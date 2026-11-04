import { describe, expect, it } from 'vitest';
import {
  COMPARABILITY_FIELDS,
  allComparability,
  decisionKey,
  evaluateLiveScenario,
  type ComparabilityProfile,
  type ComparabilityValue,
  type LiveScenario,
} from './support/rednessScenarios';

function everyProfile(): ComparabilityProfile[] {
  const profiles: ComparabilityProfile[] = [];
  const values: ComparabilityValue[] = ['pass', 'limited', 'fail'];
  const build = (index: number, partial: Partial<ComparabilityProfile>) => {
    if (index === COMPARABILITY_FIELDS.length) {
      profiles.push(partial as ComparabilityProfile);
      return;
    }
    for (const value of values) build(index + 1, { ...partial, [COMPARABILITY_FIELDS[index]]: value });
  };
  build(0, {});
  return profiles;
}

const stateOf = (profile: ComparabilityProfile): 'all_pass' | 'any_limited' | 'any_fail' => {
  const values = Object.values(profile);
  if (values.includes('fail')) return 'any_fail';
  if (values.includes('limited')) return 'any_limited';
  return 'all_pass';
};

const representative: Record<ReturnType<typeof stateOf>, ComparabilityProfile> = {
  all_pass: allComparability('pass'),
  any_limited: allComparability('limited'),
  any_fail: allComparability('fail'),
};

const core: Array<Omit<LiveScenario, 'comparability'>> = [];
for (const delta of [-20, 0, 20])
  for (const pattern of ['unanimous', 'one_contradicting'] as const)
    for (const [adherence, tolerance, anchor] of [
      ['complete', 'none', 1],
      ['partial', 'mild', -1],
    ] as const)
      core.push({ delta, pattern, intervalDays: 29, adherence, tolerance, anchor, context: 'none' });

describe('comparability equivalence', () => {
  it('collapses all 243 field combinations into three outcome states in every placement', () => {
    const profiles = everyProfile();
    expect(profiles).toHaveLength(243);
    const mismatches: string[] = [];
    for (const profile of profiles) {
      const expectedProfile = representative[stateOf(profile)];
      for (const scenario of core) {
        const expected = decisionKey(evaluateLiveScenario({ ...scenario, comparability: expectedProfile }));
        for (const placement of ['both', 'baseline_only', 'endpoint_only'] as const) {
          const actual = decisionKey(
            evaluateLiveScenario({
              ...scenario,
              comparability: allComparability('pass'),
              baselineComparability: placement === 'endpoint_only' ? allComparability('pass') : profile,
              endpointComparability: placement === 'baseline_only' ? allComparability('pass') : profile,
            }),
          );
          if (actual !== expected) mismatches.push(`${JSON.stringify(profile)} ${placement} d=${scenario.delta}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('locks out keep with a single limited field exactly as five limited fields do', () => {
    const strongClean: Omit<LiveScenario, 'comparability'> = {
      delta: 20,
      pattern: 'unanimous',
      intervalDays: 29,
      adherence: 'complete',
      tolerance: 'none',
      anchor: 1,
      context: 'none',
    };
    expect(
      evaluateLiveScenario({ ...strongClean, comparability: allComparability('pass') }).interpretation
        .recommendedAction,
    ).toBe('keep');
    for (const field of COMPARABILITY_FIELDS) {
      const snapshot = evaluateLiveScenario({
        ...strongClean,
        comparability: { ...allComparability('pass'), [field]: 'limited' },
      });
      expect(snapshot.measurementQuality).toBe('limited');
      expect(snapshot.interpretation.recommendedAction).toBe('test_longer');
    }
  });
});
