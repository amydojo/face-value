import type { AnalysisResult, AnalysisScenario } from '../../domain/model';

export interface AnalysisRequest {
  scenario: AnalysisScenario;
  overlapRetained: boolean;
}

export interface AnalysisAdapter {
  compare(request: AnalysisRequest): Promise<AnalysisResult>;
}
