import { createContext, useContext, type Dispatch } from 'react';
import type {
  FaceValueEvent,
  PhaseBFaceValueState,
} from './phaseBMachine';

export interface FaceValueContextValue {
  state: PhaseBFaceValueState;
  dispatch: Dispatch<FaceValueEvent>;
}

export const FaceValueContext = createContext<FaceValueContextValue | null>(null);

export function useFaceValue(): FaceValueContextValue {
  const value = useContext(FaceValueContext);
  if (!value) throw new Error('useFaceValue must be used within FaceValueProvider');
  return value;
}
