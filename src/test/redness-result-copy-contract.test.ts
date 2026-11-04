import { describe, expect, it } from 'vitest';
import type { RednessEvaluationSnapshot } from '../domain/evidence/redness';
import {
  allComparability,
  decisionGrid,
  evaluateLiveScenario,
  type LiveScenario,
} from './support/rednessScenarios';

// Copy contract for engine-authored result text. Every rule is a mechanical check over evaluator
// state and the words it produced, applied to every scenario in the decision grid.

const established = (s: RednessEvaluationSnapshot) =>
  s.measurementQuality === 'adequate' || s.measurementQuality === 'strong';
const engineText = (s: RednessEvaluationSnapshot) =>
  [s.interpretation.finding, s.interpretation.nonFinding, s.interpretation.explanation, ...s.interpretation.claimBoundary].join(' ');

/** Independent statement of the gate actionFor() used for test_longer (evaluateRedness.ts). */
function bindingGate(s: RednessEvaluationSnapshot): string | null {
  if (s.interpretation.recommendedAction !== 'test_longer') return null;
  if (s.measurementQuality === 'invalid') return 'invalid';
  if (s.observationWindowStatus === 'too_early') return 'early';
  if (s.measurementQuality === 'limited') return 'limited';
  if (s.effectClassification === 'directional_improvement') return 'directional';
  if (s.directionAgreement.status !== 'agreeing') return 'inconsistent';
  if (s.attributionQuality === 'weak') return 'attribution';
  if (s.corroboratingSignals.length === 0) return 'uncorroborated';
  return 'other';
}
const GATE_WORDS: Record<string, RegExp> = {
  invalid: /not comparable enough to read/i,
  early: /trial window is not complete/i,
  limited: /matching scan conditions were not measured/i,
  directional: /not yet strong/i,
  inconsistent: /moved the other way/i,
  attribution: /reported use or other trial changes/i,
  uncorroborated: /own observation did not confirm/i,
  other: /./,
};

const RULES: Record<string, (s: RednessEvaluationSnapshot) => boolean> = {
  'encouragement only for a directional improvement with established comparability': (s) =>
    !/encouraging/i.test(engineText(s)) ||
    (s.effectClassification === 'directional_improvement' && established(s)),
  'a worsening result never carries encouraging or reassuring words': (s) =>
    s.effectClassification !== 'worsened' || !/encouraging|promising|looks good|on track/i.test(engineText(s)),
  '"comparable" is asserted only when comparability was established': (s) =>
    established(s) ||
    !/across comparable scans|comparable scans did not|in comparable scans|under (comparable|matching scan) conditions/i.test(
      engineText(s),
    ),
  'a test_longer explanation names the gate that produced it': (s) => {
    const gate = bindingGate(s);
    return gate === null || GATE_WORDS[gate].test(s.interpretation.explanation);
  },
  'no movement is claimed from an invalid comparison': (s) =>
    s.measurementQuality !== 'invalid' ||
    !/redness (worsened|improved|changed|was higher|was lower|moved)/i.test(
      `${s.interpretation.finding} ${s.interpretation.explanation}`,
    ),
  '"changed" is never said of a null result': (s) =>
    s.effectClassification !== 'no_detectable_change' || !/redness changed/i.test(s.interpretation.explanation),
  'a strong unanimous improvement is never called "not yet strong"': (s) =>
    !(s.effectClassification === 'strong_improvement' && s.directionAgreement.status === 'agreeing') ||
    !/not yet strong/i.test(s.interpretation.explanation),
  'boundaries are never described as repeat-scan calibrated': (s) =>
    !/repeat-scan threshold/i.test(s.interpretation.explanation),
  'every check_required test_longer or retry_alone explanation tells the person to check their skin': (s) =>
    s.safetyStatus !== 'check_required' ||
    !['test_longer', 'retry_alone'].includes(s.interpretation.recommendedAction) ||
    /your skin/i.test(s.interpretation.explanation),
  '"worsened" is used only for worsening across established comparability': (s) =>
    !/redness worsened/i.test(`${s.interpretation.finding} ${s.interpretation.explanation}`) ||
    (s.effectClassification === 'worsened' && established(s)),
};

describe('engine result copy contract', () => {
  const grid = decisionGrid().map(({ comparabilityClass, scenario }) => ({
    comparabilityClass,
    scenario,
    snapshot: evaluateLiveScenario(scenario),
  }));

  it('covers live, all-pass, one-limited and one-fail measurement', () => {
    expect(new Set(grid.map((row) => row.comparabilityClass))).toEqual(
      new Set(['live_adapter', 'all_pass', 'one_limited', 'one_fail']),
    );
  });

  it.each(Object.keys(RULES))('%s', (rule: string) => {
    const violations = grid
      .filter(({ snapshot }) => !RULES[rule](snapshot))
      .slice(0, 3)
      .map(({ comparabilityClass, scenario, snapshot }) => ({
        comparabilityClass,
        scenario,
        finding: snapshot.interpretation.finding,
        explanation: snapshot.interpretation.explanation,
      }));
    expect(violations).toEqual([]);
  });
});

