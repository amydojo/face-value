import type { CaptureMetadata, DurableSkinSignal } from '../../../domain/model';
import {
  REDNESS_BURST_PROVIDER_MAX_ATTEMPTS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../../domain/rednessEvidenceBurst';
import {
  HD_REDNESS_PROTOCOL,
  protocolsMatch,
  type AnalysisProtocol,
  type SkinAnalysisProvider,
} from './contracts';
import { analyzeLongitudinalCapture, LocalProtocolMismatchError } from './longitudinalAnalysis';

export interface EphemeralRednessFrame {
  frameId: string;
  image: Blob;
  fileName: string;
  metadata: CaptureMetadata;
}

export class RednessBurstProviderFailure extends Error {
  readonly frameId: string;
  readonly cause: unknown;

  constructor(frameId: string, cause: unknown) {
    super('A redness burst frame failed after its bounded provider retry.');
    this.name = 'RednessBurstProviderFailure';
    this.frameId = frameId;
    this.cause = cause;
  }
}

export async function analyzeRednessBurstFrames(input: {
  provider: SkinAnalysisProvider;
  role: 'baseline' | 'followup';
  frames: EphemeralRednessFrame[];
  frozenProtocol: AnalysisProtocol | null;
  generationId: string;
  signal: AbortSignal;
  requestIdFactory(frameId: string, attempt: 1 | 2): string;
  releaseFrame(frameId: string): void;
  onRequestStarted(input: {
    generationId: string;
    frameId: string;
    requestId: string;
    attempt: 1 | 2;
  }): void;
  onRequestFailed(input: {
    generationId: string;
    frameId: string;
    requestId: string;
    attempt: 1 | 2;
    terminal: boolean;
    error: unknown;
  }): void;
  onRequestAccepted(input: {
    generationId: string;
    frameId: string;
    requestId: string;
    attempt: 1 | 2;
    protocol: AnalysisProtocol;
    signal: DurableSkinSignal;
  }): void;
}): Promise<void> {
  const unreleasedFrameIds = new Set(input.frames.map((frame) => frame.frameId));
  const releaseFrame = (frameId: string) => {
    if (!unreleasedFrameIds.delete(frameId)) return;
    input.releaseFrame(frameId);
  };

  try {
    const uniqueFrameIds = new Set(input.frames.map((frame) => frame.frameId));
    if (
      input.frames.length !== REDNESS_BURST_REQUIRED_MEASUREMENTS ||
      uniqueFrameIds.size !== REDNESS_BURST_REQUIRED_MEASUREMENTS
    ) {
      throw new Error('A redness evidence burst requires three unique captured frames.');
    }
    if (
      input.role === 'followup' &&
      (!input.frozenProtocol || !protocolsMatch(input.frozenProtocol, HD_REDNESS_PROTOCOL))
    ) {
      throw new LocalProtocolMismatchError();
    }

    for (const frame of input.frames) {
      let accepted = false;
      let terminalCause: unknown = null;

      for (
        let attemptNumber = 1;
        attemptNumber <= REDNESS_BURST_PROVIDER_MAX_ATTEMPTS;
        attemptNumber += 1
      ) {
        if (input.signal.aborted) {
          throw new DOMException('Analysis cancelled', 'AbortError');
        }
        const attempt = attemptNumber as 1 | 2;
        const requestId = input.requestIdFactory(frame.frameId, attempt);
        input.onRequestStarted({
          generationId: input.generationId,
          frameId: frame.frameId,
          requestId,
          attempt,
        });

        try {
          const analyzed = await analyzeLongitudinalCapture({
            provider: input.provider,
            role: input.role,
            image: frame.image,
            fileName: frame.fileName,
            metadata: frame.metadata,
            frozenProtocol: input.frozenProtocol,
            signal: input.signal,
          });
          input.onRequestAccepted({
            generationId: input.generationId,
            frameId: frame.frameId,
            requestId,
            attempt,
            protocol: analyzed.protocol,
            signal: analyzed.durableSignal,
          });
          accepted = true;
          break;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          terminalCause = error;
          const terminal =
            error instanceof LocalProtocolMismatchError ||
            attempt === REDNESS_BURST_PROVIDER_MAX_ATTEMPTS;
          input.onRequestFailed({
            generationId: input.generationId,
            frameId: frame.frameId,
            requestId,
            attempt,
            terminal,
            error,
          });
          if (terminal) break;
        }
      }

      releaseFrame(frame.frameId);
      if (!accepted) {
        throw terminalCause instanceof LocalProtocolMismatchError
          ? terminalCause
          : new RednessBurstProviderFailure(frame.frameId, terminalCause);
      }
    }
  } finally {
    for (const frameId of unreleasedFrameIds) releaseFrame(frameId);
  }
}
