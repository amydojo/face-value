import {
  analysisResultFromRednessEvaluation,
  placementForRednessAction,
  rednessComparisonFromEvaluation,
} from '../../adapters/analysis/youcam/rednessEvidenceAdapter';
import { HD_REDNESS_PROTOCOL } from '../../adapters/analysis/youcam/contracts';
import { createOracleEvidenceRecord } from '../../app/phaseBMachine';
import {
  initialState,
  normalizeTrialTruthState,
  type TrialTruthFaceValueState,
} from '../../app/trialTruthMachine';
import {
  canonicalRednessFixtures,
  evaluateRedness,
  type RednessEvaluationSnapshot,
} from '../../domain/evidence/redness';
import type {
  AnalysisResult,
  CaptureContext,
  CaptureMetadata,
  DurableSkinSignal,
  EvidenceRecordData,
  RegisteredProduct,
} from '../../domain/model';
import { openCurrentSavedResultRoute } from './evidenceRecordDemoAdapter';
import {
  canonicalKeyForDemoFixture,
  type DemoResultFixtureId,
  type DemoStartingPoint,
} from '../../domain/demoLab';
import { FOLLOW_UP_INTERVAL_DAYS, addCalendarDays } from '../../domain/phaseB5';
import { anchorRelationshipFor, trialTruthEvidenceFromSnapshot } from '../../domain/trialTruth';

const DEMO_PRODUCT = {
  accession: 'DEMO 01',
  brand: 'Face Value Lab',
  productName: 'One Thing Redness Trial',
  strength: '10%',
  volume: '30 ml',
} as const;

const emptyContext: CaptureContext = {
  makeup: false,
  recentHeatOrExercise: false,
  recentCleansingOrSkincare: false,
  routineOrTreatmentChange: false,
  note: 'Synthetic canonical fixture. No physical capture was used.',
};

function firstCapturedAt(
  snapshot: RednessEvaluationSnapshot,
  period: 'baseline' | 'endpoint',
): string {
  const session = snapshot[period].sessions[0];
  if (!session) {
    throw new Error(`Canonical fixture has no ${period} session.`);
  }
  return session.capturedAt;
}

function requiredMedian(value: number | null, period: 'baseline' | 'follow-up'): number {
  if (value === null) {
    throw new Error(`Canonical fixture has no ${period} raw-score median.`);
  }
  return value;
}

function signal(rawScore: number, capturedAt: string): DurableSkinSignal {
  return {
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
  };
}

function capture(kind: 'baseline' | 'followup', createdAt: string): CaptureMetadata {
  return {
    id: `demo-synthetic-${kind}`,
    kind,
    source: 'file',
    mimeType: 'image/unknown',
    createdAt,
    orientationRule: 'analysis-unmirrored',
    cameraProfileId: null,
  };
}

function registeredProduct(
  snapshot: RednessEvaluationSnapshot,
  createdAt: string,
): RegisteredProduct {
  return {
    id: snapshot.productId,
    ...DEMO_PRODUCT,
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...snapshot.expectedObservationWindowDays,
    },
    createdAt,
  };
}

function demoRecord(
  state: TrialTruthFaceValueState,
  snapshot: RednessEvaluationSnapshot,
): EvidenceRecordData {
  const created = createOracleEvidenceRecord({
    ...state,
    oracleCommittedAt: snapshot.evaluatedAt,
  });
  if (!created) {
    throw new Error('Canonical demo state could not create a saved result.');
  }
  const evidence = state.trialTruthEvidence;
  return {
    ...created,
    demoOriginated: true,
    includesFaceImage: false,
    trialTruth: evidence ?? undefined,
    anchorRelationship: evidence
      ? anchorRelationshipFor(snapshot.effectClassification, evidence.patientAnchor)
      : undefined,
  };
}

