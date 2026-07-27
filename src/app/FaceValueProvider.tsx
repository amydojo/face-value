import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  clearStructuredDemoData,
  loadStructuredDemoData,
  saveStructuredDemoData,
} from '../adapters/persistence/localObservationStore';
import { FaceValueContext } from './faceValueContext';
import {
  createEmptyLongitudinalEvidence,
  faceValueReducer,
  initialState,
  normalizePhaseBState,
  type PhaseBFaceValueState,
} from './phaseBMachine';

function hydrateState(): PhaseBFaceValueState {
  if (typeof localStorage === 'undefined') return initialState;
  const persisted = loadStructuredDemoData();
  if (!persisted) return initialState;

  const hasPendingDecision = Boolean(
    persisted.analysis &&
    persisted.placement !== 'observation' &&
    !persisted.placementSealed,
  );
  const hasPendingRelease = Boolean(
    persisted.placementSealed && persisted.record,
  );
  const preserveTerminalJourney = hasPendingDecision || hasPendingRelease;
  const completedTrial =
    persisted.observation === 'complete' &&
    persisted.archive.length > 0 &&
    !preserveTerminalJourney;
  const completeSignalsAwaitingComparison = Boolean(
    persisted.longitudinalEvidence.baseline &&
    persisted.longitudinalEvidence.followUp &&
    !persisted.longitudinalEvidence.comparison &&
    !persisted.analysis,
  );
  const hasContinuity =
    persisted.observation !== 'none' ||
    persisted.archive.length > 0 ||
    persisted.assignedJob !== null ||
    Boolean(persisted.longitudinalEvidence.baseline);

  return normalizePhaseBState({
    ...initialState,
    ...persisted,
    stage: preserveTerminalJourney
      ? 'placement'
      : completeSignalsAwaitingComparison
        ? 'analysis'
        : hasContinuity
          ? 'cabinet'
          : 'welcome',
    cabinet: hasContinuity ? 'open' : 'closed',
    observation: completedTrial ? 'none' : persisted.observation,
    assignedJob: completedTrial ? null : persisted.assignedJob,
    baselineCapture: completedTrial ? null : persisted.baselineCapture,
    followupCapture: completedTrial ? null : persisted.followupCapture,
    trace: completedTrial ? null : persisted.trace,
    analysis: completedTrial ? null : persisted.analysis,
    disturbance: completedTrial ? 'none' : persisted.disturbance,
    comparison: completedTrial ? 'not_available' : persisted.comparison,
    confidence: completedTrial ? 'insufficient' : persisted.confidence,
    processing: 'idle',
    placement: completedTrial ? 'observation' : persisted.placement,
    placementSealed: completedTrial ? false : persisted.placementSealed,
    longitudinalEvidence: completedTrial
      ? createEmptyLongitudinalEvidence()
      : persisted.longitudinalEvidence,
    analysisRole: null,
    activeAnalysisRequestId: null,
    pendingAnalysisCapture: null,
    analysisError: null,
    announcement: hasPendingRelease
      ? 'Your Evidence Record was restored and is ready to collect.'
      : hasPendingDecision
        ? 'Your selected next step was restored and is ready to save.'
        : completeSignalsAwaitingComparison
          ? 'Your matched scans were restored. Comparison is resuming.'
          : hasContinuity
            ? 'Your trials were restored. Raw images were not saved.'
            : initialState.announcement,
  });
}

export function FaceValueProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(faceValueReducer, undefined, hydrateState);

  useEffect(() => {
    if (
      state.stage === 'welcome' &&
      state.archive.length === 0 &&
      state.assignedJob === null
    ) {
      clearStructuredDemoData();
      return;
    }
    saveStructuredDemoData(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <FaceValueContext.Provider value={value}>{children}</FaceValueContext.Provider>;
}
