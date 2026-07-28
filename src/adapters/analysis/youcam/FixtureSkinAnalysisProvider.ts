import type {
  AnalyzeCaptureInput,
  SkinAnalysisProvider,
  SkinAnalysisSignal,
} from './contracts';

const FIXTURE_SCORES = {
  baseline: 93.3356,
  followup: 100,
} as const;

export class FixtureSkinAnalysisProvider implements SkinAnalysisProvider {
  private baselineCalls = 0;
  private followUpCalls = 0;

  async analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal> {
    if (input.signal?.aborted) {
      throw new DOMException('Analysis cancelled', 'AbortError');
    }

    const role = input.role ?? 'baseline';
    const sequence = role === 'baseline' ? ++this.baselineCalls : ++this.followUpCalls;
    const rawScore = FIXTURE_SCORES[role];

    return {
      provider: 'youcam',
      apiVersion: input.protocol.apiVersion,
      mode: input.protocol.mode,
      concern: input.protocol.concern,
      region: null,
      rawScore,
      capturedAt: input.capturedAt,
      captureQuality: 'accepted',
      ephemeralTaskReference: `fixture-${role}-${sequence}`,
    };
  }
}
