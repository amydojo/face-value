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
  analysisResultFromRednessEvaluation,
  buildMvpRednessEvaluation,
  rednessComparisonFromEvaluation,
} from '../adapters/analysis/youcam/rednessEvidenceAdapter';
import { toPersistedDemoData } from '../adapters/persistence/localObservationStore';
import { faceValueReducer, initialState, type PhaseBFaceValueState } from '../app/phaseBMachine';
import type { CaptureMetadata, DurableSkinSignal } from '../domain/model';
import {
  normalizeSkinAnalysisSignal,
  summarizeCalibration,
  translateProviderError,
} from '../domain/youcamEvidence';
import { createRegisteredProduct, emptyCaptureContext } from '../domain/phaseB5';

const metadata = (kind: 'baseline' | 'followup', id: string = kind): CaptureMetadata => ({
  id,
  kind,
  source: 'file',
  mimeType: 'image/jpeg',
  createdAt: kind === 'baseline' ? '2026-07-01T12:00:00.000Z' : '2026-07-27T12:00:00.000Z',
  orientationRule: 'analysis-unmirrored',
});

const signal = (
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

const evaluatePair = (baselineRawScore: number, followUpRawScore: number) =>
  buildMvpRednessEvaluation({
    trialId: 'FV–014',
    product: createRegisteredProduct(
      { brand: 'Naturium', productName: 'Azelaic Topical Acid' },
      metadata('baseline').createdAt,
    ),
    baseline: signal(baselineRawScore),
    endpoint: signal(followUpRawScore, 'followup'),
    baselineCapture: metadata('baseline'),
    endpointCapture: metadata('followup'),
    baselineContext: emptyCaptureContext(),
    endpointContext: emptyCaptureContext(),
    disturbance: 'none',
  });

const cameraState = (kind: 'baseline' | 'followup'): PhaseBFaceValueState => ({
  ...initialState,
  stage: 'camera',
  captureKind: kind,
  selectedSpecimenId: 'one-thing',
  assignedJob: 'Reduce visible redness',
  longitudinalEvidence:
    kind === 'baseline'
      ? initialState.longitudinalEvidence
      : {
          protocol: { ...HD_REDNESS_PROTOCOL },
          baseline: signal(93.3356),
          followUp: null,
          comparison: null,
        },
});

describe('Phase B provider boundary', () => {
  it('normalizes raw_score and strips raw provider task identity and ui_score', () => {
    const providerSignal: SkinAnalysisSignal & {
      providerTaskId: string;
      ui_score: number;
    } = {
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      rawScore: 93.3356,
      ui_score: 99,
      capturedAt: metadata('baseline').createdAt,
      captureQuality: 'accepted',
      ephemeralTaskReference: 'task-private',
      providerTaskId: 'raw-provider-field',
    };
    const durable = normalizeSkinAnalysisSignal(providerSignal);
    expect(durable.rawScore).toBe(93.3356);
    expect(JSON.stringify(durable)).not.toMatch(/providerTaskId|ui_score|ephemeralTaskReference/);
  });

  it('rejects non-finite scores', () => {
    expect(() =>
      normalizeSkinAnalysisSignal({
        provider: 'youcam',
        apiVersion: '2.1',
        mode: 'hd',
        concern: 'hd_redness',
        region: null,
        rawScore: Number.NaN,
        capturedAt: metadata('baseline').createdAt,
        captureQuality: 'accepted',
        ephemeralTaskReference: 'task-private',
      }),
    ).toThrow(/frozen Phase B contract/);
  });

  it('rejects protocol drift before provider invocation', async () => {
    const provider: SkinAnalysisProvider = { analyzeCapture: vi.fn() };
    await expect(
      analyzeLongitudinalCapture({
        provider,
        role: 'followup',
        image: new Blob(['face'], { type: 'image/jpeg' }),
        metadata: metadata('followup'),
        frozenProtocol: SD_REDNESS_PROTOCOL,
      }),
    ).rejects.toBeInstanceOf(LocalProtocolMismatchError);
    expect(provider.analyzeCapture).not.toHaveBeenCalled();
  });

  it('marks accepted guided-camera blobs for the existing YouCam handoff', async () => {
    const analyzeCapture = vi.fn(async () => ({
      provider: 'youcam' as const,
      apiVersion: '2.1' as const,
      mode: 'hd' as const,
      concern: 'hd_redness' as const,
      region: null,
      rawScore: 93.3356,
      capturedAt: metadata('baseline').createdAt,
      captureQuality: 'accepted' as const,
      ephemeralTaskReference: 'ephemeral-task',
    }));
    const guidedMetadata = {
      ...metadata('baseline'),
      source: 'camera' as const,
    };

    await analyzeLongitudinalCapture({
      provider: { analyzeCapture },
      role: 'baseline',
      image: new Blob(['face'], { type: 'image/jpeg' }),
      metadata: guidedMetadata,
      frozenProtocol: null,
    });

    expect(analyzeCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: HD_REDNESS_PROTOCOL,
        fromCameraKit: true,
      }),
    );
  });

  it('translates a connection interruption without provider jargon', () => {
    expect(translateProviderError('network_interrupted', 'followup')).toMatchObject({
      message: 'Connection interrupted. This scan was not added.',
      retryable: true,
    });
  });
});

