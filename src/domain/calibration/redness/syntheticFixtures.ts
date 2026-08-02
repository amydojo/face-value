import {
  REDNESS_CALIBRATION_ANALYSIS_VERSION,
} from './analysis';
import {
  REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
  REDNESS_CALIBRATION_UNAVAILABLE_METRICS,
  type RednessCalibrationConditionType,
  type RednessCalibrationConfounder,
  type RednessCalibrationObservation,
  type RednessCalibrationPreCaptureContext,
} from './types';

export const SYNTHETIC_REDNESS_CALIBRATION_FIXTURE_VERSION =
  'synthetic-face-free-redness-calibration-v1' as const;

const baseContext: RednessCalibrationPreCaptureContext = {
  makeup: 'absent',
  concealer: 'absent',
  tintedMoisturizer: 'absent',
  tintedSpf: 'absent',
  filter: 'absent',
  selfTanner: 'absent',
  otherEnhancement: 'absent',
  recentHeat: 'absent',
  recentExercise: 'absent',
  recentShower: 'absent',
  recentCleansing: 'absent',
  recentRubbing: 'absent',
  recentSunExposure: 'absent',
  recentProcedureOrIllness: 'absent',
  medicationOrRoutineChange: 'absent',
  emotionalFlushing: 'absent',
  timeOfDay: 'morning',
  productRoutineState: 'no_intervention',
};

interface SyntheticObservationSpec {
  observationId: string;
  participantId: string;
  sessionId: string;
  conditionId: string;
  conditionType: RednessCalibrationConditionType;
  timestamp: string;
  deviceClass: string;
  scores: number[];
  rejectedReasons?: string[][];
  captureOutcome?: RednessCalibrationObservation['captureOutcome'];
  captureAccepted?: boolean;
  context?: Partial<RednessCalibrationPreCaptureContext>;
  confounders?: RednessCalibrationConfounder[];
}

