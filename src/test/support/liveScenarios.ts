// Test-only: live-shaped redness scenarios through the production bridge, and the saved record
// for a snapshot. Domain and adapter code only, so browser specs can import it without pulling
// in UI components. It never calls a provider and never touches the network.
import {
  analysisResultFromRednessEvaluation,
  buildMvpRednessEvaluation,
  placementForRednessAction,
} from '../../adapters/analysis/youcam/rednessEvidenceAdapter';
import { applyTrialTruthToRednessEvaluation } from '../../adapters/analysis/youcam/trialTruthEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../../domain/evidence/redness';
import type {
  CaptureContext,
  DisturbanceState,
  EvidenceRecordData,
  RecommendedAction,
  RednessEvidenceBurst,
  RegisteredProduct,
} from '../../domain/model';
import type { TrialTruthEvidence } from '../../domain/trialTruth';

export const COMPARABILITY_FIELDS = [
  'lightingComparability',
  'poseComparability',
  'cropComparability',
  'faceSizeComparability',
  'colorCastComparability',
] as const;
export type ComparabilityField = (typeof COMPARABILITY_FIELDS)[number];
export type ComparabilityValue = 'pass' | 'limited' | 'fail';
export type ComparabilityProfile = Record<ComparabilityField, ComparabilityValue>;

export type ToleranceProfile =
  | 'none'
  | 'mild'
  | 'mild_stinging'
  | 'moderate_burning'
  | 'mild_swelling'
  | 'severe';
export type ContextProfile =
  | 'none'
  | 'second_product'
  | 'routine_change'
  | 'one_downgrade'
  | 'two_downgrades'
  | 'makeup';
export type FramePattern = 'unanimous' | 'one_contradicting';

export interface LiveScenario {
  /** null keeps exactly what the production adapter writes (all five fields `limited`). */
  comparability: ComparabilityProfile | null;
  /** Optional per-period override; defaults to `comparability` for both periods. */
  baselineComparability?: ComparabilityProfile | null;
  endpointComparability?: ComparabilityProfile | null;
  delta: number;
  pattern: FramePattern;
  intervalDays: number;
  adherence: TrialTruthEvidence['adherence']['status'];
  tolerance: ToleranceProfile;
  anchor: -1 | 0 | 1;
  context: ContextProfile;
}

export const BASELINE_SCORE = 70;
const BASE_TIME = Date.parse('2026-07-01T12:00:00.000Z');
const DAY_MS = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString();

export const allComparability = (value: ComparabilityValue): ComparabilityProfile => ({
  lightingComparability: value,
  poseComparability: value,
  cropComparability: value,
  faceSizeComparability: value,
  colorCastComparability: value,
});

/** With three frames the median always sits on two of them, so the only live patterns are
 * unanimous and a single frame contradicting the median's direction. */
export function endpointScores(delta: number, pattern: FramePattern): number[] {
  const median = BASELINE_SCORE + delta;
  if (pattern === 'unanimous') return [median, median, median];
  if (delta >= 5) return [median, median, BASELINE_SCORE - 6];
  if (delta <= -5) return [BASELINE_SCORE + 6, median, median];
  return [median, median, BASELINE_SCORE + 6];
}

function burst(role: 'baseline' | 'followup', scores: number[], startMs: number): RednessEvidenceBurst {
  return {
    burstId: `${role}-burst`,
    role,
    sessionId: `${role}-session`,
    captureProfileId: 'native-browser-camera-v1',
    startedAt: iso(startMs),
    completedAt: iso(startMs + 1_000),
    attemptedFrameCount: scores.length,
    rejectedFrames: [],
    acceptedFrames: scores.map((rawScore, index) => {
      const frameId = `${role}-frame-${index + 1}`;
      const capturedAt = iso(startMs + (index + 1) * 10);
      return {
        frameId,
        capture: {
          id: frameId,
          kind: role,
          source: 'camera',
          mimeType: 'image/jpeg',
          createdAt: capturedAt,
          orientationRule: 'analysis-unmirrored',
          cameraProfileId: 'native-browser-camera-v1',
        },
        quality: { currentFrame: 'accepted', exposure: 'accepted', movement: 'accepted' },
        signal: {
          provider: 'youcam',
          apiVersion: '2.1',
          mode: 'hd',
          concern: 'hd_redness',
          region: null,
          scoreType: 'raw_score',
          captureProtocolVersion: 'face-value-youcam-1',
          rawScore,
          capturedAt,
          captureQuality: 'accepted',
        },
        providerAttemptCount: 1,
      };
    }),
  };
}

const EMPTY_CONTEXT: CaptureContext = {
  makeup: false,
  recentHeatOrExercise: false,
  recentCleansingOrSkincare: false,
  routineOrTreatmentChange: false,
  note: null,
};

function contextsFor(profile: ContextProfile): {
  baseline: CaptureContext;
  endpoint: CaptureContext;
  disturbance: DisturbanceState;
} {
  switch (profile) {
    case 'routine_change':
      return { baseline: EMPTY_CONTEXT, endpoint: { ...EMPTY_CONTEXT, routineOrTreatmentChange: true }, disturbance: 'none' };
    case 'one_downgrade':
      return { baseline: EMPTY_CONTEXT, endpoint: { ...EMPTY_CONTEXT, recentHeatOrExercise: true }, disturbance: 'none' };
    case 'two_downgrades':
      return {
        baseline: EMPTY_CONTEXT,
        endpoint: { ...EMPTY_CONTEXT, recentHeatOrExercise: true, recentCleansingOrSkincare: true },
        disturbance: 'none',
      };
    case 'makeup':
      return { baseline: EMPTY_CONTEXT, endpoint: { ...EMPTY_CONTEXT, makeup: true }, disturbance: 'none' };
    case 'second_product':
      return { baseline: EMPTY_CONTEXT, endpoint: EMPTY_CONTEXT, disturbance: 'detected' };
    case 'none':
      return { baseline: EMPTY_CONTEXT, endpoint: EMPTY_CONTEXT, disturbance: 'none' };
  }
}

