import { expect, it } from 'vitest';
import {
  loadStructuredDemoData,
  saveStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import { initialState } from '../app/machine';
import { clearImprovementFixture, evaluateRedness } from '../domain/evidence/redness';
import type { EvidenceRecordData } from '../domain/model';
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
