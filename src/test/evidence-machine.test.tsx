import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';
import { PRODUCTS } from '../fixtures/products';
import { EvidenceMachine } from '../features/evidence-machine/EvidenceMachine';
import { EvidenceRecordArtifact } from '../features/evidence-machine/EvidenceRecordArtifact';
import { confidenceSeal, nextReleaseState } from '../features/evidence-machine/evidenceMachineLogic';
import {
  createEvidenceRecordForTrial,
  createInitialEvidenceTrial,
  restoreStableTrial,
  transitionTrial,
  type EvidenceTrialState,
} from '../features/evidence-machine/evidenceTrial';
import { assertSinglePrimaryAction, resolveMachineConfiguration } from '../features/evidence-machine/machineConfiguration';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

const scan = (kind: 'baseline' | 'followup') => ({
  id: `${kind}-1`,
  kind,
  source: 'file' as const,
  mimeType: 'image/jpeg' as const,
  createdAt: '2026-07-15T12:00:00.000Z',
  orientationRule: 'analysis-unmirrored' as const,
});

const verdictReady = (): EvidenceTrialState => {
  let state = createInitialEvidenceTrial();
  state = transitionTrial(state, { type: 'PRODUCT_REGISTERED', product: PRODUCTS[1] });
  state = transitionTrial(state, { type: 'JOB_SELECTED', job: 'Visible tone consistency' });
  state = transitionTrial(state, { type: 'JOB_ASSIGNED', job: 'Visible tone consistency' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURE_STARTED' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURED', scan: scan('baseline'), startedAt: '15 JUL', targetAt: '27 JUL' });
  state = transitionTrial(state, { type: 'TRIAL_STARTED' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURE_STARTED' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURED', scan: scan('followup') });
  state = transitionTrial(state, { type: 'PROCESSING_STARTED' });
  return transitionTrial(state, { type: 'PROCESSING_COMPLETED', verdict: ANALYSIS_SCENARIOS.likely_change });
};

describe('canonical trial model', () => {
  it('preserves one trial identity across the vertical slice', () => {
    const state = verdictReady();
    expect(state.trialId).toBe('trial-face-value-014');
    expect(state.product?.product).toBe('HYDRATING DROPS');
    expect(state.assignedJob).toBe('Visible tone consistency');
    expect(state.baselineScan?.kind).toBe('baseline');
    expect(state.followUpScan?.kind).toBe('followup');
    expect(state.phase).toBe('verdict-ready');
  });

  it('rejects invalid transitions', () => {
    expect(() => transitionTrial(createInitialEvidenceTrial(), { type: 'RECORD_COLLECTED' })).toThrow(/Invalid trial transition/);
  });

  it('generates an idempotent durable record', () => {
    let state = transitionTrial(verdictReady(), { type: 'VERDICT_RELEASE_STARTED' });
    const record = createEvidenceRecordForTrial(state, '27 JUL');
    state = transitionTrial(state, { type: 'RECORD_GENERATED', record });
    expect(createEvidenceRecordForTrial(state, '28 JUL')).toBe(record);
  });

  it('restores interrupted release to the nearest stable state', () => {
    const revealing = transitionTrial(verdictReady(), { type: 'VERDICT_RELEASE_STARTED' });
    expect(restoreStableTrial(revealing).phase).toBe('verdict-ready');
    const record = createEvidenceRecordForTrial(revealing, '27 JUL');
    const generated = transitionTrial(revealing, { type: 'RECORD_GENERATED', record });
    expect(restoreStableTrial(generated).phase).toBe('record-presented');
  });
});

describe('machine resolver and ownership', () => {
  it('makes verdict ready machine-owned with one armed actuator', () => {
    const config = resolveMachineConfiguration(verdictReady());
    expect(config.primaryActionOwner).toBe('machine');
    expect(config.actuator.state).toBe('armed');
    expect(config.actuator.actionId).toBe('reveal-verdict');
  });

  it('enforces exactly one primary owner', () => {
    expect(() => assertSinglePrimaryAction({ primaryActionOwner: 'machine', machinePrimary: true, pagePrimary: true })).toThrow(/competing/);
    expect(() => assertSinglePrimaryAction({ primaryActionOwner: 'artifact', artifactPrimary: true })).not.toThrow();
  });
});

describe('release state machine', () => {
  it('follows the causal release order', () => {
    expect(nextReleaseState('ready', 'PRESS')).toBe('actuator-pressed');
    expect(nextReleaseState('actuator-pressed', 'LATCH')).toBe('latch-releasing');
    expect(nextReleaseState('latch-releasing', 'DISPENSE')).toBe('record-dispensing');
    expect(nextReleaseState('record-dispensing', 'PRESENT')).toBe('record-presented');
  });

  it('rejects collection before presentation', () => {
    expect(() => nextReleaseState('record-dispensing', 'COLLECT')).toThrow(/Invalid release transition/);
  });
});

describe('components', () => {
  it('renders actionable machine as one native button', () => {
    render(<EvidenceMachine state={verdictReady()} specimen={PRODUCTS[1]} />);
    expect(screen.getByRole('button', { name: 'Release Evidence Record' })).toBeInTheDocument();
  });

  it('renders inactive machine without a fake button', () => {
    render(<EvidenceMachine state={createInitialEvidenceTrial()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('maps confidence to honest physical seals', () => {
    expect(confidenceSeal('established')).toBe('solid');
    expect(confidenceSeal('likely')).toBe('partial');
    expect(confidenceSeal('possible')).toBe('open');
  });

  it('renders the presented artifact as one semantic action target', async () => {
    const user = userEvent.setup();
    const collect = vi.fn();
    const releasing = transitionTrial(verdictReady(), { type: 'VERDICT_RELEASE_STARTED' });
    const record = createEvidenceRecordForTrial(releasing, '27 JUL');
    render(<EvidenceRecordArtifact record={record} mode="dispensed" actionable onCollect={collect} />);
    const button = screen.getByRole('button', { name: /Collect Evidence Record/ });
    await user.click(button);
    expect(collect).toHaveBeenCalledOnce();
    expect(screen.getByText('EVIDENCE RECORD 014')).toBeVisible();
    expect(screen.queryByText(record.detail.context)).not.toBeInTheDocument();
  });
});
