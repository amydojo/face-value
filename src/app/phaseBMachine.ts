import {
  HD_REDNESS_PROTOCOL,
  protocolsMatch,
  type AnalysisProtocol,
} from '../adapters/analysis/youcam/contracts';
import {
  analysisResultFromRednessEvaluation,
  buildMvpRednessEvaluation,
  placementForRednessAction,
  rednessComparisonFromEvaluation,
} from '../adapters/analysis/youcam/rednessEvidenceAdapter';
import type {
  AnalysisErrorState,
  ActiveRednessBurst,
  CapturedRednessFrame,
  CaptureContext,
  CaptureMetadata,
  DurableSkinSignal,
  EvidenceRecordData,
  FaceValueState,
  LongitudinalSkinEvidence,
  ProductPlacement,
  RednessEvidenceBurst,
  RejectedRednessFrame,
  RegisteredProduct,
} from '../domain/model';
import {
  initialOracleRevealModel,
  oracleRevealReducer,
  type OracleRevealEvent,
  type OracleRevealModel,
  type OracleRevealState,
} from '../domain/oracleRevealMachine';
import { oracleTrialIdentity } from '../domain/oracleTrialIdentity';
import { REDNESS_MVP_OBSERVATION_WINDOW } from '../domain/evidence/redness';
import {
  REDNESS_BURST_MAX_CAPTURE_ATTEMPTS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
  baselineEvidenceCapturedAt,
  followUpEvidenceCapturedAt,
  hasBaselineEvidence,
  hasFollowUpEvidence,
  isCompleteRednessEvidenceBurst,
} from '../domain/rednessEvidenceBurst';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  addCalendarDays,
  defaultPlacementForResult,
  emptyCaptureContext,
  followUpIsEligible,
  isValidRegisteredProduct,
  normalizeCaptureContext,
} from '../domain/phaseB5';
import {
  createEvidenceRecord,
  faceValueReducer as legacyFaceValueReducer,
  initialState as legacyInitialState,
  type FaceValueEvent as LegacyFaceValueEvent,
} from './machine';

export type PhaseBFaceValueState = FaceValueState & {
  longitudinalEvidence: LongitudinalSkinEvidence;
  analysisRole: 'baseline' | 'followup' | null;
  activeAnalysisRequestId: string | null;
  pendingAnalysisCapture: CaptureMetadata | null;
  analysisError: AnalysisErrorState | null;
  registeredProduct: RegisteredProduct | null;
  baselineLockedAt: string | null;
  followUpEligibleAt: string | null;
  baselineContext: CaptureContext | null;
  followUpContext: CaptureContext | null;
  demoTimelineAdvanced: boolean;
  resultRevealed: boolean;
  oracleRevealState: OracleRevealState;
  oracleEvidenceDispensed: boolean;
  oracleCollectionStarted: boolean;
  oracleCommittedAt: string | null;
  activeRednessBurst: ActiveRednessBurst | null;
};

export type PhaseBFaceValueEvent =
  | LegacyFaceValueEvent
  | { type: 'START_PRODUCT_REGISTRATION' }
  | { type: 'REGISTER_PRODUCT'; product: RegisteredProduct }
  | {
      type: 'CAPTURE_CONTEXT_RECORDED';
      kind: 'baseline' | 'followup';
      context: CaptureContext;
    }
  | { type: 'FINISH_BASELINE_SESSION' }
  | { type: 'CHECK_FOLLOWUP_ELIGIBILITY'; now: string }
  | { type: 'ADVANCE_DEMO_TIMELINE'; now: string }
  | { type: 'REVEAL_STARTED' }
  | { type: 'REVEAL_PULL_COMPLETED' }
  | { type: 'TRANSMISSION_COMPLETED' }
  | {
      type: 'RECOMMENDATION_ACCEPTED';
      placement: ProductPlacement;
      now: string;
    }
  | { type: 'DISPENSE_STARTED' }
  | { type: 'EVIDENCE_DISPENSED' }
  | { type: 'EVIDENCE_COLLECTION_STARTED' }
  | { type: 'EVIDENCE_COLLECTED' }
  | { type: 'ORACLE_DONE' }
  // Phase B.5 compatibility aliases. Production controls use the events above.
  | { type: 'REVEAL_RESULT' }
  | {
      type: 'COMMIT_RESULT_AND_RELEASE';
      placement: ProductPlacement;
      now: string;
    }
  | {
      type: 'BASELINE_ANALYSIS_STARTED';
      requestId: string;
      metadata: CaptureMetadata;
    }
  | {
      type: 'BASELINE_ANALYSIS_ACCEPTED';
      requestId: string;
      protocol: AnalysisProtocol;
      signal: DurableSkinSignal;
    }
  | {
      type: 'BASELINE_ANALYSIS_FAILED';
      requestId: string;
      error: AnalysisErrorState;
    }
  | { type: 'BASELINE_RETRY_REQUESTED' }
  | {
      type: 'FOLLOWUP_ANALYSIS_STARTED';
      requestId: string;
      metadata: CaptureMetadata;
    }
  | {
      type: 'FOLLOWUP_ANALYSIS_ACCEPTED';
      requestId: string;
      signal: DurableSkinSignal;
    }
  | {
      type: 'FOLLOWUP_ANALYSIS_FAILED';
      requestId: string;
      error: AnalysisErrorState;
    }
  | {
      type: 'REDNESS_BURST_STARTED';
      generationId: string;
      burstId: string;
      sessionId: string;
      role: 'baseline' | 'followup';
      startedAt: string;
    }
  | {
      type: 'REDNESS_BURST_CAPTURE_REJECTED';
      generationId: string;
      frame: RejectedRednessFrame;
    }
  | {
      type: 'REDNESS_BURST_FRAME_CAPTURED';
      generationId: string;
      frame: CapturedRednessFrame;
    }
  | { type: 'REDNESS_BURST_CAPTURE_COMPLETED'; generationId: string }
  | {
      type: 'REDNESS_BURST_ANALYSIS_STARTED';
      generationId: string;
      frameId: string;
      requestId: string;
      attempt: 1 | 2;
    }
  | {
      type: 'REDNESS_BURST_ANALYSIS_ACCEPTED';
      generationId: string;
      frameId: string;
      requestId: string;
      attempt: 1 | 2;
      protocol: AnalysisProtocol;
      signal: DurableSkinSignal;
    }
  | {
      type: 'REDNESS_BURST_ANALYSIS_FAILED';
      generationId: string;
      frameId: string;
      requestId: string;
      attempt: 1 | 2;
      terminal: boolean;
      error: AnalysisErrorState;
    }
  | {
      type: 'REDNESS_BURST_COMMIT_REQUESTED';
      generationId: string;
      completedAt: string;
    }
  | { type: 'REDNESS_BURST_PRESENTATION_COMPLETED'; generationId: string }
  | {
      type: 'REDNESS_BURST_FAILED';
      generationId: string;
      error: AnalysisErrorState;
    }
  | { type: 'REDNESS_BURST_CANCELLED'; generationId: string }
  | { type: 'COMPARISON_CREATED' }
  | { type: 'COMPARISON_REJECTED'; error: AnalysisErrorState }
  | { type: 'ANALYSIS_CANCELLED'; requestId: string };

