import { createContext, useContext, type Dispatch } from 'react';
import {
  initialState,
  type FaceValueEvent,
  type PhaseBFaceValueState,
} from './phaseBMachine';

export interface FaceValueContextValue {
  state: PhaseBFaceValueState;
  dispatch: Dispatch<FaceValueEvent>;
}

const isolatedFallback: FaceValueContextValue = {
  state: initialState,
  dispatch: () => undefined,
};

export const FaceValueContext = createContext<FaceValueContextValue | null>(null);

export function useOptionalFaceValue(): FaceValueContextValue | null {
  return useContext(FaceValueContext);
}

export function useFaceValue(): FaceValueContextValue {
  return useOptionalFaceValue() ?? isolatedFallback;
}
