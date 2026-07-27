import { describe, expect, it, vi } from 'vitest';
import {
  HD_REDNESS_PROTOCOL,
  SD_REDNESS_PROTOCOL,
  type SkinAnalysisProvider,
  type SkinAnalysisSignal,
} from '../adapters/analysis/youcam/contracts';
import {
  analyzeLongitudinalCapture,
  LocalProtocolMismatchError,
} from '../adapters/analysis/youcam/longitudinalAnalysis';
import {
  faceValueReducer,
  initialState,
  type PhaseBFaceValueState,
} from '../app/phaseBMachine';
import type {
  CaptureMetadata,
  DurableSkinSignal,
} from '../domain/model';
import {
  PROTOTYPE_CALIBRATION_LIMITATION,
  analysisResultFromComparison,
  compareRednessSignals,
  normalizeSkinAnalysisSignal,
  summarizeCalibration,
  translateProviderError,
} from '../domain/youcamEvidence';
import { toPersistedDemoData } from '../adapters/persistence/localObservationStore';

const metadata = (kind: 'baseline' | 'followup', id = kind): CaptureMetadata => ({
  id,
  kind,
  source: 'file',
  mimeType: 'image/jpeg',
  createdAt: kind === 'baseline'
    ? '2026-07-01T12:00:00.000Z'
    : '2026-07-27T12:00:00.000Z',
  orientationRule: 'analysis-unmirrored',
});

const durableSignal = (
  rawScore: number,
  kind: 'baseline' | 'followup' = 'baseline',
): DurableSkinSignal => ({
  provider: 'youcam',
  apiVersion: '2.1',
  mode: 'hd',
  concern: 'hd_redness',
  region: null,
  scoreType: 'raw_score',
  captureProtocolVersion: 'face-value-youcam-1',
  rawScore,
  capturedAt: metadata(kind).createdAt,
  captureQuality: 'accepted',
});

const cameraState = (kind: 'baseline' | 'followup'): PhaseBFaceValueState => ({
  ...initialState,
  stage: 'camera',
  captureKind: kind,
  selectedSpecimenId: 'one-thing',
  assignedJob: 'Reduce visible redness',
  observation: kind === 'baseline' ? 'baseline_pending' : 'active_stable',
  longitudinalEvidence: kind === 'baseline'
    ? initialState.longitudinalEvidence
    : {
        protocol: { ...HD_REDNESS_PROTOCOL },
        baseline: durableSignal(93.3356),
        followUp: null,
        comparison: null,
      },
});

describe('Phase B provider normalization', () => {
  it('normalizes an official-shaped signal and strips provider task identity by construction', () => {
    const providerSignal: SkinAnalysisSignal & { ui_score: number } = {
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      rawScore: 93.3356,
      ui_score: 99,
      capturedAt: '2026-07-01T12:00:00.000Z',
      captureQuality: 'accepted',
      providerTaskId: 'task-private-123',
    };

    const durable = normalizeSkinAnalysisSignal(providerSignal);
    expect(durable.rawScore).toBe(93.3356);
    expect(JSON.stringify(durable)).not.toContain('providerTaskId');
    expect(JSON.stringify(durable)).not.toContain('ui_score');
  });

  it('rejects non-finite provider scores', () => {
    expect(() => normalizeSkinAnalysisSignal({
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      rawScore: Number.NaN,
      capturedAt: '2026-07-01T12:00:00.000Z',
      captureQuality: 'accepted',
      providerTaskId: 'task-private-123',
    })).toThrow(/frozen Phase B contract/);
  });

  it('rejects protocol drift before invoking the provider', async () => {
    const provider: SkinAnalysisProvider = {
      analyzeCapture: vi.fn(),
    };

    await expect(analyzeLongitudinalCapture({
      provider,
      role: 'followup',
      image: new Blob(['face'], { type: 'image/jpeg' }),
      metadata: metadata('followup'),
      frozenProtocol: SD_REDNESS_PROTOCOL,
    })).rejects.toBeInstanceOf(LocalProtocolMismatchError);
    expect(provider.analyzeCapture).not.toHaveBeenCalled();
  });
});

describe('Phase B comparison engine', () => {
  it.each([
    [93.3356, 100, 'favorable'],
    [100, 93.3356, 'unfavorable'],
    [93.3356, 93.3356, 'unchanged'],
  ] as const)('maps %s to %s deterministically', (baseline, followUp, direction) => {
    const comparison = compareRednessSignals(
      durableSignal(baseline),
      durableSignal(followUp, 'followup'),
    );
    expect(comparison.delta).toBe(followUp - baseline);
    expect(comparison.direction).toBe(direction);
    expect(comparison.calibration).toBe('pending');
    expect(comparison.confidence).toBe('possible');
    expect(comparison.limitations).toContain(PROTOTYPE_CALIBRATION_LIMITATION);
    expect(String(comparison.delta)).not.toContain('%');
  });

  it('never promotes pre-calibration direction above Possible', () => {
    const result = analysisResultFromComparison(compareRednessSignals(
      durableSignal(93.3356),
      durableSignal(100, 'followup'),
    ));
    expect(result.finding).toBe('Favorable direction detected');
    expect(result.confidence).toBe('possible');
    expect(result.recommendedAction).toBe('wait');
    expect(result.claimBoundary).not.toMatch(/proved|clinically significant|effective|cured|treated|guaranteed/i);
  });
});

