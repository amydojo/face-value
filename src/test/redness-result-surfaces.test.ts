import { describe, expect, it } from 'vitest';
import { canonicalActionLabel } from '../features/verdict/verdictViewModel';
import {
  decisionGrid,
  evaluateLiveScenario,
  surfacesFor,
  type LiveScenario,
  type ResultSurfaces,
} from './support/rednessScenarios';
import type { RednessEvaluationSnapshot } from '../domain/evidence/redness';

// User-visible copy across the Oracle (reveal headline, recommendation paragraph, NEXT label),
// the Evidence Record (headline, interpretation, next-step card, saved explanation) and
// Previous Trials, taken from the production view models for every scenario in the grid.

const established = (s: RednessEvaluationSnapshot) =>
  s.measurementQuality === 'adequate' || s.measurementQuality === 'strong';
const everyString = (v: ResultSurfaces) =>
  [
    v.oracleHeadline,
    v.oracleExplanation,
    v.recordHeadline,
    v.recordInterpretation,
    v.recordNextBody,
    v.recordSavedExplanation ?? '',
    v.previousTrialsVerdict,
    v.nonFinding,
    v.claimBoundary,
  ].join(' ‖ ');

const RULES: Record<string, (s: RednessEvaluationSnapshot, v: ResultSurfaces) => boolean> = {
  'Oracle, Record and Previous Trials show the saved finding and explanation verbatim': (s, v) =>
    v.oracleHeadline === s.interpretation.finding &&
    v.recordHeadline === s.interpretation.finding &&
    v.previousTrialsVerdict === s.interpretation.finding &&
    v.oracleExplanation === s.interpretation.explanation &&
    v.recordSavedExplanation === s.interpretation.explanation,
  'the Oracle NEXT label and Record next-step title follow the evaluator action': (s, v) =>
    v.oracleNextStep === canonicalActionLabel(s.interpretation.recommendedAction),
  'no surface pairs a worsening result with encouraging words': (s, v) =>
    s.effectClassification !== 'worsened' || !/encouraging|promising|looks good|on track/i.test(everyString(v)),
  'no surface describes scans as comparable unless comparability was established': (s, v) =>
    established(s) || !/across comparable scans|in comparable scans|comparable scans did not/i.test(everyString(v)),
  'every check_required test_longer or retry_alone next step leads with the skin check': (s, v) =>
    s.safetyStatus !== 'check_required' ||
    !['test_longer', 'retry_alone'].includes(s.interpretation.recommendedAction) ||
    (/your skin/i.test(v.recordNextBody) && v.recordNextTone === 'safety'),
  'the Record never says redness changed when no change was detected': (s, v) =>
    s.effectClassification !== 'no_detectable_change' || !/redness changed/i.test(v.recordInterpretation),
  'the Record never asks whether a change holds when no change was detected': (s, v) =>
    s.effectClassification !== 'no_detectable_change' || !/change holds/i.test(v.recordNextBody),
  'nothing a person can see describes scans as comparable unless comparability was established': (s, v) =>
    established(s) || !/comparable scans/i.test(v.visible.join(' \u2016 ')),
  'nothing a person can see pairs a worsening result with encouraging words': (s, v) =>
    s.effectClassification !== 'worsened' || !/encouraging|promising|looks good|on track/i.test(v.visible.join(' ')),
  'the visible claim boundary says when matching scan conditions were not measured': (s, v) =>
    established(s) || /matching scan conditions were not measured/.test(v.visible.join(' ')),
  'no movement is claimed on any surface from an invalid comparison': (s, v) =>
    s.measurementQuality !== 'invalid' ||
    !/redness (worsened|improved|changed|was higher|was lower|moved)/i.test(
      `${v.oracleHeadline} ${v.oracleExplanation} ${v.recordInterpretation}`,
    ),
};

describe('result surfaces copy contract', () => {
  const rows = decisionGrid().map(({ comparabilityClass, scenario }) => {
    const snapshot = evaluateLiveScenario(scenario);
    return { comparabilityClass, scenario, snapshot, surfaces: surfacesFor(snapshot) };
  });

  it.each(Object.keys(RULES))('%s', (rule: string) => {
    const violations = rows
      .filter(({ snapshot, surfaces }) => !RULES[rule](snapshot, surfaces))
      .slice(0, 3)
      .map(({ comparabilityClass, scenario, surfaces }) => ({ comparabilityClass, scenario, surfaces }));
    expect(violations).toEqual([]);
  });
});

