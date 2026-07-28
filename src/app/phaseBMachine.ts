import type { AnalysisProtocol } from '../adapters/analysis/youcam/contracts';
import type {
  AnalysisErrorState,
  CaptureContext,
  CaptureMetadata,
  DurableSkinSignal,
  FaceValueState,
  LongitudinalSkinEvidence,
  ProductPlacement,
  RegisteredProduct,
} from '../domain/model';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  addCalendarDays,
  comparisonWithCaptureContext,
  defaultPlacementForResult,
  emptyCaptureContext,
  followUpIsEligible,
  isValidRegisteredProduct,
  normalizeCaptureContext,
} from '../domain/phaseB5';
import {
  analysisResultFromComparison,
  compareRednessSignals,
} from '../domain/youcamEvidence';
import {
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
  | { type: 'COMPARISON_CREATED' }
  | { type: 'COMPARISON_REJECTED'; error: AnalysisErrorState }
  | { type: 'ANALYSIS_CANCELLED'; requestId: string };

export type FaceValueEvent = PhaseBFaceValueEvent;

export const createEmptyLongitudinalEvidence = (): LongitudinalSkinEvidence => ({
  protocol: null,
  baseline: null,
  followUp: null,
  comparison: null,
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
};

export function normalizePhaseBState(state: FaceValueState): PhaseBFaceValueState {
  return {
    ...state,
    longitudinalEvidence:
      state.longitudinalEvidence ?? createEmptyLongitudinalEvidence(),
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
  };
}

const isCurrentRequest = (state: PhaseBFaceValueState, requestId: string): boolean =>
  state.activeAnalysisRequestId === requestId;

function enrichSavedRecord(
  previous: PhaseBFaceValueState,
  next: PhaseBFaceValueState,
): PhaseBFaceValueState {
  const comparison = previous.longitudinalEvidence.comparison;
  if (!next.record || !comparison || previous.analysis?.provider !== 'youcam') {
    return next;
  }

  const enriched = {
    ...next.record,
    observationWindow: `${previous.baselineLockedAt ?? previous.baselineCapture?.createdAt ?? 'Baseline'} to ${previous.followupCapture?.createdAt ?? 'follow-up'}`,
    evidenceSource: 'YouCam Skin Analysis v2.1' as const,
    comparisonDirection: comparison.direction,
    limitations: [...comparison.limitations],
    baselineRawScore: comparison.baselineRawScore,
    followUpRawScore: comparison.followUpRawScore,
    productBrand: previous.registeredProduct?.brand,
    productStrength: previous.registeredProduct?.strength,
    productVolume: previous.registeredProduct?.volume,
    baselineContext: previous.baselineContext,
    followUpContext: previous.followUpContext,
    demoOriginated: previous.demoTimelineAdvanced,
  };

  return {
    ...next,
    record: enriched,
    archive: next.archive.map((record) =>
      record.id === enriched.id ? enriched : record,
    ),
  };
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
      if (
        state.stage !== 'product_registration' ||
        !isValidRegisteredProduct(event.product)
      ) {
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
        registeredProduct: { ...event.product },
        baselineLockedAt: null,
        followUpEligibleAt: null,
        baselineContext: null,
        followUpContext: null,
        demoTimelineAdvanced: false,
        resultRevealed: false,
        returnStage: 'product_registration',
        announcement: `${event.product.brand} ${event.product.productName} registered for visible redness.`,
      };

    case 'BEGIN_CAPTURE':
      if (!state.registeredProduct) {
        return normalizePhaseBState(
          legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
        );
      }

      if (event.kind === 'baseline') {
        if (
          state.stage !== 'job' ||
          state.longitudinalEvidence.baseline ||
          state.processing === 'running'
        ) {
          return state;
        }
      } else {
        if (
          !event.now ||
          !state.longitudinalEvidence.baseline ||
          state.longitudinalEvidence.followUp ||
          !['waiting_for_followup', 'followup_ready', 'cabinet', 'analysis_failure', 'comparison_refused'].includes(
            state.stage,
          ) ||
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
        returnStage:
          event.kind === 'baseline' ? 'job' : 'followup_ready',
        announcement:
          event.kind === 'baseline'
            ? 'Guided baseline capture opened.'
            : 'Guided follow-up capture opened.',
      };

    case 'CAPTURE_CONTEXT_RECORDED': {
      const context = normalizeCaptureContext(event.context);
      if (
        event.kind === 'baseline' &&
        (state.stage === 'baseline_context' ||
          state.stage === 'baseline_locked') &&
        state.longitudinalEvidence.baseline
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
        state.longitudinalEvidence.followUp
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
      if (
        state.stage !== 'baseline_locked' ||
        !state.longitudinalEvidence.baseline
      ) {
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
        state.longitudinalEvidence.followUp ||
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
        !state.longitudinalEvidence.baseline ||
        state.longitudinalEvidence.followUp ||
        !['waiting_for_followup', 'cabinet'].includes(state.stage)
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'followup_ready',
        observation: 'review_due',
        demoTimelineAdvanced: true,
        announcement:
          'Demo timeline advanced explicitly. The original baseline date is unchanged.',
      };

    case 'REVEAL_RESULT':
      if (
        state.stage !== 'analysis' ||
        !state.analysis ||
        !state.longitudinalEvidence.comparison ||
        state.resultRevealed
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'placement',
        placement: defaultPlacementForResult(state.analysis),
        placementSealed: false,
        resultRevealed: true,
        announcement:
          'Result revealed. Verdict, limitation, and recommendation are available.',
      };

    case 'COMMIT_RESULT_AND_RELEASE': {
      if (
        state.stage !== 'placement' ||
        !state.resultRevealed ||
        !state.analysis ||
        state.placementSealed
      ) {
        return state;
      }
      const withPlacement: PhaseBFaceValueState = {
        ...state,
        placement: event.placement,
      };
      const saved = normalizePhaseBState(
        legacyFaceValueReducer(withPlacement, {
          type: 'SAVE_RESULT',
          now: event.now,
        }),
      );
      return enrichSavedRecord(withPlacement, saved);
    }

    case 'BASELINE_ANALYSIS_STARTED':
      if (
        state.stage !== 'camera' ||
        state.captureKind !== 'baseline' ||
        state.processing === 'running' ||
        state.longitudinalEvidence.baseline
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
        state.longitudinalEvidence.baseline
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
          comparison: null,
        },
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
        baselineLockedAt,
        followUpEligibleAt: addCalendarDays(
          baselineLockedAt,
          FOLLOW_UP_INTERVAL_DAYS,
        ),
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
        announcement: 'Baseline retry ready.',
      };

    case 'FOLLOWUP_ANALYSIS_STARTED':
      if (
        state.stage !== 'camera' ||
        state.captureKind !== 'followup' ||
        state.processing === 'running' ||
        !state.longitudinalEvidence.protocol ||
        !state.longitudinalEvidence.baseline ||
        state.longitudinalEvidence.followUp ||
        (state.baselineCapture?.source === 'camera' &&
          event.metadata.source === 'camera' &&
          state.baselineCapture.cameraProfileId &&
          event.metadata.cameraProfileId !==
            state.baselineCapture.cameraProfileId) ||
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
        !state.longitudinalEvidence.baseline ||
        !state.longitudinalEvidence.protocol ||
        state.longitudinalEvidence.followUp
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
          comparison: null,
        },
        analysisRole: null,
        activeAnalysisRequestId: null,
        pendingAnalysisCapture: null,
        analysisError: null,
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
        return normalizePhaseBState(
          legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
        );
      }
      if (
        !['analysis_failure', 'comparison_refused'].includes(state.stage) ||
        !state.longitudinalEvidence.baseline
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
        comparison: 'not_available',
        confidence: 'insufficient',
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          followUp: null,
          comparison: null,
        },
        resultRevealed: false,
        announcement:
          'Follow-up retry ready. Your baseline and product are unchanged.',
      };

    case 'COMPARISON_CREATED': {
      const baseline = state.longitudinalEvidence.baseline;
      const followUp = state.longitudinalEvidence.followUp;
      if (
        state.stage !== 'analysis' ||
        state.analysis ||
        state.longitudinalEvidence.comparison ||
        !baseline ||
        !followUp
      ) {
        return state;
      }
      const comparison = comparisonWithCaptureContext(
        compareRednessSignals(baseline, followUp),
        state.baselineContext,
        state.followUpContext,
      );
      const analysis = analysisResultFromComparison(comparison);
      return {
        ...state,
        stage: 'analysis',
        analysis,
        comparison: analysis.comparison,
        confidence: analysis.confidence,
        processing: 'succeeded',
        observation: 'review_due',
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          comparison,
        },
        resultRevealed: false,
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
        announcement: 'Comparison unavailable. These scans could not be compared under the same conditions.',
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
        announcement: 'Analysis cancelled. Existing evidence is unchanged.',
      };

    case 'BACK':
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
        !state.longitudinalEvidence.baseline
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
          stage:
            state.returnStage ??
            (state.captureKind === 'baseline' ? 'job' : 'followup_ready'),
          camera: 'idle',
          processing: 'idle',
          analysisRole: null,
          activeAnalysisRequestId: null,
          pendingAnalysisCapture: null,
          analysisError: null,
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
      if (
        state.stage === 'waiting_for_followup' ||
        state.stage === 'followup_ready'
      ) {
        return {
          ...state,
          stage: 'cabinet',
          cabinet: 'open',
          announcement: 'Returned to Your trials.',
        };
      }
      if (
        state.registeredProduct &&
        (state.stage === 'analysis' || state.stage === 'placement')
      ) {
        return {
          ...state,
          announcement:
            state.stage === 'analysis'
              ? 'Your result remains sealed and safe.'
              : 'Your revealed result remains ready to keep.',
        };
      }
      return normalizePhaseBState(
        legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
      );

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
        registeredProduct: null,
        baselineLockedAt: null,
        followUpEligibleAt: null,
        baselineContext: null,
        followUpContext: null,
        demoTimelineAdvanced: false,
        resultRevealed: false,
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
