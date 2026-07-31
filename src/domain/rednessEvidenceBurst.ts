import type { LongitudinalSkinEvidence, RednessEvidenceBurst } from './model';

export const REDNESS_BURST_REQUIRED_MEASUREMENTS = 3 as const;
export const REDNESS_BURST_MAX_CAPTURE_ATTEMPTS = 5 as const;
export const REDNESS_BURST_PROVIDER_MAX_ATTEMPTS = 2 as const;
export const REDNESS_BURST_PROVIDER_CONCURRENCY = 1 as const;
export const REDNESS_BURST_FINALIZATION_MS = 420 as const;

export function isCompleteRednessEvidenceBurst(
  value: RednessEvidenceBurst | null | undefined,
): value is RednessEvidenceBurst {
  if (!value) return false;
  if (
    !value.burstId ||
    !value.sessionId ||
    !value.captureProfileId ||
    !value.startedAt ||
    !value.completedAt ||
    value.acceptedFrames.length !== REDNESS_BURST_REQUIRED_MEASUREMENTS ||
    value.attemptedFrameCount < REDNESS_BURST_REQUIRED_MEASUREMENTS ||
    value.attemptedFrameCount > REDNESS_BURST_MAX_CAPTURE_ATTEMPTS ||
    value.attemptedFrameCount !== value.acceptedFrames.length + value.rejectedFrames.length
  ) {
    return false;
  }

  const frameIds = new Set<string>();
  for (const frame of value.acceptedFrames) {
    if (
      !frame.frameId ||
      frameIds.has(frame.frameId) ||
      frame.capture.id !== frame.frameId ||
      frame.capture.kind !== value.role ||
      frame.capture.source !== 'camera' ||
      frame.capture.cameraProfileId !== value.captureProfileId ||
      frame.quality.currentFrame !== 'accepted' ||
      frame.quality.exposure !== 'accepted' ||
      frame.quality.movement !== 'accepted' ||
      !Number.isFinite(frame.signal.rawScore) ||
      frame.signal.captureQuality !== 'accepted' ||
      frame.signal.capturedAt !== frame.capture.createdAt ||
      ![1, 2].includes(frame.providerAttemptCount)
    ) {
      return false;
    }
    frameIds.add(frame.frameId);
  }

  for (const frame of value.rejectedFrames) {
    if (
      !frame.frameId ||
      frameIds.has(frame.frameId) ||
      !frame.attemptedAt ||
      frame.stage !== 'capture' ||
      frame.reasons.length === 0 ||
      frame.reasons.some((reason) => !reason)
    ) {
      return false;
    }
    frameIds.add(frame.frameId);
  }

  const profileIds = new Set(
    value.acceptedFrames.map((frame) => frame.capture.cameraProfileId ?? null),
  );
  return (
    profileIds.size === 1 &&
    profileIds.has(value.captureProfileId) &&
    frameIds.size === value.attemptedFrameCount
  );
}

export const hasBaselineEvidence = (evidence: LongitudinalSkinEvidence): boolean =>
  isCompleteRednessEvidenceBurst(evidence.baselineBurst) || evidence.baseline !== null;

export const hasFollowUpEvidence = (evidence: LongitudinalSkinEvidence): boolean =>
  isCompleteRednessEvidenceBurst(evidence.followUpBurst) || evidence.followUp !== null;

export function baselineEvidenceCapturedAt(evidence: LongitudinalSkinEvidence): string | null {
  return evidence.baselineBurst?.completedAt ?? evidence.baseline?.capturedAt ?? null;
}

export function followUpEvidenceCapturedAt(evidence: LongitudinalSkinEvidence): string | null {
  return evidence.followUpBurst?.completedAt ?? evidence.followUp?.capturedAt ?? null;
}