function median(values: number[]): number | 'not_available' {
  if (values.length === 0) return 'not_available';
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function syntheticObservation(spec: SyntheticObservationSpec): RednessCalibrationObservation {
  const rejectedReasons = spec.rejectedReasons ?? [];
  const timestamp = new Date(spec.timestamp).getTime();
  const captureAccepted = spec.captureAccepted ?? true;
  const acceptedFrames = spec.scores.map((rawScore, index) => {
    const frameId = `${spec.observationId}-frame-${index + 1}`;
    const capturedAt = new Date(timestamp - (spec.scores.length - index) * 1_000).toISOString();
    return {
      frameId,
      capture: {
        id: frameId,
        kind: 'baseline' as const,
        source: 'camera' as const,
        mimeType: 'image/jpeg' as const,
        createdAt: capturedAt,
        orientationRule: 'analysis-unmirrored' as const,
        cameraProfileId: 'native-browser-camera-v1' as const,
      },
      quality: {
        currentFrame: 'accepted' as const,
        exposure: 'accepted' as const,
        movement: 'accepted' as const,
      },
      signal: {
        provider: 'youcam' as const,
        apiVersion: '2.1' as const,
        mode: 'hd' as const,
        concern: 'hd_redness' as const,
        region: null,
        scoreType: 'raw_score' as const,
        captureProtocolVersion: 'face-value-youcam-1' as const,
        rawScore,
        capturedAt,
        captureQuality: 'accepted' as const,
      },
      providerAttemptCount: 1 as const,
    };
  });
  const rejectedFrames = rejectedReasons.map((reasons, index) => ({
    frameId: `${spec.observationId}-rejected-${index + 1}`,
    attemptedAt: new Date(timestamp - (rejectedReasons.length - index + spec.scores.length) * 1_000)
      .toISOString(),
    stage: 'capture' as const,
    reasons,
  }));
  return {
    schemaVersion: REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
    observationId: spec.observationId,
    participantId: spec.participantId,
    sessionId: spec.sessionId,
    conditionId: spec.conditionId,
    conditionType: spec.conditionType,
    collectionSource: 'synthetic_face_free_fixture',
    captureTimestamp: spec.timestamp,
    deviceClass: spec.deviceClass,
    cameraFacing: 'front',
    appBuildVersion: 'face-value-web-0.1.0',
    apiVersion: '2.1',
    analysisModelVersion: 'not_reported',
    analysisMode: 'hd',
    preprocessingVersion: 'face-value-unmodified-upload-v1',
    captureProtocolVersion: 'face-value-youcam-1',
    thresholdCandidateVersion: REDNESS_CALIBRATION_ANALYSIS_VERSION,
    burst: {
      burstId: `${spec.observationId}-burst`,
      role: 'baseline',
      sessionId: spec.sessionId,
      captureProfileId: 'native-browser-camera-v1',
      startedAt: new Date(timestamp - 8_000).toISOString(),
      completedAt: spec.timestamp,
      attemptedFrameCount: acceptedFrames.length + rejectedFrames.length,
      acceptedFrames,
      rejectedFrames,
    },
    sessionRawMedian: median(spec.scores),
    captureQuality: {
      accepted: captureAccepted,
      lightingComparability: captureAccepted ? 'limited' : 'fail',
      poseComparability: 'limited',
      cropComparability: 'limited',
      faceSizeComparability: 'limited',
      colorCastComparability: 'limited',
      obstructionPresent: !captureAccepted,
      enhancementDetected: false,
      reasons: [
        captureAccepted
          ? 'Synthetic face-free fixture; comparability metrics are unavailable.'
          : 'Synthetic hard-failure fixture retained for exclusion inspection.',
      ],
    },
    captureOutcome: spec.captureOutcome ?? (captureAccepted ? 'accepted' : 'hard_failure'),
    preCaptureContext: { ...baseContext, ...spec.context },
    confounders: spec.confounders ? structuredClone(spec.confounders) : [],
    comparisonAnchor: 'not_available',
    measuredSkinToneGroup: null,
    measuredSkinToneSource: 'not_collected',
    unavailableMetrics: { ...REDNESS_CALIBRATION_UNAVAILABLE_METRICS },
    includesFaceImage: false,
  };
}

const eligibleSpecs: SyntheticObservationSpec[] = [
  {
    observationId: 'syn-p01-standard-a',
    participantId: 'P-001',
    sessionId: 'P-001-technical-01',
    conditionId: 'P-001-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T16:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [60, 61, 62],
  },
  {
    observationId: 'syn-p01-standard-b',
    participantId: 'P-001',
    sessionId: 'P-001-technical-01',
    conditionId: 'P-001-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T16:10:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [61, 62, 64],
  },
  {
    observationId: 'syn-p01-long-a',
    participantId: 'P-001',
    sessionId: 'P-001-long-01',
    conditionId: 'P-001-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-02T16:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [61, 62, 62],
  },
  {
    observationId: 'syn-p01-long-b',
    participantId: 'P-001',
    sessionId: 'P-001-long-02',
    conditionId: 'P-001-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-05T16:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [62, 63, 64],
  },
  {
    observationId: 'syn-p02-standard-a',
    participantId: 'P-002',
    sessionId: 'P-002-technical-01',
    conditionId: 'P-002-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T17:00:00.000Z',
    deviceClass: 'synthetic-android-chromium',
    scores: [50, 51, 52],
  },
  {
    observationId: 'syn-p02-standard-b',
    participantId: 'P-002',
    sessionId: 'P-002-technical-01',
    conditionId: 'P-002-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T17:10:00.000Z',
    deviceClass: 'synthetic-android-chromium',
    scores: [49, 51, 52],
  },
  {
    observationId: 'syn-p02-long-a',
    participantId: 'P-002',
    sessionId: 'P-002-long-01',
    conditionId: 'P-002-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-02T17:00:00.000Z',
    deviceClass: 'synthetic-android-chromium',
    scores: [51, 52, 53],
  },
  {
    observationId: 'syn-p02-long-b',
    participantId: 'P-002',
    sessionId: 'P-002-long-02',
    conditionId: 'P-002-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-05T17:00:00.000Z',
    deviceClass: 'synthetic-android-chromium',
    scores: [50, 52, 53],
  },
  {
    observationId: 'syn-p03-standard-a',
    participantId: 'P-003',
    sessionId: 'P-003-technical-01',
    conditionId: 'P-003-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T18:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [70, 71, 73],
  },
  {
    observationId: 'syn-p03-standard-b',
    participantId: 'P-003',
    sessionId: 'P-003-technical-01',
    conditionId: 'P-003-standard-match',
    conditionType: 'standard',
    timestamp: '2026-07-01T18:10:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [69, 71, 72],
  },
  {
    observationId: 'syn-p03-long-a',
    participantId: 'P-003',
    sessionId: 'P-003-long-01',
    conditionId: 'P-003-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-02T18:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [70, 71, 72],
  },
  {
    observationId: 'syn-p03-long-b',
    participantId: 'P-003',
    sessionId: 'P-003-long-02',
    conditionId: 'P-003-no-treatment-match',
    conditionType: 'no_treatment_longitudinal',
    timestamp: '2026-07-05T18:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [72, 73, 74],
  },
];

const excludedSpecs: SyntheticObservationSpec[] = [
  {
    observationId: 'syn-p01-degraded',
    participantId: 'P-001',
    sessionId: 'P-001-degraded-01',
    conditionId: 'P-001-degraded-light',
    conditionType: 'degraded',
    timestamp: '2026-07-06T16:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [54, 70, 78],
    rejectedReasons: [['Intentionally degraded lighting did not pass the capture gate.']],
    context: { recentHeat: 'present' },
    confounders: [
      { code: 'degraded_capture_condition', severity: 'exclusion', source: 'protocol' },
      { code: 'recent_heat', severity: 'downgrade', source: 'participant_report' },
    ],
  },
  {
    observationId: 'syn-p02-intervention',
    participantId: 'P-002',
    sessionId: 'P-002-intervention-01',
    conditionId: 'P-002-intervention',
    conditionType: 'standard',
    timestamp: '2026-07-06T17:00:00.000Z',
    deviceClass: 'synthetic-android-chromium',
    scores: [51, 52, 53],
    context: { productRoutineState: 'explicit_change' },
    confounders: [
      { code: 'explicit_intervention', severity: 'exclusion', source: 'participant_report' },
    ],
  },
  {
    observationId: 'syn-p03-incomplete',
    participantId: 'P-003',
    sessionId: 'P-003-incomplete-01',
    conditionId: 'P-003-incomplete',
    conditionType: 'standard',
    timestamp: '2026-07-06T18:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [70, 72],
    rejectedReasons: [['Synthetic third frame was rejected for movement.']],
  },
  {
    observationId: 'syn-p01-hard-failure',
    participantId: 'P-001',
    sessionId: 'P-001-hard-failure-01',
    conditionId: 'P-001-hard-failure',
    conditionType: 'standard',
    timestamp: '2026-07-07T16:00:00.000Z',
    deviceClass: 'synthetic-ios-webkit',
    scores: [],
    rejectedReasons: [['Synthetic obstruction hard failure retained for inspection.']],
    captureOutcome: 'hard_failure',
    captureAccepted: false,
    context: { makeup: 'present' },
    confounders: [
      { code: 'makeup_or_tint', severity: 'hard_failure', source: 'participant_report' },
    ],
  },
];

const fixtureDataset = [...eligibleSpecs, ...excludedSpecs].map(syntheticObservation);

export function syntheticRednessCalibrationFixtures(): RednessCalibrationObservation[] {
  return structuredClone(fixtureDataset);
}
