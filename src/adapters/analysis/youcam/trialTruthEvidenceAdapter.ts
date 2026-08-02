import {
  evaluateRedness,
  type EvidenceSession,
  type RednessEvaluationSnapshot,
} from '../../../domain/evidence/redness';
import type { TrialTruthEvidence } from '../../../domain/trialTruth';

const cloneSession = (session: EvidenceSession): EvidenceSession => ({
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
});

const objectiveFingerprint = (snapshot: RednessEvaluationSnapshot): string =>
  JSON.stringify({
    baselineRawMedian: snapshot.baselineRawMedian,
    endpointRawMedian: snapshot.endpointRawMedian,
    rawScoreDelta: snapshot.rawScoreDelta,
    threshold: snapshot.threshold,
    effectClassification: snapshot.effectClassification,
  });

export function applyTrialTruthToRednessEvaluation(
  snapshot: RednessEvaluationSnapshot,
  evidence: TrialTruthEvidence,
): RednessEvaluationSnapshot {
  const evaluation = evaluateRedness({
    frameworkVersion: snapshot.frameworkVersion,
    schemaVersion: snapshot.schemaVersion,
    trialId: snapshot.trialId,
    productId: snapshot.productId,
    assignedJob: snapshot.assignedJob,
    expectedObservationWindowDays: { ...snapshot.expectedObservationWindowDays },
    actualObservationIntervalDays: snapshot.actualObservationIntervalDays,
    evaluatedAt: snapshot.evaluatedAt,
    baseline: { sessions: snapshot.baseline.sessions.map(cloneSession) },
    endpoint: { sessions: snapshot.endpoint.sessions.map(cloneSession) },
    threshold: { ...snapshot.threshold },
    maskEvidence: { ...snapshot.maskEvidence },
    patientAnchor: { ...evidence.patientAnchor },
    tolerance: {
      ...evidence.tolerance,
      symptoms: [...evidence.tolerance.symptoms],
    },
    adherence: { ...evidence.adherence },
    confounders: snapshot.confounders.map((flag) => ({ ...flag })),
    secondProductStatus: snapshot.secondProductStatus,
    contextSignals: { ...snapshot.contextSignals },
  });

  if (objectiveFingerprint(evaluation) !== objectiveFingerprint(snapshot)) {
    throw new Error(
      'Trial truth cannot alter redness medians, raw-score delta, thresholds, or objective effect classification.',
    );
  }

  return evaluation;
}