function evaluatedState(resultFixture: DemoResultFixtureId): {
  state: TrialTruthFaceValueState;
  snapshot: RednessEvaluationSnapshot;
  record: EvidenceRecordData;
} {
  const canonicalKey = canonicalKeyForDemoFixture(resultFixture);
  const fixtureInput = structuredClone(canonicalRednessFixtures[canonicalKey]);
  if (resultFixture === 'contradictory_anchor') {
    fixtureInput.patientAnchor = {
      visibleChange: -1,
      recordedAt: fixtureInput.evaluatedAt,
    };
  }
  const snapshot = evaluateRedness(fixtureInput);
  const baselineAt = firstCapturedAt(snapshot, 'baseline');
  const followUpAt = firstCapturedAt(snapshot, 'endpoint');
  const baseline = signal(requiredMedian(snapshot.baselineRawMedian, 'baseline'), baselineAt);
  const followUp = signal(requiredMedian(snapshot.endpointRawMedian, 'follow-up'), followUpAt);
  const product = registeredProduct(snapshot, baselineAt);
  const analysis: AnalysisResult = {
    ...analysisResultFromRednessEvaluation(snapshot),
    provider: 'fixture',
    simulated: true,
  };
  const compatibilityComparison = rednessComparisonFromEvaluation(snapshot);
  const generationId = `${product.id}:${followUp.capturedAt}`;
  const trialTruthEvidence =
    resultFixture === 'legacy_trial_truth_not_collected'
      ? null
      : trialTruthEvidenceFromSnapshot(snapshot, generationId);
  const state: TrialTruthFaceValueState = {
    ...initialState,
    stage: 'analysis',
    cabinet: 'open',
    observation: 'review_due',
    camera: 'captured',
    comparison: analysis.comparison,
    confidence: snapshot.evidenceQuality,
    processing: 'succeeded',
    disturbance: snapshot.attributionQuality === 'blocked' ? 'overlap_retained' : 'none',
    placement: placementForRednessAction(snapshot.interpretation.recommendedAction),
    placementSealed: false,
    selectedSpecimenId: product.id,
    assignedJob: product.assignedJob,
    captureKind: 'followup',
    contractOutcome:
      analysis.comparison === 'not_comparable'
        ? 'not_comparable'
        : analysis.comparison === 'not_available'
          ? null
          : analysis.comparison,
    baselineCapture: capture('baseline', baselineAt),
    followupCapture: capture('followup', followUpAt),
    analysis,
    record: null,
    archive: [],
    announcement: 'Synthetic canonical result ready.',
    returnStage: null,
    longitudinalEvidence: {
      protocol: { ...HD_REDNESS_PROTOCOL },
      baseline,
      followUp,
      comparison: compatibilityComparison,
      evaluation: snapshot,
    },
    registeredProduct: product,
    baselineLockedAt: baselineAt,
    followUpEligibleAt: followUpAt,
    baselineContext: { ...emptyContext },
    followUpContext: { ...emptyContext },
    demoTimelineAdvanced: true,
    resultRevealed: false,
    oracleRevealState: 'sealed',
    oracleEvidenceDispensed: false,
    oracleCollectionStarted: false,
    oracleCommittedAt: null,
    trialTruthDraft: {
      adherence: null,
      tolerance: null,
      symptoms: [],
      visibleChange: null,
    },
    trialTruthEvidence,
    trialTruthValidation: null,
  };

  return {
    state,
    snapshot,
    record: demoRecord(state, snapshot),
  };
}

function registeredState(state: TrialTruthFaceValueState): TrialTruthFaceValueState {
  return {
    ...state,
    stage: 'job',
    cabinet: 'closed',
    observation: 'baseline_pending',
    camera: 'idle',
    comparison: 'not_available',
    confidence: 'insufficient',
    processing: 'idle',
    disturbance: 'none',
    placement: 'observation',
    placementSealed: false,
    captureKind: 'baseline',
    contractOutcome: null,
    baselineCapture: null,
    followupCapture: null,
    analysis: null,
    record: null,
    archive: [],
    longitudinalEvidence: {
      protocol: null,
      baseline: null,
      followUp: null,
      comparison: null,
      evaluation: null,
    },
    baselineLockedAt: null,
    followUpEligibleAt: null,
    baselineContext: null,
    followUpContext: null,
    resultRevealed: false,
    oracleRevealState: 'sealed',
    oracleEvidenceDispensed: false,
    oracleCollectionStarted: false,
    oracleCommittedAt: null,
    returnStage: 'product_registration',
    announcement: 'Synthetic registered product ready.',
  };
}

