import { describe, expect, it } from 'vitest';
import {
  MockOpticalAnalysisAdapter,
  OpticalAnalysisUnavailableError,
} from '../adapters/analysis/MockOpticalAnalysisAdapter';

const adapter = new MockOpticalAnalysisAdapter();

describe('MockOpticalAnalysisAdapter', () => {
  it('returns deterministic comparable and partial fixture results', async () => {
    await expect(
      adapter.compare({ scenario: 'no_change', overlapRetained: false }),
    ).resolves.toMatchObject({
      comparison: 'comparable',
      finding: 'No reliable change observed.',
      simulated: true,
    });
    await expect(
      adapter.compare({ scenario: 'partial', overlapRetained: false }),
    ).resolves.toMatchObject({ comparison: 'partially_comparable', confidence: 'possible' });
  });

  it('forces the reduced-confidence result when overlap was retained', async () => {
    await expect(
      adapter.compare({ scenario: 'likely_change', overlapRetained: true }),
    ).resolves.toMatchObject({
      comparison: 'partially_comparable',
      confidence: 'possible',
      recommendedAction: 'continue_with_overlap',
    });
  });

  it('fails without returning a fabricated result', async () => {
    await expect(
      adapter.compare({ scenario: 'failure', overlapRetained: false }),
    ).rejects.toBeInstanceOf(OpticalAnalysisUnavailableError);
  });
});