describe('Phase B deterministic comparison', () => {
  it.each([
    [93.3356, 100, 'favorable'],
    [100, 93.3356, 'unfavorable'],
    [93.3356, 93.3356, 'unchanged'],
  ] as const)('maps %s and %s to %s', (baseline, followUp, direction) => {
    const evaluation = evaluatePair(baseline, followUp);
    const comparison = rednessComparisonFromEvaluation(evaluation);
    expect(comparison.delta).toBe(followUp - baseline);
    expect(comparison.direction).toBe(direction);
    expect(comparison.calibration).toBe('provisional_fixture');
    expect(comparison.confidence).toBe('possible');
    expect(comparison.limitations).toContain(
      'Production thresholds require repeat-scan calibration.',
    );
  });

  it('maps a higher raw score to favorable condition language without implying efficacy', () => {
    const result = analysisResultFromRednessEvaluation(evaluatePair(94.96, 95.69));
    expect(result.finding).toBe('No detectable improvement showed up.');
    expect(result.nonFinding).toBe(
      'Comparable scans did not establish progress on the assigned visible-redness job.',
    );
    expect(result.relevantContext).toContain('not yet strong or consistent');
    expect(result.limitations).toContain('Production thresholds require repeat-scan calibration.');
    expect(result.confidence).toBe('possible');
    expect(result.recommendedAction).toBe('wait');
    expect(result.claimBoundary).not.toMatch(
      /proved|clinically significant|effective|cured|treated|guaranteed/i,
    );
  });

  it('represents the current one-scan MVP honestly and reports every uncollected input', () => {
    const evaluation = evaluatePair(93.3356, 100);

    expect(evaluation.baseline.sessionCount).toBe(1);
    expect(evaluation.endpoint.sessionCount).toBe(1);
    expect(evaluation.baseline.acceptedRawScores).toEqual([93.3356]);
    expect(evaluation.endpoint.acceptedRawScores).toEqual([100]);
    expect(evaluation.measurementQuality).toBe('limited');
    expect(evaluation.evidenceQuality).toBe('possible');
    expect(evaluation.patientAnchor).toBeNull();
    expect(evaluation.maskEvidence).toEqual({});
    expect(evaluation.tolerance).toBeNull();
    expect(evaluation.adherence.status).toBe('unknown');
    expect(evaluation.missingEvidence).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/patient-observed/i),
        expect.stringMatching(/mask and facial-registration/i),
        expect.stringMatching(/symptoms and tolerance/i),
        expect.stringMatching(/adherence/i),
      ]),
    );
  });

  it('turns an unexpected ui_score into an explicit invalid evaluation', () => {
    const baseline = {
      ...signal(93.3356),
      ui_score: 100,
    } as DurableSkinSignal;
    const evaluation = buildMvpRednessEvaluation({
      trialId: 'FV–014',
      product: createRegisteredProduct(
        { brand: 'Naturium', productName: 'Azelaic Topical Acid' },
        metadata('baseline').createdAt,
      ),
      baseline,
      endpoint: signal(100, 'followup'),
      baselineCapture: metadata('baseline'),
      endpointCapture: metadata('followup'),
      baselineContext: emptyCaptureContext(),
      endpointContext: emptyCaptureContext(),
      disturbance: 'none',
    });

    expect(evaluation.measurementQuality).toBe('invalid');
    expect(evaluation.triggeredRuleIds).toContain('R01_UI_SCORE_REJECTED');
    expect(evaluation.interpretation.recommendedAction).toBe('test_longer');
    expect(evaluation).not.toHaveProperty('ui_score');
  });

  it('treats unresolved or retained product overlap as an attribution blocker', () => {
    for (const disturbance of ['detected', 'overlap_retained'] as const) {
      const evaluation = buildMvpRednessEvaluation({
        trialId: `FV–${disturbance}`,
        product: createRegisteredProduct(
          { brand: 'Naturium', productName: 'Azelaic Topical Acid' },
          metadata('baseline').createdAt,
        ),
        baseline: signal(93.3356),
        endpoint: signal(100, 'followup'),
        baselineCapture: metadata('baseline'),
        endpointCapture: metadata('followup'),
        baselineContext: emptyCaptureContext(),
        endpointContext: emptyCaptureContext(),
        disturbance,
      });

      expect(evaluation.secondProductStatus).toBe('active_overlap');
      expect(evaluation.attributionQuality).toBe('blocked');
      expect(evaluation.interpretation.recommendedAction).toBe('retry_alone');
    }
  });

  it.each([
    [
      100,
      93.3356,
      'Visible redness worsened across comparable scans.',
      'The result does not diagnose a reaction or establish why redness changed.',
    ],
    [
      93.3356,
      93.3356,
      'No detectable improvement showed up.',
      'Comparable scans did not establish progress on the assigned visible-redness job.',
    ],
  ] as const)(
    'uses honest non-favorable copy for %s to %s',
    (baseline, followUp, finding, support) => {
      const result = analysisResultFromRednessEvaluation(evaluatePair(baseline, followUp));
      expect(result.finding).toBe(finding);
      expect(result.nonFinding).toBe(support);
    },
  );
});