const live = (overrides: Partial<LiveScenario>): ResultSurfaces =>
  surfacesFor(
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
    }),
  );

describe('result surfaces for named live states', () => {
  it('live worsening: every surface a person reads, as V1 now shows it', () => {
    const v = live({ delta: -20, anchor: -1 });
    expect(v).toMatchObject({
      oracleHeadline: 'Visible redness was higher at follow-up.',
      oracleExplanation:
        'Visible redness was higher at follow-up. Check how your skin is responding before you continue. Matching scan conditions were not measured, so Face Value cannot call this result yet.',
      oracleNextStep: 'TEST LONGER',
      recordHeadline: 'Visible redness was higher at follow-up.',
      recordInterpretation: 'Visible redness was higher in the saved comparison.',
      recordNextTitle: 'Test longer',
      recordNextBody: 'Check how your skin is responding before you continue, then repeat a comparable scan.',
      recordNextTone: 'safety',
      previousTrialsVerdict: 'Visible redness was higher at follow-up.',
    });
    // What the current UI renders visibly for this trial (Chromium-verified on the branch build).
    const guidance = [
      'Check your skin before you continue',
      'The measurements moved in an unfavorable direction.',
      'Matching scan conditions were not measured, so this change is not confirmed.',
      'Face Value cannot tell whether the product caused it.',
      'Look at how your skin feels before using the product again. If it is irritated, pause the product.',
      '"Test longer" describes the evidence, not your skin. It does not mean continued use has been shown to be safe.',
    ];
    expect(v.visible).toEqual([
      'Visible redness was higher at follow-up.',
      'TEST LONGER',
      ...guidance,
      '-20 points',
      '6/6 checks passed',
      'Early',
      'TEST LONGER',
      'Visible redness was higher at follow-up.',
      'This result describes visible redness in the saved scans; matching scan conditions were not measured. Face Value operating thresholds are not clinical efficacy thresholds. Face Value does not diagnose a skin condition or establish product causation.',
      'Visible redness was higher at follow-up.',
      'Unfavorable',
      'Early',
      ...guidance,
      'TEST LONGER',
    ]);
  });

  it('live null result: no "change holds", no encouragement', () => {
    const v = live({ delta: 0 });
    expect(v.oracleExplanation).toBe(
      'No detectable change showed up, but matching scan conditions were not measured, so Face Value cannot call this result yet.',
    );
    expect(v.recordInterpretation).toBe('Visible redness stayed close to the baseline.');
    expect(v.recordNextBody).toBe('Repeat a comparable scan to see whether a change appears.');
    expect(v.recordNextTone).toBe('default');
  });

  it('blocked null trial: Record does not say redness changed', () => {
    const v = live({ delta: 0, context: 'second_product' });
    expect(v.recordNextTitle).toBe('Retry it alone');
    expect(v.recordInterpretation).toBe(
      'Visible redness stayed close to the baseline, and another trial change interfered.',
    );
  });

  it('blocked worsening trial: Record next step leads with the skin check', () => {
    const v = live({ delta: -20, context: 'second_product' });
    expect(v.recordInterpretation).toBe('Visible redness was higher, and another trial change interfered.');
    expect(v.recordNextBody).toBe(
      'Check how your skin is responding before you continue, then repeat the trial without the other redness-changing product or routine change.',
    );
    expect(v.recordNextTone).toBe('safety');
  });

  it('early worsening: Record next step pauses before the trial window continues', () => {
    const v = live({ delta: -20, intervalDays: 7 });
    expect(v.recordNextBody).toBe('Check how your skin is responding before you continue the trial window.');
    expect(v.recordNextTone).toBe('safety');
  });

  it('unreadable worsening comparison: recapture first, with a skin caution', () => {
    const v = live({ delta: -20, context: 'makeup' });
    expect(v.oracleHeadline).toBe('This comparison was not readable.');
    expect(v.recordNextBody).toBe(
      'Repeat the scans under matched conditions before reading this result. If your skin feels worse, pause the product.',
    );
  });
});
