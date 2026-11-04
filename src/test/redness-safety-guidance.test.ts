import { describe, expect, it } from 'vitest';
import { analysisResultFromRednessEvaluation } from '../adapters/analysis/youcam/rednessEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../domain/evidence/redness';
import { safetyGuidanceFor, type SafetyGuidance } from '../features/verdict/safetyGuidance';
import {
  verdictViewModelFromAnalysis,
  verdictViewModelFromRecord,
} from '../features/verdict/verdictViewModel';
import savedV1 from './fixtures/redness-snapshot-engine-v1.0.0.json';
import {
  decisionGrid,
  decisionKey,
  evaluateLiveScenario,
  recordForSnapshot,
  type LiveScenario,
} from './support/rednessScenarios';

// Safety-priority guidance is presentation derived from saved canonical fields. It never changes
// the evaluator's action, and it must say what a person needs to know on the visible result.

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

const words = (guidance: SafetyGuidance | null): string =>
  guidance ? [guidance.title, ...guidance.lines, guidance.actionMeaning ?? ''].join(' ') : '';

const DIRECTION_CLAIM =
  /redness (was )?(higher|lower|improved|worsened|increased|decreased)|unfavorable direction|favorable direction/i;
const RECAPTURE_AS_FIX = /scan again|repeat (the|a) (comparable )?scans?|new scan|recapture|retake/i;
const ENCOURAGING = /encourag|promising|looks good|on track|working well/i;

