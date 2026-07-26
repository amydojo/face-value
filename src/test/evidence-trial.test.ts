import { describe, expect, it } from 'vitest';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';
import { PRODUCTS } from '../fixtures/products';
import {
  InvalidTrialTransitionError,
  assertSinglePrimaryAction,
  confidenceSeal,
  createEvidenceRecord,
  createInitialEvidenceTrial,
  productFromSpecimen,
  resolveMachineConfiguration,
  restoreInterruptedTrial,
  transitionTrial,
  type EvidenceTrialState,
} from '../features/evidence-machine/evidenceTrial';

const scan = (kind: 'baseline' | 'followup', day: string) => ({
  id: `${kind}-${day}`,
  kind,
  source: 'file' as const,
  mimeType: 'image/jpeg' as const,
  createdAt: `2026-07-${day}T12:00:00.000Z`,
  orientationRule: 'analysis-unmirrored' as const,
});

function verdictReady(): EvidenceTrialState {
  let state = createInitialEvidenceTrial('trial-test');
  state = transitionTrial(state, { type: 'PRODUCT_REGISTERED', product: productFromSpecimen(PRODUCTS[1]) });
  state = transitionTrial(state, { type: 'JOB_SELECTED', job: 'Visible Tone Consistency' });
  state = transitionTrial(state, { type: 'JOB_ASSIGNED' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURE_REQUESTED' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURED', scan: scan('baseline', '15') });
  state = transitionTrial(state, { type: 'TRIAL_STARTED', startedAt: '2026-07-15T12:00:00.000Z', targetAt: '2026-07-27T12:00:00.000Z' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_DUE' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURE_REQUESTED' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURED', scan: scan('followup', '27') });
  return transitionTrial(state, { type: 'PROCESSING_COMPLETED', result: ANALYSIS_SCENARIOS.likely_change });
}

describe('canonical trial transition function', () => {
  it('preserves one product, job, scans, verdict, and record through the full slice', () => {
    let state = verdictReady();
    expect(state.product?.name).toBe('HYDRATING DROPS');
    expect(state.assignedJob).toBe('Visible Tone Consistency');
    expect(resolveMachineConfiguration(state).primaryActionOwner).toBe('machine');

    state = transitionTrial(state, { type: 'VERDICT_REVEAL_STARTED' });
    state = transitionTrial(state, { type: 'RECORD_GENERATED', generatedAt: '2026-07-27T12:01:00.000Z' });
    state = transitionTrial(state, { type: 'RECORD_PRESENTED' });
    expect(resolveMachineConfiguration(state).primaryActionOwner).toBe('artifact');
    state = transitionTrial(state, { type: 'RECORD_COLLECTED' });
    state = transitionTrial(state, { type: 'DISPOSITION_SELECTED', disposition: 'established' });

    expect(state.phase).toBe('complete');
    expect(state.evidenceRecord).toMatchObject({
      productName: 'HYDRATING DROPS',
      recordNumber: '014',
      finding: { metric: 'VISIBLE EVENNESS', summary: 'SLIGHTLY IMPROVED' },
      confidence: 'likely',
      nextStep: 'Established routine',
    });
    expect(state.baselineScan?.id).toBe('baseline-15');
    expect(state.followUpScan?.id).toBe('followup-27');
  });

  it('rejects impossible transitions instead of reconstructing state on another screen', () => {
    expect(() => transitionTrial(createInitialEvidenceTrial(), { type: 'RECORD_COLLECTED' })).toThrow(InvalidTrialTransitionError);
  });

  it('generates one idempotent durable record under repeated release work', () => {
    const ready = verdictReady();
    const revealing = transitionTrial(ready, { type: 'VERDICT_REVEAL_STARTED' });
    const first = createEvidenceRecord(revealing, '2026-07-27T12:01:00.000Z');
    const withRecord = transitionTrial(revealing, { type: 'RECORD_GENERATED', generatedAt: '2026-07-27T12:01:00.000Z' });
    const second = createEvidenceRecord(withRecord, '2026-07-27T12:03:00.000Z');
    expect(second).toBe(withRecord.evidenceRecord);
    expect(second.id).toBe(first.id);
  });

  it('restores interruptions to the nearest durable physical state', () => {
    const revealing = transitionTrial(verdictReady(), { type: 'VERDICT_REVEAL_STARTED' });
    expect(restoreInterruptedTrial(revealing).phase).toBe('verdict-ready');
    const withRecord = transitionTrial(revealing, { type: 'RECORD_GENERATED', generatedAt: '2026-07-27T12:01:00.000Z' });
    expect(restoreInterruptedTrial(withRecord).phase).toBe('record-presented');
  });

  it('enforces one primary action owner', () => {
    expect(() => assertSinglePrimaryAction({ machinePrimary: true, pagePrimary: true })).toThrow(/competing primary actions/);
    expect(() => assertSinglePrimaryAction({ artifactPrimary: true })).not.toThrow();
  });

  it('maps uncertainty to physical seals without reward tiers', () => {
    expect(confidenceSeal('established')).toBe('solid');
    expect(confidenceSeal('likely')).toBe('partial');
    expect(confidenceSeal('possible')).toBe('open');
  });
});