export type FaceValueEvent = PhaseBFaceValueEvent;

export const createEmptyLongitudinalEvidence = (): LongitudinalSkinEvidence => ({
  protocol: null,
  baseline: null,
  followUp: null,
  baselineBurst: null,
  followUpBurst: null,
  comparison: null,
  evaluation: null,
});

export const initialState: PhaseBFaceValueState = {
  ...legacyInitialState,
  longitudinalEvidence: createEmptyLongitudinalEvidence(),
  analysisRole: null,
  activeAnalysisRequestId: null,
  pendingAnalysisCapture: null,
  analysisError: null,
  registeredProduct: null,
  baselineLockedAt: null,
  followUpEligibleAt: null,
  baselineContext: null,
  followUpContext: null,
  demoTimelineAdvanced: false,
  resultRevealed: false,
  oracleRevealState: initialOracleRevealModel.phase,
  oracleEvidenceDispensed: initialOracleRevealModel.evidenceDispensed,
  oracleCollectionStarted: initialOracleRevealModel.collectionStarted,
  oracleCommittedAt: null,
  activeRednessBurst: null,
};

export function normalizePhaseBState(state: FaceValueState): PhaseBFaceValueState {
  const legacyOracleState: OracleRevealState =
    state.stage === 'record' && state.record
      ? 'collected'
      : state.placementSealed && state.record
        ? 'dispensing'
        : state.resultRevealed
          ? 'verdict_revealed'
          : 'sealed';
  return {
    ...state,
    longitudinalEvidence: state.longitudinalEvidence
      ? {
          ...state.longitudinalEvidence,
          baselineBurst: state.longitudinalEvidence.baselineBurst ?? null,
          followUpBurst: state.longitudinalEvidence.followUpBurst ?? null,
          evaluation: state.longitudinalEvidence.evaluation ?? null,
        }
      : createEmptyLongitudinalEvidence(),
    analysisRole: state.analysisRole ?? null,
    activeAnalysisRequestId: state.activeAnalysisRequestId ?? null,
    pendingAnalysisCapture: state.pendingAnalysisCapture ?? null,
    analysisError: state.analysisError ?? null,
    registeredProduct: state.registeredProduct ?? null,
    baselineLockedAt: state.baselineLockedAt ?? null,
    followUpEligibleAt: state.followUpEligibleAt ?? null,
    baselineContext: state.baselineContext ?? null,
    followUpContext: state.followUpContext ?? null,
    demoTimelineAdvanced: state.demoTimelineAdvanced ?? false,
    resultRevealed: state.resultRevealed ?? false,
    oracleRevealState: state.oracleRevealState ?? legacyOracleState,
    oracleEvidenceDispensed:
      state.oracleEvidenceDispensed ?? Boolean(state.placementSealed && state.record),
    oracleCollectionStarted: state.oracleCollectionStarted ?? false,
    oracleCommittedAt:
      state.oracleCommittedAt ?? (state.placementSealed ? (state.record?.createdAt ?? null) : null),
    activeRednessBurst: state.activeRednessBurst ?? null,
  };
}

const isCurrentRequest = (state: PhaseBFaceValueState, requestId: string): boolean =>
  state.activeAnalysisRequestId === requestId;

const isCurrentBurst = (
  state: PhaseBFaceValueState,
  generationId: string,
): state is PhaseBFaceValueState & { activeRednessBurst: ActiveRednessBurst } =>
  state.activeRednessBurst?.generationId === generationId;

const burstHasFrameId = (burst: ActiveRednessBurst, frameId: string): boolean =>
  burst.capturedFrames.some((frame) => frame.frameId === frameId) ||
  burst.rejectedFrames.some((frame) => frame.frameId === frameId);

const baselineCaptureProfileFor = (
  state: PhaseBFaceValueState,
): CaptureMetadata['cameraProfileId'] =>
  (isCompleteRednessEvidenceBurst(state.longitudinalEvidence.baselineBurst)
    ? state.longitudinalEvidence.baselineBurst.captureProfileId
    : null) ??
  state.baselineCapture?.cameraProfileId ??
  null;

const signalMatchesProtocol = (signal: DurableSkinSignal, protocol: AnalysisProtocol): boolean =>
  signal.provider === protocol.provider &&
  signal.apiVersion === protocol.apiVersion &&
  signal.mode === protocol.mode &&
  signal.concern === protocol.concern &&
  signal.region === protocol.region &&
  signal.scoreType === protocol.scoreType &&
  signal.captureProtocolVersion === protocol.captureProtocolVersion;

const burstAttemptLimitError = (role: 'baseline' | 'followup'): AnalysisErrorState => ({
  role,
  code: 'burst_attempts_exhausted',
  message:
    'Three valid measurements could not be secured within five attempts. Try the scan again.',
  retryable: true,
});

function completedBurstFrom(
  active: ActiveRednessBurst,
  completedAt: string,
): RednessEvidenceBurst | null {
  const burst: RednessEvidenceBurst = {
    burstId: active.burstId,
    role: active.role,
    sessionId: active.sessionId,
    captureProfileId: active.captureProfileId,
    startedAt: active.startedAt,
    completedAt,
    attemptedFrameCount: active.attemptedFrameCount,
    acceptedFrames: active.acceptedFrames.map((frame) => ({
      ...frame,
      capture: { ...frame.capture },
      quality: { ...frame.quality },
      signal: { ...frame.signal },
    })),
    rejectedFrames: active.rejectedFrames.map((frame) => ({
      ...frame,
      reasons: [...frame.reasons],
    })),
  };
  return isCompleteRednessEvidenceBurst(burst) ? burst : null;
}

const oracleModelFor = (state: PhaseBFaceValueState): OracleRevealModel => ({
  phase: state.oracleRevealState,
  evidenceDispensed: state.oracleEvidenceDispensed,
  collectionStarted: state.oracleCollectionStarted,
});

const applyOracleEvent = (
  state: PhaseBFaceValueState,
  event: OracleRevealEvent,
): PhaseBFaceValueState => {
  const current = oracleModelFor(state);
  const next = oracleRevealReducer(current, event);
  if (next === current) return state;
  return {
    ...state,
    oracleRevealState: next.phase,
    oracleEvidenceDispensed: next.evidenceDispensed,
    oracleCollectionStarted: next.collectionStarted,
  };
};

