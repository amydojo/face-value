import {
  REDNESS_BURST_MAX_CAPTURE_ATTEMPTS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../rednessEvidenceBurst';
import type {
  AcceptedRednessFrame,
  RednessEvidenceBurst,
  RejectedRednessFrame,
} from '../../model';
import {
  REDNESS_CALIBRATION_ANALYSIS_MODE,
  REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
  type CalibrationReportedState,
  type RednessCalibrationConditionType,
  type RednessCalibrationConfounder,
  type RednessCalibrationObservation,
  type RednessCalibrationPreCaptureContext,
  type RednessCalibrationUnavailableMetrics,
} from './types';

export type RednessCalibrationValidationCode =
  | 'forbidden_private_material'
  | 'unsupported_schema_version'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'invalid_condition'
  | 'invalid_collection_source'
  | 'invalid_version_metadata'
  | 'invalid_burst'
  | 'invalid_capture_quality'
  | 'invalid_context'
  | 'invalid_confounder'
  | 'invalid_unavailable_metric'
  | 'invalid_skin_tone_audit_source'
  | 'invalid_session_median'
  | 'invalid_observation';

export interface RednessCalibrationValidationIssue {
  code: RednessCalibrationValidationCode;
  path: string;
  detail: string;
}

export type RednessCalibrationValidationResult =
  | { valid: true; observation: RednessCalibrationObservation; issues: [] }
  | { valid: false; observation: null; issues: RednessCalibrationValidationIssue[] };

const conditions = new Set<RednessCalibrationConditionType>([
  'standard',
  'no_treatment_longitudinal',
  'degraded',
]);
const reportedStates = new Set<CalibrationReportedState>([
  'absent',
  'present',
  'not_reported',
]);
const confounderCodes = new Set<RednessCalibrationConfounder['code']>([
  'makeup_or_tint',
  'filter_or_enhancement',
  'recent_heat',
  'recent_exercise',
  'recent_shower',
  'recent_cleansing',
  'recent_rubbing',
  'recent_sun_exposure',
  'recent_procedure_or_illness',
  'medication_or_routine_change',
  'emotional_flushing',
  'explicit_intervention',
  'degraded_capture_condition',
]);
const unavailableMetricKeys: Array<keyof RednessCalibrationUnavailableMetrics> = [
  'lightingMetrics',
  'poseMetrics',
  'cropMetrics',
  'faceSizeMetrics',
  'colorCastMetrics',
  'facialRegistrationQuality',
  'eligibleSkinPixelCount',
  'rednessMaskPixelCount',
  'rednessMaskAreaPct',
  'baselineRegionOverlap',
  'segmentationStability',
];
const contextStateKeys: Array<keyof RednessCalibrationPreCaptureContext> = [
  'makeup',
  'concealer',
  'tintedMoisturizer',
  'tintedSpf',
  'filter',
  'selfTanner',
  'otherEnhancement',
  'recentHeat',
  'recentExercise',
  'recentShower',
  'recentCleansing',
  'recentRubbing',
  'recentSunExposure',
  'recentProcedureOrIllness',
  'medicationOrRoutineChange',
  'emotionalFlushing',
];

const forbiddenKeys = new Set([
  'name',
  'fullname',
  'email',
  'emailaddress',
  'accountid',
  'url',
  'signedurl',
  'blob',
  'base64',
  'providertaskid',
  'rawproviderpayload',
  'rawapipayload',
  'facedata',
  'faceimage',
  'image',
  'imagedata',
  'thumbnail',
  'maskimage',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPseudonymousId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

function privateMaterialPath(value: unknown, path = '$', visited = new WeakSet<object>()): string | null {
  if (typeof value === 'string') {
    return /(?:data:image|blob:|https?:\/\/|[^\s@]+@[^\s@]+)/i.test(value) ? path : null;
  }
  if (typeof value !== 'object' || value === null) return null;
  if (visited.has(value)) return path;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = privateMaterialPath(item, `${path}[${index}]`, visited);
      if (found) return found;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replaceAll(/[^a-z0-9]/gi, '').toLocaleLowerCase('en-US');
    if (normalized !== 'includesfaceimage' && forbiddenKeys.has(normalized)) return `${path}.${key}`;
    const found = privateMaterialPath(item, `${path}.${key}`, visited);
    if (found) return found;
  }
  return null;
}

function cloneObservation(value: RednessCalibrationObservation): RednessCalibrationObservation {
  return structuredClone(value);
}

function median(values: number[]): number | null {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validAcceptedFrame(value: unknown): value is AcceptedRednessFrame {
  if (!isObject(value) || !isObject(value.capture) || !isObject(value.quality) || !isObject(value.signal)) {
    return false;
  }
  return (
    isNonEmptyString(value.frameId) &&
    value.capture.id === value.frameId &&
    (value.capture.kind === 'baseline' || value.capture.kind === 'followup') &&
    value.capture.source === 'camera' &&
    isIsoTimestamp(value.capture.createdAt) &&
    value.capture.orientationRule === 'analysis-unmirrored' &&
    value.quality.currentFrame === 'accepted' &&
    value.quality.exposure === 'accepted' &&
    value.quality.movement === 'accepted' &&
    value.signal.provider === 'youcam' &&
    value.signal.apiVersion === '2.1' &&
    value.signal.mode === 'hd' &&
    value.signal.concern === 'hd_redness' &&
    value.signal.region === null &&
    value.signal.scoreType === 'raw_score' &&
    typeof value.signal.rawScore === 'number' &&
    Number.isFinite(value.signal.rawScore) &&
    isIsoTimestamp(value.signal.capturedAt) &&
    value.signal.captureQuality === 'accepted' &&
    (value.providerAttemptCount === 1 || value.providerAttemptCount === 2)
  );
}

function validRejectedFrame(value: unknown): value is RejectedRednessFrame {
  return (
    isObject(value) &&
    isNonEmptyString(value.frameId) &&
    isIsoTimestamp(value.attemptedAt) &&
    (value.stage === 'capture' || value.stage === 'provider') &&
    Array.isArray(value.reasons) &&
    value.reasons.length > 0 &&
    value.reasons.every(isNonEmptyString)
  );
}

function validBurst(value: unknown): value is RednessEvidenceBurst {
  if (!isObject(value)) return false;
  if (
    !isNonEmptyString(value.burstId) ||
    !isNonEmptyString(value.sessionId) ||
    (value.role !== 'baseline' && value.role !== 'followup') ||
    !(value.captureProfileId === null || isNonEmptyString(value.captureProfileId)) ||
    !isIsoTimestamp(value.startedAt) ||
    !isIsoTimestamp(value.completedAt) ||
    !Number.isInteger(value.attemptedFrameCount) ||
    Number(value.attemptedFrameCount) < 0 ||
    Number(value.attemptedFrameCount) > REDNESS_BURST_MAX_CAPTURE_ATTEMPTS ||
    !Array.isArray(value.acceptedFrames) ||
    value.acceptedFrames.length > REDNESS_BURST_REQUIRED_MEASUREMENTS ||
    !value.acceptedFrames.every(validAcceptedFrame) ||
    !Array.isArray(value.rejectedFrames) ||
    !value.rejectedFrames.every(validRejectedFrame) ||
    value.attemptedFrameCount !== value.acceptedFrames.length + value.rejectedFrames.length
  ) {
    return false;
  }
  const ids = [
    ...value.acceptedFrames.map((frame) => frame.frameId),
    ...value.rejectedFrames.map((frame) => frame.frameId),
  ];
  return new Set(ids).size === ids.length;
}

function validCaptureQuality(value: unknown): boolean {
  if (!isObject(value)) return false;
  const comparisons = ['fail', 'limited', 'pass'];
  return (
    typeof value.accepted === 'boolean' &&
    comparisons.includes(String(value.lightingComparability)) &&
    comparisons.includes(String(value.poseComparability)) &&
    comparisons.includes(String(value.cropComparability)) &&
    comparisons.includes(String(value.faceSizeComparability)) &&
    comparisons.includes(String(value.colorCastComparability)) &&
    typeof value.obstructionPresent === 'boolean' &&
    typeof value.enhancementDetected === 'boolean' &&
    Array.isArray(value.reasons) &&
    value.reasons.every(isNonEmptyString)
  );
}

function validContext(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    contextStateKeys.every((key) => reportedStates.has(value[key] as CalibrationReportedState)) &&
    isNonEmptyString(value.timeOfDay) &&
    ['no_intervention', 'explicit_change', 'not_reported'].includes(
      String(value.productRoutineState),
    )
  );
}

function validConfounder(value: unknown): boolean {
  return (
    isObject(value) &&
    confounderCodes.has(value.code as RednessCalibrationConfounder['code']) &&
    ['downgrade', 'hard_failure', 'exclusion'].includes(String(value.severity)) &&
    ['capture', 'participant_report', 'protocol'].includes(String(value.source))
  );
}

function validUnavailableMetrics(value: unknown): boolean {
  return (
    isObject(value) &&
    Object.keys(value).length === unavailableMetricKeys.length &&
    unavailableMetricKeys.every((key) => value[key] === 'not_available')
  );
}

export function validateRednessCalibrationObservation(
  value: unknown,
): RednessCalibrationValidationResult {
  const issues: RednessCalibrationValidationIssue[] = [];
  const add = (
    code: RednessCalibrationValidationCode,
    path: string,
    detail: string,
  ): void => {
    issues.push({ code, path, detail });
  };

  const privatePath = privateMaterialPath(value);
  if (privatePath) {
    add(
      'forbidden_private_material',
      privatePath,
      'Calibration observations cannot contain image, URL, provider payload, or identity material.',
    );
  }
  if (!isObject(value)) {
    add('invalid_observation', '$', 'Observation must be an object.');
    return { valid: false, observation: null, issues };
  }
  if (value.schemaVersion !== REDNESS_CALIBRATION_OBSERVATION_SCHEMA) {
    add('unsupported_schema_version', '$.schemaVersion', 'Only the v1 observation schema is accepted.');
  }
  for (const key of ['observationId', 'participantId', 'sessionId', 'conditionId'] as const) {
    if (!isPseudonymousId(value[key])) {
      add('invalid_identifier', `$.${key}`, `${key} must be a bounded pseudonymous identifier.`);
    }
  }
  if (!conditions.has(value.conditionType as RednessCalibrationConditionType)) {
    add('invalid_condition', '$.conditionType', 'Condition type is not supported.');
  }
  if (!['live_provider', 'synthetic_face_free_fixture'].includes(String(value.collectionSource))) {
    add('invalid_collection_source', '$.collectionSource', 'Collection source is not supported.');
  }
  if (!isIsoTimestamp(value.captureTimestamp)) {
    add('invalid_timestamp', '$.captureTimestamp', 'Capture timestamp must be a readable timestamp.');
  }
  if (value.cameraFacing !== 'front') {
    add('invalid_observation', '$.cameraFacing', 'Calibration is limited to the front camera.');
  }
  for (const key of [
    'deviceClass',
    'appBuildVersion',
    'apiVersion',
    'analysisModelVersion',
    'preprocessingVersion',
    'captureProtocolVersion',
    'thresholdCandidateVersion',
  ] as const) {
    if (!isNonEmptyString(value[key])) {
      add('invalid_version_metadata', `$.${key}`, `${key} must be explicit and non-empty.`);
    }
  }
  if (value.analysisMode !== REDNESS_CALIBRATION_ANALYSIS_MODE) {
    add('invalid_version_metadata', '$.analysisMode', 'Analysis mode must remain hd.');
  }
  if (!validBurst(value.burst)) {
    add('invalid_burst', '$.burst', 'Burst evidence is structurally invalid or exceeds frozen bounds.');
  }
  if (!validCaptureQuality(value.captureQuality)) {
    add('invalid_capture_quality', '$.captureQuality', 'Capture quality is incomplete or invalid.');
  }
  if (!['accepted', 'hard_failure'].includes(String(value.captureOutcome))) {
    add('invalid_capture_quality', '$.captureOutcome', 'Capture outcome is not supported.');
  }
  if (!validContext(value.preCaptureContext)) {
    add('invalid_context', '$.preCaptureContext', 'Pre-capture context must report every field explicitly.');
  }
  if (!Array.isArray(value.confounders) || !value.confounders.every(validConfounder)) {
    add('invalid_confounder', '$.confounders', 'Confounder entries must use the structured calibration model.');
  }
  if (!validUnavailableMetrics(value.unavailableMetrics)) {
    add(
      'invalid_unavailable_metric',
      '$.unavailableMetrics',
      'Unavailable provider metrics must remain explicitly not_available.',
    );
  }
  if (
    value.measuredSkinToneSource === 'not_collected'
      ? value.measuredSkinToneGroup !== null
      : value.measuredSkinToneSource !== 'validated_audit_input' ||
        !isNonEmptyString(value.measuredSkinToneGroup)
  ) {
    add(
      'invalid_skin_tone_audit_source',
      '$.measuredSkinToneGroup',
      'Skin-tone groups require a validated non-inferred audit input; otherwise they remain null.',
    );
  }
  if (value.includesFaceImage !== false) {
    add('forbidden_private_material', '$.includesFaceImage', 'Face image inclusion must be false.');
  }
  if (
    !(
      value.comparisonAnchor === 'not_available' ||
      (isObject(value.comparisonAnchor) &&
        typeof value.comparisonAnchor.rawScore === 'number' &&
        Number.isFinite(value.comparisonAnchor.rawScore) &&
        ['no_change', 'improvement', 'worsening'].includes(
          String(value.comparisonAnchor.expectedDirection),
        ))
    )
  ) {
    add('invalid_observation', '$.comparisonAnchor', 'Comparison anchor must be explicit or not_available.');
  }

  if (validBurst(value.burst)) {
    const scores = value.burst.acceptedFrames.map((frame) => frame.signal.rawScore);
    const expectedMedian = median(scores);
    const observedMedian = value.sessionRawMedian;
    const medianMatches =
      expectedMedian === null
        ? observedMedian === 'not_available'
        : typeof observedMedian === 'number' &&
          Number.isFinite(observedMedian) &&
          Math.abs(observedMedian - expectedMedian) < Number.EPSILON * 16;
    if (!medianMatches) {
      add(
        'invalid_session_median',
        '$.sessionRawMedian',
        'Saved session median must exactly match the accepted face-free raw scores.',
      );
    }
  }

  if (issues.length > 0) return { valid: false, observation: null, issues };
  return {
    valid: true,
    observation: cloneObservation(value as unknown as RednessCalibrationObservation),
    issues: [],
  };
}

export function migrateRednessCalibrationObservation(
  value: unknown,
): RednessCalibrationValidationResult {
  // V1 intentionally has no coercive migration. Unknown or old shapes remain
  // inspectable through validation issues until a reviewed migration exists.
  return validateRednessCalibrationObservation(value);
}
