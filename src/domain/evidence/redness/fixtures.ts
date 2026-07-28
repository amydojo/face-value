import {
  REDNESS_FRAMEWORK_VERSION,
  REDNESS_SCHEMA_VERSION,
  type CaptureQuality,
  type EvidencePeriodInput,
  type EvidenceSession,
  type RednessEvaluationInput,
  type RednessVersionMetadata,
} from './types';

const FIXTURE_VERSIONS: RednessVersionMetadata = {
  apiVersion: '2.1',
  analysisModelVersion: 'youcam-hd-redness-fixture-v1',
  analysisMode: 'hd',
  appBuildVersion: 'face-value-fixture-v1',
  preprocessingVersion: 'face-value-unmodified-upload-v1',
  captureProtocolVersion: 'face-value-youcam-1',
};

const PASS_CAPTURE: CaptureQuality = {
  accepted: true,
  lightingComparability: 'pass',
  poseComparability: 'pass',
  cropComparability: 'pass',
  faceSizeComparability: 'pass',
  colorCastComparability: 'pass',
  obstructionPresent: false,
  enhancementDetected: false,
  reasons: [],
};

function timestamp(day: number, minuteOffset = 0): string {
  return new Date(Date.UTC(2026, 0, 1 + day, 12, minuteOffset)).toISOString();
}

function session(input: {
  id: string;
  day: number;
  scores: number[];
  captureQuality?: CaptureQuality;
  versions?: RednessVersionMetadata;
  minuteOffset?: number;
}): EvidenceSession {
  const frameIds = input.scores.map((_, index) => `${input.id}-frame-${index + 1}`);
  return {
    sessionId: input.id,
    capturedAt: timestamp(input.day, input.minuteOffset),
    deviceClass: 'fixture-front-camera',
    cameraFacing: 'front',
    frameIds,
    rawScores: [...input.scores],
    acceptedFrameIds: [...frameIds],
    rejectedFrames: [],
    captureQuality: {
      ...(input.captureQuality ?? PASS_CAPTURE),
      reasons: [...(input.captureQuality ?? PASS_CAPTURE).reasons],
    },
    versions: { ...(input.versions ?? FIXTURE_VERSIONS) },
  };
}

function period(...sessions: EvidenceSession[]): EvidencePeriodInput {
  return { sessions };
}

function baseInput(
  name: string,
  actualObservationIntervalDays: number,
  baseline: EvidencePeriodInput,
  endpoint: EvidencePeriodInput,
): RednessEvaluationInput {
  return {
    frameworkVersion: REDNESS_FRAMEWORK_VERSION,
    schemaVersion: REDNESS_SCHEMA_VERSION,
    trialId: `fixture-${name}`,
    productId: `product-${name}`,
    assignedJob: 'calm_visible_redness',
    expectedObservationWindowDays: {
      minimum: 28,
      target: 56,
      maximum: 84,
    },
    actualObservationIntervalDays,
    evaluatedAt: timestamp(actualObservationIntervalDays),
    baseline,
    endpoint,
    maskEvidence: {},
    patientAnchor: null,
    tolerance: {
      collectionStatus: 'collected',
      symptoms: [],
      severity: 'none',
    },
    adherence: { status: 'complete' },
    confounders: [],
    secondProductStatus: 'none',
  };
}

export const clearImprovementFixture: RednessEvaluationInput = {
  ...baseInput(
    'clear-improvement',
    35,
    period(session({ id: 'clear-baseline', day: 0, scores: [59, 60, 61] })),
    period(session({ id: 'clear-endpoint', day: 35, scores: [71, 72, 73] })),
  ),
  patientAnchor: { visibleChange: 2, recordedAt: timestamp(35) },
};

export const cleanNullFixture: RednessEvaluationInput = {
  ...baseInput(
    'clean-null',
    35,
    period(
      session({ id: 'null-baseline-a', day: 0, scores: [59, 60, 61] }),
      session({
        id: 'null-baseline-b',
        day: 1,
        minuteOffset: 1,
        scores: [59, 60, 61],
      }),
    ),
    period(
      session({ id: 'null-endpoint-a', day: 35, scores: [61, 62, 63] }),
      session({
        id: 'null-endpoint-b',
        day: 36,
        minuteOffset: 1,
        scores: [61, 62, 63],
      }),
    ),
  ),
  patientAnchor: { visibleChange: 0, recordedAt: timestamp(36) },
};

export const tooEarlyFixture: RednessEvaluationInput = baseInput(
  'too-early',
  8,
  period(session({ id: 'early-baseline', day: 0, scores: [59, 60, 61] })),
  period(session({ id: 'early-endpoint', day: 8, scores: [66, 67, 68] })),
);

export const productOverlapFixture: RednessEvaluationInput = {
  ...baseInput(
    'product-overlap',
    35,
    period(session({ id: 'overlap-baseline', day: 0, scores: [59, 60, 61] })),
    period(session({ id: 'overlap-endpoint', day: 35, scores: [70, 71, 72] })),
  ),
  patientAnchor: { visibleChange: 2, recordedAt: timestamp(35) },
  secondProductStatus: 'active_overlap',
  confounders: [
    {
      code: 'active_second_redness_product',
      severity: 'attribution_blocker',
      source: 'user_report',
      note: 'Another calming product was added during the trial.',
    },
  ],
};

export const objectiveWorseningFixture: RednessEvaluationInput = baseInput(
  'objective-worsening',
  35,
  period(session({ id: 'worse-baseline', day: 0, scores: [69, 70, 71] })),
  period(session({ id: 'worse-endpoint', day: 35, scores: [62, 63, 64] })),
);

export const worseningWithSymptomsFixture: RednessEvaluationInput = {
  ...baseInput(
    'worsening-with-symptoms',
    35,
    period(session({ id: 'symptom-baseline', day: 0, scores: [69, 70, 71] })),
    period(session({ id: 'symptom-endpoint', day: 35, scores: [61, 62, 63] })),
  ),
  tolerance: {
    collectionStatus: 'collected',
    symptoms: ['burning', 'swelling'],
    severity: 'severe',
  },
};

const INVALID_WHITE_BALANCE: CaptureQuality = {
  ...PASS_CAPTURE,
  accepted: false,
  colorCastComparability: 'fail',
  reasons: ['Major white-balance mismatch.'],
};

export const invalidCaptureFixture: RednessEvaluationInput = {
  ...baseInput(
    'invalid-capture',
    35,
    period(session({ id: 'invalid-baseline', day: 0, scores: [59, 60, 61] })),
    period(
      session({
        id: 'invalid-endpoint',
        day: 35,
        scores: [74, 75, 76],
        captureQuality: INVALID_WHITE_BALANCE,
      }),
    ),
  ),
  patientAnchor: { visibleChange: 2, recordedAt: timestamp(35) },
};

export const canonicalRednessFixtures = {
  A: clearImprovementFixture,
  B: cleanNullFixture,
  C: tooEarlyFixture,
  D: productOverlapFixture,
  E: objectiveWorseningFixture,
  F: worseningWithSymptomsFixture,
  G: invalidCaptureFixture,
} as const;
