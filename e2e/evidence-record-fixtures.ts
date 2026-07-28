import type { Page } from '@playwright/test';
import {
  analysisResultFromRednessEvaluation,
  placementForRednessAction,
} from '../src/adapters/analysis/youcam/rednessEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../src/domain/evidence/redness';
import type {
  EvidenceRecordData,
  RecommendedAction,
  RegisteredProduct,
} from '../src/domain/model';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

const EMPTY_CONTEXT = {
  makeup: false,
  recentHeatOrExercise: false,
  recentCleansingOrSkincare: false,
  routineOrTreatmentChange: false,
  note: null,
};

function compatibilityAction(
  action: RednessEvaluationSnapshot['interpretation']['recommendedAction'],
): RecommendedAction {
  switch (action) {
    case 'keep':
      return 'keep';
    case 'test_longer':
      return 'wait';
    case 'retry_alone':
    case 'not_proving_job':
      return 'reassess';
    case 'safety_interruption':
      return 'seek_professional_guidance';
  }
}

export function evidenceRecordForSnapshot(
  snapshot: RednessEvaluationSnapshot,
  options: {
    id?: string;
    accession?: string;
    productName?: string;
    productBrand?: string;
    note?: string | null;
  } = {},
): EvidenceRecordData {
  const action = snapshot.interpretation.recommendedAction;
  return {
    id: options.id ?? `ER-${snapshot.trialId}`,
    specimenId: snapshot.productId,
    accession: options.accession ?? 'FV–035',
    product: options.productName ?? 'One Thing',
    productBrand: options.productBrand ?? 'Lab Dojo',
    job: 'Reduce visible redness',
    observationWindow: `${snapshot.baseline.sessions[0]?.capturedAt ?? snapshot.evaluatedAt} to ${
      snapshot.endpoint.sessions[0]?.capturedAt ?? snapshot.evaluatedAt
    }`,
    comparison:
      snapshot.measurementQuality === 'invalid'
        ? 'not_comparable'
        : snapshot.attributionQuality === 'blocked'
          ? 'partially_comparable'
          : 'comparable',
    finding: snapshot.interpretation.finding,
    nonFinding: snapshot.interpretation.nonFinding,
    confidence: snapshot.evidenceQuality,
    disturbance: snapshot.secondProductStatus === 'active_overlap' ? 'overlap_retained' : 'none',
    finalPlacement: placementForRednessAction(action),
    recommendedAction: compatibilityAction(action),
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    createdAt: snapshot.evaluatedAt,
    includesFaceImage: false,
    note: options.note,
    evidenceSource: 'YouCam Skin Analysis v2.1',
    comparisonDirection:
      snapshot.rawScoreDelta === null
        ? undefined
        : snapshot.rawScoreDelta > 0
          ? 'favorable'
          : snapshot.rawScoreDelta < 0
            ? 'unfavorable'
            : 'unchanged',
    limitations: [...snapshot.interpretation.limitations],
    baselineRawScore: snapshot.baselineRawMedian ?? undefined,
    followUpRawScore: snapshot.endpointRawMedian ?? undefined,
    baselineContext: EMPTY_CONTEXT,
    followUpContext: EMPTY_CONTEXT,
    demoOriginated: false,
    rednessEvaluation: snapshot,
  };
}

export function legacyEvidenceRecord(
  canonicalRecord: EvidenceRecordData,
): EvidenceRecordData {
  const legacy = { ...canonicalRecord };
  delete legacy.rednessEvaluation;
  delete legacy.baselineRawScore;
  delete legacy.followUpRawScore;
  delete legacy.evidenceSource;
  delete legacy.limitations;
  return {
    ...legacy,
    id: 'ER-EARLIER-RESULT',
    accession: 'FV–012',
    product: 'Earlier Saved Serum',
    productBrand: 'Lab Dojo',
    finding: 'A favorable change showed up.',
    nonFinding: 'The earlier result did not retain detailed measurement evidence.',
    note: 'Saved before detailed evidence records were introduced.',
  };
}

export function persistedRecordState(
  referenceSnapshot: RednessEvaluationSnapshot,
  record: EvidenceRecordData,
  stage: 'record' | 'archive' = 'record',
) {
  const evaluation = record.rednessEvaluation ?? null;
  const product: RegisteredProduct = {
    id: record.specimenId,
    accession: record.accession,
    brand: record.productBrand ?? 'Face Value',
    productName: record.product,
    strength: record.productStrength ?? null,
    volume: record.productVolume ?? null,
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...referenceSnapshot.expectedObservationWindowDays,
    },
    createdAt: referenceSnapshot.baseline.sessions[0]?.capturedAt ?? record.createdAt,
  };

  return {
    ...persistedSealedTrial,
    stage,
    selectedSpecimenId: product.id,
    assignedJob: product.assignedJob,
    observation: 'complete',
    placement: record.finalPlacement,
    placementSealed: true,
    comparison: record.comparison,
    confidence: record.confidence,
    disturbance: record.disturbance,
    analysis: evaluation ? analysisResultFromRednessEvaluation(evaluation) : null,
    record,
    archive: [record],
    longitudinalEvidence: {
      protocol: null,
      baseline: null,
      followUp: null,
      comparison: null,
      evaluation,
    },
    registeredProduct: product,
    baselineLockedAt: referenceSnapshot.baseline.sessions[0]?.capturedAt ?? record.createdAt,
    followUpEligibleAt: referenceSnapshot.endpoint.sessions[0]?.capturedAt ?? record.createdAt,
    baselineContext: EMPTY_CONTEXT,
    followUpContext: EMPTY_CONTEXT,
    demoTimelineAdvanced: false,
    resultRevealed: true,
    oracleRevealState: 'collected',
    oracleEvidenceDispensed: true,
    oracleCollectionStarted: true,
    oracleCommittedAt: record.createdAt,
  } as const;
}

export async function loadRecordState(
  page: Page,
  state: ReturnType<typeof persistedRecordState>,
): Promise<void> {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: state,
  });
  await page.reload();
}
