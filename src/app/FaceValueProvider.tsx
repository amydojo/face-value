import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  clearStructuredDemoData,
  loadStructuredDemoData,
  saveStructuredDemoData,
} from '../adapters/persistence/localObservationStore';
import type { FaceValueState } from '../domain/model';
import { FaceValueContext } from './faceValueContext';
import { faceValueReducer, initialState } from './machine';

function hydrateState(): FaceValueState {
  if (typeof localStorage === 'undefined') return initialState;
  const persisted = loadStructuredDemoData();
  if (!persisted) return initialState;

  const completedTrial = persisted.observation === 'complete' && persisted.archive.length > 0;
  const hasContinuity =
    persisted.observation !== 'none' ||
    persisted.archive.length > 0 ||
    persisted.assignedJob !== null;

  return {
    ...initialState,
    ...persisted,
    stage: hasContinuity ? 'cabinet' : 'welcome',
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
    announcement: hasContinuity
      ? 'Your trials were restored. Raw images were not saved.'
      : initialState.announcement,
  };
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
