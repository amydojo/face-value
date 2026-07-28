import { createContext, useContext, type Dispatch } from 'react';
import { ordinaryDemoRuntime, type DemoRuntime } from '../domain/demoLab';
import {
  initialState,
  type FaceValueEvent,
  type PhaseBFaceValueState,
} from './phaseBMachine';

export interface FaceValueContextValue {
  state: PhaseBFaceValueState;
  dispatch: Dispatch<FaceValueEvent>;
  demoRuntime: DemoRuntime;
}

const isolatedFallback: FaceValueContextValue = {
  state: initialState,
  dispatch: () => undefined,
  demoRuntime: ordinaryDemoRuntime,
};

export const FaceValueContext = createContext<FaceValueContextValue | null>(null);

export function useOptionalFaceValue(): FaceValueContextValue | null {
  return useContext(FaceValueContext);
}

export function useFaceValue(): FaceValueContextValue {
  return useOptionalFaceValue() ?? isolatedFallback;
}
