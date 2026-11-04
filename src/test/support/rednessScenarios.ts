// Test-only kit: drives the production redness bridge and the production result view models
// with live-shaped evidence. It never calls a provider and never touches the network.
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
import { evidenceRecordViewModelFromRecord } from '../../features/evidence-record/evidenceRecordViewModel';
import { resultExperienceViewModelFromRecord } from '../../features/evidence-record/resultExperienceViewModel';
import { submissionContinuityEvidenceViewModel } from '../../features/submission-continuity/submissionContinuityViewModel';
import { verdictViewModelFromRecord } from '../../features/verdict/verdictViewModel';

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

function findRowValue(node: unknown, rowId: string): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRowValue(item, rowId);
      if (found !== null) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.id === rowId && typeof record.value === 'string') return record.value;
    for (const value of Object.values(record)) {
      const found = findRowValue(value, rowId);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Every string a person reads for this result, taken from the production view models. */
export interface ResultSurfaces {
  oracleHeadline: string;
  oracleExplanation: string;
  oracleNextStep: string;
  recordHeadline: string;
  recordInterpretation: string;
  recordNextTitle: string;
  recordNextBody: string;
  recordNextTone: string;
  recordSavedExplanation: string | null;
  previousTrialsVerdict: string;
  nonFinding: string;
  claimBoundary: string;
  /** Strings the current UI renders visibly (Chromium-verified): the Oracle finding projection
   * and NEXT label, the "Why this result" panel, the Record result layer, Previous Trials. */
  visible: string[];
}

export function surfacesFor(snapshot: RednessEvaluationSnapshot): ResultSurfaces {
  const record = recordForSnapshot(snapshot);
  const oracle = verdictViewModelFromRecord(record);
  const evidenceRecord = evidenceRecordViewModelFromRecord(record);
  const previous = resultExperienceViewModelFromRecord(record);
  const analysis = analysisResultFromRednessEvaluation(snapshot);
  const why = submissionContinuityEvidenceViewModel(
    analysis,
    analysis.confidence,
    placementForRednessAction(snapshot.interpretation.recommendedAction),
  );
  return {
    oracleHeadline: oracle.headline,
    oracleExplanation: oracle.explanation,
    oracleNextStep: oracle.nextStepLabel,
    recordHeadline: evidenceRecord.headline,
    recordInterpretation: evidenceRecord.interpretation,
    recordNextTitle: evidenceRecord.nextStep.title,
    recordNextBody: evidenceRecord.nextStep.body,
    recordNextTone: evidenceRecord.nextStep.tone,
    recordSavedExplanation: findRowValue(evidenceRecord.full, 'deterministic-explanation'),
    previousTrialsVerdict: previous.verdict,
    nonFinding: snapshot.interpretation.nonFinding,
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    visible: [
      oracle.headline,
      oracle.nextStepLabel,
      why.change,
      why.comparison,
      why.evidence,
      why.recommendation,
      why.interpretation,
      why.claimBoundary,
      previous.verdict,
      previous.directionLabel,
      previous.evidenceLevel,
      evidenceRecord.nextStep.statusLabel,
    ],
  };
}

/** Decision fields only: no copy. A copy-only change must leave these byte-identical. */
export function decisionKey(snapshot: RednessEvaluationSnapshot): string {
  return [
    snapshot.effectClassification,
    snapshot.measurementQuality,
    snapshot.attributionQuality,
    snapshot.evidenceQuality,
    snapshot.safetyStatus,
    snapshot.directionAgreement.status,
    snapshot.observationWindowStatus,
    snapshot.interpretation.recommendedAction,
    snapshot.corroboratingSignals.join('+') || 'none',
    snapshot.rawScoreDelta,
    snapshot.threshold.configHash,
    snapshot.triggeredRuleIds.join(' '),
  ].join('|');
}

/** cyrb53: small, dependency-free, deterministic 53-bit string hash (test fingerprinting only). */
export function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export interface DecisionSummary {
  rowCount: number;
  fingerprint: string;
  outcomeCounts: Record<string, number>;
}

/** Fingerprint of every decision in the grid, plus grouped counts so a drift is diagnosable. */
export function summarizeDecisions(grid: LabeledScenario[]): DecisionSummary {
  const keys: string[] = [];
  const outcomeCounts: Record<string, number> = {};
  for (const { comparabilityClass, scenario } of grid) {
    const snapshot = evaluateLiveScenario(scenario);
    keys.push(decisionKey(snapshot));
    const group = [
      comparabilityClass,
      snapshot.effectClassification,
      snapshot.measurementQuality,
      snapshot.safetyStatus,
      snapshot.interpretation.recommendedAction,
    ].join('|');
    outcomeCounts[group] = (outcomeCounts[group] ?? 0) + 1;
  }
  const sorted = Object.fromEntries(Object.entries(outcomeCounts).sort(([a], [b]) => a.localeCompare(b)));
  return { rowCount: keys.length, fingerprint: fingerprint(keys.join('\n')), outcomeCounts: sorted };
}

export const COMPARABILITY_CLASSES: Record<string, ComparabilityProfile | null> = {
  live_adapter: null,
  all_pass: allComparability('pass'),
  one_limited: { ...allComparability('pass'), poseComparability: 'limited' },
  one_fail: { ...allComparability('pass'), poseComparability: 'fail' },
};

export const GRID_DELTAS = [-20, -10, -9, -5, -4, 0, 4, 5, 9, 10, 20] as const;
export const GRID_INTERVALS = [7, 29, 60] as const;

export interface LabeledScenario {
  comparabilityClass: string;
  scenario: LiveScenario;
}

/** Bounded grid (12,672 scenarios) covering every boundary that decides an action. */
export function decisionGrid(): LabeledScenario[] {
  const rows: LabeledScenario[] = [];
  for (const [comparabilityClass, comparability] of Object.entries(COMPARABILITY_CLASSES))
    for (const delta of GRID_DELTAS)
      for (const pattern of ['unanimous', 'one_contradicting'] as const)
        for (const intervalDays of GRID_INTERVALS)
          for (const adherence of ['complete', 'poor'] as const)
            for (const tolerance of ['none', 'moderate_burning', 'mild_swelling'] as const)
              for (const anchor of [-1, 1] as const)
                for (const context of ['none', 'second_product', 'two_downgrades', 'makeup'] as const)
                  rows.push({
                    comparabilityClass,
                    scenario: { comparability, delta, pattern, intervalDays, adherence, tolerance, anchor, context },
                  });
  return rows;
}