const live = (overrides: Partial<LiveScenario>): RednessEvaluationSnapshot =>
  evaluateLiveScenario({
    comparability: null,
    delta: 0,
    pattern: 'unanimous',
    intervalDays: 29,
    adherence: 'complete',
    tolerance: 'none',
    anchor: 0,
    context: 'none',
    ...overrides,
  });

describe('engine result copy for named states', () => {
  it('live worsening without symptoms leads with the skin check (V1 said "encouraging")', () => {
    const s = live({ delta: -20, anchor: -1 });
    expect(s.interpretation.recommendedAction).toBe('test_longer');
    expect(s.interpretation.finding).toBe('Visible redness was higher at follow-up.');
    expect(s.interpretation.explanation).toBe(
      'Visible redness was higher at follow-up. Check how your skin is responding before you continue. Matching scan conditions were not measured, so Face Value cannot call this result yet.',
    );
    expect(s.interpretation.claimBoundary[0]).toBe(
      'This result describes visible redness in the saved scans; matching scan conditions were not measured.',
    );
  });

  it('live null result says no change and why it cannot be called', () => {
    const s = live({ delta: 0 });
    expect(s.interpretation.finding).toBe('No detectable improvement showed up.');
    expect(s.interpretation.explanation).toBe(
      'No detectable change showed up, but matching scan conditions were not measured, so Face Value cannot call this result yet.',
    );
    expect(s.interpretation.nonFinding).toBe(
      'The saved scans did not establish progress on the assigned visible-redness job.',
    );
  });

  it('live strong improvement is reported as lower, not as comparable improvement', () => {
    const s = live({ delta: 20, anchor: 1 });
    expect(s.interpretation.finding).toBe('Visible redness was lower at follow-up.');
    expect(s.interpretation.explanation).toBe(
      'Visible redness was lower at follow-up, but matching scan conditions were not measured, so Face Value cannot call this result yet.',
    );
  });

  it('early worsening still leads with the skin check', () => {
    const s = live({ delta: -20, intervalDays: 7 });
    expect(s.interpretation.explanation).toBe(
      'Visible redness was higher at follow-up. Check how your skin is responding before you continue. The trial window is not complete, so this product job cannot be judged yet.',
    );
  });

  it('an unreadable comparison claims no movement and keeps the skin caution', () => {
    const s = live({ delta: -20, context: 'makeup' });
    expect(s.measurementQuality).toBe('invalid');
    expect(s.interpretation.finding).toBe('This comparison was not readable.');
    expect(s.interpretation.explanation).toBe(
      'The scans were not comparable enough to read. Repeat the comparison under matched conditions. If your skin feels worse, pause the product and review how it is responding.',
    );
  });

  it('a blocked null trial does not say redness changed', () => {
    const s = live({ delta: 0, context: 'second_product' });
    expect(s.interpretation.recommendedAction).toBe('retry_alone');
    expect(s.interpretation.explanation).toBe(
      'No detectable change showed up, and another product or routine change means this trial could not isolate this product.',
    );
  });

  it('a blocked worsening trial leads with the skin check', () => {
    const s = live({ delta: -20, context: 'second_product' });
    expect(s.interpretation.explanation).toBe(
      'Visible redness was higher at follow-up. Check how your skin is responding before you continue. Also, another product or routine change means this trial could not isolate this product.',
    );
  });

  it('a strong all-pass improvement the participant did not see names that reason', () => {
    const s = live({ comparability: allComparability('pass'), delta: 20, anchor: -1 });
    expect(s.interpretation.recommendedAction).toBe('test_longer');
    expect(s.interpretation.explanation).toBe(
      'Visible redness was lower at follow-up, but your own observation did not confirm the change, so it is not ready to call.',
    );
  });

  it('keep describes provisional boundaries, never repeat-scan calibration', () => {
    const s = live({ comparability: allComparability('pass'), delta: 20, anchor: 1 });
    expect(s.interpretation.recommendedAction).toBe('keep');
    expect(s.interpretation.finding).toBe('Visible redness improved across comparable scans.');
    expect(s.interpretation.explanation).toBe(
      "Visible redness improved beyond Face Value's provisional strong boundary, and the follow-up frames agreed under matching scan conditions.",
    );
  });

  it('a directional improvement with established comparability may still read as encouraging', () => {
    const s = live({ comparability: allComparability('pass'), delta: 5, anchor: 1 });
    expect(s.interpretation.explanation).toBe(
      'The direction looks encouraging, but the change is not yet strong or consistent enough to call.',
    );
  });

  it('a limited-measurement safety interruption with worsening does not claim comparable worsening', () => {
    const s = live({ delta: -20, tolerance: 'moderate_burning' });
    expect(s.interpretation.recommendedAction).toBe('safety_interruption');
    expect(s.interpretation.explanation).toBe(
      'Visible redness was higher at follow-up, and the reported symptoms make a favorable product verdict inappropriate. Face Value cannot diagnose the reaction.',
    );
  });
});
