import { describe, expect, it } from 'vitest';
import {
  REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM,
  REDNESS_CALIBRATION_QUANTILE_METHOD,
  analyzeRednessCalibration,
  buildExploratoryRednessCalibrationRegistry,
  empiricalQuantileR7,
  iccAbsoluteAgreementSingle,
  participantClusterBootstrap,
  repeatabilityCoefficient,
  serializeRednessCalibrationRegistry,
  sha256Hex,
  syntheticRednessCalibrationFixtures,
  validateRednessCalibrationObservation,
  withinClusterResidualSd,
} from '../domain/calibration/redness';
import { loadRednessCalibrationRegistryForProduction } from '../domain/evidence/redness';

const analysis = () =>
  analyzeRednessCalibration(syntheticRednessCalibrationFixtures(), {
    bootstrapSeed: 65,
    bootstrapIterations: 400,
  });

function assertFiniteNumbers(value: unknown, path = '$'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    if (/count/i.test(path)) expect(value, `${path} must not be negative`).toBeGreaterThanOrEqual(0);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      assertFiniteNumbers(item, `${path}.${key}`);
    }
  }
}

describe('calibration mathematical primitives', () => {
  it('uses named R-7 linear interpolation for empirical percentiles', () => {
    expect(REDNESS_CALIBRATION_QUANTILE_METHOD).toBe('R-7 linear interpolation');
    expect(empiricalQuantileR7([0, 10], 0.95)).toBe(9.5);
    expect(empiricalQuantileR7([1, 2, 3, 4], 0.95)).toBeCloseTo(3.85, 12);
    expect(empiricalQuantileR7([], 0.95)).toBeNull();
  });

  it('calculates unequal-count residual within-person SD instead of pooled between-person SD', () => {
    const estimate = withinClusterResidualSd([
      [10, 12, 14],
      [100, 102],
    ]);

    expect(estimate.status).toBe('estimated');
    expect(estimate.status === 'estimated' && estimate.value).toBeCloseTo(Math.sqrt(10 / 3), 12);
    expect(estimate.observationCount).toBe(5);
    expect(estimate.clusterCount).toBe(2);
    expect(estimate.residualDegreesOfFreedom).toBe(3);
  });

  it('calculates the repeatability coefficient with the exact canonical formula', () => {
    expect(repeatabilityCoefficient(2)).toBeCloseTo(1.96 * Math.sqrt(2) * 2, 12);
    expect(repeatabilityCoefficient(Number.NaN)).toBeNull();
  });

  it('implements ICC(A,1) absolute agreement and names structurally incompatible data', () => {
    const known = iccAbsoluteAgreementSingle([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    expect(known).toMatchObject({
      status: 'estimated',
      variant: 'ICC(A,1)',
      participantCount: 3,
      repeatedObservationCount: 2,
      method: 'two-way random-effects absolute agreement single measurement',
    });
    expect(known.status === 'estimated' && known.value).toBeCloseTo(2 / 3, 12);

    const uneven = iccAbsoluteAgreementSingle([
      [1, 2],
      [2],
    ]);
    expect(uneven).toMatchObject({
      status: 'not_estimable',
      variant: 'ICC(A,1)',
      reason: expect.stringContaining('balanced'),
    });
  });

  it('keeps participant clusters intact under a fixed deterministic bootstrap seed', () => {
    const input = {
      clusters: [[1, 2], [10, 20], [100, 200]],
      statistic: (clusters: number[][]) => empiricalQuantileR7(clusters.flat(), 0.5),
      seed: 6500,
      iterations: 400,
    };
    const first = participantClusterBootstrap(input);
    const second = participantClusterBootstrap(input);

    expect(REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM).toContain('participant-cluster');
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'estimated',
      confidenceLevel: 0.95,
      method: expect.stringContaining('participant-cluster'),
    });
    expect(participantClusterBootstrap({ ...input, clusters: [[1, 2]] })).toMatchObject({
      status: 'not_estimable',
      reason: expect.stringContaining('two participant clusters'),
    });
  });

  it('uses the standard SHA-256 digest for registry configuration hashes', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('pure redness calibration analysis', () => {
  it('keeps every deterministic fixture face-free and schema-valid', () => {
    const fixtures = syntheticRednessCalibrationFixtures();

    expect(fixtures).toHaveLength(16);
    expect(fixtures.every((fixture) => fixture.collectionSource === 'synthetic_face_free_fixture')).toBe(
      true,
    );
    expect(fixtures.every((fixture) => validateRednessCalibrationObservation(fixture).valid)).toBe(
      true,
    );
    expect(JSON.stringify(fixtures)).not.toMatch(
      /data:image|blob:|https?:\/\/|providerTaskId|rawProviderPayload|"name"|email/i,
    );
  });

  it('calculates Technical N95 from all eligible within-burst pairs', () => {
    const result = analysis();

    expect(result.technicalN95).toMatchObject({
      status: 'estimated',
      value: 3,
      sampleCount: 36,
      participantCount: 3,
      sessionCount: 9,
      frameCount: 36,
      method: expect.stringContaining('unordered accepted-frame pairs'),
      confidenceInterval: expect.objectContaining({ status: 'estimated' }),
    });
  });

  it('calculates Longitudinal N95 from matched within-participant session medians only', () => {
    const result = analysis();

    expect(result.longitudinalN95).toMatchObject({
      status: 'estimated',
      value: 1.9,
      sampleCount: 3,
      participantCount: 3,
      sessionCount: 6,
      method: expect.stringContaining('within-participant session-median pairs'),
    });
    expect(result.noChangeComparisons.filter(({ kind }) => kind === 'matched_longitudinal')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ participantId: 'P-001', signedDifference: 1 }),
        expect.objectContaining({ participantId: 'P-002', signedDifference: 0 }),
        expect.objectContaining({ participantId: 'P-003', signedDifference: 2 }),
      ]),
    );
  });

  it('excludes degraded, intervention, hard-failure, and incomplete observations with reasons', () => {
    const result = analysis();

    expect(result.counts).toMatchObject({
      observationCount: 16,
      eligibleObservationCount: 12,
      participantCount: 3,
      sessionCount: 9,
      acceptedFrameCount: 36,
    });
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationId: 'syn-p01-degraded',
          reasons: expect.arrayContaining(['degraded_condition']),
        }),
        expect.objectContaining({
          observationId: 'syn-p02-intervention',
          reasons: expect.arrayContaining(['explicit_intervention']),
        }),
        expect.objectContaining({
          observationId: 'syn-p03-incomplete',
          reasons: expect.arrayContaining(['fewer_than_three_accepted_frames']),
        }),
        expect.objectContaining({
          observationId: 'syn-p01-hard-failure',
          reasons: expect.arrayContaining([
            'hard_capture_failure',
            'fewer_than_three_accepted_frames',
          ]),
        }),
      ]),
    );
  });

  it('reports direction as unavailable without an anchor and mixed only when an anchor exists', () => {
    const fixtures = syntheticRednessCalibrationFixtures();
    const withoutAnchor = analyzeRednessCalibration([fixtures[0]], { bootstrapIterations: 400 });
    const anchoredFixture = {
      ...fixtures[0],
      comparisonAnchor: {
        rawScore: 61,
        expectedDirection: 'improvement' as const,
      },
    };
    const withAnchor = analyzeRednessCalibration([anchoredFixture], {
      bootstrapIterations: 400,
    });
    const contradictedNoChange = analyzeRednessCalibration([
      {
        ...fixtures[0],
        comparisonAnchor: {
          rawScore: 59,
          expectedDirection: 'no_change' as const,
        },
      },
    ], { bootstrapIterations: 400 });

    expect(withoutAnchor.observations[0].directionAgreement).toEqual({
      status: 'not_available',
      assessedFrameCount: 0,
      expectedDirection: 'not_available',
    });
    expect(withAnchor.observations[0].directionAgreement).toEqual({
      status: 'mixed',
      assessedFrameCount: 3,
      expectedDirection: 'improvement',
    });
    expect(contradictedNoChange.observations[0].directionAgreement).toEqual({
      status: 'contradicted',
      assessedFrameCount: 3,
      expectedDirection: 'no_change',
    });
  });

  it('names missing or non-finite raw evidence even when the observation is corrupt', () => {
    const candidate = syntheticRednessCalibrationFixtures()[0];
    candidate.burst.acceptedFrames[1].signal.rawScore = Number.NaN;

    const result = analyzeRednessCalibration([candidate], { bootstrapIterations: 400 });

    expect(result.exclusions).toEqual([
      expect.objectContaining({
        observationId: candidate.observationId,
        reasons: ['corrupt_observation', 'missing_or_non_finite_raw_score'],
        validationIssueCodes: expect.arrayContaining(['invalid_burst']),
      }),
    ]);
    expect(result.counts.eligibleObservationCount).toBe(0);
    assertFiniteNumbers(result);
  });

  it('calculates residual within-person SD, exact repeatability coefficient, and balanced ICC', () => {
    const result = analysis();

    expect(result.withinPersonSd).toMatchObject({
      status: 'estimated',
      value: expect.any(Number),
      observationCount: 12,
      participantCount: 3,
      residualDegreesOfFreedom: 9,
    });
    expect(result.withinPersonSd.value).toBeCloseTo(Math.sqrt(2 / 3), 12);
    expect(result.repeatabilityCoefficient).toMatchObject({
      status: 'estimated',
      formula: '1.96 × sqrt(2) × within-person SD',
      withinPersonSd: result.withinPersonSd.value,
      confidenceInterval: expect.objectContaining({ status: 'estimated' }),
    });
    expect(result.repeatabilityCoefficient.value).toBeCloseTo(
      1.96 * Math.sqrt(2) * Math.sqrt(2 / 3),
      12,
    );
    expect(result.icc).toMatchObject({
      status: 'estimated',
      variant: 'ICC(A,1)',
      participantCount: 3,
      repeatedObservationCount: 4,
    });
  });

  it('returns not estimable when balanced row lengths hide incompatible ICC occasions', () => {
    const fixtures = syntheticRednessCalibrationFixtures();
    const incompatible = fixtures.map((fixture) =>
      fixture.observationId === 'syn-p03-long-b'
        ? {
            ...fixture,
            conditionType: 'standard' as const,
            conditionId: 'P-003-standard-extra',
          }
        : fixture,
    );

    const result = analyzeRednessCalibration(incompatible, { bootstrapIterations: 400 });

    expect(result.icc).toMatchObject({
      status: 'not_estimable',
      variant: 'ICC(A,1)',
      participantCount: 3,
      repeatedObservationCount: null,
      reason: expect.stringContaining('condition/occasion slots'),
    });
  });

  it('compares provisional and exploratory candidates without approving any candidate', () => {
    const result = analysis();
    const provisional = result.thresholdCandidates.find(({ id }) => id === 'provisional_5_10');
    const technical = result.thresholdCandidates.find(({ id }) => id === 'technical_n95');
    const composite = result.thresholdCandidates.find(({ id }) => id === 'conservative_composite');

    expect(provisional).toMatchObject({
      authority: 'currently_used_by_consumer_trials',
      detectableBoundary: 5,
      strongBoundary: 10,
      falseChangeCount: 0,
      validNoChangeComparisonCount: 39,
      falseChangeRate: 0,
      classificationCounts: {
        worsened: 0,
        no_detectable_change: 39,
        directional_improvement: 0,
        meaningful_candidate: 0,
        strong_improvement: 0,
      },
    });
    expect(technical).toMatchObject({
      authority: 'exploratory_only',
      detectableBoundary: 3,
      strongBoundary: 6,
      falseChangeCount: 5,
      validNoChangeComparisonCount: 39,
    });
    expect(composite).toMatchObject({
      authority: 'exploratory_only',
      detectableBoundary: 3,
      falseChangeCount: 5,
    });
  });

  it('uses attempted frames as the rejection-rate denominator and separates degraded behavior', () => {
    const result = analysis();
    const degraded = result.breakdowns.byConditionType.find(({ key }) => key === 'degraded');

    expect(result.rejection).toMatchObject({
      rejectedFrameCount: 3,
      attemptedFrameCount: 47,
      rate: 3 / 47,
      uncertaintyInterval: expect.objectContaining({ status: 'estimated' }),
    });
    expect(degraded).toMatchObject({
      observationCount: 1,
      eligibleObservationCount: 0,
      acceptedFrameCount: 3,
      rejectedFrameCount: 1,
      attemptedFrameCount: 4,
      rejectionRate: 0.25,
    });
    expect(result.breakdowns.measuredSkinTone).toEqual({
      status: 'not_collected',
      groups: [],
    });
  });

  it('excludes version mismatches instead of silently pooling strata', () => {
    const fixtures = syntheticRednessCalibrationFixtures();
    fixtures[0] = { ...fixtures[0], analysisModelVersion: 'different-model-v2' };
    const result = analyzeRednessCalibration(fixtures, {
      bootstrapSeed: 65,
      bootstrapIterations: 400,
    });

    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationId: fixtures[0].observationId,
          reasons: expect.arrayContaining(['incompatible_analysis_model_version']),
        }),
      ]),
    );
    expect(result.technicalN95.sampleCount).toBe(33);
  });

  it('returns explicit not-estimable states for an empty or one-participant sample', () => {
    const empty = analyzeRednessCalibration([], { bootstrapIterations: 400 });
    const oneParticipant = analyzeRednessCalibration(
      syntheticRednessCalibrationFixtures().filter(({ participantId }) => participantId === 'P-001'),
      { bootstrapIterations: 400 },
    );

    expect(empty.technicalN95).toMatchObject({
      status: 'not_estimable',
      value: null,
      sampleCount: 0,
      confidenceInterval: expect.objectContaining({ status: 'not_estimable' }),
    });
    expect(empty.longitudinalN95.status).toBe('not_estimable');
    expect(empty.icc.status).toBe('not_estimable');
    expect(oneParticipant.technicalN95.confidenceInterval).toMatchObject({
      status: 'not_estimable',
      reason: expect.stringContaining('two participant clusters'),
    });
    expect(oneParticipant.icc.status).toBe('not_estimable');
    assertFiniteNumbers(empty);
    assertFiniteNumbers(oneParticipant);
  });
});

