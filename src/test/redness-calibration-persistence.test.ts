import { describe, expect, it } from 'vitest';
import {
  REDNESS_CALIBRATION_ENVELOPE_SCHEMA,
  REDNESS_CALIBRATION_ORIGIN,
  REDNESS_CALIBRATION_STORAGE_KEY,
  appendRednessCalibrationObservation,
  clearRednessCalibrationData,
  exportRednessCalibrationData,
  loadRednessCalibrationData,
  parseRednessCalibrationExport,
  saveRednessCalibrationData,
} from '../adapters/persistence/rednessCalibrationStore';
import {
  REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
  REDNESS_CALIBRATION_UNAVAILABLE_METRICS,
  canonicalJson,
  validateRednessCalibrationObservation,
  type RednessCalibrationObservation,
} from '../domain/calibration/redness';

function observation(
  overrides: Partial<RednessCalibrationObservation> = {},
): RednessCalibrationObservation {
  const captureTimestamp = '2026-08-01T18:00:00.000Z';
  const rawScores = [61, 62, 63];
  return {
    schemaVersion: REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
    observationId: 'synthetic-observation-001',
    participantId: 'P-001',
    sessionId: 'P-001-session-01',
    conditionId: 'matched-condition-01',
    conditionType: 'standard',
    collectionSource: 'synthetic_face_free_fixture',
    captureTimestamp,
    deviceClass: 'synthetic-mobile-webkit',
    cameraFacing: 'front',
    appBuildVersion: 'face-value-web-0.1.0',
    apiVersion: '2.1',
    analysisModelVersion: 'not_reported',
    analysisMode: 'hd',
    preprocessingVersion: 'face-value-unmodified-upload-v1',
    captureProtocolVersion: 'face-value-youcam-1',
    thresholdCandidateVersion: 'redness-calibration-analysis-v1',
    burst: {
      burstId: 'synthetic-burst-001',
      role: 'baseline',
      sessionId: 'P-001-session-01',
      captureProfileId: 'native-browser-camera-v1',
      startedAt: '2026-08-01T17:59:55.000Z',
      completedAt: captureTimestamp,
      attemptedFrameCount: 3,
      acceptedFrames: rawScores.map((rawScore, index) => {
        const frameId = `synthetic-frame-${index + 1}`;
        const capturedAt = `2026-08-01T17:59:${String(56 + index).padStart(2, '0')}.000Z`;
        return {
          frameId,
          capture: {
            id: frameId,
            kind: 'baseline',
            source: 'camera',
            mimeType: 'image/jpeg',
            createdAt: capturedAt,
            orientationRule: 'analysis-unmirrored',
            cameraProfileId: 'native-browser-camera-v1',
          },
          quality: {
            currentFrame: 'accepted',
            exposure: 'accepted',
            movement: 'accepted',
          },
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
        } as const;
      }),
      rejectedFrames: [],
    },
    sessionRawMedian: 62,
    captureQuality: {
      accepted: true,
      lightingComparability: 'limited',
      poseComparability: 'limited',
      cropComparability: 'limited',
      faceSizeComparability: 'limited',
      colorCastComparability: 'limited',
      obstructionPresent: false,
      enhancementDetected: false,
      reasons: ['Synthetic face-free fixture; comparability metrics are unavailable.'],
    },
    captureOutcome: 'accepted',
    preCaptureContext: {
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
      timeOfDay: 'afternoon',
      productRoutineState: 'no_intervention',
    },
    confounders: [],
    comparisonAnchor: 'not_available',
    measuredSkinToneGroup: null,
    measuredSkinToneSource: 'not_collected',
    unavailableMetrics: { ...REDNESS_CALIBRATION_UNAVAILABLE_METRICS },
    includesFaceImage: false,
    ...overrides,
  };
}

describe('redness calibration observation contract', () => {
  it('accepts a deterministic face-free observation with explicit unavailable fields', () => {
    const result = validateRednessCalibrationObservation(observation());

    expect(result.valid).toBe(true);
    expect(result.valid && result.observation).toEqual(observation());
    expect(result.valid && result.observation).not.toBe(observation());
    expect(canonicalJson(result.valid && result.observation)).toContain(
      '"includesFaceImage":false',
    );
    expect(canonicalJson(result.valid && result.observation)).toContain(
      '"facialRegistrationQuality":"not_available"',
    );
  });

  it.each([
    ['email', 'person@example.com'],
    ['name', 'Private Person'],
    ['providerTaskId', 'task-123'],
    ['rawProviderPayload', { result: true }],
    ['signedUrl', 'https://provider.example/private'],
    ['faceImage', 'data:image/jpeg;base64,private'],
  ])('rejects forbidden private field %s', (key, value) => {
    const candidate = { ...observation(), [key]: value };
    const result = validateRednessCalibrationObservation(candidate);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'forbidden_private_material' }),
      ]),
    );
  });

  it('rejects unknown contract fields and binary containers instead of serializing them', () => {
    const unknownField = validateRednessCalibrationObservation({
      ...observation(),
      debugLabel: 'not part of the versioned contract',
    });
    const binaryField = validateRednessCalibrationObservation({
      ...observation(),
      burst: {
        ...observation().burst,
        privateBytes: new Uint8Array([1, 2, 3]),
      },
    });
    const blobField = validateRednessCalibrationObservation({
      ...observation(),
      burst: {
        ...observation().burst,
        privateCapture: new Blob(['synthetic binary sentinel'], { type: 'image/jpeg' }),
      },
    });

    expect(unknownField).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_observation', path: '$' }),
      ]),
    });
    for (const result of [binaryField, blobField]) {
      expect(result).toMatchObject({
        valid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'forbidden_private_material' }),
          expect.objectContaining({ code: 'invalid_burst' }),
        ]),
      });
    }
  });

  it('fails closed for an incompatible schema and a fabricated passing unavailable metric', () => {
    const candidate = {
      ...observation(),
      schemaVersion: 'redness-calibration-observation-v0',
      unavailableMetrics: {
        ...REDNESS_CALIBRATION_UNAVAILABLE_METRICS,
        poseMetrics: 'pass',
      },
    };
    const result = validateRednessCalibrationObservation(candidate);

    expect(result.valid).toBe(false);
    expect(result.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['unsupported_schema_version', 'invalid_unavailable_metric']),
    );
  });

  it('rejects a saved median that does not match its accepted raw scores', () => {
    const result = validateRednessCalibrationObservation(
      observation({ sessionRawMedian: 99 }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'invalid_session_median' })]),
    );
  });
});