function baselineOnlyState(
  state: TrialTruthFaceValueState,
  stage: 'baseline_locked' | 'waiting_for_followup' | 'followup_ready',
): TrialTruthFaceValueState {
  const followUpEligibleAt = state.baselineLockedAt
    ? addCalendarDays(state.baselineLockedAt, FOLLOW_UP_INTERVAL_DAYS)
    : state.followUpEligibleAt;
  return {
    ...state,
    stage,
    observation:
      stage === 'followup_ready'
        ? 'review_due'
        : stage === 'waiting_for_followup'
          ? 'waiting'
          : 'active_stable',
    camera: 'captured',
    comparison: 'not_available',
    confidence: 'insufficient',
    processing: 'succeeded',
    captureKind: stage === 'followup_ready' ? 'followup' : 'baseline',
    contractOutcome: null,
    followupCapture: null,
    analysis: null,
    record: null,
    archive: [],
    longitudinalEvidence: {
      ...state.longitudinalEvidence,
      followUp: null,
      comparison: null,
      evaluation: null,
    },
    followUpContext: null,
    resultRevealed: false,
    oracleRevealState: 'sealed',
    oracleEvidenceDispensed: false,
    oracleCollectionStarted: false,
    oracleCommittedAt: null,
    returnStage: null,
    followUpEligibleAt,
    demoTimelineAdvanced: stage === 'followup_ready',
    announcement:
      stage === 'followup_ready'
        ? 'Synthetic follow-up state ready.'
        : stage === 'waiting_for_followup'
          ? 'Synthetic active trial is waiting for follow-up eligibility.'
          : 'Synthetic baseline locked.',
  };
}

function completedState(
  state: TrialTruthFaceValueState,
  record: EvidenceRecordData,
): TrialTruthFaceValueState {
  return {
    ...state,
    stage: 'analysis',
    observation: 'complete',
    placementSealed: true,
    record,
    archive: [record],
    resultRevealed: true,
    oracleRevealState: 'collected',
    oracleEvidenceDispensed: true,
    oracleCollectionStarted: false,
    oracleCommittedAt: record.createdAt,
    announcement: 'Synthetic result saved.',
  };
}

function homeWithSavedResult(record: EvidenceRecordData): TrialTruthFaceValueState {
  return {
    ...initialState,
    stage: 'cabinet',
    cabinet: 'open',
    record,
    archive: [record],
    resultRevealed: true,
    oracleRevealState: 'done',
    oracleEvidenceDispensed: true,
    oracleCommittedAt: record.createdAt,
    announcement: 'Synthetic saved result opened on Home.',
  };
}

export function buildDemoFixtureState(
  startingPoint: DemoStartingPoint,
  resultFixture: DemoResultFixtureId,
): TrialTruthFaceValueState {
  const evaluated = evaluatedState(resultFixture);
  const registered = registeredState(evaluated.state);

  switch (startingPoint) {
    case 'new_trial':
      return {
        ...initialState,
        announcement: 'Synthetic preview opened at the ordinary trial entry.',
      };
    case 'product_registered':
      return registered;
    case 'baseline_ready':
      return {
        ...registered,
        stage: 'camera',
        camera: 'idle',
        returnStage: 'job',
        announcement: 'Synthetic baseline entry ready.',
      };
    case 'baseline_locked':
      return baselineOnlyState(evaluated.state, 'baseline_locked');
    case 'trial_pending':
      return baselineOnlyState(evaluated.state, 'waiting_for_followup');
    case 'followup_ready':
      return baselineOnlyState(evaluated.state, 'followup_ready');
    case 'trial_truth':
      return {
        ...evaluated.state,
        stage: 'followup_context',
        analysis: null,
        comparison: 'not_available',
        confidence: 'insufficient',
        processing: 'idle',
        longitudinalEvidence: {
          ...evaluated.state.longitudinalEvidence,
          comparison: null,
          evaluation: null,
        },
        trialTruthEvidence: null,
        trialTruthValidation: null,
        announcement: 'Synthetic follow-up secured. Trial truth is required.',
      };
    case 'comparison_processing':
      return {
        ...evaluated.state,
        analysis: null,
        comparison: 'not_available',
        confidence: 'insufficient',
        processing: 'running',
        longitudinalEvidence: {
          ...evaluated.state.longitudinalEvidence,
          comparison: null,
          evaluation: null,
        },
        announcement: 'Synthetic scans are being compared.',
      };
    case 'verdict_ready':
      return evaluated.state;
    case 'cassette_revealed':
      return {
        ...evaluated.state,
        resultRevealed: true,
        oracleRevealState: 'verdict_revealed',
        announcement: 'Synthetic canonical verdict revealed.',
      };
    case 'evidence_recorded':
      return completedState(evaluated.state, evaluated.record);
    case 'home_saved_result':
      return homeWithSavedResult(evaluated.record);
    case 'previous_trials':
      return {
        ...homeWithSavedResult(evaluated.record),
        stage: 'archive',
        returnStage: 'cabinet',
        announcement: 'One synthetic previous trial.',
      };
    case 'saved_result':
    case 'evidence_record_reasoning_expanded':
    case 'evidence_record_full_technical_expanded':
      return normalizeTrialTruthState(
        openCurrentSavedResultRoute(homeWithSavedResult(evaluated.record), evaluated.record),
      );
  }
}
