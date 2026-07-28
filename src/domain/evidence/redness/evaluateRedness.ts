import { aggregateEvidencePeriod } from './aggregateEvidence';
import { interpretationForRedness } from './explanationTemplates';
import {
  PROVISIONAL_REDNESS_THRESHOLDS,
  PROVISIONAL_THRESHOLD_NOTE,
  activeDetectableBoundary,
  classifyEffect,
  evidenceStrengthRatio,
} from './thresholds';
import {
  REDNESS_ENGINE_VERSION,
  REDNESS_FRAMEWORK_VERSION,
  REDNESS_SCHEMA_VERSION,
  type AttributionQuality,
  type AuditTraceEntry,
  type DirectionAgreement,
  type EvidenceQuality,
  type EvidenceSession,
  type MeasurementQuality,
  type RednessAction,
  type RednessEvaluationInput,
  type RednessEvaluationSnapshot,
  type RednessThresholdConfiguration,
  type RednessVersionMetadata,
  type SafetyStatus,
} from './types';

const VERSION_KEYS: Array<keyof RednessVersionMetadata> = [
  'apiVersion',
  'analysisModelVersion',
  'analysisMode',
  'preprocessingVersion',
  'captureProtocolVersion',
];

const SERIOUS_SYMPTOMS = new Set(['swelling', 'blistering', 'eye_involvement', 'rapid_escalation']);

const UNKNOWN_VERSIONS: RednessVersionMetadata = {
  apiVersion: 'not_available',
  analysisModelVersion: 'not_available',
  analysisMode: 'hd',
  appBuildVersion: 'not_available',
  preprocessingVersion: 'not_available',
  captureProtocolVersion: 'not_available',
};

function containsForbiddenUiScore(value: unknown, visited = new WeakSet<object>()): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenUiScore(item, visited));
  }
  const record = value as Record<string, unknown>;
  if ('ui_score' in record || 'uiScore' in record) return true;
  return Object.values(record).some((item) => containsForbiddenUiScore(item, visited));
}

function cloneThreshold(
  threshold: RednessThresholdConfiguration | undefined,
): RednessThresholdConfiguration {
  return { ...(threshold ?? PROVISIONAL_REDNESS_THRESHOLDS) };
}

function thresholdConfigurationValid(threshold: RednessThresholdConfiguration): boolean {
  if (!threshold.version || !threshold.configHash) return false;
  if (threshold.source === 'provisional_fixture') {
    const detectable = threshold.provisionalDetectablePoints;
    const strong = threshold.provisionalStrongPoints;
    return (
      threshold.provisional === true &&
      typeof detectable === 'number' &&
      Number.isFinite(detectable) &&
      detectable > 0 &&
      typeof strong === 'number' &&
      Number.isFinite(strong) &&
      strong > detectable
    );
  }
  return (
    threshold.provisional === false &&
    typeof threshold.activeN95 === 'number' &&
    Number.isFinite(threshold.activeN95) &&
    threshold.activeN95 > 0
  );
}

function versionCompatibility(sessions: EvidenceSession[]): {
  compatible: boolean;
  versions: RednessVersionMetadata;
  reasons: string[];
} {
  const first = sessions[0]?.versions;
  if (!first) {
    return {
      compatible: false,
      versions: { ...UNKNOWN_VERSIONS },
      reasons: ['No session version metadata was available.'],
    };
  }

  const reasons: string[] = [];
  if (first.analysisMode !== 'hd') {
    reasons.push('The deciding redness signal was not analyzed in HD mode.');
  }
  for (const session of sessions.slice(1)) {
    for (const key of VERSION_KEYS) {
      if (session.versions[key] !== first[key]) {
        reasons.push(`${session.sessionId}: ${key} does not match the frozen trial version.`);
      }
    }
  }

  return {
    compatible: reasons.length === 0,
    versions: { ...first },
    reasons,
  };
}

function hardCaptureFailure(session: EvidenceSession): boolean {
  const quality = session.captureQuality;
  return (
    !quality.accepted ||
    quality.lightingComparability === 'fail' ||
    quality.poseComparability === 'fail' ||
    quality.cropComparability === 'fail' ||
    quality.faceSizeComparability === 'fail' ||
    quality.colorCastComparability === 'fail' ||
    quality.obstructionPresent ||
    quality.enhancementDetected
  );
}