function enrichRecord(state: PhaseBFaceValueState, record: EvidenceRecordData): EvidenceRecordData {
  const comparison = state.longitudinalEvidence.comparison;
  const evaluation = state.longitudinalEvidence.evaluation;
  if (!comparison || !evaluation || state.analysis?.provider !== 'youcam') return record;

  return {
    ...record,
    observationWindow: `${state.baselineLockedAt ?? state.baselineCapture?.createdAt ?? 'Baseline'} to ${state.followupCapture?.createdAt ?? 'follow-up'}`,
    evidenceSource: 'YouCam Skin Analysis v2.1',
    comparisonDirection: comparison.direction,
    limitations: [...comparison.limitations],
    baselineRawScore: comparison.baselineRawScore,
    followUpRawScore: comparison.followUpRawScore,
    productBrand: state.registeredProduct?.brand,
    productStrength: state.registeredProduct?.strength,
    productVolume: state.registeredProduct?.volume,
    baselineContext: state.baselineContext,
    followUpContext: state.followUpContext,
    demoOriginated: state.demoTimelineAdvanced,
    rednessEvaluation: evaluation,
  };
}

export function createOracleEvidenceRecord(state: PhaseBFaceValueState): EvidenceRecordData | null {
  if (!state.oracleCommittedAt || !state.analysis || !state.assignedJob) {
    return null;
  }
  const record = enrichRecord(state, createEvidenceRecord(state, state.oracleCommittedAt));
  return record;
}

function enrichSavedRecord(
  previous: PhaseBFaceValueState,
  next: PhaseBFaceValueState,
): PhaseBFaceValueState {
  if (!next.record) return next;
  const enriched = enrichRecord(previous, next.record);

  return {
    ...next,
    record: enriched,
    archive: next.archive.map((record) => (record.id === enriched.id ? enriched : record)),
  };
}

function productForRednessEvaluation(
  state: PhaseBFaceValueState,
  baselineCapturedAt: string,
): RegisteredProduct {
  if (state.registeredProduct) return state.registeredProduct;
  return {
    id: state.selectedSpecimenId || 'legacy-redness-product',
    accession: 'LEGACY',
    brand: 'FACE VALUE',
    productName: state.selectedSpecimenId || 'Legacy redness trial',
    strength: null,
    volume: null,
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...REDNESS_MVP_OBSERVATION_WINDOW,
    },
    createdAt: baselineCapturedAt,
  };
}

function placementForAnalysis(analysis: NonNullable<PhaseBFaceValueState['analysis']>) {
  return analysis.rednessEvaluation
    ? placementForRednessAction(analysis.rednessEvaluation.interpretation.recommendedAction)
    : defaultPlacementForResult(analysis);
}

