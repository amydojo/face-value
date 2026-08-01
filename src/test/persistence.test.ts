import { expect, it } from 'vitest';
import {
  loadStructuredDemoData,
  saveStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import { HD_REDNESS_PROTOCOL } from '../adapters/analysis/youcam/contracts';
import { initialState } from '../app/machine';
import { clearImprovementFixture, evaluateRedness } from '../domain/evidence/redness';
import type { EvidenceRecordData, RednessEvidenceBurst } from '../domain/model';
import { verdictViewModelFromRecord } from '../features/verdict/verdictViewModel';

const legacyRecord: EvidenceRecordData = {
  id: 'ER-LEGACY',
  specimenId: 'legacy-product',
  accession: 'FV–001',
  product: 'Legacy Redness Product',
  productBrand: 'Face Value',
  job: 'Reduce visible redness',
  observationWindow: 'Legacy baseline to follow-up',
  comparison: 'comparable',
  finding: 'Legacy saved finding.',
  nonFinding: 'Legacy saved limitation.',
  confidence: 'possible',
  disturbance: 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary: 'Legacy claim boundary.',
  createdAt: '2026-06-01T12:00:00.000Z',
  includesFaceImage: false,
};

const burst = (role: 'baseline' | 'followup', scores: number[]): RednessEvidenceBurst => ({
  burstId: `${role}-burst`,
  role,
  sessionId: `${role}-session`,
  captureProfileId: 'native-browser-camera-v1',
  startedAt: `2026-07-${role === 'baseline' ? '01' : '30'}T12:00:00.000Z`,
  completedAt: `2026-07-${role === 'baseline' ? '01' : '30'}T12:00:01.000Z`,
  attemptedFrameCount: 3,
  acceptedFrames: scores.map((rawScore, index) => {
    const frameId = `${role}-frame-${index + 1}`;
    const capturedAt = `2026-07-${role === 'baseline' ? '01' : '30'}T12:00:00.00${index + 1}Z`;
    return {
      frameId,
      capture: {
        id: frameId,
        kind: role,
        source: 'camera',
        mimeType: 'image/jpeg',
        createdAt: capturedAt,
        orientationRule: 'analysis-unmirrored',
        cameraProfileId: 'native-browser-camera-v1',
      },
      quality: {
        currentFrame: 'accepted',
        exposure: 'accepted',
        movement: 'accepted',
      },
      signal: {
        provider: 'youcam',
        apiVersion: '2.1',
        mode: 'hd',
        concern: 'hd_redness',
        region: null,
        scoreType: 'raw_score',
        captureProtocolVersion: 'face-value-youcam-1',
        rawScore,
        capturedAt,
        captureQuality: 'accepted',
      },
      providerAttemptCount: 1,
    };
  }),
  rejectedFrames: [],
});

it('persists structured scan metadata without images or object URLs', () => {
  const state = {
    ...initialState,
    assignedJob: 'Post-acne pigmentation',
    observation: 'review_due' as const,
    baselineCapture: {
      id: 'baseline',
      kind: 'baseline' as const,
      source: 'file' as const,
      mimeType: 'image/jpeg' as const,
      createdAt: '2026-07-12T18:00:00.000Z',
      orientationRule: 'analysis-unmirrored' as const,
    },
    followupCapture: {
      id: 'followup',
      kind: 'followup' as const,
      source: 'file' as const,
      mimeType: 'image/jpeg' as const,
      createdAt: '2026-07-24T18:00:00.000Z',
      orientationRule: 'analysis-unmirrored' as const,
    },
  };
  const data = toPersistedDemoData(state);

  expect(data.baselineCapture?.id).toBe('baseline');
  expect(data.followupCapture?.id).toBe('followup');
  expect(JSON.stringify(data)).not.toMatch(/blob:|data:image|objectURL|imageBytes|base64/);
  saveStructuredDemoData(state);
  expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/blob:|data:image/);
  expect(loadStructuredDemoData()).toMatchObject({
    assignedJob: 'Post-acne pigmentation',
    observation: 'review_due',
    baselineCapture: { id: 'baseline', kind: 'baseline' },
    followupCapture: { id: 'followup', kind: 'followup' },
  });
});

it('backfills older structured data without capture metadata', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedDrawerIndex: 0,
      selectedSpecimenId: 'fermented-essence',
      assignedJob: 'Post-acne pigmentation',
      observation: 'active_stable',
      placement: 'observation',
      placementSealed: false,
      comparison: 'not_available',
      confidence: 'insufficient',
      disturbance: 'none',
      trace: null,
      analysis: null,
      record: null,
      archive: [],
    }),
  );

  expect(loadStructuredDemoData()).toMatchObject({
    baselineCapture: null,
    followupCapture: null,
  });
});