function limitedCapture(session: EvidenceSession): boolean {
  const quality = session.captureQuality;
  return [
    quality.lightingComparability,
    quality.poseComparability,
    quality.cropComparability,
    quality.faceSizeComparability,
    quality.colorCastComparability,
  ].includes('limited');
}

function measurementQualityFor(input: {
  schemaCompatible: boolean;
  versionsCompatible: boolean;
  hardCaptureFailurePresent: boolean;
  captureLimited: boolean;
  aggregationInvalid: boolean;
  baselineSessionCount: number;
  endpointSessionCount: number;
  baselineAcceptedCount: number;
  endpointAcceptedCount: number;
  rejectedFrameCount: number;
}): MeasurementQuality {
  if (
    !input.schemaCompatible ||
    !input.versionsCompatible ||
    input.hardCaptureFailurePresent ||
    input.aggregationInvalid
  ) {
    return 'invalid';
  }

  const fullBursts = input.baselineAcceptedCount >= 3 && input.endpointAcceptedCount >= 3;
  if (
    input.baselineSessionCount >= 2 &&
    input.endpointSessionCount >= 2 &&
    input.baselineAcceptedCount >= 6 &&
    input.endpointAcceptedCount >= 6 &&
    !input.captureLimited &&
    input.rejectedFrameCount === 0
  ) {
    return 'strong';
  }
  if (fullBursts && !input.captureLimited) return 'adequate';
  return 'limited';
}

function directionAgreementFor(input: {
  baselineMedian: number | null;
  endpointScores: number[];
  effect: RednessEvaluationSnapshot['effectClassification'];
  detectableBoundary: number | null;
}): DirectionAgreement {
  if (input.baselineMedian === null || input.endpointScores.length < 3 || input.effect === null) {
    return {
      status: 'not_available',
      assessedEndpointFrameCount: input.endpointScores.length,
      improvingEndpointFrameCount: 0,
      contradictionDetected: false,
    };
  }

  const deltas = input.endpointScores.map((score) => score - input.baselineMedian!);
  const improvingEndpointFrameCount = deltas.filter((delta) => delta > 0).length;
  const boundary = input.detectableBoundary ?? Number.POSITIVE_INFINITY;
  const improvementEffect = [
    'directional_improvement',
    'meaningful_candidate',
    'strong_improvement',
  ].includes(input.effect);
  const contradictionDetected = improvementEffect
    ? deltas.some((delta) => delta <= -boundary)
    : input.effect === 'worsened'
      ? deltas.some((delta) => delta >= boundary)
      : false;
  const agreeingCount = improvementEffect
    ? improvingEndpointFrameCount
    : input.effect === 'worsened'
      ? deltas.filter((delta) => delta < 0).length
      : deltas.filter((delta) => Math.abs(delta) < boundary).length;

  return {
    status: contradictionDetected ? 'contradicted' : agreeingCount >= 2 ? 'agreeing' : 'mixed',
    assessedEndpointFrameCount: deltas.length,
    improvingEndpointFrameCount,
    contradictionDetected,
  };
}

function attributionQualityFor(input: RednessEvaluationInput): AttributionQuality {
  const attributionBlocker =
    input.secondProductStatus === 'active_overlap' ||
    input.confounders.some(
      (flag) =>
        flag.severity === 'attribution_blocker' ||
        (flag.severity === 'hard_failure' && flag.source !== 'capture'),
    );
  if (attributionBlocker) return 'blocked';

  const downgrades = input.confounders.filter((flag) => flag.severity === 'downgrade').length;
  if (
    input.secondProductStatus === 'possible_overlap' ||
    input.adherence.status === 'poor' ||
    input.adherence.status === 'unknown' ||
    downgrades > 1
  ) {
    return 'weak';
  }
  if (input.adherence.status === 'partial' || downgrades === 1) return 'moderate';
  return 'strong';
}