describe('safety guidance for named states', () => {
  it('1. worsening, limited measurement, no symptoms: check skin first; test longer is explained', () => {
    const snapshot = live({ delta: -20, anchor: -1 });
    expect(snapshot.interpretation.recommendedAction).toBe('test_longer');
    expect(safetyGuidanceFor(snapshot)).toEqual({
      kind: 'check_skin_first',
      tone: 'safety',
      title: 'Check your skin before you continue',
      lines: [
        'The measurements moved in an unfavorable direction.',
        'Matching scan conditions were not measured, so this change is not confirmed.',
        'Face Value cannot tell whether the product caused it.',
        'Look at how your skin feels before using the product again. If it is irritated, pause the product.',
      ],
      actionMeaning:
        '"Test longer" describes the evidence, not your skin. It does not mean continued use has been shown to be safe.',
      nextCaption: 'EVIDENCE',
    });
  });

  it('2. worsening with reported concerning symptoms: pause use, seek advice, no diagnosis', () => {
    const snapshot = live({ delta: -20, anchor: -1, tolerance: 'severe' });
    expect(snapshot.interpretation.recommendedAction).toBe('safety_interruption');
    const guidance = safetyGuidanceFor(snapshot);
    expect(guidance?.kind).toBe('pause_for_symptoms');
    expect(guidance?.tone).toBe('safety');
    expect(guidance?.title).toBe('Pause the product');
    expect(words(guidance)).toMatch(/You reported symptoms during this trial\./);
    expect(words(guidance)).toMatch(/pharmacist, doctor, or dermatologist/);
    expect(words(guidance)).toMatch(/does not diagnose a reaction/);
    expect(words(guidance)).not.toMatch(/allerg|you have|caused by the product/i);
    expect(guidance?.nextCaption).toBe('NEXT');
  });

  it('3. no detectable change, limited measurement: no improvement implied, limitation named', () => {
    const guidance = safetyGuidanceFor(live({ delta: 0 }));
    expect(guidance?.kind).toBe('no_change');
    expect(guidance?.tone).toBe('neutral');
    expect(guidance?.title).toBe('No change detected');
    expect(guidance?.lines).toContain('Visible redness stayed close to the baseline. This is not a sign of improvement.');
    expect(guidance?.lines).toContain(
      'Matching scan conditions were not measured, so Face Value cannot call this result yet.',
    );
    expect(words(guidance)).not.toMatch(ENCOURAGING);
  });

  it('4. favorable direction, limited measurement: direction is not proof', () => {
    const snapshot = live({ delta: 20, anchor: 1 });
    expect(snapshot.interpretation.recommendedAction).not.toBe('keep');
    const guidance = safetyGuidanceFor(snapshot);
    expect(guidance?.kind).toBe('favorable_unproven');
    expect(guidance?.title).toBe('Favorable direction, not proof');
    expect(guidance?.lines).toContain('The measurements moved in a favorable direction.');
    expect(guidance?.lines).toContain('This does not show that the product works.');
    expect(words(guidance)).not.toMatch(ENCOURAGING);
  });

  it('5. invalid comparison: no direction claimed, no new scan offered as the fix', () => {
    for (const delta of [-20, 20]) {
      const guidance = safetyGuidanceFor(live({ delta, context: 'makeup' }));
      expect(guidance?.kind).toBe('not_readable');
      expect(guidance?.title).toBe('No result was read');
      expect(words(guidance)).not.toMatch(DIRECTION_CLAIM);
      expect(words(guidance)).not.toMatch(RECAPTURE_AS_FIX);
    }
  });

  it('6. confounded trial with another active product: names the other change, keeps retry_alone', () => {
    const worse = live({ delta: -20, context: 'second_product' });
    expect(worse.interpretation.recommendedAction).toBe('retry_alone');
    const worseGuidance = safetyGuidanceFor(worse);
    expect(worseGuidance?.kind).toBe('check_skin_first');
    expect(worseGuidance?.lines).toContain(
      'Another product or routine change during the trial could also explain it.',
    );
    expect(worseGuidance?.actionMeaning).toBe(
      '"Retry it alone" describes the evidence, not your skin. Check your skin before starting another trial.',
    );

    const flat = safetyGuidanceFor(live({ delta: 0, context: 'second_product' }));
    expect(flat?.kind).toBe('no_change');
    expect(flat?.lines).toContain(
      'Another product or routine change during the trial could also explain the result.',
    );
  });

  it('7. a V1 saved worsening record gets guidance from its saved fields and is not mutated', () => {
    const snapshot = structuredClone(savedV1) as unknown as RednessEvaluationSnapshot;
    const before = JSON.stringify(snapshot);
    expect(safetyGuidanceFor(snapshot)?.kind).toBe('check_skin_first');
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('records without a canonical evaluation get no guidance', () => {
    expect(safetyGuidanceFor(undefined)).toBeNull();
    expect(safetyGuidanceFor(null)).toBeNull();
  });
});

describe('9. the Oracle reveal and the Evidence Record carry the same guidance', () => {
  it('for every guidance kind', () => {
    for (const snapshot of [
      live({ delta: -20, anchor: -1 }),
      live({ delta: -20, tolerance: 'severe' }),
      live({ delta: 0 }),
      live({ delta: 20, anchor: 1 }),
      live({ delta: -20, context: 'makeup' }),
    ]) {
      const record = recordForSnapshot(snapshot);
      const analysis = analysisResultFromRednessEvaluation(snapshot);
      const fromAnalysis = verdictViewModelFromAnalysis({
        trialId: 'T',
        productName: 'P',
        analysis,
        confidence: analysis.confidence,
        placement: 'test_longer',
      }).safetyGuidance;
      expect(fromAnalysis).toEqual(safetyGuidanceFor(snapshot));
      expect(verdictViewModelFromRecord(record).safetyGuidance).toEqual(
        safetyGuidanceFor(record.rednessEvaluation),
      );
    }
  });
});

describe('safety guidance across the decision grid', () => {
  const rows = decisionGrid().map(({ comparabilityClass, scenario }) => ({
    comparabilityClass,
    scenario,
    snapshot: evaluateLiveScenario(scenario),
  }));

  const RULES: Record<string, (s: RednessEvaluationSnapshot, g: SafetyGuidance | null) => boolean> = {
    '10. deriving guidance never changes a decision field': (s) => {
      const before = decisionKey(s);
      safetyGuidanceFor(s);
      return decisionKey(s) === before;
    },
    'reported symptoms always lead to pause_for_symptoms': (s, g) =>
      s.safetyStatus !== 'interrupted' || g?.kind === 'pause_for_symptoms',
    'every readable worsening without symptoms leads with the skin check': (s, g) =>
      s.safetyStatus === 'interrupted' ||
      s.measurementQuality === 'invalid' ||
      s.effectClassification !== 'worsened' ||
      (g?.kind === 'check_skin_first' && g.tone === 'safety'),
    'a worsening never shows the action under a plain NEXT caption unless it is a safety stop': (s, g) =>
      s.effectClassification !== 'worsened' ||
      s.interpretation.recommendedAction === 'safety_interruption' ||
      g?.nextCaption === 'EVIDENCE',
    'a test_longer or retry_alone worsening explains what the action label means': (s, g) =>
      s.effectClassification !== 'worsened' ||
      s.measurementQuality === 'invalid' ||
      !['test_longer', 'retry_alone'].includes(s.interpretation.recommendedAction) ||
      /describes the evidence, not your skin/.test(g?.actionMeaning ?? ''),
    'invalid comparisons claim no direction and offer no new scan as the fix': (s, g) =>
      s.measurementQuality !== 'invalid' ||
      s.safetyStatus === 'interrupted' ||
      (g?.kind === 'not_readable' && !DIRECTION_CLAIM.test(words(g)) && !RECAPTURE_AS_FIX.test(words(g))),
    'favorable results short of keep never read as proof': (s, g) =>
      !['directional_improvement', 'meaningful_candidate', 'strong_improvement'].includes(
        s.effectClassification ?? '',
      ) ||
      s.interpretation.recommendedAction === 'keep' ||
      s.measurementQuality === 'invalid' ||
      s.safetyStatus === 'interrupted' ||
      words(g).includes('This does not show that the product works.'),
    'guidance never uses encouraging words': (_s, g) => !ENCOURAGING.test(words(g)),
    'guidance never calls scans comparable': (_s, g) => !/comparable/i.test(words(g)),
    'guidance claims no causation': (_s, g) => !/caused by the product|(the product|it) (irritated|is irritating|damaged)/i.test(words(g)),
    'missing symptom data is never reported as no symptoms': (s, g) =>
      s.tolerance !== null || !/no symptoms/i.test(words(g)),
  };

  it.each(Object.keys(RULES))('%s', (rule: string) => {
    const violations = rows
      .filter(({ snapshot }) => !RULES[rule](snapshot, safetyGuidanceFor(snapshot)))
      .slice(0, 3)
      .map(({ comparabilityClass, scenario, snapshot }) => ({
        comparabilityClass,
        scenario,
        guidance: safetyGuidanceFor(snapshot),
      }));
    expect(violations).toEqual([]);
  });
});