describe('isolated redness calibration persistence', () => {
  it('hydrates deterministically without touching ordinary or Demo Lab storage', () => {
    localStorage.setItem('face-value:structured-demo:v1', 'ordinary-bytes');
    localStorage.setItem('face-value:demo-lab:journey:v1', 'demo-bytes');
    const value = observation();

    saveRednessCalibrationData([value], localStorage, '2026-08-01T19:00:00.000Z');
    const first = loadRednessCalibrationData();
    const second = loadRednessCalibrationData();

    expect(first).toEqual(second);
    expect(first.status).toBe('ready');
    expect(first.envelope).toMatchObject({
      schemaVersion: REDNESS_CALIBRATION_ENVELOPE_SCHEMA,
      origin: REDNESS_CALIBRATION_ORIGIN,
      observations: [{ observationId: value.observationId }],
    });
    expect(localStorage.getItem('face-value:structured-demo:v1')).toBe('ordinary-bytes');
    expect(localStorage.getItem('face-value:demo-lab:journey:v1')).toBe('demo-bytes');
  });

  it('keeps corrupt data inspectable and unavailable to calculations', () => {
    const corrupt = '{"schemaVersion":"face-value-redness-calibration-envelope-v1"';
    localStorage.setItem(REDNESS_CALIBRATION_STORAGE_KEY, corrupt);

    const result = loadRednessCalibrationData();

    expect(result.status).toBe('corrupt');
    expect(result.envelope).toBeNull();
    expect(result.quarantine[0]?.issues[0]?.detail).toContain('corrupt');
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).toBe(corrupt);
    expect(() => appendRednessCalibrationObservation(observation())).toThrow(/Corrupt/);
  });

  it('quarantines incompatible observations without returning a partial usable dataset', () => {
    const invalid = { ...observation(), schemaVersion: 'future-schema' };
    localStorage.setItem(
      REDNESS_CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: REDNESS_CALIBRATION_ENVELOPE_SCHEMA,
        origin: REDNESS_CALIBRATION_ORIGIN,
        savedAt: '2026-08-01T19:00:00.000Z',
        observations: [observation(), invalid],
      }),
    );

    const result = loadRednessCalibrationData();

    expect(result.status).toBe('corrupt');
    expect(result.envelope).toBeNull();
    expect(result.quarantine).toEqual([
      expect.objectContaining({
        index: 1,
        observationId: invalid.observationId,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'unsupported_schema_version' }),
        ]),
      }),
    ]);
  });

  it('round-trips a canonical face-free export and refuses immutable replacement', () => {
    const first = observation();
    const second = observation({
      observationId: 'synthetic-observation-002',
      sessionId: 'P-001-session-02',
      burst: {
        ...observation().burst,
        burstId: 'synthetic-burst-002',
        sessionId: 'P-001-session-02',
      },
    });
    const exported = exportRednessCalibrationData(
      [first, second],
      '2026-08-01T20:00:00.000Z',
    );

    expect(parseRednessCalibrationExport(exported)).toEqual([first, second]);
    expect(exported).toBe(
      exportRednessCalibrationData([first, second], '2026-08-01T20:00:00.000Z'),
    );
    expect(exported).not.toMatch(
      /data:image|blob:|https?:\/\/|providerTaskId|rawProviderPayload|"name"|email/i,
    );

    appendRednessCalibrationObservation(first, localStorage, '2026-08-01T20:00:00.000Z');
    expect(() => appendRednessCalibrationObservation(first)).toThrow(/immutable/);
  });

  it('rejects malformed or extended export envelopes before replacement', () => {
    const exported = exportRednessCalibrationData(
      [observation()],
      '2026-08-01T20:00:00.000Z',
    );
    const invalidTimestamp = JSON.parse(exported) as Record<string, unknown>;
    invalidTimestamp.exportedAt = 'not-a-timestamp';
    const unknownEnvelopeField = JSON.parse(exported) as Record<string, unknown>;
    unknownEnvelopeField.privatePayload = { bytes: [1, 2, 3] };

    expect(() => parseRednessCalibrationExport(JSON.stringify(invalidTimestamp))).toThrow(
      /incompatible/,
    );
    expect(() => parseRednessCalibrationExport(JSON.stringify(unknownEnvelopeField))).toThrow(
      /incompatible/,
    );
  });

  it('clears calibration data only', () => {
    localStorage.setItem('face-value:structured-demo:v1', 'ordinary-bytes');
    localStorage.setItem('face-value:demo-lab:journey:v1', 'demo-bytes');
    saveRednessCalibrationData([observation()]);

    clearRednessCalibrationData();

    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('face-value:structured-demo:v1')).toBe('ordinary-bytes');
    expect(localStorage.getItem('face-value:demo-lab:journey:v1')).toBe('demo-bytes');
  });
});
