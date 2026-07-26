import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';
import { PRODUCTS } from '../fixtures/products';
import { EvidenceMachine } from '../features/evidence-machine/EvidenceMachine';
import {
  createEvidenceRecord,
  createInitialEvidenceTrial,
  productFromSpecimen,
  transitionTrial,
  type EvidenceTrialState,
} from '../features/evidence-machine/evidenceTrial';

const scan = (kind: 'baseline' | 'followup', day: string) => ({
  id: `${kind}-${day}`, kind, source: 'file' as const, mimeType: 'image/jpeg' as const,
  createdAt: `2026-07-${day}T12:00:00.000Z`, orientationRule: 'analysis-unmirrored' as const,
});

function stateAt(phase: 'baseline-required' | 'trial-active' | 'verdict-ready'): EvidenceTrialState {
  let state = createInitialEvidenceTrial('machine-test');
  state = transitionTrial(state, { type: 'PRODUCT_REGISTERED', product: productFromSpecimen(PRODUCTS[1]) });
  state = transitionTrial(state, { type: 'JOB_SELECTED', job: 'Visible Tone Consistency' });
  state = transitionTrial(state, { type: 'JOB_ASSIGNED' });
  if (phase === 'baseline-required') return state;
  state = transitionTrial(state, { type: 'BASELINE_CAPTURE_REQUESTED' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURED', scan: scan('baseline', '15') });
  state = transitionTrial(state, { type: 'TRIAL_STARTED', startedAt: '2026-07-15T12:00:00.000Z', targetAt: '2026-07-27T12:00:00.000Z' });
  if (phase === 'trial-active') return state;
  state = transitionTrial(state, { type: 'FOLLOW_UP_DUE' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURE_REQUESTED' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURED', scan: scan('followup', '27') });
  return transitionTrial(state, { type: 'PROCESSING_COMPLETED', result: ANALYSIS_SCENARIOS.likely_change });
}

beforeEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
});

describe('canonical Evidence Machine', () => {
  it('renders the full lower door as one native button only when actionable', () => {
    const { rerender } = render(<EvidenceMachine trial={stateAt('baseline-required')} onMachineAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Start baseline scan/i })).toBeInTheDocument();
    rerender(<EvidenceMachine trial={stateAt('trial-active')} onMachineAction={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('compresses before the door releases and feeds the artifact from the slot', async () => {
    vi.useFakeTimers();
    const ready = stateAt('verdict-ready');
    const revealing = transitionTrial(ready, { type: 'VERDICT_REVEAL_STARTED' });
    const record = createEvidenceRecord(revealing, '2026-07-27T12:01:00.000Z');
    const presented = vi.fn();
    const { container } = render(
      <EvidenceMachine
        trial={ready}
        onMachineAction={vi.fn()}
        onRecordGenerated={() => record}
        onRecordPresented={presented}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Release Evidence Record/i }));
    expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'actuator-pressed');
    expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-door-state', 'closed');

    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-door-state', 'released');
    act(() => vi.advanceTimersByTime(130));
    expect(container.querySelector('[data-dispense-step="edge"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Collect Evidence Record/i })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(760));
    expect(presented).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Collect Evidence Record/i })).toBeInTheDocument();
  });

  it('collects the presented artifact exactly once by semantic activation', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const ready = stateAt('verdict-ready');
    const revealing = transitionTrial(ready, { type: 'VERDICT_REVEAL_STARTED' });
    const record = createEvidenceRecord(revealing, '2026-07-27T12:01:00.000Z');
    const collected = vi.fn();
    render(<EvidenceMachine trial={ready} onMachineAction={vi.fn()} onRecordGenerated={() => record} onRecordCollected={collected} />);
    await user.click(screen.getByRole('button', { name: /Release Evidence Record/i }));
    act(() => vi.advanceTimersByTime(1000));
    const artifact = screen.getByRole('button', { name: /Collect Evidence Record/i });
    await user.click(artifact);
    await user.click(artifact);
    act(() => vi.advanceTimersByTime(500));
    expect(collected).toHaveBeenCalledOnce();
  });

  it('keeps the collectible face concise and leaves detail fields out', () => {
    const ready = stateAt('verdict-ready');
    const revealing = transitionTrial(ready, { type: 'VERDICT_REVEAL_STARTED' });
    const withRecord = transitionTrial(revealing, { type: 'RECORD_GENERATED', generatedAt: '2026-07-27T12:01:00.000Z' });
    const presented = transitionTrial(withRecord, { type: 'RECORD_PRESENTED' });
    render(<EvidenceMachine trial={presented} />);
    expect(screen.getByText('EVIDENCE RECORD 014')).toBeVisible();
    expect(screen.getByText('SLIGHTLY IMPROVED')).toBeVisible();
    expect(screen.getByText('LIKELY')).toBeVisible();
    expect(screen.queryByText('NOT ESTABLISHED')).not.toBeInTheDocument();
    expect(screen.queryByText('Technical metadata')).not.toBeInTheDocument();
  });
});