describe('Phase B reducer transitions', () => {
  it('freezes an accepted baseline and ignores duplicate or stale acceptance', () => {
    const started = faceValueReducer(cameraState('baseline'), {
      type: 'BASELINE_ANALYSIS_STARTED',
      requestId: 'request-1',
      metadata: metadata('baseline'),
    });
    const duplicate = faceValueReducer(started, {
      type: 'BASELINE_ANALYSIS_STARTED',
      requestId: 'request-2',
      metadata: metadata('baseline', 'duplicate'),
    });
    expect(duplicate.activeAnalysisRequestId).toBe('request-1');

    const stale = faceValueReducer(started, {
      type: 'BASELINE_ANALYSIS_ACCEPTED',
      requestId: 'stale-request',
      protocol: HD_REDNESS_PROTOCOL,
      signal: durableSignal(12),
    });
    expect(stale.longitudinalEvidence.baseline).toBeNull();

    const accepted = faceValueReducer(started, {
      type: 'BASELINE_ANALYSIS_ACCEPTED',
      requestId: 'request-1',
      protocol: HD_REDNESS_PROTOCOL,
      signal: durableSignal(93.3356),
    });
    expect(accepted.stage).toBe('observation');
    expect(accepted.longitudinalEvidence.protocol).toEqual(HD_REDNESS_PROTOCOL);
    expect(accepted.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
  });

  it('does not advance a failed baseline and preserves an accepted baseline on follow-up failure', () => {
    const baselineStarted = faceValueReducer(cameraState('baseline'), {
      type: 'BASELINE_ANALYSIS_STARTED',
      requestId: 'baseline-request',
      metadata: metadata('baseline'),
    });
    const baselineFailed = faceValueReducer(baselineStarted, {
      type: 'BASELINE_ANALYSIS_FAILED',
      requestId: 'baseline-request',
      error: translateProviderError('analysis_timeout', 'baseline'),
    });
    expect(baselineFailed.stage).toBe('camera');
    expect(baselineFailed.longitudinalEvidence.baseline).toBeNull();

    const followUpStarted = faceValueReducer(cameraState('followup'), {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'followup-request',
      metadata: metadata('followup'),
    });
    const followUpFailed = faceValueReducer(followUpStarted, {
      type: 'FOLLOWUP_ANALYSIS_FAILED',
      requestId: 'followup-request',
      error: translateProviderError('error_src_face_too_small', 'followup'),
    });
    expect(followUpFailed.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
    expect(followUpFailed.longitudinalEvidence.followUp).toBeNull();
  });

  it('creates a comparison only after both durable signals exist', () => {
    const incomplete = faceValueReducer({
      ...cameraState('followup'),
      stage: 'analysis',
    }, { type: 'COMPARISON_CREATED' });
    expect(incomplete.analysis).toBeNull();

    const started = faceValueReducer(cameraState('followup'), {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'followup-request',
      metadata: metadata('followup'),
    });
    const accepted = faceValueReducer(started, {
      type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
      requestId: 'followup-request',
      signal: durableSignal(100, 'followup'),
    });
    const compared = faceValueReducer(accepted, { type: 'COMPARISON_CREATED' });
    expect(compared.analysis?.finding).toBe('Favorable direction detected');
    expect(compared.longitudinalEvidence.comparison?.delta).toBeCloseTo(6.6644);
  });

  it('cancellation and stale completion preserve prior durable evidence', () => {
    const started = faceValueReducer(cameraState('followup'), {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'followup-request',
      metadata: metadata('followup'),
    });
    const cancelled = faceValueReducer(started, {
      type: 'ANALYSIS_CANCELLED',
      requestId: 'followup-request',
    });
    expect(cancelled.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
    expect(cancelled.longitudinalEvidence.followUp).toBeNull();

    const stale = faceValueReducer(cancelled, {
      type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
      requestId: 'followup-request',
      signal: durableSignal(100, 'followup'),
    });
    expect(stale.longitudinalEvidence.followUp).toBeNull();
  });
});

describe('Phase B privacy and calibration', () => {
  it('serializes durable evidence without transient or image-adjacent values', () => {
    const state: PhaseBFaceValueState = {
      ...initialState,
      assignedJob: 'Reduce visible redness',
      selectedSpecimenId: 'one-thing',
      baselineCapture: metadata('baseline'),
      followupCapture: metadata('followup'),
      longitudinalEvidence: {
        protocol: { ...HD_REDNESS_PROTOCOL },
        baseline: durableSignal(93.3356),
        followUp: durableSignal(100, 'followup'),
        comparison: compareRednessSignals(
          durableSignal(93.3356),
          durableSignal(100, 'followup'),
        ),
      },
      activeAnalysisRequestId: 'providerTaskId-should-not-persist',
    };
    const serialized = JSON.stringify(toPersistedDemoData(state));
    for (const forbidden of [
      'YOUCAM_API_KEY',
      'YOUCAM_SPIKE_TOKEN',
      'Authorization: Bearer',
      'providerTaskId',
      'data:image',
      'blob:',
      'signed provider',
      'temporary mask',
      'raw provider payload',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('calculates memory-only calibration statistics without a threshold', () => {
    expect(summarizeCalibration([93, 94, 92])).toEqual({
      scores: [93, 94, 92],
      consecutiveDeltas: [1, -2],
      absoluteConsecutiveDeltas: [1, 2],
      medianAbsoluteDelta: 1.5,
      maxAbsoluteDelta: 2,
      minimumScore: 92,
      maximumScore: 94,
    });
  });

  it('translates provider codes without exposing them in consumer copy', () => {
    const translated = translateProviderError('error_src_face_too_small', 'baseline');
    expect(translated.message).toBe('Move closer so your face fills more of the frame.');
    expect(translated.message).not.toContain('error_src_face_too_small');
  });
});