describe('Phase B reducer legality and idempotency', () => {
  it('freezes one baseline and ignores duplicate and stale attempts', () => {
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
      requestId: 'stale',
      protocol: HD_REDNESS_PROTOCOL,
      signal: signal(12),
    });
    expect(stale.longitudinalEvidence.baseline).toBeNull();
    const accepted = faceValueReducer(started, {
      type: 'BASELINE_ANALYSIS_ACCEPTED',
      requestId: 'request-1',
      protocol: HD_REDNESS_PROTOCOL,
      signal: signal(93.3356),
    });
    expect(accepted.stage).toBe('observation');
    expect(accepted.longitudinalEvidence.protocol).toEqual(HD_REDNESS_PROTOCOL);
  });

  it('preserves baseline on failure, cancellation, and stale follow-up completion', () => {
    const started = faceValueReducer(cameraState('followup'), {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'followup',
      metadata: metadata('followup'),
    });
    const failed = faceValueReducer(started, {
      type: 'FOLLOWUP_ANALYSIS_FAILED',
      requestId: 'followup',
      error: translateProviderError('error_src_face_too_small', 'followup'),
    });
    expect(failed.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
    const cancelled = faceValueReducer(started, {
      type: 'ANALYSIS_CANCELLED',
      requestId: 'followup',
    });
    const stale = faceValueReducer(cancelled, {
      type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
      requestId: 'followup',
      signal: signal(100, 'followup'),
    });
    expect(stale.longitudinalEvidence.followUp).toBeNull();
  });

  it('creates no result from incomplete evidence and one result from a matched pair', () => {
    const incomplete = faceValueReducer(
      { ...cameraState('followup'), stage: 'analysis' },
      { type: 'COMPARISON_CREATED' },
    );
    expect(incomplete.analysis).toBeNull();
    const started = faceValueReducer(cameraState('followup'), {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'followup',
      metadata: metadata('followup'),
    });
    const accepted = faceValueReducer(started, {
      type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
      requestId: 'followup',
      signal: signal(100, 'followup'),
    });
    const compared = faceValueReducer(accepted, { type: 'COMPARISON_CREATED' });
    expect(compared.analysis?.finding).toBe('Visible redness moved in a favorable direction.');
    expect(compared.longitudinalEvidence.comparison?.delta).toBeCloseTo(6.6644);
    expect(compared.longitudinalEvidence.evaluation).toBeDefined();
  });
});

describe('Phase B privacy and calibration', () => {
  it('serializes no transient provider or image data', () => {
    const evaluation = evaluatePair(93.3356, 100);
    const state: PhaseBFaceValueState = {
      ...initialState,
      longitudinalEvidence: {
        protocol: { ...HD_REDNESS_PROTOCOL },
        baseline: signal(93.3356),
        followUp: signal(100, 'followup'),
        comparison: rednessComparisonFromEvaluation(evaluation),
        evaluation,
      },
      activeAnalysisRequestId: 'ephemeral-secret',
    };
    const serialized = JSON.stringify(toPersistedDemoData(state));
    expect(serialized).not.toMatch(
      /YOUCAM_API_KEY|YOUCAM_SPIKE_TOKEN|Authorization: Bearer|providerTaskId|ephemeralTaskReference|data:image|blob:|signed provider|temporary mask|raw provider payload/,
    );
  });

  it('calculates memory-only calibration statistics without inventing a threshold', () => {
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
});
