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

  const hasContinuity =
    persisted.observation !== 'none' ||
    persisted.archive.length > 0 ||
    persisted.assignedJob !== null;

  return {
    ...initialState,
    ...persisted,
    stage: hasContinuity ? 'cabinet' : 'welcome',
    cabinet: hasContinuity ? 'open' : 'closed',
    announcement: hasContinuity
      ? 'Structured evidence restored. Raw images were not persisted.'
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
