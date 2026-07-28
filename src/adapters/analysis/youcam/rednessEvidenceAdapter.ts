import {
  REDNESS_FRAMEWORK_VERSION,
  REDNESS_MVP_OBSERVATION_WINDOW,
  REDNESS_SCHEMA_VERSION,
  evaluateRedness,
  type CaptureQuality,
  type ConfounderFlag,
  type EvidenceSession,
  type RednessAction,
  type RednessEvaluationInput,
  type RednessEvaluationSnapshot,
  type RednessVersionMetadata,
} from '../../../domain/evidence/redness';
import type {
  AnalysisResult,
  CaptureContext,
  CaptureMetadata,
  ComparisonState,
  DisturbanceState,
  DurableSkinSignal,
  ProductPlacement,
  RecommendedAction,
  RednessComparison,
  RegisteredProduct,
} from '../../../domain/model';

const APP_BUILD_VERSION = 'face-value-web-0.1.0';
const PROVIDER_MODEL_VERSION_NOT_REPORTED = 'youcam-hd-redness-model-version-not-reported';
const PREPROCESSING_VERSION = 'face-value-unmodified-upload-v1';

const hasForbiddenUiScore = (signal: DurableSkinSignal): boolean =>
  'ui_score' in signal || 'uiScore' in signal;

function versionsFor(signal: DurableSkinSignal): RednessVersionMetadata {
  return {
    apiVersion: signal.apiVersion,
    analysisModelVersion: PROVIDER_MODEL_VERSION_NOT_REPORTED,
    analysisMode: signal.mode,
    appBuildVersion: APP_BUILD_VERSION,
    preprocessingVersion: PREPROCESSING_VERSION,
    captureProtocolVersion: signal.captureProtocolVersion,
  };
}

function captureQualityFor(context: CaptureContext | null): CaptureQuality {
  const makeupPresent = context?.makeup === true;
  return {
    accepted: !makeupPresent,
    lightingComparability: 'limited',
    poseComparability: 'limited',
    cropComparability: 'limited',
    faceSizeComparability: 'limited',
    colorCastComparability: makeupPresent ? 'fail' : 'limited',
    obstructionPresent: makeupPresent,
    enhancementDetected: false,
    reasons: [
      'The current MVP stores one accepted image per capture session.',
      'Cross-session lighting, pose, crop, face-size, and color-cast metrics were not persisted.',
      ...(makeupPresent
        ? ['Makeup was reported, so the visible-redness comparison is not readable.']
        : []),
    ],
  };
}

function sessionFor(input: {
  signal: DurableSkinSignal;
  capture: CaptureMetadata | null;
  context: CaptureContext | null;
  fallbackId: string;
}): EvidenceSession {
  const frameId = input.capture?.id ?? input.fallbackId;
  return {
    sessionId: `${frameId}-session`,
    capturedAt: input.signal.capturedAt,
    deviceClass:
      input.capture?.cameraProfileId ??
      (input.capture?.source === 'camera'
        ? 'front-camera-profile-not-recorded'
        : 'user-provided-front-image'),
    cameraFacing: 'front',
    frameIds: [frameId],
    rawScores: [input.signal.rawScore],
    acceptedFrameIds: [frameId],
    rejectedFrames: [],
    captureQuality: captureQualityFor(input.context),
    versions: versionsFor(input.signal),
  };
}

function confoundersFor(input: {
  baselineContext: CaptureContext | null;
  followUpContext: CaptureContext | null;
  disturbance: DisturbanceState;
}): ConfounderFlag[] {
  const flags: ConfounderFlag[] = [];
  const contexts = [
    ['baseline', input.baselineContext] as const,
    ['endpoint', input.followUpContext] as const,
  ];

  for (const [period, context] of contexts) {
    if (!context) continue;
    if (context.makeup) {
      flags.push({
        code: `${period}_makeup_present`,
        severity: 'hard_failure',
        source: 'capture',
        note: 'Makeup was reported for this capture.',
      });
    }
    if (context.routineOrTreatmentChange) {
      flags.push({
        code: `${period}_routine_or_treatment_change`,
        severity: 'attribution_blocker',
        source: 'user_report',
        note: 'A routine or treatment change was reported.',
      });
    }
    if (context.recentHeatOrExercise) {
      flags.push({
        code: `${period}_recent_heat_or_exercise`,
        severity: 'downgrade',
        source: 'user_report',
        note: 'Recent heat or exercise may affect visible redness.',
      });
    }
    if (context.recentCleansingOrSkincare) {
      flags.push({
        code: `${period}_recent_cleansing_or_skincare`,
        severity: 'downgrade',
        source: 'user_report',
        note: 'Recent cleansing or skincare timing differed.',
      });
    }
  }

  if (input.disturbance === 'detected' || input.disturbance === 'overlap_retained') {
    flags.push({
      code: 'active_second_redness_product',
      severity: 'attribution_blocker',
      source: 'system',
      note: 'A second product remained active during the trial.',
    });
  }
  return flags;
}

function elapsedDays(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round(((endTime - startTime) / 86_400_000) * 100) / 100);
}

