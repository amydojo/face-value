import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaceValueContext } from '../app/faceValueContext';
import { initialState, type FaceValueEvent, type PhaseBFaceValueState } from '../app/phaseBMachine';
import { ordinaryDemoRuntime, type DemoStartingPoint } from '../domain/demoLab';
import { followUpIsEligible, trialDaySummary } from '../domain/phaseB5';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';

const runtimeFor = (startingPoint: DemoStartingPoint, state: PhaseBFaceValueState) => ({
  mode: 'preview' as const,
  startingPoint,
  resultFixture: 'clear_favorable_change' as const,
  fixtureNow: startingPoint === 'trial_pending' ? state.baselineLockedAt : null,
});

function renderState(
  state: PhaseBFaceValueState,
  startingPoint: DemoStartingPoint | null,
  dispatch = vi.fn<(event: FaceValueEvent) => void>(),
) {
  return {
    dispatch,
    ...render(
      <FaceValueContext.Provider
        value={{
          state,
          dispatch,
          demoRuntime:
            startingPoint === null ? ordinaryDemoRuntime : runtimeFor(startingPoint, state),
        }}
      >
        <FaceValueApplication />
      </FaceValueContext.Provider>,
    ),
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('Machine Continuity production projections', () => {
  it('renders the approved empty case and dispatches the existing registration event', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderState(initialState, null);

    expect(screen.getByText('ONE PRODUCT · ONE JOB · ONE HONEST RESULT')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Is your skincare actually doing anything?' }))
      .toBeVisible();
    expect(screen.getByText('NO TRIAL LOADED')).toBeVisible();
    expect(screen.getByText('Insert one product to begin.')).toBeVisible();
    expect(document.querySelector('[data-machine-projection="empty"]')).toHaveAttribute(
      'data-machine-shell',
      'canonical',
    );
    expect(document.querySelectorAll('[data-machine-chassis="canonical"]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'START A PRODUCT TRIAL' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_PRODUCT_REGISTRATION' });
  });

  it('keeps Baseline locked distinct from the loaded pending machine', () => {
    const state = buildDemoFixtureState('baseline_locked', 'clear_favorable_change');
    renderState(state, 'baseline_locked');

    expect(state.stage).toBe('baseline_locked');
    expect(screen.getByRole('heading', { name: 'Baseline locked.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'DONE' })).toBeVisible();
    expect(document.querySelector('[data-machine-projection="trial-pending"]')).toBeNull();
  });

  it('maps trial_pending to a deterministic, ineligible waiting state', () => {
    const state = buildDemoFixtureState('trial_pending', 'clear_favorable_change');
    if (!state.baselineLockedAt || !state.followUpEligibleAt) {
      throw new Error('Expected deterministic trial timing.');
    }
    const summary = trialDaySummary(
      state.baselineLockedAt,
      state.followUpEligibleAt,
      state.baselineLockedAt,
    );

    expect(state.stage).toBe('waiting_for_followup');
    expect(state.longitudinalEvidence.baseline).not.toBeNull();
    expect(state.longitudinalEvidence.followUp).toBeNull();
    expect(state.demoTimelineAdvanced).toBe(false);
    expect(
      followUpIsEligible({
        followUpEligibleAt: state.followUpEligibleAt,
        demoTimelineAdvanced: state.demoTimelineAdvanced,
        now: state.baselineLockedAt,
      }),
    ).toBe(false);
    expect(summary).toMatchObject({
      day: 1,
      intervalDays: 14,
      daysRemaining: 14,
      eligible: false,
    });
  });

  it('renders reducer-owned product and timing data without exposing a pending scan action', () => {
    const state = buildDemoFixtureState('trial_pending', 'clear_favorable_change');
    const { dispatch } = renderState(state, 'trial_pending');
    const machine = document.querySelector('[data-machine-projection="trial-pending"]');
    if (!(machine instanceof HTMLElement)) throw new Error('Expected the pending machine.');

    expect(machine).toHaveAttribute('data-machine-shell', 'canonical');
    expect(within(machine).getByText('Face Value Lab')).toBeVisible();
    expect(within(machine).getByText('One Thing Redness Trial')).toBeVisible();
    expect(within(machine).getByText('Reduce visible redness')).toBeVisible();
    expect(within(machine).getByText('DAY 01 OF 14')).toBeVisible();
    expect(screen.getByText('IN 14 DAYS')).toBeVisible();
    expect(screen.getByLabelText('Follow-up scan available in 14 days')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Take follow-up scan/i })).not
      .toBeInTheDocument();
    expect(
      dispatch.mock.calls.some(([event]) => event.type === 'BEGIN_CAPTURE'),
    ).toBe(false);
    expect(document.querySelectorAll('[data-machine-chassis="canonical"]')).toHaveLength(1);
  });

  it('keeps ready geometry on the canonical shell and launches the existing follow-up event', async () => {
    const user = userEvent.setup();
    const pending = buildDemoFixtureState('trial_pending', 'clear_favorable_change');
    const ready = buildDemoFixtureState('followup_ready', 'clear_favorable_change');
    const dispatch = vi.fn<(event: FaceValueEvent) => void>();
    const rendered = renderState(pending, 'trial_pending', dispatch);
    const pendingMachine = document.querySelector('[data-machine-projection="trial-pending"]');
    const pendingChassis = document.querySelector('[data-machine-chassis="canonical"]');
    const pendingMachineClass = pendingMachine?.getAttribute('class');
    const pendingChassisClass = pendingChassis?.getAttribute('class');

    rendered.rerender(
      <FaceValueContext.Provider
        value={{
          state: ready,
          dispatch,
          demoRuntime: runtimeFor('followup_ready', ready),
        }}
      >
        <FaceValueApplication />
      </FaceValueContext.Provider>,
    );

    const readyMachine = document.querySelector('[data-machine-projection="followup-ready"]');
    const readyChassis = document.querySelector('[data-machine-chassis="canonical"]');
    expect(readyMachine).toHaveAttribute('data-machine-shell', 'canonical');
    expect(readyMachine?.getAttribute('class')).toBe(pendingMachineClass);
    expect(readyChassis?.getAttribute('class')).toBe(pendingChassisClass);
    expect(document.querySelectorAll('[data-machine-chassis="canonical"]')).toHaveLength(1);
    expect(screen.getByText('READY')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Take follow-up scan' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BEGIN_CAPTURE',
        kind: 'followup',
      }),
    );
  });

  it('preserves saved-result Home and its Latest Verdict cassette', () => {
    const state = buildDemoFixtureState('home_saved_result', 'clear_favorable_change');
    renderState(state, 'home_saved_result');

    expect(document.querySelector('[data-latest-verdict-cassette]')).not.toBeNull();
    expect(document.querySelector('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
      'data-machine-shell',
      'canonical',
    );
    expect(document.querySelector('[data-machine-projection="empty"]')).toBeNull();
    expect(document.querySelector('[data-machine-projection="trial-pending"]')).toBeNull();
    expect(screen.getByRole('button', { name: /Previous trials, 1 saved result/ })).toBeVisible();
  });
});
