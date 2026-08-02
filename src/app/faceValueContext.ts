import { createContext, useContext, type Dispatch } from 'react';
import { ordinaryDemoRuntime, type DemoRuntime } from '../domain/demoLab';
import { initialState, type FaceValueEvent, type PhaseBFaceValueState } from './phaseBMachine';
import type { TrialTruthFaceValueEvent, TrialTruthFaceValueState } from './trialTruthMachine';

type TrialTruthContextState = PhaseBFaceValueState &
  Partial<
    Pick<
      TrialTruthFaceValueState,
      'trialTruthDraft' | 'trialTruthEvidence' | 'trialTruthValidation'
    >
  >;

export interface FaceValueContextValue {
  state: TrialTruthContextState;
  dispatch: Dispatch<FaceValueEvent>;
  dispatchTrialTruth?: Dispatch<TrialTruthFaceValueEvent>;
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
