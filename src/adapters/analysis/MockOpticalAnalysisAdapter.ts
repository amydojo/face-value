import { ANALYSIS_SCENARIOS } from '../../fixtures/analysis-scenarios';
import type { AnalysisAdapter, AnalysisRequest } from './AnalysisAdapter';
import type { AnalysisResult } from '../../domain/model';

export class OpticalAnalysisUnavailableError extends Error {
  constructor() {
    super('Optical analysis unavailable');
    this.name = 'OpticalAnalysisUnavailableError';
  }
}

export class MockOpticalAnalysisAdapter implements AnalysisAdapter {
  async compare({ scenario, overlapRetained }: AnalysisRequest): Promise<AnalysisResult> {
    await Promise.resolve();
    if (scenario === 'failure') throw new OpticalAnalysisUnavailableError();
    const resolvedScenario = overlapRetained ? 'overlap_reduced' : scenario;
    return structuredClone(ANALYSIS_SCENARIOS[resolvedScenario]);
  }
}