export function faceValueReducer(
  rawState: PhaseBFaceValueState,
  event: PhaseBFaceValueEvent,
): PhaseBFaceValueState {
  const state = normalizePhaseBState(rawState);

  switch (event.type) {
    case 'START_PRODUCT_REGISTRATION':
      if (state.stage !== 'welcome' && state.stage !== 'cabinet') return state;
      return {
        ...state,
        stage: 'product_registration',
        cabinet: 'closed',
        announcement: 'Product registration opened.',
      };

    case 'REGISTER_PRODUCT':
      if (state.stage !== 'product_registration' || !isValidRegisteredProduct(event.product)) {
        return state;
      }
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
        selectedSpecimenId: event.product.id,
        selectedDrawerIndex: 0,
        assignedJob: event.product.assignedJob,
        captureKind: 'baseline',
        contractOutcome: null,
        baselineCapture: null,
        followupCapture: null,
        trace: null,
        analysis: null,
        record: null,
        longitudinalEvidence: createEmptyLongitudinalEvidence(),
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        registeredProduct: { ...event.product },
        baselineLockedAt: null,
        followUpEligibleAt: null,
        baselineContext: null,
        followUpContext: null,
        demoTimelineAdvanced: false,
        resultRevealed: false,
        oracleRevealState: 'sealed',
        oracleEvidenceDispensed: false,
        oracleCollectionStarted: false,
        oracleCommittedAt: null,
        returnStage: 'product_registration',
        announcement: `${event.product.brand} ${event.product.productName} registered for visible redness.`,
      };

    case 'BEGIN_CAPTURE':
      if (!state.registeredProduct) {
        return normalizePhaseBState(legacyFaceValueReducer(state, event as LegacyFaceValueEvent));
      }

      if (event.kind === 'baseline') {
        if (
          state.stage !== 'job' ||
          hasBaselineEvidence(state.longitudinalEvidence) ||
          state.processing === 'running'
        ) {
          return state;
        }
      } else {
        if (
          !event.now ||
          !hasBaselineEvidence(state.longitudinalEvidence) ||
          hasFollowUpEvidence(state.longitudinalEvidence) ||
          ![
            'waiting_for_followup',
            'followup_ready',
            'cabinet',
            'analysis_failure',
            'comparison_refused',
          ].includes(state.stage) ||
          !followUpIsEligible({
            followUpEligibleAt: state.followUpEligibleAt,
            demoTimelineAdvanced: state.demoTimelineAdvanced,
            now: event.now,
          })
        ) {
          return state;
        }
      }

      return {
        ...state,
        stage: 'camera',
        captureKind: event.kind,
        camera: 'idle',
        processing: 'idle',
        analysisError: null,
        activeRednessBurst: null,
        returnStage: event.kind === 'baseline' ? 'job' : 'followup_ready',
        announcement:
          event.kind === 'baseline'
            ? 'Guided baseline capture opened.'
            : 'Guided follow-up capture opened.',
      };

    case 'CAPTURE_CONTEXT_RECORDED': {
      const context = normalizeCaptureContext(event.context);
      if (
        event.kind === 'baseline' &&
        (state.stage === 'baseline_context' || state.stage === 'baseline_locked') &&
        hasBaselineEvidence(state.longitudinalEvidence)
      ) {
        return {
          ...state,
          stage: 'baseline_locked',
          baselineContext: context,
          announcement: `Baseline locked. Follow-up is scheduled in ${FOLLOW_UP_INTERVAL_DAYS} days.`,
        };
      }
      if (
        event.kind === 'followup' &&
        state.stage === 'followup_context' &&
        hasFollowUpEvidence(state.longitudinalEvidence)
      ) {
        return {
          ...state,
          stage: 'analysis',
          followUpContext: context,
          processing: 'idle',
          announcement: 'Comparing against your baseline.',
        };
      }
      return state;
    }

    case 'FINISH_BASELINE_SESSION':
      if (state.stage !== 'baseline_locked' || !hasBaselineEvidence(state.longitudinalEvidence)) {
        return state;
      }
      return {
        ...state,
        stage: 'waiting_for_followup',
        cabinet: 'open',
        observation: 'active_stable',
        returnStage: null,
        announcement: 'Your trial is running. Follow-up is not available yet.',
      };

    case 'CHECK_FOLLOWUP_ELIGIBILITY':
      if (
        !['waiting_for_followup', 'cabinet'].includes(state.stage) ||
        hasFollowUpEvidence(state.longitudinalEvidence) ||
        !followUpIsEligible({
          followUpEligibleAt: state.followUpEligibleAt,
          demoTimelineAdvanced: state.demoTimelineAdvanced,
          now: event.now,
        })
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'followup_ready',
        observation: 'review_due',
        announcement: 'Follow-up ready. Let’s see what changed.',
      };

    case 'ADVANCE_DEMO_TIMELINE':
      if (
        !state.registeredProduct ||
        !hasBaselineEvidence(state.longitudinalEvidence) ||
        hasFollowUpEvidence(state.longitudinalEvidence) ||
        !['waiting_for_followup', 'cabinet'].includes(state.stage)
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'followup_ready',
        observation: 'review_due',
        demoTimelineAdvanced: true,
        announcement: 'Demo timeline advanced explicitly. The original baseline date is unchanged.',
      };

    case 'REVEAL_STARTED': {
      if (
        state.stage !== 'analysis' ||
        !state.analysis ||
        !state.longitudinalEvidence.comparison ||
        state.oracleRevealState !== 'sealed'
      ) {
        return state;
      }
      const next = applyOracleEvent(state, event);
      return {
        ...next,
        placement: placementForAnalysis(state.analysis),
        placementSealed: false,
        announcement: 'Reveal started. Preparing the result.',
      };
    }

    case 'REVEAL_PULL_COMPLETED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        announcement: 'Revealing result. Preparing your evidence record.',
      };
    }

    case 'TRANSMISSION_COMPLETED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        resultRevealed: true,
        announcement: 'Result revealed. The finding and recommended next step are ready.',
      };
    }

    case 'SELECT_PLACEMENT':
      if (
        state.stage === 'analysis' &&
        state.oracleRevealState === 'verdict_revealed' &&
        !state.placementSealed
      ) {
        return {
          ...state,
          placement: event.placement,
          announcement: `Next step selected: ${event.placement.replaceAll('_', ' ')}.`,
        };
      }
      return normalizePhaseBState(legacyFaceValueReducer(state, event as LegacyFaceValueEvent));

    case 'RECOMMENDATION_ACCEPTED': {
      if (
        state.stage !== 'analysis' ||
        state.oracleRevealState !== 'verdict_revealed' ||
        !state.analysis ||
        state.placementSealed ||
        !event.now
      ) {
        return state;
      }
      const next = applyOracleEvent(state, {
        type: 'RECOMMENDATION_ACCEPTED',
      });
      if (next === state) return state;
      return {
        ...next,
        placement: event.placement,
        oracleCommittedAt: event.now,
        announcement: 'Saving your result.',
      };
    }

    case 'DISPENSE_STARTED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        announcement: 'Your evidence record is being prepared.',
      };
    }

    case 'EVIDENCE_DISPENSED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        announcement: 'Result ready. Take your evidence record.',
      };
    }

    case 'EVIDENCE_COLLECTION_STARTED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        announcement: 'Collecting the evidence record.',
      };
    }

    case 'EVIDENCE_COLLECTED': {
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      const record = state.record ?? createOracleEvidenceRecord(state);
      if (!record) return state;
      const archive = state.archive.some((item) => item.id === record.id)
        ? state.archive
        : [record, ...state.archive];
      const announcedNextStep =
        record.rednessEvaluation?.interpretation.recommendedAction.replaceAll('_', ' ') ??
        record.finalPlacement.replaceAll('_', ' ');
      return {
        ...next,
        observation: 'complete',
        placementSealed: true,
        record,
        archive,
        announcement: `Your result is saved. ${record.finding} Next: ${announcedNextStep}.`,
      };
    }

    case 'ORACLE_DONE': {
      if (!state.record) return state;
      const next = applyOracleEvent(state, event);
      if (next === state) return state;
      return {
        ...next,
        stage: 'cabinet',
        cabinet: 'open',
        observation: 'none',
        camera: 'idle',
        comparison: 'not_available',
        confidence: 'insufficient',
        processing: 'idle',
        disturbance: 'none',
        assignedJob: null,
        captureKind: 'baseline',
        contractOutcome: null,
        baselineCapture: null,
        followupCapture: null,
        trace: null,
        analysis: null,
        longitudinalEvidence: createEmptyLongitudinalEvidence(),
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        registeredProduct: null,
        baselineLockedAt: null,
        followUpEligibleAt: null,
        baselineContext: null,
        followUpContext: null,
        demoTimelineAdvanced: false,
        returnStage: null,
        announcement: 'Result saved. Returned to Your trials.',
      };
    }

    case 'REVEAL_RESULT': {
      if (
        state.stage !== 'analysis' ||
        !state.analysis ||
        !state.longitudinalEvidence.comparison ||
        state.oracleRevealState !== 'sealed'
      ) {
        return state;
      }
      const opening = applyOracleEvent(state, {
        type: 'REVEAL_STARTED',
      });
      const transmitting = applyOracleEvent(opening, {
        type: 'REVEAL_PULL_COMPLETED',
      });
      const revealed = applyOracleEvent(transmitting, {
        type: 'TRANSMISSION_COMPLETED',
      });
      return {
        ...revealed,
        placement: placementForAnalysis(state.analysis),
        resultRevealed: true,
        announcement: 'Result revealed. The finding and recommended next step are ready.',
      };
    }

    case 'COMMIT_RESULT_AND_RELEASE':
      return faceValueReducer(state, {
        type: 'RECOMMENDATION_ACCEPTED',
        placement: event.placement,
        now: event.now,
      });

    case 'REDNESS_BURST_STARTED': {
      const replacingFailedGeneration = state.activeRednessBurst?.status === 'failed';
      if (
        state.stage !== 'camera' ||
        state.captureKind !== event.role ||
        state.processing === 'running' ||
        (!replacingFailedGeneration && state.activeRednessBurst !== null) ||
        !event.generationId ||
        !event.burstId ||
        !event.sessionId ||
        !event.startedAt ||
        (event.role === 'baseline' && hasBaselineEvidence(state.longitudinalEvidence)) ||
        (event.role === 'followup' &&
          (!hasBaselineEvidence(state.longitudinalEvidence) ||
            hasFollowUpEvidence(state.longitudinalEvidence) ||
            !state.longitudinalEvidence.protocol ||
            !protocolsMatch(state.longitudinalEvidence.protocol, HD_REDNESS_PROTOCOL) ||
            (state.registeredProduct !== null &&
              !followUpIsEligible({
                followUpEligibleAt: state.followUpEligibleAt,
                demoTimelineAdvanced: state.demoTimelineAdvanced,
                now: event.startedAt,
              }))))
      ) {
        return state;
      }

      return {
        ...state,
        processing: 'idle',
        analysisRole: event.role,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: {
          generationId: event.generationId,
          burstId: event.burstId,
          role: event.role,
          sessionId: event.sessionId,
          captureProfileId: null,
          startedAt: event.startedAt,
          attemptedFrameCount: 0,
          capturedFrames: [],
          acceptedFrames: [],
          rejectedFrames: [],
          providerRequests: [],
          protocol:
            event.role === 'followup' && state.longitudinalEvidence.protocol
              ? { ...state.longitudinalEvidence.protocol }
              : null,
          status: 'capturing',
        },
        announcement: 'Three-measurement capture started.',
      };
    }

    case 'REDNESS_BURST_CAPTURE_REJECTED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'capturing' ||
        state.activeRednessBurst.attemptedFrameCount >= REDNESS_BURST_MAX_CAPTURE_ATTEMPTS ||
        event.frame.stage !== 'capture' ||
        !event.frame.frameId ||
        !event.frame.attemptedAt ||
        event.frame.reasons.length === 0 ||
        burstHasFrameId(state.activeRednessBurst, event.frame.frameId)
      ) {
        return state;
      }
      const attemptedFrameCount = state.activeRednessBurst.attemptedFrameCount + 1;
      const exhausted =
        attemptedFrameCount >= REDNESS_BURST_MAX_CAPTURE_ATTEMPTS &&
        state.activeRednessBurst.capturedFrames.length < REDNESS_BURST_REQUIRED_MEASUREMENTS;
      const error = exhausted ? burstAttemptLimitError(state.activeRednessBurst.role) : null;
      return {
        ...state,
        processing: exhausted ? 'failed' : state.processing,
        analysisError: error,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          attemptedFrameCount,
          rejectedFrames: [
            ...state.activeRednessBurst.rejectedFrames,
            {
              ...event.frame,
              reasons: [...event.frame.reasons],
            },
          ],
          status: exhausted ? 'failed' : 'capturing',
        },
        announcement: exhausted
          ? error!.message
          : 'Capture conditions changed. Replacing that measurement automatically.',
      };
    }

    case 'REDNESS_BURST_FRAME_CAPTURED': {
      const burst = state.activeRednessBurst;
      if (
        !isCurrentBurst(state, event.generationId) ||
        burst?.status !== 'capturing' ||
        burst.attemptedFrameCount >= REDNESS_BURST_MAX_CAPTURE_ATTEMPTS ||
        burst.capturedFrames.length >= REDNESS_BURST_REQUIRED_MEASUREMENTS ||
        !event.frame.frameId ||
        event.frame.capture.id !== event.frame.frameId ||
        event.frame.capture.kind !== burst.role ||
        event.frame.capture.source !== 'camera' ||
        !event.frame.capture.cameraProfileId ||
        event.frame.quality.currentFrame !== 'accepted' ||
        event.frame.quality.exposure !== 'accepted' ||
        event.frame.quality.movement !== 'accepted' ||
        burstHasFrameId(burst, event.frame.frameId) ||
        (burst.role === 'followup' &&
          baselineCaptureProfileFor(state) !== null &&
          event.frame.capture.cameraProfileId !== baselineCaptureProfileFor(state)) ||
        (burst.captureProfileId !== null &&
          event.frame.capture.cameraProfileId !== burst.captureProfileId)
      ) {
        return state;
      }

      const capturedFrames = [
        ...burst.capturedFrames,
        {
          ...event.frame,
          capture: { ...event.frame.capture },
          quality: { ...event.frame.quality },
        },
      ];
      const attemptedFrameCount = burst.attemptedFrameCount + 1;
      const exhausted =
        attemptedFrameCount >= REDNESS_BURST_MAX_CAPTURE_ATTEMPTS &&
        capturedFrames.length < REDNESS_BURST_REQUIRED_MEASUREMENTS;
      const error = exhausted ? burstAttemptLimitError(burst.role) : null;
      return {
        ...state,
        processing: exhausted ? 'failed' : state.processing,
        analysisError: error,
        activeRednessBurst: {
          ...burst,
          captureProfileId: burst.captureProfileId ?? event.frame.capture.cameraProfileId ?? null,
          attemptedFrameCount,
          capturedFrames,
          status: exhausted ? 'failed' : 'capturing',
        },
        announcement: exhausted
          ? error!.message
          : `${capturedFrames.length} of ${REDNESS_BURST_REQUIRED_MEASUREMENTS} current frames secured.`,
      };
    }

    case 'REDNESS_BURST_CAPTURE_COMPLETED':
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'capturing' ||
        state.activeRednessBurst.capturedFrames.length !== REDNESS_BURST_REQUIRED_MEASUREMENTS ||
        state.activeRednessBurst.attemptedFrameCount > REDNESS_BURST_MAX_CAPTURE_ATTEMPTS
      ) {
        return state;
      }
      return {
        ...state,
        camera: 'captured',
        processing: 'running',
        analysisRole: state.activeRednessBurst.role,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          status: 'analyzing',
        },
        announcement: 'Scan complete. You can relax.',
      };

    case 'REDNESS_BURST_ANALYSIS_STARTED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'analyzing' ||
        state.activeAnalysisRequestId !== null ||
        state.activeRednessBurst.providerRequests.some(
          (request) => request.requestId === event.requestId,
        ) ||
        state.activeRednessBurst.acceptedFrames.some((frame) => frame.frameId === event.frameId) ||
        !state.activeRednessBurst.capturedFrames.some((frame) => frame.frameId === event.frameId)
      ) {
        return state;
      }
      const frameRequests = state.activeRednessBurst.providerRequests.filter(
        (request) => request.frameId === event.frameId,
      );
      const validAttempt =
        (event.attempt === 1 && frameRequests.length === 0) ||
        (event.attempt === 2 &&
          frameRequests.length === 1 &&
          frameRequests[0].attempt === 1 &&
          frameRequests[0].status === 'failed');
      if (!validAttempt) return state;

      return {
        ...state,
        processing: 'running',
        activeAnalysisRequestId: event.requestId,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          providerRequests: [
            ...state.activeRednessBurst.providerRequests,
            {
              requestId: event.requestId,
              frameId: event.frameId,
              attempt: event.attempt,
              status: 'running',
            },
          ],
        },
        announcement:
          event.attempt === 2
            ? 'Rechecking this measurement…'
            : `Analyzing measurement ${state.activeRednessBurst.acceptedFrames.length + 1} of ${REDNESS_BURST_REQUIRED_MEASUREMENTS}.`,
      };
    }

    case 'REDNESS_BURST_ANALYSIS_ACCEPTED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'analyzing' ||
        state.activeAnalysisRequestId !== event.requestId
      ) {
        return state;
      }
      const request = state.activeRednessBurst.providerRequests.find(
        (candidate) => candidate.requestId === event.requestId,
      );
      const captured = state.activeRednessBurst.capturedFrames.find(
        (frame) => frame.frameId === event.frameId,
      );
      const frozenProtocol =
        state.activeRednessBurst.protocol ?? state.longitudinalEvidence.protocol;
      if (
        !request ||
        request.status !== 'running' ||
        request.frameId !== event.frameId ||
        request.attempt !== event.attempt ||
        !captured ||
        state.activeRednessBurst.acceptedFrames.some((frame) => frame.frameId === event.frameId) ||
        !protocolsMatch(event.protocol, HD_REDNESS_PROTOCOL) ||
        (frozenProtocol !== null && !protocolsMatch(frozenProtocol, event.protocol)) ||
        !signalMatchesProtocol(event.signal, event.protocol) ||
        !Number.isFinite(event.signal.rawScore) ||
        event.signal.captureQuality !== 'accepted' ||
        event.signal.capturedAt !== captured.capture.createdAt
      ) {
        return state;
      }

      const acceptedFrames = [
        ...state.activeRednessBurst.acceptedFrames,
        {
          ...captured,
          signal: { ...event.signal },
          providerAttemptCount: event.attempt,
        },
      ];
      const ready = acceptedFrames.length === REDNESS_BURST_REQUIRED_MEASUREMENTS;
      return {
        ...state,
        processing: ready ? 'succeeded' : 'running',
        activeAnalysisRequestId: null,
        analysisError: null,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          protocol: { ...event.protocol },
          acceptedFrames,
          providerRequests: state.activeRednessBurst.providerRequests.map((candidate) =>
            candidate.requestId === event.requestId
              ? { ...candidate, status: 'accepted' as const }
              : candidate,
          ),
          status: ready ? 'ready' : 'analyzing',
        },
        announcement: ready
          ? 'Measurements confirmed. Preparing your comparison.'
          : `Measurement ${acceptedFrames.length} confirmed.`,
      };
    }

    case 'REDNESS_BURST_ANALYSIS_FAILED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'analyzing' ||
        state.activeAnalysisRequestId !== event.requestId
      ) {
        return state;
      }
      const request = state.activeRednessBurst.providerRequests.find(
        (candidate) => candidate.requestId === event.requestId,
      );
      if (
        !request ||
        request.status !== 'running' ||
        request.frameId !== event.frameId ||
        request.attempt !== event.attempt
      ) {
        return state;
      }
      const providerRequests = state.activeRednessBurst.providerRequests.map((candidate) =>
        candidate.requestId === event.requestId
          ? { ...candidate, status: 'failed' as const }
          : candidate,
      );
      return {
        ...state,
        processing: event.terminal ? 'failed' : 'running',
        activeAnalysisRequestId: null,
        analysisError: event.terminal ? event.error : null,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          providerRequests,
          rejectedFrames: event.terminal
            ? [
                ...state.activeRednessBurst.rejectedFrames,
                {
                  frameId: event.frameId,
                  attemptedAt:
                    state.activeRednessBurst.capturedFrames.find(
                      (frame) => frame.frameId === event.frameId,
                    )?.capture.createdAt ?? state.activeRednessBurst.startedAt,
                  stage: 'provider',
                  reasons: ['provider analysis failed after bounded retry'],
                },
              ]
            : state.activeRednessBurst.rejectedFrames,
          status: event.terminal ? 'failed' : 'analyzing',
        },
        announcement: event.terminal ? event.error.message : 'Rechecking this measurement…',
      };
    }

    case 'REDNESS_BURST_COMMIT_REQUESTED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'ready' ||
        !state.activeRednessBurst.protocol
      ) {
        return state;
      }
      const completed = completedBurstFrom(state.activeRednessBurst, event.completedAt);
      if (!completed) return state;
      const primaryCapture = completed.acceptedFrames[0].capture;

      if (completed.role === 'baseline') {
        if (
          hasBaselineEvidence(state.longitudinalEvidence) ||
          !protocolsMatch(state.activeRednessBurst.protocol, HD_REDNESS_PROTOCOL)
        ) {
          return state;
        }
        const baselineLockedAt = completed.completedAt;
        return {
          ...state,
          stage: 'camera',
          camera: 'captured',
          observation: 'active_stable',
          baselineCapture: primaryCapture,
          comparison: 'not_available',
          confidence: 'insufficient',
          processing: 'succeeded',
          returnStage: state.returnStage,
          longitudinalEvidence: {
            protocol: { ...state.activeRednessBurst.protocol },
            baseline: null,
            followUp: null,
            baselineBurst: completed,
            followUpBurst: null,
            comparison: null,
            evaluation: null,
          },
          analysisRole: null,
          activeAnalysisRequestId: null,
          pendingAnalysisCapture: null,
          analysisError: null,
          activeRednessBurst: {
            ...state.activeRednessBurst,
            status: 'committed',
          },
          baselineLockedAt,
          followUpEligibleAt: addCalendarDays(baselineLockedAt, FOLLOW_UP_INTERVAL_DAYS),
          baselineContext: null,
          demoTimelineAdvanced: false,
          announcement: 'Measurements confirmed. Preparing your comparison.',
        };
      }

      if (
        !hasBaselineEvidence(state.longitudinalEvidence) ||
        hasFollowUpEvidence(state.longitudinalEvidence) ||
        !state.longitudinalEvidence.protocol ||
        !protocolsMatch(state.longitudinalEvidence.protocol, state.activeRednessBurst.protocol)
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'camera',
        camera: 'captured',
        observation: 'review_due',
        followupCapture: primaryCapture,
        returnStage: state.returnStage,
        processing: 'idle',
        analysis: null,
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          followUp: null,
          followUpBurst: completed,
          comparison: null,
          evaluation: null,
        },
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          status: 'committed',
        },
        followUpContext: null,
        announcement: 'Measurements confirmed. Preparing your comparison.',
      };
    }

    case 'REDNESS_BURST_PRESENTATION_COMPLETED': {
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status !== 'committed'
      ) {
        return state;
      }
      const role = state.activeRednessBurst.role;
      if (role === 'baseline' && !hasBaselineEvidence(state.longitudinalEvidence)) return state;
      if (role === 'followup' && !hasFollowUpEvidence(state.longitudinalEvidence)) return state;
      return {
        ...state,
        stage:
          role === 'baseline'
            ? state.registeredProduct
              ? 'baseline_context'
              : 'observation'
            : state.registeredProduct
              ? 'followup_context'
              : 'analysis',
        returnStage: null,
        activeRednessBurst: null,
        announcement:
          role === 'baseline'
            ? state.registeredProduct
              ? 'Baseline secured. Add optional context before the trial is locked.'
              : 'Baseline secured. Trial in progress.'
            : state.registeredProduct
              ? 'Follow-up secured. Add optional context before comparison.'
              : 'Follow-up secured. Comparing like with like.',
      };
    }

    case 'REDNESS_BURST_FAILED':
      if (
        !isCurrentBurst(state, event.generationId) ||
        state.activeRednessBurst.status === 'ready' ||
        state.activeRednessBurst.status === 'committed'
      ) {
        return state;
      }
      return {
        ...state,
        processing: 'failed',
        activeAnalysisRequestId: null,
        analysisError: event.error,
        activeRednessBurst: {
          ...state.activeRednessBurst,
          status: 'failed',
        },
        announcement: event.error.message,
      };

    case 'REDNESS_BURST_CANCELLED':
      if (!isCurrentBurst(state, event.generationId)) return state;
      return {
        ...state,
        processing: 'idle',
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        announcement: 'Evidence burst cancelled. Existing evidence is unchanged.',
      };

    case 'BASELINE_ANALYSIS_STARTED':
      if (
        state.stage !== 'camera' ||
        state.captureKind !== 'baseline' ||
        state.processing === 'running' ||
        hasBaselineEvidence(state.longitudinalEvidence)
      ) {
        return state;
      }
      return {
        ...state,
        processing: 'running',
        analysisRole: 'baseline',
        activeAnalysisRequestId: event.requestId,
        pendingAnalysisCapture: event.metadata,
        analysisError: null,
        announcement: 'Securing baseline.',
      };

    case 'BASELINE_ANALYSIS_ACCEPTED': {
      if (
        !isCurrentRequest(state, event.requestId) ||
        state.analysisRole !== 'baseline' ||
        hasBaselineEvidence(state.longitudinalEvidence)
      ) {
        return state;
      }
      const baselineLockedAt = event.signal.capturedAt;
      return {
        ...state,
        stage: state.registeredProduct ? 'baseline_context' : 'observation',
        camera: 'captured',
        observation: 'active_stable',
        baselineCapture: state.pendingAnalysisCapture,
        comparison: 'not_available',
        confidence: 'insufficient',
        processing: 'succeeded',
        returnStage: null,
        longitudinalEvidence: {
          protocol: { ...event.protocol },
          baseline: event.signal,
          followUp: null,
          baselineBurst: null,
          followUpBurst: null,
          comparison: null,
          evaluation: null,
        },
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        baselineLockedAt,
        followUpEligibleAt: addCalendarDays(baselineLockedAt, FOLLOW_UP_INTERVAL_DAYS),
        baselineContext: null,
        demoTimelineAdvanced: false,
        announcement: state.registeredProduct
          ? 'Baseline secured. Add optional context before the trial is locked.'
          : 'Baseline secured. Trial in progress.',
      };
    }

    case 'BASELINE_ANALYSIS_FAILED':
      if (!isCurrentRequest(state, event.requestId) || state.analysisRole !== 'baseline') {
        return state;
      }
      return {
        ...state,
        processing: 'failed',
        activeAnalysisRequestId: null,
        analysisError: event.error,
        announcement: event.error.message,
      };

    case 'BASELINE_RETRY_REQUESTED':
      if (
        state.stage !== 'camera' ||
        state.captureKind !== 'baseline' ||
        state.processing !== 'failed'
      ) {
        return state;
      }
      return {
        ...state,
        processing: 'idle',
        analysisRole: null,
        activeAnalysisRequestId: null,
        analysisError: null,
        activeRednessBurst: null,
        announcement: 'Baseline retry ready.',
      };

    case 'FOLLOWUP_ANALYSIS_STARTED':
      if (
        state.stage !== 'camera' ||
        state.captureKind !== 'followup' ||
        state.processing === 'running' ||
        !state.longitudinalEvidence.protocol ||
        !hasBaselineEvidence(state.longitudinalEvidence) ||
        hasFollowUpEvidence(state.longitudinalEvidence) ||
        (state.baselineCapture?.source === 'camera' &&
          event.metadata.source === 'camera' &&
          state.baselineCapture.cameraProfileId &&
          event.metadata.cameraProfileId !== state.baselineCapture.cameraProfileId) ||
        (state.registeredProduct &&
          !followUpIsEligible({
            followUpEligibleAt: state.followUpEligibleAt,
            demoTimelineAdvanced: state.demoTimelineAdvanced,
            now: event.metadata.createdAt,
          }))
      ) {
        return state;
      }
      return {
        ...state,
        processing: 'running',
        analysisRole: 'followup',
        activeAnalysisRequestId: event.requestId,
        pendingAnalysisCapture: event.metadata,
        analysisError: null,
        announcement: 'Securing follow-up.',
      };

    case 'FOLLOWUP_ANALYSIS_ACCEPTED':
      if (
        !isCurrentRequest(state, event.requestId) ||
        state.analysisRole !== 'followup' ||
        !hasBaselineEvidence(state.longitudinalEvidence) ||
        !state.longitudinalEvidence.protocol ||
        hasFollowUpEvidence(state.longitudinalEvidence)
      ) {
        return state;
      }
      return {
        ...state,
        stage: state.registeredProduct ? 'followup_context' : 'analysis',
        camera: 'captured',
        observation: 'review_due',
        followupCapture: state.pendingAnalysisCapture,
        returnStage: null,
        processing: 'idle',
        analysis: null,
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          followUp: event.signal,
          followUpBurst: null,
          comparison: null,
          evaluation: null,
        },
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        followUpContext: null,
        announcement: state.registeredProduct
          ? 'Follow-up secured. Add optional context before comparison.'
          : 'Follow-up secured. Comparing like with like.',
      };

    case 'FOLLOWUP_ANALYSIS_FAILED':
      if (!isCurrentRequest(state, event.requestId) || state.analysisRole !== 'followup') {
        return state;
      }
      return {
        ...state,
        processing: 'failed',
        activeAnalysisRequestId: null,
        analysisError: event.error,
        announcement: event.error.message,
      };

    case 'RETAKE_FOLLOWUP':
      if (!state.registeredProduct) {
        return normalizePhaseBState(legacyFaceValueReducer(state, event as LegacyFaceValueEvent));
      }
      if (
        !['analysis_failure', 'comparison_refused'].includes(state.stage) ||
        !hasBaselineEvidence(state.longitudinalEvidence)
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'followup_ready',
        captureKind: 'followup',
        followupCapture: null,
        processing: 'idle',
        analysis: null,
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        comparison: 'not_available',
        confidence: 'insufficient',
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          followUp: null,
          followUpBurst: null,
          comparison: null,
          evaluation: null,
        },
        resultRevealed: false,
        oracleRevealState: 'sealed',
        oracleEvidenceDispensed: false,
        oracleCollectionStarted: false,
        oracleCommittedAt: null,
        announcement: 'Follow-up retry ready. Your baseline and product are unchanged.',
      };

    case 'COMPARISON_CREATED': {
      const baseline =
        (isCompleteRednessEvidenceBurst(state.longitudinalEvidence.baselineBurst)
          ? state.longitudinalEvidence.baselineBurst
          : null) ?? state.longitudinalEvidence.baseline;
      const followUp =
        (isCompleteRednessEvidenceBurst(state.longitudinalEvidence.followUpBurst)
          ? state.longitudinalEvidence.followUpBurst
          : null) ?? state.longitudinalEvidence.followUp;
      const baselineCapturedAt = baselineEvidenceCapturedAt(state.longitudinalEvidence);
      const followUpCapturedAt = followUpEvidenceCapturedAt(state.longitudinalEvidence);
      if (
        state.stage !== 'analysis' ||
        state.analysis ||
        state.longitudinalEvidence.comparison ||
        !baseline ||
        !followUp ||
        !baselineCapturedAt ||
        !followUpCapturedAt
      ) {
        return state;
      }
      const trialIdentity = oracleTrialIdentity({
        baselineAt: state.baselineLockedAt ?? baselineCapturedAt,
        followUpAt: state.followupCapture?.createdAt ?? followUpCapturedAt,
        accession: state.registeredProduct?.accession,
      });
      const evaluation = buildMvpRednessEvaluation({
        trialId: trialIdentity.folio,
        product: productForRednessEvaluation(state, baselineCapturedAt),
        baseline,
        endpoint: followUp,
        baselineCapture: state.baselineCapture,
        endpointCapture: state.followupCapture,
        baselineContext: state.baselineContext,
        endpointContext: state.followUpContext,
        disturbance: state.disturbance,
      });
      const comparison = rednessComparisonFromEvaluation(evaluation);
      const analysis = analysisResultFromRednessEvaluation(evaluation);
      return {
        ...state,
        stage: 'analysis',
        analysis,
        comparison: analysis.comparison,
        confidence: analysis.confidence,
        processing: 'succeeded',
        observation: 'review_due',
        placement: placementForRednessAction(evaluation.interpretation.recommendedAction),
        placementSealed: false,
        record: null,
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          comparison,
          evaluation,
        },
        resultRevealed: false,
        oracleRevealState: 'sealed',
        oracleEvidenceDispensed: false,
        oracleCollectionStarted: false,
        oracleCommittedAt: null,
        announcement: 'Result ready. Pull the handle to reveal it.',
      };
    }

    case 'COMPARISON_REJECTED':
      return {
        ...state,
        stage: 'comparison_refused',
        processing: 'failed',
        comparison: 'not_comparable',
        confidence: 'insufficient',
        analysis: null,
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: event.error,
        activeRednessBurst: null,
        resultRevealed: false,
        oracleRevealState: 'sealed',
        oracleEvidenceDispensed: false,
        oracleCollectionStarted: false,
        oracleCommittedAt: null,
        announcement:
          'Comparison unavailable. These scans could not be compared under the same conditions.',
      };

    case 'ANALYSIS_CANCELLED':
      if (!isCurrentRequest(state, event.requestId)) return state;
      return {
        ...state,
        processing: 'idle',
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        announcement: 'Analysis cancelled. Existing evidence is unchanged.',
      };

    case 'BACK':
      if (state.stage === 'camera' && state.activeRednessBurst?.status === 'committed') {
        return state;
      }
      if (state.stage === 'product_registration') {
        return {
          ...state,
          stage: 'welcome',
          cabinet: 'closed',
          announcement: 'Returned to Face Value.',
        };
      }
      if (
        state.stage === 'job' &&
        state.registeredProduct &&
        !hasBaselineEvidence(state.longitudinalEvidence)
      ) {
        return {
          ...state,
          stage: 'product_registration',
          announcement: 'Returned to product registration.',
        };
      }
      if (state.stage === 'camera' && state.registeredProduct) {
        return {
          ...state,
          stage: state.returnStage ?? (state.captureKind === 'baseline' ? 'job' : 'followup_ready'),
          camera: 'idle',
          processing: 'idle',
          analysisRole: null,
          activeAnalysisRequestId: null,
          pendingAnalysisCapture: null,
          analysisError: null,
          activeRednessBurst: null,
          announcement: 'Guided capture closed. Existing evidence is unchanged.',
        };
      }
      if (state.stage === 'baseline_context') {
        return {
          ...state,
          stage: 'baseline_locked',
          baselineContext: emptyCaptureContext(),
          announcement: 'Baseline locked without additional context.',
        };
      }
      if (state.stage === 'followup_context') {
        return {
          ...state,
          stage: 'analysis',
          followUpContext: emptyCaptureContext(),
          processing: 'idle',
          announcement: 'Comparing against your baseline.',
        };
      }
      if (state.stage === 'baseline_locked') {
        return {
          ...state,
          stage: 'waiting_for_followup',
          cabinet: 'open',
          announcement: 'Your trial is running.',
        };
      }
      if (state.stage === 'waiting_for_followup' || state.stage === 'followup_ready') {
        return {
          ...state,
          stage: 'cabinet',
          cabinet: 'open',
          announcement: 'Returned to Your trials.',
        };
      }
      if (state.registeredProduct && (state.stage === 'analysis' || state.stage === 'placement')) {
        return {
          ...state,
          announcement:
            state.stage === 'analysis'
              ? 'Your result remains sealed and safe.'
              : 'Your revealed result remains ready to keep.',
        };
      }
      return normalizePhaseBState(legacyFaceValueReducer(state, event as LegacyFaceValueEvent));

    case 'CLEAR_DEMO_DATA': {
      const next = normalizePhaseBState(
        legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
      );
      return {
        ...next,
        longitudinalEvidence: createEmptyLongitudinalEvidence(),
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        activeRednessBurst: null,
        registeredProduct: null,
        baselineLockedAt: null,
        followUpEligibleAt: null,
        baselineContext: null,
        followUpContext: null,
        demoTimelineAdvanced: false,
        resultRevealed: false,
        oracleRevealState: 'sealed',
        oracleEvidenceDispensed: false,
        oracleCollectionStarted: false,
        oracleCommittedAt: null,
      };
    }

    default: {
      const next = normalizePhaseBState(
        legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
      );
      if (event.type === 'SAVE_RESULT') return enrichSavedRecord(state, next);
      return next;
    }
  }
}
