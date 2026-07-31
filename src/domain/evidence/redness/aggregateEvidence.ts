import type { EvidencePeriod, EvidencePeriodInput, EvidenceSession } from './types';

export interface AggregatedPeriod {
  period: EvidencePeriod;
  invalidReasons: string[];
  limitations: string[];
}

export function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 1 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
}

function acceptedScoresForSession(session: EvidenceSession): {
  scores: number[];
  invalidReasons: string[];
} {
  const invalidReasons: string[] = [];
  if (session.acceptedFrameIds.length !== session.rawScores.length) {
    invalidReasons.push(`${session.sessionId}: accepted frame IDs and raw scores do not align.`);
  }

  const scores: number[] = [];
  const attemptedFrameIds = new Set<string>();
  for (const frameId of session.frameIds) {
    if (attemptedFrameIds.has(frameId)) {
      invalidReasons.push(`${session.sessionId}: attempted frame ${frameId} is duplicated.`);
    }
    attemptedFrameIds.add(frameId);
  }

  const seenFrameIds = new Set<string>();
  for (const [acceptedIndex, frameId] of session.acceptedFrameIds.entries()) {
    if (seenFrameIds.has(frameId)) {
      invalidReasons.push(`${session.sessionId}: accepted frame ${frameId} is duplicated.`);
      continue;
    }
    seenFrameIds.add(frameId);
    const rawScore = session.rawScores[acceptedIndex];
    if (!attemptedFrameIds.has(frameId) || !Number.isFinite(rawScore)) {
      invalidReasons.push(
        `${session.sessionId}: accepted frame ${frameId} has no finite raw score.`,
      );
      continue;
    }
    scores.push(rawScore);
  }

  const rejectedFrameIds = new Set<string>();
  for (const rejected of session.rejectedFrames) {
    if (rejectedFrameIds.has(rejected.frameId)) {
      invalidReasons.push(
        `${session.sessionId}: rejected frame ${rejected.frameId} is duplicated.`,
      );
    }
    rejectedFrameIds.add(rejected.frameId);
    if (!attemptedFrameIds.has(rejected.frameId)) {
      invalidReasons.push(
        `${session.sessionId}: rejected frame ${rejected.frameId} was not an attempted frame.`,
      );
    }
    if (seenFrameIds.has(rejected.frameId)) {
      invalidReasons.push(
        `${session.sessionId}: frame ${rejected.frameId} is both accepted and rejected.`,
      );
    }
  }

  for (const frameId of attemptedFrameIds) {
    if (!seenFrameIds.has(frameId) && !rejectedFrameIds.has(frameId)) {
      invalidReasons.push(`${session.sessionId}: attempted frame ${frameId} has no disposition.`);
    }
  }

  return { scores, invalidReasons };
}

export function aggregateEvidencePeriod(
  input: EvidencePeriodInput,
  label: 'baseline' | 'endpoint',
): AggregatedPeriod {
  const acceptedRawScores: number[] = [];
  const invalidReasons: string[] = [];
  const limitations: string[] = [];
  let rejectedFrameCount = 0;

  if (input.sessions.length === 0) {
    invalidReasons.push(`${label}: no capture session was provided.`);
  }

  for (const session of input.sessions) {
    rejectedFrameCount += session.rejectedFrames.length;
    const accepted = acceptedScoresForSession(session);
    acceptedRawScores.push(...accepted.scores);
    invalidReasons.push(...accepted.invalidReasons);
    if (accepted.scores.length === 0) {
      invalidReasons.push(`${session.sessionId}: no accepted redness measurement is available.`);
    }
  }

  if (input.sessions.length === 1) {
    limitations.push(`${label}: only one capture session was collected.`);
  }
  if (acceptedRawScores.length < 3) {
    limitations.push(`${label}: fewer than three accepted frame measurements were collected.`);
  }

  return {
    period: {
      sessionCount: input.sessions.length,
      sessions: input.sessions.map((session) => ({
        ...session,
        frameIds: [...session.frameIds],
        rawScores: [...session.rawScores],
        acceptedFrameIds: [...session.acceptedFrameIds],
        rejectedFrames: session.rejectedFrames.map((frame) => ({
          ...frame,
          reasons: [...frame.reasons],
        })),
        captureQuality: {
          ...session.captureQuality,
          reasons: [...session.captureQuality.reasons],
        },
        versions: { ...session.versions },
      })),
      acceptedRawScores,
      rejectedFrameCount,
      rawMedian: median(acceptedRawScores),
    },
    invalidReasons,
    limitations,
  };
}
