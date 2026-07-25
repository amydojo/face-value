import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../domain/model';
import { placementForVerdict } from '../features/evidence-cassette/verdictDisposition';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';

describe('result to next-step mapping', () => {
  it('maps a keep recommendation to established', () => {
    expect(placementForVerdict({
      ...ANALYSIS_SCENARIOS.likely_change,
      recommendedAction: 'keep',
    }, 'none')).toBe('established');
  });

  it('maps no reliable change to paused', () => {
    expect(placementForVerdict(ANALYSIS_SCENARIOS.no_change, 'none')).toBe('paused');
  });

  it('maps retained overlap to retry alone regardless of a stronger recommendation', () => {
    expect(placementForVerdict({
      ...ANALYSIS_SCENARIOS.likely_change,
      recommendedAction: 'keep',
    }, 'overlap_retained')).toBe('retry_alone');
  });

  it('maps the explicit overlap recommendation to retry alone', () => {
    expect(placementForVerdict(ANALYSIS_SCENARIOS.overlap_reduced, 'none')).toBe('retry_alone');
  });

  it('throws instead of silently defaulting an unknown recommendation', () => {
    const unknown = {
      ...ANALYSIS_SCENARIOS.likely_change,
      recommendedAction: 'invented-action',
    } as unknown as AnalysisResult;

    expect(() => placementForVerdict(unknown, 'none')).toThrow(
      'Unsupported verdict recommendation: invented-action',
    );
  });
});