function toleranceFor(profile: ToleranceProfile): TrialTruthEvidence['tolerance'] {
  const symptoms: Record<ToleranceProfile, TrialTruthEvidence['tolerance']['symptoms']> = {
    none: [],
    mild: [],
    mild_stinging: ['stinging'],
    moderate_burning: ['burning'],
    mild_swelling: ['swelling'],
    severe: [],
  };
  const severity: Record<ToleranceProfile, TrialTruthEvidence['tolerance']['severity']> = {
    none: 'none',
    mild: 'mild',
    mild_stinging: 'mild',
    moderate_burning: 'moderate',
    mild_swelling: 'mild',
    severe: 'severe',
  };
  return { collectionStatus: 'collected', severity: severity[profile], symptoms: [...symptoms[profile]] };
}

const PRODUCT: RegisteredProduct = {
  id: 'registered-product-scenario',
  accession: 'FV-SCN',
  brand: 'Lab Dojo',
  productName: 'One Thing',
  strength: null,
  volume: null,
  assignedJob: 'Reduce visible redness',
  protocolId: 'youcam-redness-v1',
  createdAt: iso(BASE_TIME),
};

/** Overwrites ONLY the five comparability fields after the production adapter built the
 * sessions, as a future measuring adapter would. A `fail` the adapter already wrote (makeup)
 * is never upgraded. */
function applyComparability(
  snapshot: RednessEvaluationSnapshot,
  period: 'baseline' | 'endpoint',
  profile: ComparabilityProfile | null | undefined,
): void {
  if (!profile) return;
  for (const session of snapshot[period].sessions) {
    for (const field of COMPARABILITY_FIELDS) {
      if (session.captureQuality[field] === 'fail') continue;
      session.captureQuality[field] = profile[field];
    }
  }
}

/** Production bridge: buildMvpRednessEvaluation -> applyTrialTruthToRednessEvaluation. */
export function evaluateLiveScenario(scenario: LiveScenario): RednessEvaluationSnapshot {
  const context = contextsFor(scenario.context);
  const baselineStart = BASE_TIME;
  const endpointStart = BASE_TIME + scenario.intervalDays * DAY_MS;
  const bridged = buildMvpRednessEvaluation({
    trialId: 'trial-scenario',
    product: PRODUCT,
    baseline: burst('baseline', [BASELINE_SCORE, BASELINE_SCORE, BASELINE_SCORE], baselineStart),
    endpoint: burst('followup', endpointScores(scenario.delta, scenario.pattern), endpointStart),
    baselineCapture: null,
    endpointCapture: null,
    baselineContext: context.baseline,
    endpointContext: context.endpoint,
    disturbance: context.disturbance,
  });
  const snapshot = structuredClone(bridged);
  applyComparability(snapshot, 'baseline', scenario.baselineComparability ?? scenario.comparability);
  applyComparability(snapshot, 'endpoint', scenario.endpointComparability ?? scenario.comparability);
  const recordedAt = iso(endpointStart + 5 * 60_000);
  return applyTrialTruthToRednessEvaluation(snapshot, {
    generationId: 'trial-truth-scenario',
    recordedAt,
    adherence: { status: scenario.adherence },
    tolerance: toleranceFor(scenario.tolerance),
    patientAnchor: { visibleChange: scenario.anchor, recordedAt },
  });
}

function compatibilityAction(action: RednessEvaluationSnapshot['interpretation']['recommendedAction']): RecommendedAction {
  switch (action) {
    case 'keep':
      return 'keep';
    case 'test_longer':
      return 'wait';
    case 'retry_alone':
    case 'not_proving_job':
      return 'reassess';
    case 'safety_interruption':
      return 'seek_professional_guidance';
  }
}

/** Mirrors the production record (createEvidenceRecord): `comparison` comes from the analysis
 * the reducer stored, which maps limited measurement to `partially_comparable`. */
export function recordForSnapshot(snapshot: RednessEvaluationSnapshot): EvidenceRecordData {
  const action = snapshot.interpretation.recommendedAction;
  return {
    id: `ER-${snapshot.trialId}`,
    specimenId: snapshot.productId,
    accession: 'FV-SCN',
    product: 'One Thing',
    productBrand: 'Lab Dojo',
    job: 'Reduce visible redness',
    observationWindow: `${snapshot.baseline.sessions[0]?.capturedAt ?? snapshot.evaluatedAt} to ${snapshot.evaluatedAt}`,
    comparison: analysisResultFromRednessEvaluation(snapshot).comparison,
    finding: snapshot.interpretation.finding,
    nonFinding: snapshot.interpretation.nonFinding,
    confidence: snapshot.evidenceQuality,
    disturbance: snapshot.secondProductStatus === 'active_overlap' ? 'overlap_retained' : 'none',
    finalPlacement: placementForRednessAction(action),
    recommendedAction: compatibilityAction(action),
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    createdAt: snapshot.evaluatedAt,
    includesFaceImage: false,
    evidenceSource: 'YouCam Skin Analysis v2.1',
    baselineRawScore: snapshot.baselineRawMedian ?? undefined,
    followUpRawScore: snapshot.endpointRawMedian ?? undefined,
    rednessEvaluation: snapshot,
  };
}
