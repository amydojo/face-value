from pathlib import Path


def replace_exact(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    source = path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{path_str}: expected one replacement, found {count}: {old[:100]!r}")
    path.write_text(source.replace(old, new))


Path("src/app/faceValueContext.ts").write_text("""import { createContext, useContext, type Dispatch } from 'react';
import { ordinaryDemoRuntime, type DemoRuntime } from '../domain/demoLab';
import {
  initialState,
  type FaceValueEvent,
  type PhaseBFaceValueState,
} from './phaseBMachine';
import type {
  TrialTruthFaceValueEvent,
  TrialTruthFaceValueState,
} from './trialTruthMachine';

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
""")

replace_exact(
    "src/app/FaceValueProvider.tsx",
    "const value = useMemo(() => ({ state, dispatch, demoRuntime }), [demoRuntime, state]);",
    """const value = useMemo(
  () => ({ state, dispatch, dispatchTrialTruth: dispatch, demoRuntime }),
  [demoRuntime, state],
);""",
)

machine = Path("src/app/trialTruthMachine.ts")
source = machine.read_text()
source = source.replace(
    "export type TrialTruthFaceValueEvent =",
    """export type TrialTruthCompatibleState = PhaseBFaceValueState &
  Partial<
    Pick<
      TrialTruthFaceValueState,
      'trialTruthDraft' | 'trialTruthEvidence' | 'trialTruthValidation'
    >
  >;

export type TrialTruthFaceValueEvent =""",
)
source = source.replace(
    "state: PhaseBFaceValueState & Partial<TrialTruthFaceValueState>,",
    "state: TrialTruthCompatibleState,",
)
source = source.replace(
    """export function trialTruthMatchesCurrentTrial(state: TrialTruthFaceValueState): boolean {
  const generationId = trialTruthGenerationFor(state);""",
    """export function trialTruthMatchesCurrentTrial(
  rawState: TrialTruthCompatibleState,
): boolean {
  const state = normalizeTrialTruthState(rawState);
  const generationId = trialTruthGenerationFor(state);""",
)
source = source.replace(
    """export function trialTruthRequired(state: TrialTruthFaceValueState): boolean {
  return Boolean(""",
    """export function trialTruthRequired(rawState: TrialTruthCompatibleState): boolean {
  const state = normalizeTrialTruthState(rawState);
  return Boolean(""",
)
machine.write_text(source)

surface = Path("src/features/trial-truth/TrialTruthSurface.tsx")
source = surface.read_text()
source = source.replace(
    "import { useEffect, useMemo, useRef } from 'react';",
    "import { useEffect, useMemo, useRef, type Dispatch } from 'react';",
)
source = source.replace(
    """  trialTruthGenerationFor,
  trialTruthMatchesCurrentTrial,""",
    """  normalizeTrialTruthState,
  trialTruthGenerationFor,
  trialTruthMatchesCurrentTrial,
  type TrialTruthFaceValueEvent,""",
)
source = source.replace(
    """  const { state, dispatch } = useFaceValue();
  const validation = state.trialTruthValidation;""",
    """  const context = useFaceValue();
  const state = normalizeTrialTruthState(context.state);
  const dispatch =
    context.dispatchTrialTruth ??
    (context.dispatch as Dispatch<TrialTruthFaceValueEvent>);
  const validation = state.trialTruthValidation;""",
)
surface.write_text(source)

fixture = Path("src/features/demo-lab/demoFixtureState.ts")
source = fixture.read_text()
source = source.replace(
    """  initialState,
  type TrialTruthFaceValueState,""",
    """  initialState,
  normalizeTrialTruthState,
  type TrialTruthFaceValueState,""",
)
source = source.replace(
    """      return openCurrentSavedResultRoute(homeWithSavedResult(evaluated.record), evaluated.record);""",
    """      return normalizeTrialTruthState(
        openCurrentSavedResultRoute(homeWithSavedResult(evaluated.record), evaluated.record),
      );""",
)
fixture.write_text(source)
