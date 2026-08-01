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
    expect(screen.getByRole('button', { name: 'Continue to skin response' })).toBeDisabled();
    expect(container.querySelectorAll('[data-oracle-machine]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-specimen-renderer="identity-lock"]')).toHaveLength(0);
    expect(
      screen.getByLabelText(
        'Registered product: Face Value Lab, One Thing Redness Trial, 10%, 30 ml',
      ),
    ).toHaveTextContent('DEMO 01 · One Thing Redness Trial 10%');
    expect(container.querySelectorAll('form')).toHaveLength(0);
  });

  it('does not skip a step across repeated amber-control presses and moves focus for VoiceOver', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'YES' }));

    const amber = screen.getByRole('button', { name: 'Continue to skin response' });
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
    await user.click(screen.getByRole('button', { name: 'Done choosing symptoms' }));
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
    expect(screen.getByRole('button', { name: 'Done choosing symptoms' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Itching' }));
    await user.click(screen.getByRole('button', { name: 'Done choosing symptoms' }));
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

  it('double-tapping See result commits once and does not create downstream state early', async () => {
    const clock = vi.spyOn(systemClock, 'now').mockReturnValue('2026-08-01T19:30:00.000Z');
    const user = userEvent.setup();
    render(<Harness />);
    await reachStepThree(user);
    await user.click(screen.getByRole('radio', { name: 'LESS' }));

    const seeResult = screen.getByRole('button', { name: 'See result' });
    fireEvent.click(seeResult);
    fireEvent.click(seeResult);

    const state = renderedState();
    expect(clock).toHaveBeenCalledTimes(1);
    expect(state.trialTruthEvidence?.recordedAt).toBe('2026-08-01T19:30:00.000Z');
    expect(state.longitudinalEvidence.comparison).toBeNull();
    expect(state.record).toBeNull();
    expect(state.archive).toHaveLength(0);
  });
});
