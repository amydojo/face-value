import type { SkinAnalysisSignal } from '../adapters/analysis/youcam/contracts';
import type {
  AnalysisErrorState,
  AnalysisResult,
  DurableSkinSignal,
  RednessComparison,
} from './model';

export const PROTOTYPE_CALIBRATION_LIMITATION =
  'Prototype noise boundary has not been calibrated.';

export function normalizeSkinAnalysisSignal(
  signal: SkinAnalysisSignal,
): DurableSkinSignal {
  if (
    signal.provider !== 'youcam' ||
    signal.apiVersion !== '2.1' ||
    signal.mode !== 'hd' ||
    signal.concern !== 'hd_redness' ||
    signal.region !== null ||
    signal.captureQuality !== 'accepted' ||
    !Number.isFinite(signal.rawScore)
  ) {
    throw new Error('The provider signal does not match the frozen Phase B contract.');
  }

  return {
    provider: 'youcam',
    apiVersion: '2.1',
    mode: 'hd',
    concern: 'hd_redness',
    region: null,
    scoreType: 'raw_score',
    captureProtocolVersion: 'face-value-youcam-1',
    rawScore: signal.rawScore,
    capturedAt: signal.capturedAt,
    captureQuality: 'accepted',
  };
}

export function compareRednessSignals(
  baseline: DurableSkinSignal,
  followUp: DurableSkinSignal,
): RednessComparison {
  const delta = followUp.rawScore - baseline.rawScore;
  const direction: RednessComparison['direction'] =
    delta > 0 ? 'favorable' : delta < 0 ? 'unfavorable' : 'unchanged';

  return {
    baselineRawScore: baseline.rawScore,
    followUpRawScore: followUp.rawScore,
    delta,
    direction,
    calibration: 'pending',
    confidence: 'possible',
    limitations: [PROTOTYPE_CALIBRATION_LIMITATION],
  };
}

export function formatRawScore(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function resultCopy(comparison: RednessComparison): {
  finding: string;
  support: string;
} {
  if (comparison.direction === 'favorable') {
    return {
      finding: 'A small favorable shift showed up.',
      support: 'Visible redness moved in the intended direction.',
    };
  }

  if (comparison.direction === 'unfavorable') {
    return {
      finding: 'No favorable shift showed up yet.',
      support: 'Visible redness did not move in the intended direction.',
    };
  }

  return {
    finding: 'No favorable shift showed up yet.',
    support: 'The follow-up remained close to the baseline.',
  };
}

export function analysisResultFromComparison(
  comparison: RednessComparison,
): AnalysisResult {
  const copy = resultCopy(comparison);
  return {
    captureQuality: 'accepted',
    comparison: 'comparable',
    visibleSignal: 'visible redness',
    confidence: 'possible',
    finding: copy.finding,
    nonFinding: copy.support,
    relevantContext:
      'This prototype cannot yet tell whether the shift is larger than normal scan variation.',
    recommendedAction: 'wait',
    claimBoundary:
      'Possible directional evidence only. This does not establish product efficacy or clinical significance.',
    simulated: false,
    provider: 'youcam',
    baselineRawScore: comparison.baselineRawScore,
    followUpRawScore: comparison.followUpRawScore,
    delta: comparison.delta,
    direction: comparison.direction,
    limitations: [...comparison.limitations],
  };
}

const includesAny = (value: string, fragments: string[]): boolean =>
  fragments.some((fragment) => value.includes(fragment));

export function translateProviderError(
  code: string,
  role: AnalysisErrorState['role'],
): AnalysisErrorState {
  const normalized = code.toLowerCase();
  let message = 'This scan could not be analyzed. Your existing trial is safe.';
  let retryable = true;

  if (normalized === 'error_src_face_too_small') {
    message = 'Move closer so your face fills more of the frame.';
  } else if (includesAny(normalized, ['lighting', 'too_dark', 'too_bright'])) {
    message = 'Find more even light and try again.';
  } else if (includesAny(normalized, ['out_of_bound', 'outside', 'face_bounds'])) {
    message = 'Center your full face inside the guide.';
  } else if (includesAny(normalized, ['unsupported_image', 'invalid_image', 'image_type'])) {
    message = 'Choose a clear front-facing JPEG or PNG.';
    retryable = false;
  } else if (includesAny(normalized, ['timeout', 'expired'])) {
    message = 'Analysis took too long. Retry without losing this trial.';
  } else if (includesAny(normalized, ['network', 'connection', 'fetch'])) {
    message = 'Connection interrupted. This scan was not added.';
  } else if (includesAny(normalized, ['unauthorized', 'session'])) {
    message = 'Analysis access expired. Reopen the protected demo session.';
  } else if (normalized === 'protocol_mismatch') {
    message = 'These scans could not be compared under the same conditions.';
    retryable = false;
  }

  return { role, code, message, retryable };
}

export type CalibrationSummary = {
  scores: number[];
  consecutiveDeltas: number[];
  absoluteConsecutiveDeltas: number[];
  medianAbsoluteDelta: number;
  maxAbsoluteDelta: number;
  minimumScore: number;
  maximumScore: number;
};

export function summarizeCalibration(scores: number[]): CalibrationSummary {
  if (scores.length === 0 || scores.some((score) => !Number.isFinite(score))) {
    throw new Error('Calibration requires at least one finite score.');
  }

  const consecutiveDeltas = scores.slice(1).map((score, index) => score - scores[index]);
  const absoluteConsecutiveDeltas = consecutiveDeltas.map(Math.abs);
  const sorted = [...absoluteConsecutiveDeltas].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianAbsoluteDelta = sorted.length === 0
    ? 0
    : sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;

  return {
    scores: [...scores],
    consecutiveDeltas,
    absoluteConsecutiveDeltas,
    medianAbsoluteDelta,
    maxAbsoluteDelta: absoluteConsecutiveDeltas.length
      ? Math.max(...absoluteConsecutiveDeltas)
      : 0,
    minimumScore: Math.min(...scores),
    maximumScore: Math.max(...scores),
  };
}

export function logSafeAnalysisDiagnostic(input: {
  stage: string;
  role: 'baseline' | 'followup';
  outcome: string;
  code?: string;
}): void {
  if (typeof console === 'undefined') return;
  console.info('[face-value-analysis]', {
    stage: input.stage,
    role: input.role,
    outcome: input.outcome,
    ...(input.code ? { code: input.code } : {}),
  });
}
