import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
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

const machinePartSelectors = {
  chassis: '[data-oracle-chassis]',
  carbon: '[data-oracle-carbon-texture]',
  bezel: '[data-oracle-display-opening]',
  glass: '[data-oracle-display-glass]',
  specimen: '[data-oracle-specimen]',
  lowerDeck: '[data-oracle-lower-deck]',
  slot: '[data-oracle-slot]',
  amber: '[data-oracle-amber-control]',
  handle: '[data-oracle-handle]',
  bottomRail: '[data-oracle-bottom-rail]',
  evidencePath: '[data-oracle-evidence-path]',
  slotLip: '[data-oracle-slot-lip]',
} as const;

function machineStructure(machine: HTMLElement) {
  const parts = Object.fromEntries(
    Object.entries(machinePartSelectors).map(([name, selector]) => [
      name,
      machine.querySelector<HTMLElement>(selector),
    ]),
  ) as Record<keyof typeof machinePartSelectors, HTMLElement | null>;

  for (const [name, part] of Object.entries(parts)) {
    if (!part) throw new Error(`Expected Oracle machine part: ${name}`);
    expect(machine.querySelectorAll(machinePartSelectors[name as keyof typeof parts])).toHaveLength(
      1,
    );
  }

  return {
    tags: Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, part?.tagName])),
    parents: {
      chassis: parts.chassis?.parentElement === machine,
      carbon: parts.carbon?.parentElement === parts.chassis,
      bezel: parts.bezel?.parentElement === parts.chassis,
      glass: parts.glass?.parentElement === parts.bezel,
      specimen: parts.specimen?.parentElement === parts.glass,
      lowerDeck: parts.lowerDeck?.parentElement === parts.chassis,
      slot: parts.slot?.parentElement === parts.lowerDeck,
      amber: parts.amber?.parentElement === parts.lowerDeck,
      handle: parts.handle?.parentElement === parts.lowerDeck,
      bottomRail: parts.bottomRail?.parentElement === parts.lowerDeck,
      evidencePath: parts.evidencePath?.parentElement === machine,
      slotLip: parts.slotLip?.parentElement === machine,
    },
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
    expect(
      screen.getByRole('heading', { name: 'Is your skincare actually doing anything?' }),
    ).toBeVisible();
    expect(screen.getByText('NO SPECIMEN LOADED')).toBeVisible();
    expect(screen.getByText('Insert one product to begin.')).toBeVisible();
    expect(document.querySelector('main')).toHaveAttribute('data-fv-tone', 'dark');
    expect(document.querySelector('[data-trial-machine-state="empty"]')).toHaveAttribute(
      'data-machine-implementation',
      'oracle',
    );
    expect(document.querySelectorAll('[data-oracle-chassis]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'LOAD A PRODUCT' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'START_PRODUCT_REGISTRATION' });
  });

  it('keeps Baseline locked distinct from the loaded pending machine', () => {
    const state = buildDemoFixtureState('baseline_locked', 'clear_favorable_change');
    renderState(state, 'baseline_locked');

    expect(state.stage).toBe('baseline_locked');
    expect(screen.getByRole('heading', { name: 'Baseline locked.' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'DONE' })).toBeVisible();
    expect(document.querySelector('[data-cassette-variant="trial-state"]')).toBeNull();
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
    const machine = document.querySelector('[data-trial-machine-state="pending"]');
    if (!(machine instanceof HTMLElement)) throw new Error('Expected the pending machine.');
    const specimen = machine.querySelector('[data-oracle-specimen]');

    expect(machine).toHaveAttribute('data-machine-implementation', 'oracle');
    expect(specimen).toHaveAttribute('data-specimen-brand', 'Face Value Lab');
    expect(specimen).toHaveAttribute('data-specimen-product', 'One Thing Redness Trial');
    expect(specimen).toHaveAttribute('data-specimen-strength', '10%');
    expect(specimen).toHaveAttribute('data-specimen-volume', '30 ml');
    expect(specimen).toHaveAttribute('data-display-brand', 'FACE VAL');
    expect(within(machine).queryByText('FACE VAL')).not.toBeInTheDocument();
    expect(machine.querySelector('[data-label-product]')).toHaveTextContent('ONE THING');
    expect(within(machine).getByText('REDUCE VISIBLE REDNESS')).toBeVisible();
    expect(within(machine).getByText('DAY 01 OF 14')).toBeVisible();
    expect(screen.getByText('IN 14 DAYS')).toBeVisible();
    expect(screen.getByLabelText('Follow-up scan available in 14 days')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Take follow-up scan/i })).not.toBeInTheDocument();
    expect(dispatch.mock.calls.some(([event]) => event.type === 'BEGIN_CAPTURE')).toBe(false);
    expect(document.querySelectorAll('[data-oracle-chassis]')).toHaveLength(1);
  });

  it('keeps ready on the same Oracle machine and launches the existing follow-up event', async () => {
    const user = userEvent.setup();
    const pending = buildDemoFixtureState('trial_pending', 'clear_favorable_change');
    const ready = buildDemoFixtureState('followup_ready', 'clear_favorable_change');
    const dispatch = vi.fn<(event: FaceValueEvent) => void>();
    const rendered = renderState(pending, 'trial_pending', dispatch);
    const pendingMachine = document.querySelector('[data-trial-machine-state="pending"]');
    const pendingChassis = document.querySelector('[data-oracle-chassis]');
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

    const readyMachine = document.querySelector('[data-trial-machine-state="followup-ready"]');
    const readyChassis = document.querySelector('[data-oracle-chassis]');
    expect(readyMachine).toHaveAttribute('data-machine-implementation', 'oracle');
    expect(readyMachine?.getAttribute('class')).toBe(pendingMachineClass);
    expect(readyChassis?.getAttribute('class')).toBe(pendingChassisClass);
    expect(document.querySelectorAll('[data-oracle-chassis]')).toHaveLength(1);
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
      'data-machine-implementation',
      'oracle',
    );
    expect(document.querySelector('[data-cassette-variant="trial-state"]')).toBeNull();
    expect(document.querySelector('[data-oracle-specimen]')).toHaveAttribute(
      'data-specimen-brand',
      'Face Value Lab',
    );
    expect(document.querySelector('[data-oracle-specimen]')).toHaveAttribute(
      'data-specimen-product',
      'One Thing Redness Trial',
    );
    expect(document.querySelector('[data-oracle-specimen]')).toHaveAttribute(
      'data-specimen-strength',
      '10%',
    );
    expect(document.querySelector('[data-oracle-specimen]')).toHaveAttribute(
      'data-specimen-volume',
      '30 ml',
    );
    expect(screen.getByRole('button', { name: /Previous trials, 1 saved result/ })).toBeVisible();
  });

  it('keeps one internally consistent Demo Lab product from follow-up through saved result', () => {
    for (const startingPoint of [
      'followup_ready',
      'verdict_ready',
      'cassette_revealed',
      'evidence_recorded',
      'home_saved_result',
    ] as const) {
      const state = buildDemoFixtureState(startingPoint, 'clear_favorable_change');
      const rendered = renderState(state, startingPoint);
      const specimen = document.querySelector('[data-oracle-specimen]');
      expect(specimen).toHaveAttribute('data-specimen-brand', 'Face Value Lab');
      expect(specimen).toHaveAttribute('data-specimen-product', 'One Thing Redness Trial');
      expect(specimen).toHaveAttribute('data-specimen-strength', '10%');
      expect(specimen).toHaveAttribute('data-specimen-volume', '30 ml');
      expect(specimen).not.toHaveAttribute('data-specimen-brand', 'FACE VALUE');
      rendered.unmount();
      cleanup();
    }
  });

  it('keeps one Oracle hardware tree across empty, pending, ready, reveal, and latest verdict', () => {
    const cases: Array<{
      state: PhaseBFaceValueState;
      startingPoint: DemoStartingPoint | null;
      expectedVariant: string;
    }> = [
      { state: initialState, startingPoint: null, expectedVariant: 'trial-state' },
      {
        state: buildDemoFixtureState('trial_pending', 'clear_favorable_change'),
        startingPoint: 'trial_pending',
        expectedVariant: 'trial-state',
      },
      {
        state: buildDemoFixtureState('followup_ready', 'clear_favorable_change'),
        startingPoint: 'followup_ready',
        expectedVariant: 'trial-state',
      },
      {
        state: buildDemoFixtureState('verdict_ready', 'clear_favorable_change'),
        startingPoint: 'verdict_ready',
        expectedVariant: 'reveal',
      },
      {
        state: buildDemoFixtureState('home_saved_result', 'clear_favorable_change'),
        startingPoint: 'home_saved_result',
        expectedVariant: 'latest-verdict',
      },
    ];
    let reference: ReturnType<typeof machineStructure> | null = null;

    for (const entry of cases) {
      const rendered = renderState(entry.state, entry.startingPoint);
      const machine = document.querySelector<HTMLElement>('[data-oracle-machine]');
      if (!machine) throw new Error('Expected the production Oracle machine.');
      expect(machine).toHaveAttribute('data-machine-implementation', 'oracle');
      expect(machine).toHaveAttribute('data-cassette-variant', entry.expectedVariant);
      const structure = machineStructure(machine);
      expect(Object.values(structure.parents).every(Boolean)).toBe(true);
      if (reference) expect(structure).toEqual(reference);
      else reference = structure;
      rendered.unmount();
      cleanup();
    }
  });

  it('contains no reconstructed hardware shell, geometry override, or CSS bottle', () => {
    const source = readFileSync(
      resolve('src/features/oracle-reveal/OracleRevealScene.tsx'),
      'utf8',
    );
    const css = readFileSync(
      resolve('src/features/oracle-reveal/OracleRevealScene.module.css'),
      'utf8',
    );

    for (const removedName of [
      'CanonicalMachineShell',
      'CanonicalMachineProjection',
      'CanonicalAmberState',
      'ContinuityProjection',
      'compactSpecimenLabel',
    ]) {
      expect(source).not.toContain(removedName);
    }
    for (const removedSelector of [
      '.continuityMachine',
      '.emptySpecimen',
      '.loadedSpecimen',
      '.loadedSpecimenCap',
      '.loadedSpecimenCollar',
      '.loadedSpecimenBody',
      '.loadedSpecimenLabel',
      '.loadedPedestal',
    ]) {
      expect(css).not.toContain(removedSelector);
    }
  });
});
