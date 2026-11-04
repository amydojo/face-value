import { describe, expect, it } from 'vitest';
import golden from './fixtures/redness-decision-golden.v1.json';
import {
  decisionGrid,
  evaluateLiveScenario,
  summarizeDecisions,
} from './support/rednessScenarios';

// The golden was generated from unmodified V1 (main@766c76c) before any copy change.
// Copy corrections must never move it. A deliberate policy change must regenerate it in the
// same change and say so.
describe('redness decision parity with V1', () => {
  const summary = summarizeDecisions(decisionGrid());

  it('keeps every evaluator decision identical to the frozen V1 grid', () => {
    expect(summary.rowCount).toBe(golden.rowCount);
    expect(summary.outcomeCounts).toEqual(golden.outcomeCounts);
    expect(summary.fingerprint).toBe(golden.fingerprint);
  });

  it('documents the live lockout: the production adapter cannot reach keep or not_proving_job', () => {
    const actionsFor = (comparabilityClass: string) =>
      new Set(
        Object.keys(summary.outcomeCounts)
          .filter((key) => key.startsWith(`${comparabilityClass}|`))
          .map((key) => key.split('|').at(-1)),
      );

    expect([...actionsFor('live_adapter')].sort()).toEqual([
      'retry_alone',
      'safety_interruption',
      'test_longer',
    ]);
    expect([...actionsFor('one_limited')].sort()).toEqual([...actionsFor('live_adapter')].sort());
    expect(actionsFor('all_pass')).toEqual(
      new Set(['keep', 'not_proving_job', 'retry_alone', 'safety_interruption', 'test_longer']),
    );
  });

  it('routes objective worsening under live measurement to test_longer (P0-B policy question)', () => {
    const snapshot = evaluateLiveScenario({
      comparability: null,
      delta: -20,
      pattern: 'unanimous',
      intervalDays: 29,
      adherence: 'complete',
      tolerance: 'none',
      anchor: -1,
      context: 'none',
    });
    expect(snapshot.effectClassification).toBe('worsened');
    expect(snapshot.measurementQuality).toBe('limited');
    expect(snapshot.safetyStatus).toBe('check_required');
    expect(snapshot.interpretation.recommendedAction).toBe('test_longer');
  });
});