it('keeps a versioned canonical evaluation byte-stable after persistence', () => {
  const snapshot = evaluateRedness(structuredClone(clearImprovementFixture));
  const record: EvidenceRecordData = {
    ...legacyRecord,
    id: 'ER-CANONICAL',
    accession: 'FV–014',
    finding: snapshot.interpretation.finding,
    nonFinding: snapshot.interpretation.nonFinding,
    confidence: snapshot.evidenceQuality,
    finalPlacement: 'established',
    recommendedAction: 'keep',
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    createdAt: snapshot.evaluatedAt,
    rednessEvaluation: snapshot,
  };
  const serializedSnapshot = JSON.stringify(snapshot);

  saveStructuredDemoData({
    ...initialState,
    stage: 'record',
    record,
    archive: [record],
  });

  const futureInput = structuredClone(clearImprovementFixture);
  futureInput.threshold = {
    version: 'future-calibration-test-only',
    source: 'technical_calibration',
    activeN95: 20,
    configHash: 'future-calibration-test-only',
    provisional: false,
  };
  evaluateRedness(futureInput);

  const restored = loadStructuredDemoData();
  expect(JSON.stringify(restored?.archive[0].rednessEvaluation)).toBe(serializedSnapshot);
  expect(restored?.archive[0].rednessEvaluation?.threshold.version).toBe('redness-provisional-v1');
});

it('reloads complete face-free bursts and never persists the partial active generation', () => {
  const baselineBurst = burst('baseline', [90.25, 92.5, 91.75]);
  const data = toPersistedDemoData({
    ...initialState,
    stage: 'camera',
    assignedJob: 'Reduce visible redness',
    longitudinalEvidence: {
      protocol: { ...HD_REDNESS_PROTOCOL },
      baseline: null,
      followUp: null,
      baselineBurst,
      followUpBurst: null,
      comparison: null,
      evaluation: null,
    },
    activeRednessBurst: {
      generationId: 'runtime-only-generation',
      burstId: 'runtime-only-burst',
      role: 'followup',
      sessionId: 'runtime-only-session',
      captureProfileId: null,
      startedAt: '2026-07-30T12:30:00.000Z',
      attemptedFrameCount: 1,
      capturedFrames: [],
      acceptedFrames: [],
      rejectedFrames: [
        {
          frameId: 'runtime-only-rejection',
          attemptedAt: '2026-07-30T12:30:00.001Z',
          stage: 'capture',
          reasons: ['movement above accepted range'],
        },
      ],
      providerRequests: [],
      protocol: { ...HD_REDNESS_PROTOCOL },
      status: 'capturing',
    },
  });
  const serialized = JSON.stringify(data);
  expect(serialized).not.toContain('runtime-only-generation');
  expect(serialized).not.toMatch(/Blob|blob:|data:image|base64|objectURL|MediaStream/);

  localStorage.setItem(STORAGE_KEY, serialized);
  const restored = loadStructuredDemoData();
  expect(
    restored?.longitudinalEvidence.baselineBurst?.acceptedFrames.map(
      (frame) => frame.signal.rawScore,
    ),
  ).toEqual([90.25, 92.5, 91.75]);
  expect(restored?.longitudinalEvidence.baselineBurst?.captureProfileId).toBe(
    'native-browser-camera-v1',
  );
});

it('fails closed when a persisted burst is stored under the wrong period role', () => {
  const data = toPersistedDemoData({
    ...initialState,
    assignedJob: 'Reduce visible redness',
    longitudinalEvidence: {
      protocol: { ...HD_REDNESS_PROTOCOL },
      baseline: null,
      followUp: null,
      baselineBurst: burst('baseline', [90, 91, 92]),
      followUpBurst: null,
      comparison: null,
      evaluation: null,
    },
  });
  const malformed = structuredClone(data);
  malformed.longitudinalEvidence.baselineBurst!.role = 'followup';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(malformed));

  expect(loadStructuredDemoData()).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

it('keeps a pre-burst signal and its saved snapshot unchanged without inventing a burst', () => {
  const snapshot = evaluateRedness(structuredClone(clearImprovementFixture));
  const capturedAt = '2026-06-01T12:00:00.000Z';
  const legacySignal = {
    provider: 'youcam' as const,
    apiVersion: '2.1' as const,
    mode: 'hd' as const,
    concern: 'hd_redness' as const,
    region: null,
    scoreType: 'raw_score' as const,
    captureProtocolVersion: 'face-value-youcam-1' as const,
    rawScore: 93.3356,
    capturedAt,
    captureQuality: 'accepted' as const,
  };
  const savedSnapshotBytes = JSON.stringify(snapshot);
  saveStructuredDemoData({
    ...initialState,
    assignedJob: 'Reduce visible redness',
    longitudinalEvidence: {
      protocol: { ...HD_REDNESS_PROTOCOL },
      baseline: legacySignal,
      followUp: null,
      comparison: null,
      evaluation: snapshot,
    },
  });

  const restored = loadStructuredDemoData();
  expect(restored?.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
  expect(restored?.longitudinalEvidence.baselineBurst).toBeNull();
  expect(JSON.stringify(restored?.longitudinalEvidence.evaluation)).toBe(savedSnapshotBytes);
});

it('keeps pre-engine saved records readable without inventing a snapshot', () => {
  saveStructuredDemoData({
    ...initialState,
    stage: 'record',
    record: legacyRecord,
    archive: [legacyRecord],
  });

  const restored = loadStructuredDemoData();
  const restoredRecord = restored?.archive[0];
  expect(restoredRecord?.rednessEvaluation).toBeUndefined();
  expect(verdictViewModelFromRecord(restoredRecord!)).toMatchObject({
    headline: 'Legacy saved finding.',
    explanation: 'Legacy saved limitation.',
    evidenceQuality: 'POSSIBLE',
  });
});

it('deletes malformed persisted data instead of hydrating it', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ observation: 'invented-state' }));
  expect(loadStructuredDemoData()).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
