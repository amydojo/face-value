import { useReducer } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { systemClock } from '../adapters/clock/clock';
import { FaceValueContext } from '../app/faceValueContext';
import { faceValueReducer, type TrialTruthFaceValueState } from '../app/trialTruthMachine';
import { ordinaryDemoRuntime } from '../domain/demoLab';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import { TrialTruthSurface } from '../features/trial-truth/TrialTruthSurface';

const fixtureState = (): TrialTruthFaceValueState =>
  buildDemoFixtureState('trial_truth', 'clear_favorable_change');

function Harness({ initialState = fixtureState() }: { initialState?: TrialTruthFaceValueState }) {
  const [state, dispatch] = useReducer(faceValueReducer, initialState);
  return (
    <FaceValueContext.Provider value={{ state, dispatch, demoRuntime: ordinaryDemoRuntime }}>
      <TrialTruthSurface />
      <output data-testid="trial-truth-state" data-state={JSON.stringify(state)} />
    </FaceValueContext.Provider>
  );
}

function renderedState(): TrialTruthFaceValueState {
  return JSON.parse(screen.getByTestId('trial-truth-state').getAttribute('data-state') ?? '{}');
}

async function reachStepTwo(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('radio', { name: 'YES' }));
  await user.click(screen.getByRole('button', { name: 'Continue to skin response' }));
}

async function reachStepThree(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await reachStepTwo(user);
  await user.click(screen.getByRole('radio', { name: 'NONE' }));
  await user.click(screen.getByRole('button', { name: 'Continue to visible redness' }));
}

async function reachCaptureCheck(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await reachStepThree(user);
  await user.click(screen.getByRole('radio', { name: 'LESS' }));
  await user.click(screen.getByRole('button', { name: 'Continue to capture check' }));
}

