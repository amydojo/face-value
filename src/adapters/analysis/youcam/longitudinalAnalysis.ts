import type { CaptureMetadata, DurableSkinSignal } from '../../../domain/model';
import { normalizeSkinAnalysisSignal } from '../../../domain/youcamEvidence';
import {
  HD_REDNESS_PROTOCOL,
  protocolsMatch,
  type AnalysisProtocol,
  type SkinAnalysisProvider,
} from './contracts';

export class LocalProtocolMismatchError extends Error {
  readonly code = 'protocol_mismatch';

  constructor() {
    super('The follow-up protocol does not match the accepted baseline protocol.');
    this.name = 'LocalProtocolMismatchError';
  }
}

export async function analyzeLongitudinalCapture(input: {
  provider: SkinAnalysisProvider;
  role: 'baseline' | 'followup';
  image: Blob;
  fileName?: string;
  metadata: CaptureMetadata;
  frozenProtocol: AnalysisProtocol | null;
  signal?: AbortSignal;
}): Promise<{ durableSignal: DurableSkinSignal; protocol: AnalysisProtocol }> {
  let protocol: AnalysisProtocol;

  if (input.role === 'baseline') {
    protocol = HD_REDNESS_PROTOCOL;
  } else {
    if (
      !input.frozenProtocol ||
      !protocolsMatch(input.frozenProtocol, HD_REDNESS_PROTOCOL)
    ) {
      throw new LocalProtocolMismatchError();
    }
    protocol = input.frozenProtocol;
  }

  const providerSignal = await input.provider.analyzeCapture({
    image: input.image,
    fileName: input.fileName,
    protocol,
    capturedAt: input.metadata.createdAt,
    role: input.role,
    signal: input.signal,
  });

  return {
    durableSignal: normalizeSkinAnalysisSignal(providerSignal),
    protocol: { ...protocol },
  };
}