function safetyStatusFor(input: {
  tolerance: RednessEvaluationInput['tolerance'];
  effect: RednessEvaluationSnapshot['effectClassification'];
}): SafetyStatus {
  if (!input.tolerance) return 'check_required';
  const seriousSymptom = input.tolerance.symptoms.some((symptom) => SERIOUS_SYMPTOMS.has(symptom));
  const significantBurning =
    input.tolerance.symptoms.includes('burning') &&
    ['moderate', 'severe'].includes(input.tolerance.severity);
  if (input.tolerance.severity === 'severe' || seriousSymptom || significantBurning) {
    return 'interrupted';
  }
  if (input.effect === 'worsened') return 'check_required';
  return 'clear';
}

function actionFor(input: {
  safetyStatus: SafetyStatus;
  attributionQuality: AttributionQuality;
  tooEarly: boolean;
  measurementQuality: MeasurementQuality;
  effect: RednessEvaluationSnapshot['effectClassification'];
  directionAgreement: DirectionAgreement;
  corroboratingSignalCount: number;
  toleranceCollected: boolean;
}): RednessAction {
  if (input.safetyStatus === 'interrupted') return 'safety_interruption';
  if (input.attributionQuality === 'blocked') return 'retry_alone';
  if (input.tooEarly) return 'test_longer';
  if (input.measurementQuality === 'invalid') return 'test_longer';

  const keepCandidate =
    input.effect === 'meaningful_candidate' || input.effect === 'strong_improvement';
  if (
    keepCandidate &&
    ['adequate', 'strong'].includes(input.measurementQuality) &&
    ['moderate', 'strong'].includes(input.attributionQuality) &&
    input.directionAgreement.status === 'agreeing' &&
    input.corroboratingSignalCount > 0 &&
    input.toleranceCollected &&
    input.safetyStatus === 'clear'
  ) {
    return 'keep';
  }

  if (
    input.effect === 'directional_improvement' ||
    input.measurementQuality === 'limited' ||
    ['mixed', 'contradicted', 'not_available'].includes(input.directionAgreement.status)
  ) {
    return 'test_longer';
  }

  if (
    (input.effect === 'no_detectable_change' || input.effect === 'worsened') &&
    ['adequate', 'strong'].includes(input.measurementQuality)
  ) {
    return 'not_proving_job';
  }

  return 'test_longer';
}

function evidenceQualityFor(input: {
  measurementQuality: MeasurementQuality;
  attributionQuality: AttributionQuality;
  tooEarly: boolean;
}): EvidenceQuality {
  if (input.measurementQuality === 'invalid') return 'insufficient';
  if (
    input.measurementQuality === 'limited' ||
    input.tooEarly ||
    ['blocked', 'weak'].includes(input.attributionQuality)
  ) {
    return 'possible';
  }
  return 'likely';
}

function observationWindowStatus(input: RednessEvaluationInput) {
  if (
    !Number.isFinite(input.actualObservationIntervalDays) ||
    input.actualObservationIntervalDays < input.expectedObservationWindowDays.minimum
  ) {
    return 'too_early' as const;
  }
  if (
    input.expectedObservationWindowDays.maximum !== undefined &&
    input.actualObservationIntervalDays > input.expectedObservationWindowDays.maximum
  ) {
    return 'past_maximum' as const;
  }
  return 'within_window' as const;
}

