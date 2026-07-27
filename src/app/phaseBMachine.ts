import type { AnalysisProtocol } from '../adapters/analysis/youcam/contracts';
import type {
  AnalysisErrorState,
  CaptureMetadata,
  DurableSkinSignal,
  FaceValueState,
  LongitudinalSkinEvidence,
} from '../domain/model';
import {
  analysisResultFromComparison,
  compareRednessSignals,
} from '../domain/youcamEvidence';
import {
  faceValueReducer as legacyFaceValueReducer,
  initialState as legacyInitialState,
  type FaceValueEvent as LegacyFaceValueEvent,
} from './machine';

export type PhaseBFaceValueEvent =
  | LegacyFaceValueEvent
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

export const initialState: FaceValueState = {
  ...legacyInitialState,
  longitudinalEvidence: createEmptyLongitudinalEvidence(),
  analysisRole: null,
  activeAnalysisRequestId: null,
  pendingAnalysisCapture: null,
  analysisError: null,
};

export function normalizePhaseBState(state: FaceValueState): FaceValueState {
  return {
    ...state,
    longitudinalEvidence:
      state.longitudinalEvidence ?? createEmptyLongitudinalEvidence(),
    analysisRole: state.analysisRole ?? null,
    activeAnalysisRequestId: state.activeAnalysisRequestId ?? null,
    pendingAnalysisCapture: state.pendingAnalysisCapture ?? null,
    analysisError: state.analysisError ?? null,
  };
}

const isCurrentRequest = (state: FaceValueState, requestId: string): boolean =>
  state.activeAnalysisRequestId === requestId;

function enrichSavedRecord(
  previous: FaceValueState,
  next: FaceValueState,
): FaceValueState {
  const comparison = previous.longitudinalEvidence.comparison;
  if (!next.record || !comparison || previous.analysis?.provider !== 'youcam') {
    return next;
  }

  const enriched = {
    ...next.record,
    observationWindow: `${previous.baselineCapture?.createdAt ?? 'Baseline'} to ${previous.followupCapture?.createdAt ?? 'follow-up'}`,
    evidenceSource: 'YouCam Skin Analysis v2.1' as const,
    comparisonDirection: comparison.direction,
    limitations: [...comparison.limitations],
    baselineRawScore: comparison.baselineRawScore,
    followUpRawScore: comparison.followUpRawScore,
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
  rawState: FaceValueState,
  event: PhaseBFaceValueEvent,
): FaceValueState {
  const state = normalizePhaseBState(rawState);

  switch (event.type) {
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

    case 'BASELINE_ANALYSIS_ACCEPTED':
      if (
        !isCurrentRequest(state, event.requestId) ||
        state.analysisRole !== 'baseline' ||
        state.longitudinalEvidence.baseline
      ) {
        return state;
      }
      return {
        ...state,
        stage: 'observation',
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
        announcement: 'Baseline secured. Trial in progress.',
      };

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
        state.longitudinalEvidence.followUp
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
        stage: 'analysis',
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
        announcement: 'Follow-up secured. Comparing like with like.',
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
      const comparison = compareRednessSignals(baseline, followUp);
      const analysis = analysisResultFromComparison(comparison);
      return {
        ...state,
        analysis,
        comparison: analysis.comparison,
        confidence: analysis.confidence,
        processing: 'succeeded',
        observation: 'review_due',
        longitudinalEvidence: {
          ...state.longitudinalEvidence,
          comparison,
        },
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

    default: {
      const next = normalizePhaseBState(
        legacyFaceValueReducer(state, event as LegacyFaceValueEvent),
      );
      if (event.type === 'SAVE_RESULT') return enrichSavedRecord(state, next);
      if (event.type === 'CLEAR_DEMO_DATA') {
        return {
          ...next,
          longitudinalEvidence: createEmptyLongitudinalEvidence(),
          analysisRole: null,
          activeAnalysisRequestId: null,
          pendingAnalysisCapture: null,
          analysisError: null,
        };
      }
      return next;
    }
  }
}