export function buildMvpRednessEvaluation(input: {
  trialId: string;
  product: RegisteredProduct;
  baseline: DurableSkinSignal;
  endpoint: DurableSkinSignal;
  baselineCapture: CaptureMetadata | null;
  endpointCapture: CaptureMetadata | null;
  baselineContext: CaptureContext | null;
  endpointContext: CaptureContext | null;
  disturbance: DisturbanceState;
}): RednessEvaluationSnapshot {
  const uiScorePresent = hasForbiddenUiScore(input.baseline) || hasForbiddenUiScore(input.endpoint);
  const activeOverlap =
    input.disturbance === 'detected' || input.disturbance === 'overlap_retained';
  const confounders = confoundersFor({
    baselineContext: input.baselineContext,
    followUpContext: input.endpointContext,
    disturbance: input.disturbance,
  });
  const evidenceInput: RednessEvaluationInput = {
    frameworkVersion: REDNESS_FRAMEWORK_VERSION,
    schemaVersion: REDNESS_SCHEMA_VERSION,
    trialId: input.trialId,
    productId: input.product.id,
    assignedJob: 'calm_visible_redness',
    expectedObservationWindowDays: {
      ...(input.product.expectedObservationWindowDays ?? REDNESS_MVP_OBSERVATION_WINDOW),
    },
    actualObservationIntervalDays: elapsedDays(
      input.baseline.capturedAt,
      input.endpoint.capturedAt,
    ),
    evaluatedAt: input.endpoint.capturedAt,
    baseline: {
      sessions: [
        sessionFor({
          signal: input.baseline,
          capture: input.baselineCapture,
          context: input.baselineContext,
          fallbackId: `${input.trialId}-baseline`,
        }),
      ],
    },
    endpoint: {
      sessions: [
        sessionFor({
          signal: input.endpoint,
          capture: input.endpointCapture,
          context: input.endpointContext,
          fallbackId: `${input.trialId}-endpoint`,
        }),
      ],
    },
    maskEvidence: {},
    patientAnchor: null,
    tolerance: null,
    adherence: { status: 'unknown' },
    confounders,
    secondProductStatus: activeOverlap ? 'active_overlap' : 'none',
  };

  const evaluatorInput = uiScorePresent
    ? ({
        ...evidenceInput,
        ui_score: 'rejected',
      } as RednessEvaluationInput)
    : evidenceInput;
  const snapshot = evaluateRedness(evaluatorInput);
  return snapshot.versions.analysisModelVersion === PROVIDER_MODEL_VERSION_NOT_REPORTED
    ? {
        ...snapshot,
        missingEvidence: [
          ...snapshot.missingEvidence,
          'The provider did not report an analysis model version for this MVP result.',
        ],
      }
    : snapshot;
}

function compatibilityRecommendedAction(action: RednessAction): RecommendedAction {
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

export function placementForRednessAction(action: RednessAction): ProductPlacement {
  switch (action) {
    case 'keep':
      return 'established';
    case 'test_longer':
      return 'paused';
    case 'retry_alone':
      return 'retry_alone';
    case 'not_proving_job':
      return 'useful_elsewhere';
    case 'safety_interruption':
      return 'released';
  }
}

function comparisonStateFor(snapshot: RednessEvaluationSnapshot): ComparisonState {
  if (snapshot.measurementQuality === 'invalid') return 'not_comparable';
  if (snapshot.measurementQuality === 'limited' || snapshot.attributionQuality === 'blocked') {
    return 'partially_comparable';
  }
  return 'comparable';
}

export function rednessComparisonFromEvaluation(
  snapshot: RednessEvaluationSnapshot,
): RednessComparison {
  if (
    snapshot.baselineRawMedian === null ||
    snapshot.endpointRawMedian === null ||
    snapshot.rawScoreDelta === null
  ) {
    throw new Error('A compatibility comparison requires finite redness medians.');
  }
  return {
    baselineRawScore: snapshot.baselineRawMedian,
    followUpRawScore: snapshot.endpointRawMedian,
    delta: snapshot.rawScoreDelta,
    direction:
      snapshot.rawScoreDelta > 0
        ? 'favorable'
        : snapshot.rawScoreDelta < 0
          ? 'unfavorable'
          : 'unchanged',
    calibration: 'provisional_fixture',
    confidence: snapshot.evidenceQuality,
    limitations: [...snapshot.interpretation.limitations],
  };
}

export function analysisResultFromRednessEvaluation(
  snapshot: RednessEvaluationSnapshot,
): AnalysisResult {
  const comparison = comparisonStateFor(snapshot);
  return {
    captureQuality:
      snapshot.measurementQuality === 'invalid'
        ? 'rejected'
        : snapshot.measurementQuality === 'limited'
          ? 'context_only'
          : 'accepted',
    comparison,
    visibleSignal: 'visible redness',
    confidence: snapshot.evidenceQuality,
    finding: snapshot.interpretation.finding,
    nonFinding: snapshot.interpretation.nonFinding,
    relevantContext: snapshot.interpretation.explanation,
    recommendedAction: compatibilityRecommendedAction(snapshot.interpretation.recommendedAction),
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    simulated: false,
    provider: 'youcam',
    baselineRawScore: snapshot.baselineRawMedian ?? undefined,
    followUpRawScore: snapshot.endpointRawMedian ?? undefined,
    delta: snapshot.rawScoreDelta ?? undefined,
    direction:
      snapshot.rawScoreDelta === null
        ? undefined
        : snapshot.rawScoreDelta > 0
          ? 'favorable'
          : snapshot.rawScoreDelta < 0
            ? 'unfavorable'
            : 'unchanged',
    limitations: [...snapshot.interpretation.limitations],
    rednessEvaluation: snapshot,
  };
}