describe('exploratory threshold registry isolation', () => {
  it('serializes canonically, hashes deterministically, and remains exploratory', async () => {
    const first = await buildExploratoryRednessCalibrationRegistry({
      analysis: analysis(),
      createdAt: '2026-08-01T21:00:00.000Z',
    });
    const second = await buildExploratoryRednessCalibrationRegistry({
      analysis: analysis(),
      createdAt: '2026-08-01T21:00:00.000Z',
    });
    const serialized = serializeRednessCalibrationRegistry(first);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      threshold_source: 'technical_calibration',
      status: 'exploratory',
      approved_by: null,
      provisional: true,
      technical_n95: 3,
      longitudinal_n95: 1.9,
      participant_count: 3,
      session_count: 9,
      frame_count: 36,
      analysis_model_version: 'not_reported',
      config_hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(serialized).toBe(serializeRednessCalibrationRegistry(second));
    expect(serialized.indexOf('"approved_by"')).toBeLessThan(
      serialized.indexOf('"threshold_source"'),
    );
    expect(serialized).not.toMatch(/NaN|Infinity|data:image|blob:|https?:\/\//);
  });

  it('production loading ignores exploratory calibration output', async () => {
    const registry = await buildExploratoryRednessCalibrationRegistry({
      analysis: analysis(),
      createdAt: '2026-08-01T21:00:00.000Z',
    });

    expect(loadRednessCalibrationRegistryForProduction(registry)).toEqual({
      status: 'ignored',
      reason: 'exploratory_not_approved',
      configuration: null,
    });
    expect(loadRednessCalibrationRegistryForProduction({ ...registry, status: 'approved' })).toEqual({
      status: 'rejected',
      reason: 'unsupported_registry',
      configuration: null,
    });
  });
});