describe('TrialTruthSurface firmware sequence', () => {
  it('starts as one stationary machine question without a favorable selection', () => {
    const { container } = render(<Harness />);

    expect(screen.getByRole('group', { name: 'Did you use it as planned?' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'How did your skin respond?' })).toBeNull();
    expect(
      screen.queryByRole('group', {
        name: /Compared with the start of this trial/i,
      }),
    ).toBeNull();
    expect(screen.getByRole('radio', { name: 'YES' })).not.toBeChecked();
    const deckAction = screen.getByRole('button', { name: 'Continue to skin response' });
    const centerActuator = container.querySelector<HTMLElement>(
      '[data-trial-truth-center-actuator]',
    );
    const visibleLabel = container.querySelector<HTMLElement>(
      '[data-trial-truth-visible-control-label]',
    );
    const amber = container.querySelector<HTMLElement>('[data-trial-truth-confirmation]');
    expect(deckAction).toBeDisabled();
    expect(deckAction).toContainElement(centerActuator);
    expect(deckAction).toContainElement(visibleLabel);
    expect(deckAction).toContainElement(amber);
    expect(visibleLabel).toHaveTextContent('');
    expect(amber).toHaveAttribute('data-amber-state', 'idle');
    expect(container.querySelectorAll('[data-oracle-machine]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-specimen-renderer="identity-lock"]')).toHaveLength(0);
    expect(
      screen.getByLabelText(
        'Registered product: Face Value Lab, One Thing Redness Trial, 10%, 30 ml',
      ),
    ).toHaveTextContent('DEMO 01 · One Thing Redness Trial 10%');
    expect(container.querySelectorAll('form')).toHaveLength(0);
  });

  it('uses one accessible deck action for its center label, actuator, and amber control', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const center = () =>
      container.querySelector<HTMLElement>('[data-trial-truth-center-actuator]')!;
    const visibleLabel = () =>
      container.querySelector<HTMLElement>('[data-trial-truth-visible-control-label]')!;
    const amber = () => container.querySelector<HTMLElement>('[data-trial-truth-confirmation]')!;

    fireEvent.click(center());
    fireEvent.click(amber());
    expect(screen.getByRole('group', { name: 'Did you use it as planned?' })).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'YES' }));
    expect(visibleLabel()).toHaveTextContent('CONTINUE');
    expect(amber()).toHaveAttribute('data-amber-state', 'ready');
    fireEvent.click(visibleLabel());
    expect(screen.getByRole('group', { name: 'How did your skin respond?' })).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'MILD' }));
    await user.click(screen.getByRole('button', { name: 'Add reported symptoms' }));
    expect(screen.getByRole('button', { name: 'Save signs' })).toContainElement(visibleLabel());
    expect(visibleLabel()).toHaveTextContent('SAVE SIGNS');
    fireEvent.click(amber());
    expect(screen.getByRole('group', { name: 'How did your skin respond?' })).toBeVisible();

    expect(visibleLabel()).toHaveTextContent('CONTINUE');
    fireEvent.click(center());
    expect(
      screen.getByRole('group', {
        name: /Compared with the start of this trial, your visible redness looks/i,
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('radio', { name: 'LESS' }));
    expect(visibleLabel()).toHaveTextContent('CONTINUE');
    expect(amber()).toHaveAttribute('data-amber-state', 'ready');
    fireEvent.click(center());
    expect(
      screen.getByRole('group', { name: 'Anything different around today’s scan?' }),
    ).toBeVisible();
    expect(visibleLabel()).toHaveTextContent('');

    await user.click(screen.getByRole('button', { name: 'ADD CONTEXT' }));
    expect(screen.getByRole('button', { name: 'Save capture context' })).toContainElement(
      visibleLabel(),
    );
    expect(visibleLabel()).toHaveTextContent('SAVE CONTEXT');
    await user.click(screen.getByRole('button', { name: 'Back to capture check' }));
    await user.click(screen.getByRole('button', { name: 'NOTHING DIFFERENT' }));
    expect(visibleLabel()).toHaveTextContent('SEE RESULT');
  });

  it('does not skip a step across repeated amber-control presses and moves focus for VoiceOver', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'YES' }));

    const amber = container.querySelector<HTMLElement>('[data-trial-truth-confirmation]')!;
    fireEvent.click(amber);
    fireEvent.click(amber);

    expect(screen.getByRole('group', { name: 'How did your skin respond?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue to visible redness' })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'How did your skin respond?' })).toHaveFocus(),
    );

    await user.click(screen.getByRole('radio', { name: 'NONE' }));
    await user.click(screen.getByRole('button', { name: 'Continue to visible redness' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: /Compared with the start of this trial, your visible redness looks/i,
        }),
      ).toHaveFocus(),
    );
  });

  it('returns through all local steps without changing the reducer-owned draft', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await reachStepThree(user);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'How did your skin respond?' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'NONE' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'Did you use it as planned?' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'YES' })).toBeChecked();
    expect(renderedState().trialTruthEvidence).toBeNull();
  });

  it('uses a dedicated symptom subview, preserves return, and summarizes selected symptoms', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await reachStepTwo(user);
    await user.click(screen.getByRole('radio', { name: 'MILD' }));
    await user.click(screen.getByRole('button', { name: 'Add reported symptoms' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'What did you notice?' })).toHaveFocus(),
    );
    const itching = screen.getByRole('checkbox', { name: 'Itching' });
    await user.click(itching);
    expect(itching).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Back to skin response' }));
    expect(screen.getByRole('button', { name: 'Edit reported symptoms' })).toHaveTextContent(
      'Itching',
    );

    await user.click(screen.getByRole('button', { name: 'Edit reported symptoms' }));
    await user.click(screen.getByRole('button', { name: 'Save signs' }));
    expect(screen.getByRole('button', { name: 'Edit reported symptoms' })).toHaveTextContent(
      'Itching',
    );
  });

  it('requires symptoms for moderate or severe and clears them when tolerance changes to none', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await reachStepTwo(user);
    await user.click(screen.getByRole('radio', { name: 'MODERATE' }));
    expect(screen.getByRole('button', { name: 'Continue to visible redness' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Add reported symptoms' }));
    expect(screen.getByRole('button', { name: 'Save signs' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Itching' }));
    await user.click(screen.getByRole('button', { name: 'Save signs' }));
    expect(screen.getByRole('button', { name: 'Edit reported symptoms' })).toHaveTextContent(
      'Itching',
    );

    await user.click(screen.getByRole('radio', { name: 'NONE' }));
    expect(screen.queryByRole('button', { name: 'Edit reported symptoms' })).toBeNull();
    expect(renderedState().trialTruthDraft.symptoms).toEqual([]);
  });

  it('re-enters at the first incomplete step for a reducer-owned partial draft', () => {
    const initialState = fixtureState();
    initialState.trialTruthDraft = {
      adherence: 'mostly',
      tolerance: null,
      symptoms: [],
      visibleChange: null,
    };
    render(<Harness initialState={initialState} />);

    expect(screen.getByRole('group', { name: 'How did your skin respond?' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Did you use it as planned?' })).toBeNull();
  });

  it('records Nothing Different through the existing context contract and submits once', async () => {
    const clock = vi.spyOn(systemClock, 'now').mockReturnValue('2026-08-01T19:30:00.000Z');
    const user = userEvent.setup();
    render(<Harness />);
    await reachCaptureCheck(user);

    expect(screen.queryByText('Anything meaningfully different today?')).toBeNull();
    expect(renderedState().trialTruthEvidence).toBeNull();
    expect(renderedState().followUpContext).toBeNull();
    await user.click(screen.getByRole('button', { name: 'NOTHING DIFFERENT' }));

    const seeResult = screen.getByRole('button', { name: 'See result' });
    fireEvent.click(seeResult);
    fireEvent.click(seeResult);

    const state = renderedState();
    expect(clock).toHaveBeenCalledTimes(1);
    expect(state.trialTruthEvidence?.recordedAt).toBe('2026-08-01T19:30:00.000Z');
    expect(state.followUpContext).toEqual({
      makeup: false,
      recentHeatOrExercise: false,
      recentCleansingOrSkincare: false,
      routineOrTreatmentChange: false,
      note: null,
    });
    expect(state.stage).toBe('analysis');
    expect(state.longitudinalEvidence.comparison).toBeNull();
    expect(state.record).toBeNull();
    expect(state.archive).toHaveLength(0);
  });

  it('maps added context to CaptureContext and preserves Back and Edit answers', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await reachCaptureCheck(user);

    await user.click(screen.getByRole('button', { name: 'ADD CONTEXT' }));
    await user.click(screen.getByRole('checkbox', { name: 'Makeup' }));
    await user.click(screen.getByRole('checkbox', { name: 'Recent heat or exercise' }));
    await user.type(screen.getByRole('textbox', { name: 'Optional note' }), 'Warm commute');

    await user.click(screen.getByRole('button', { name: 'Back to capture check' }));
    await user.click(screen.getByRole('button', { name: 'ADD CONTEXT' }));
    expect(screen.getByRole('checkbox', { name: 'Makeup' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Recent heat or exercise' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Optional note' })).toHaveValue('Warm commute');

    await user.click(screen.getByRole('button', { name: 'Save capture context' }));
    expect(screen.getByRole('button', { name: 'Edit capture context' })).toHaveTextContent(
      'Makeup · Recent heat or exercise · Note added',
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(
      screen.getByRole('group', {
        name: /Compared with the start of this trial, your visible redness looks/i,
      }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continue to capture check' }));
    await user.click(screen.getByRole('button', { name: 'Edit capture context' }));
    expect(screen.getByRole('checkbox', { name: 'Makeup' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Optional note' })).toHaveValue('Warm commute');
    await user.click(screen.getByRole('button', { name: 'Save capture context' }));
    await user.click(screen.getByRole('button', { name: 'See result' }));

    expect(renderedState().followUpContext).toEqual({
      makeup: true,
      recentHeatOrExercise: true,
      recentCleansingOrSkincare: false,
      routineOrTreatmentChange: false,
      note: 'Warm commute',
    });
  });
});
