import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  clearStructuredDemoData,
  loadStructuredDemoData,
  saveStructuredDemoData,
  type PersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import type { AppStage } from '../domain/model';
import { FaceValueContext } from './faceValueContext';
import {
  faceValueReducer,
  initialState,
  normalizePhaseBState,
  type PhaseBFaceValueState,
} from './phaseBMachine';

function restoredStageFor(persisted: PersistedDemoData): AppStage {
  const hasBaseline = Boolean(persisted.longitudinalEvidence.baseline);
  const hasFollowUp = Boolean(persisted.longitudinalEvidence.followUp);
  const hasComparison = Boolean(
    persisted.longitudinalEvidence.comparison && persisted.analysis,
  );
  const hasRegisteredTrial = Boolean(
    persisted.registeredProduct && hasBaseline,
  );

  if (persisted.stage === 'archive') return 'archive';
  if (persisted.stage === 'record' && persisted.record) return 'record';
  if (persisted.placementSealed && persisted.record) return 'placement';
  if (persisted.resultRevealed && hasComparison) return 'placement';
  if (hasComparison) return 'analysis';
  if (hasBaseline && hasFollowUp) {
    return persisted.stage === 'followup_context'
      ? 'followup_context'
      : 'analysis';
  }

  if (hasRegisteredTrial) {
    if (persisted.stage === 'baseline_context') return 'baseline_context';
    if (persisted.stage === 'baseline_locked') return 'baseline_locked';
    if (persisted.stage === 'followup_ready') return 'followup_ready';
    if (persisted.stage === 'analysis_failure') return 'analysis_failure';
    if (persisted.stage === 'comparison_refused') {
      return 'comparison_refused';
    }
    if (persisted.stage === 'camera') {
      return persisted.captureKind === 'followup'
        ? 'followup_ready'
        : 'baseline_locked';
    }
    return 'waiting_for_followup';
  }

  if (persisted.registeredProduct) {
    return persisted.stage === 'product_registration'
      ? 'product_registration'
      : 'job';
  }
  if (persisted.stage === 'product_registration') {
    return 'product_registration';
  }
  if (
    persisted.archive.length > 0 ||
    persisted.observation !== 'none' ||
    persisted.assignedJob !== null
  ) {
    return 'cabinet';
  }
  return 'welcome';
}

function hydrateState(): PhaseBFaceValueState {
  if (typeof localStorage === 'undefined') return initialState;
  const persisted = loadStructuredDemoData();
  if (!persisted) return initialState;

  const completeSignalsAwaitingComparison = Boolean(
    persisted.longitudinalEvidence.baseline &&
    persisted.longitudinalEvidence.followUp &&
    !persisted.longitudinalEvidence.comparison &&
    !persisted.analysis,
  );
  const restoredStage = restoredStageFor(persisted);
  const hasPendingRelease = Boolean(
    restoredStage === 'placement' &&
      persisted.placementSealed &&
      persisted.record,
  );
  const hasPendingDecision = Boolean(
    restoredStage === 'placement' &&
      persisted.resultRevealed &&
      !persisted.placementSealed,
  );

  const hydrated = normalizePhaseBState({
    ...initialState,
    ...persisted,
    stage: completeSignalsAwaitingComparison ? 'analysis' : restoredStage,
    cabinet:
      restoredStage === 'welcome' ||
      restoredStage === 'product_registration' ||
      restoredStage === 'job'
        ? 'closed'
        : 'open',
    processing: persisted.analysis ? 'succeeded' : 'idle',
    analysisRole: null,
    activeAnalysisRequestId: null,
    pendingAnalysisCapture: null,
    analysisError: null,
    announcement: hasPendingRelease
      ? 'Your Evidence Record was restored and is ready to collect.'
      : hasPendingDecision
        ? 'Your result was restored. Press amber to keep this evidence.'
        : completeSignalsAwaitingComparison
          ? 'Your matched scans were restored. Comparison is resuming.'
          : restoredStage === 'welcome'
            ? initialState.announcement
            : 'Your trial was restored. Raw images were not saved.',
  });

  return completeSignalsAwaitingComparison
    ? faceValueReducer(hydrated, { type: 'COMPARISON_CREATED' })
    : hydrated;
}

export function FaceValueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(faceValueReducer, undefined, hydrateState);

  useEffect(() => {
    if (
      state.stage === 'welcome' &&
      state.archive.length === 0 &&
      state.assignedJob === null &&
      state.registeredProduct === null
    ) {
      clearStructuredDemoData();
      return;
    }
    saveStructuredDemoData(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <FaceValueContext.Provider value={value}>{children}</FaceValueContext.Provider>;
}
