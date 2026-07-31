import type { AnalyzeCaptureInput, SkinAnalysisProvider, SkinAnalysisSignal } from './contracts';
import { YouCamProviderError } from './YouCamSkinAnalysisProvider';

const FIXTURE_SCORES = {
  baseline: [93.3356, 92.5, 94.25],
  followup: [100, 99, 100],
} as const;

function fixtureDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Analysis cancelled', 'AbortError'));
      return;
    }

    const abort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Analysis cancelled', 'AbortError'));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export class FixtureSkinAnalysisProvider implements SkinAnalysisProvider {
  private baselineCalls = 0;
  private followUpCalls = 0;
  private readonly attemptsByFrame = new Map<string, number>();

  async analyzeCapture(input: AnalyzeCaptureInput): Promise<SkinAnalysisSignal> {
    if (input.signal?.aborted) {
      throw new DOMException('Analysis cancelled', 'AbortError');
    }

    const role = input.role ?? 'baseline';
    const sequence = role === 'baseline' ? ++this.baselineCalls : ++this.followUpCalls;
    const frameKey = `${role}:${input.fileName ?? input.capturedAt}`;
    const frameAttempt = (this.attemptsByFrame.get(frameKey) ?? 0) + 1;
    this.attemptsByFrame.set(frameKey, frameAttempt);
    const measurementMatch = input.fileName?.match(/measurement-(\d+)/);
    const measurementNumber = Number(measurementMatch?.[1] ?? 0);
    const query = typeof location === 'undefined' ? null : new URLSearchParams(location.search);
    const retryFailureFrame = Number(query?.get('provider-failure-frame') ?? 0);
    const terminalFailureFrame = Number(query?.get('provider-terminal-failure-frame') ?? 0);
    const configuredDelay = Number(query?.get('provider-delay-ms') ?? 0);
    const delayedMeasurement = Number(query?.get('provider-delay-frame') ?? 0);
    const fixtureDelayMs =
      Number.isFinite(configuredDelay) && configuredDelay > 0
        ? Math.min(Math.floor(configuredDelay), 10_000)
        : 0;
    if (
      fixtureDelayMs > 0 &&
      (delayedMeasurement === 0 || delayedMeasurement === measurementNumber)
    ) {
      await fixtureDelay(fixtureDelayMs, input.signal);
    }
    const shouldFail =
      measurementNumber > 0 &&
      (measurementNumber === terminalFailureFrame ||
        (measurementNumber === retryFailureFrame && frameAttempt === 1));
    if (shouldFail) {
      throw new YouCamProviderError({
        message: 'Synthetic provider interruption for bounded-retry verification.',
        code: 'analysis_request_failed',
        retryable: true,
        status: 503,
      });
    }

    const scoreIndex =
      measurementNumber >= 1 && measurementNumber <= FIXTURE_SCORES[role].length
        ? measurementNumber - 1
        : (sequence - 1) % FIXTURE_SCORES[role].length;
    const rawScore = FIXTURE_SCORES[role][scoreIndex];

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
