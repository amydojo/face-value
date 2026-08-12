import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaceValueContext } from '../app/faceValueContext';
import type { FaceValueEvent } from '../app/phaseBMachine';
import type { TrialTruthFaceValueEvent } from '../app/trialTruthMachine';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { HumanButterProductionJourney } from '../features/HumanButterProductionJourney';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';

function installMatchMedia() {
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
}

beforeEach(() => installMatchMedia());

describe('submission continuity capture context', () => {
  it('keeps baseline capture qualification inside the light-bench instrument', () => {
    const state = buildDemoFixtureState('baseline_context', 'clear_favorable_change');
    const dispatch = vi.fn<(event: FaceValueEvent) => void>();

    render(
      <FaceValueContext.Provider
        value={{
          state,
          dispatch,
          demoRuntime: {
            mode: 'preview',
            startingPoint: 'baseline_context',
            resultFixture: 'clear_favorable_change',
            fixtureNow: null,
          },
        }}
      >
        <FaceValueApplication />
      </FaceValueContext.Provider>,
    );

    expect(screen.getByText('BASELINE SECURED')).toBeVisible();
    expect(screen.getByText('CAPTURE CONTEXT')).toBeVisible();
    expect(screen.getByRole('button', { name: 'NOTHING DIFFERENT' })).toBeVisible();
    const chassis = document.querySelector('[data-canonical-trial-chassis="baseline-context"]');
    expect(chassis).toBeInTheDocument();
    expect(chassis?.querySelector('[data-oracle-machine]')).toHaveAttribute(
      'data-machine-implementation',
      'oracle',
    );
    expect(document.querySelector('main')).toHaveAttribute('data-fv-tone', 'light');
  });

  it('exposes follow-up capture context in Demo Lab through the existing Trial Truth machine', () => {
    const state = buildDemoFixtureState('followup_context', 'clear_favorable_change');
    const dispatch = vi.fn<(event: FaceValueEvent) => void>();
    const dispatchTrialTruth = vi.fn<(event: TrialTruthFaceValueEvent) => void>();

    render(
      <FaceValueContext.Provider
        value={{
          state,
          dispatch,
          dispatchTrialTruth,
          demoRuntime: {
            mode: 'preview',
            startingPoint: 'followup_context',
            resultFixture: 'clear_favorable_change',
            fixtureNow: null,
          },
        }}
      >
        <HumanButterProductionJourney />
      </FaceValueContext.Provider>,
    );

    expect(screen.getByText('FOLLOW-UP SECURED')).toBeVisible();
    expect(screen.getByText('Anything different around today’s scan?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'NOTHING DIFFERENT' })).toBeVisible();
    expect(document.querySelector('[data-oracle-machine]')).toBeInTheDocument();
    expect(document.querySelector('main')).toHaveAttribute('data-fv-tone', 'light');
  });
});