export function evaluateRedness(input: RednessEvaluationInput): RednessEvaluationSnapshot {
  const auditTrace: AuditTraceEntry[] = [];
  const triggeredRuleIds: string[] = [];
  const reasons: string[] = [];
  const missingEvidence: string[] = [];
  const limitations: string[] = [];
  const recordTrace = (ruleId: string, outcome: AuditTraceEntry['outcome'], detail: string) => {
    triggeredRuleIds.push(ruleId);
    auditTrace.push({ ruleId, outcome, detail });
  };

  const uiScorePresent = containsForbiddenUiScore(input);
  const allInputSessions = [...input.baseline.sessions, ...input.endpoint.sessions];
  const versionCheck = versionCompatibility(allInputSessions);
  const schemaCompatible =
    input.frameworkVersion === REDNESS_FRAMEWORK_VERSION &&
    input.schemaVersion === REDNESS_SCHEMA_VERSION &&
    input.assignedJob === 'calm_visible_redness' &&
    !uiScorePresent;
  if (uiScorePresent) reasons.push('ui_score is forbidden in redness evidence.');
  reasons.push(...versionCheck.reasons);
  recordTrace(
    uiScorePresent ? 'R01_UI_SCORE_REJECTED' : 'R01_SCHEMA_AND_VERSIONS',
    schemaCompatible && versionCheck.compatible ? 'pass' : 'fail',
    schemaCompatible && versionCheck.compatible
      ? 'Schema, HD mode, and immutable comparison versions are compatible.'
      : 'Schema or immutable comparison versions are incompatible.',
  );

  const hardCaptureFailurePresent =
    allInputSessions.some(hardCaptureFailure) ||
    input.confounders.some((flag) => flag.source === 'capture' && flag.severity === 'hard_failure');
  const captureLimited = allInputSessions.some(limitedCapture);
  const captureReasons = allInputSessions.flatMap((session) => session.captureQuality.reasons);
  limitations.push(...captureReasons);
  recordTrace(
    'R02_CAPTURE_QUALITY',
    hardCaptureFailurePresent ? 'fail' : captureLimited ? 'limited' : 'pass',
    hardCaptureFailurePresent
      ? 'At least one capture has a hard comparability failure.'
      : captureLimited
        ? 'The captures are usable with recorded comparability limits.'
        : 'All provided captures passed the recorded comparability gates.',
  );

  const baseline = aggregateEvidencePeriod(input.baseline, 'baseline');
  const endpoint = aggregateEvidencePeriod(input.endpoint, 'endpoint');
  reasons.push(...baseline.invalidReasons, ...endpoint.invalidReasons);
  limitations.push(...baseline.limitations, ...endpoint.limitations);
  const aggregationInvalid =
    baseline.invalidReasons.length > 0 ||
    endpoint.invalidReasons.length > 0 ||
    baseline.period.rawMedian === null ||
    endpoint.period.rawMedian === null;
  recordTrace(
    'R03_ACCEPTED_SCORE_AGGREGATION',
    aggregationInvalid ? 'fail' : 'pass',
    aggregationInvalid
      ? 'A finite baseline and endpoint median could not both be constructed.'
      : 'Accepted raw scores were aggregated into period medians.',
  );

  let measurementQuality = measurementQualityFor({
    schemaCompatible,
    versionsCompatible: versionCheck.compatible,
    hardCaptureFailurePresent,
    captureLimited,
    aggregationInvalid,
    baselineSessionCount: baseline.period.sessionCount,
    endpointSessionCount: endpoint.period.sessionCount,
    baselineAcceptedCount: baseline.period.acceptedRawScores.length,
    endpointAcceptedCount: endpoint.period.acceptedRawScores.length,
    rejectedFrameCount: baseline.period.rejectedFrameCount + endpoint.period.rejectedFrameCount,
  });
  recordTrace(
    `R04_MEASUREMENT_${measurementQuality.toUpperCase()}`,
    measurementQuality === 'invalid'
      ? 'fail'
      : measurementQuality === 'limited'
        ? 'limited'
        : 'selected',
    `Measurement quality classified independently as ${measurementQuality}.`,
  );

  const windowStatus = observationWindowStatus(input);
  const tooEarly = windowStatus === 'too_early';
  recordTrace(
    tooEarly ? 'R05_OBSERVATION_WINDOW_EARLY' : 'R05_OBSERVATION_WINDOW_ELAPSED',
    tooEarly ? 'limited' : 'pass',
    `${input.actualObservationIntervalDays} observed day(s); minimum ${input.expectedObservationWindowDays.minimum}.`,
  );

  const threshold = cloneThreshold(input.threshold);
  const thresholdValid = thresholdConfigurationValid(threshold);
  if (!thresholdValid) {
    measurementQuality = 'invalid';
    reasons.push('The active redness threshold configuration is incomplete or incompatible.');
  }
  const rawScoreDelta =
    baseline.period.rawMedian === null || endpoint.period.rawMedian === null
      ? null
      : endpoint.period.rawMedian - baseline.period.rawMedian;
  threshold.evidenceStrengthRatio = evidenceStrengthRatio(rawScoreDelta, threshold);
  if (threshold.provisional) limitations.push(PROVISIONAL_THRESHOLD_NOTE);
  recordTrace(
    threshold.provisional ? 'R06_THRESHOLD_PROVISIONAL' : 'R06_THRESHOLD_CALIBRATED',
    thresholdValid ? 'selected' : 'fail',
    thresholdValid
      ? `${threshold.source} ${threshold.version} (${threshold.configHash}) selected.`
      : 'The threshold configuration was not complete enough to classify this comparison.',
  );

  const effectClassification =
    rawScoreDelta === null || !thresholdValid ? null : classifyEffect(rawScoreDelta, threshold);
  recordTrace(
    effectClassification
      ? `R07_EFFECT_${effectClassification.toUpperCase()}`
      : 'R07_EFFECT_UNAVAILABLE',
    effectClassification ? 'selected' : 'not_available',
    effectClassification
      ? `Endpoint minus baseline raw-score delta classified as ${effectClassification}.`
      : 'No finite primary-signal delta was available.',
  );

  const directionAgreement = directionAgreementFor({
    baselineMedian: baseline.period.rawMedian,
    endpointScores: endpoint.period.acceptedRawScores,
    effect: effectClassification,
    detectableBoundary: activeDetectableBoundary(threshold),
  });
  if (directionAgreement.status === 'not_available') {
    missingEvidence.push(
      'Repeated endpoint-frame direction was not available from the collected evidence.',
    );
  }
  recordTrace(
    `R08_DIRECTION_${directionAgreement.status.toUpperCase()}`,
    directionAgreement.status === 'agreeing'
      ? 'pass'
      : directionAgreement.status === 'not_available'
        ? 'not_available'
        : 'limited',
    `${directionAgreement.improvingEndpointFrameCount} of ${directionAgreement.assessedEndpointFrameCount} endpoint frame(s) moved favorably.`,
  );

  const maskProvided = Object.keys(input.maskEvidence).length > 0;
  const maskFailed = input.maskEvidence.segmentationStable === false;
  if (maskFailed) {
    measurementQuality = 'invalid';
    reasons.push('Redness segmentation was not stable enough for comparison.');
  }
  const maskCorroborates =
    input.maskEvidence.segmentationStable === true &&
    ((typeof input.maskEvidence.areaDelta === 'number' && input.maskEvidence.areaDelta < 0) ||
      (typeof input.maskEvidence.baselineAreaPct === 'number' &&
        typeof input.maskEvidence.endpointAreaPct === 'number' &&
        input.maskEvidence.endpointAreaPct < input.maskEvidence.baselineAreaPct));
  if (!maskProvided) {
    missingEvidence.push('Mask and facial-registration evidence was not collected.');
  }
  recordTrace(
    'R09_MASK_AND_REGISTRATION',
    maskFailed ? 'fail' : maskProvided ? 'pass' : 'not_available',
    maskFailed
      ? 'Mask stability invalidated regional comparability.'
      : maskProvided
        ? 'Mask evidence was retained only as validity or corroborating evidence.'
        : 'No mask or registration evidence was available.',
  );

  const anchorCorroborates = (input.patientAnchor?.visibleChange ?? 0) > 0;
  if (!input.patientAnchor) {
    missingEvidence.push('A patient-observed visible-redness anchor was not collected.');
  } else if (input.patientAnchor.visibleChange < 0) {
    limitations.push('The patient-observed redness anchor contradicted improvement.');
  }
  recordTrace(
    'R10_PATIENT_ANCHOR',
    input.patientAnchor ? (anchorCorroborates ? 'pass' : 'limited') : 'not_available',
    input.patientAnchor
      ? `Patient anchor recorded visible change ${input.patientAnchor.visibleChange}.`
      : 'No patient anchor was available.',
  );

  const attributionQuality = attributionQualityFor(input);
  if (input.adherence.status === 'unknown') {
    missingEvidence.push('Adherence was not collected.');
  }
  recordTrace(
    `R11_ATTRIBUTION_${attributionQuality.toUpperCase()}`,
    attributionQuality === 'blocked'
      ? 'fail'
      : attributionQuality === 'weak'
        ? 'limited'
        : 'selected',
    `Attribution quality classified independently as ${attributionQuality}.`,
  );

  recordTrace(
    effectClassification === 'worsened' ? 'R12_OBJECTIVE_WORSENING' : 'R12_NO_OBJECTIVE_WORSENING',
    effectClassification === 'worsened' ? 'selected' : 'pass',
    effectClassification === 'worsened'
      ? 'The primary redness raw score worsened beyond the active boundary.'
      : 'No objective worsening rule was triggered.',
  );

  const safetyStatus = safetyStatusFor({
    tolerance: input.tolerance,
    effect: effectClassification,
  });
  if (!input.tolerance) {
    missingEvidence.push('Symptoms and tolerance were not collected.');
  }
  recordTrace(
    `R13_SAFETY_${safetyStatus.toUpperCase()}`,
    safetyStatus === 'interrupted'
      ? 'fail'
      : safetyStatus === 'check_required'
        ? 'limited'
        : 'pass',
    `Safety status classified separately as ${safetyStatus}.`,
  );

  if (!input.contextSignals || Object.keys(input.contextSignals).length === 0) {
    missingEvidence.push(
      'Optional acne, texture, and moisture context signals were not collected.',
    );
  }

  const corroboratingSignals: Array<'mask' | 'patient_anchor'> = [];
  if (maskCorroborates) corroboratingSignals.push('mask');
  if (anchorCorroborates) corroboratingSignals.push('patient_anchor');
  const action = actionFor({
    safetyStatus,
    attributionQuality,
    tooEarly,
    measurementQuality,
    effect: effectClassification,
    directionAgreement,
    corroboratingSignalCount: corroboratingSignals.length,
    toleranceCollected: input.tolerance !== null,
  });
  recordTrace(
    `R14_ACTION_${action.toUpperCase()}`,
    'selected',
    `${action} selected after safety, attribution, timing, measurement, effect, and corroboration checks.`,
  );

  if (measurementQuality === 'limited') {
    limitations.push(
      'The current evidence volume supports only a limited measurement-quality classification.',
    );
  }
  const evidenceQuality = evidenceQualityFor({
    measurementQuality,
    attributionQuality,
    tooEarly,
  });
  const interpretation = interpretationForRedness({
    action,
    effect: effectClassification,
    measurementQuality,
    safetyStatus,
    tooEarly,
    limitations,
  });
  recordTrace(
    'R15_DETERMINISTIC_INTERPRETATION',
    'pass',
    'Finding, non-finding, limits, claim boundary, and explanation came from deterministic templates.',
  );

  return {
    frameworkVersion: REDNESS_FRAMEWORK_VERSION,
    schemaVersion: REDNESS_SCHEMA_VERSION,
    engineVersion: REDNESS_ENGINE_VERSION,
    evaluatedAt: input.evaluatedAt,
    trialId: input.trialId,
    productId: input.productId,
    assignedJob: 'calm_visible_redness',
    expectedObservationWindowDays: { ...input.expectedObservationWindowDays },
    actualObservationIntervalDays: input.actualObservationIntervalDays,
    observationWindowStatus: windowStatus,
    baseline: baseline.period,
    endpoint: endpoint.period,
    baselineRawMedian: baseline.period.rawMedian,
    endpointRawMedian: endpoint.period.rawMedian,
    rawScoreDelta,
    threshold,
    effectClassification,
    measurementQuality,
    attributionQuality,
    evidenceQuality,
    safetyStatus,
    directionAgreement,
    corroboratingSignals,
    maskEvidence: { ...input.maskEvidence },
    patientAnchor: input.patientAnchor ? { ...input.patientAnchor } : null,
    tolerance: input.tolerance
      ? {
          ...input.tolerance,
          symptoms: [...input.tolerance.symptoms],
          safetyStatus,
        }
      : null,
    adherence: { ...input.adherence },
    confounders: input.confounders.map((flag) => ({ ...flag })),
    secondProductStatus: input.secondProductStatus,
    contextSignals: { ...(input.contextSignals ?? {}) },
    versions: versionCheck.versions,
    interpretation,
    reasons: [...new Set(reasons)],
    missingEvidence: [...new Set(missingEvidence)],
    triggeredRuleIds,
    auditTrace,
    privacy: { includesFaceImage: false },
  };
}
