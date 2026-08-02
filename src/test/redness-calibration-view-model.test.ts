import { describe, expect, it } from 'vitest';
import { syntheticRednessCalibrationFixtures } from '../domain/calibration/redness';
import {
  buildRednessCalibrationInstrumentViewModel,
  buildRednessCalibrationRegistryExport,
} from '../features/calibration-redness/rednessCalibrationViewModel';

describe('redness calibration instrument view model', () => {
  it('projects every required estimate from the pure analysis without recalculating in React', () => {
    const viewModel = buildRednessCalibrationInstrumentViewModel(
      syntheticRednessCalibrationFixtures(),
      { bootstrapIterations: 400, bootstrapSeed: 650065 },
    );

    expect(viewModel.metrics.map(({ title }) => title)).toEqual([
      'Technical N95',
      'Longitudinal N95',
      'Repeatability coefficient',
      'Within-person SD',
      'ICC(A,1)',
      'False-change rate · current 5-point boundary',
      'Capture rejection rate',
      'Eligible sample',
    ]);
    expect(viewModel.metrics.every(({ preliminaryLabel }) => (
      preliminaryLabel === 'PRELIMINARY INTERNAL ESTIMATE'
    ))).toBe(true);
    expect(viewModel.metrics.find(({ id }) => id === 'technical-n95')).toMatchObject({
      value: '3',
      status: 'estimated',
    });
    expect(viewModel.metrics.find(({ id }) => id === 'longitudinal-n95')).toMatchObject({
      value: '1.9',
      status: 'estimated',
    });
    expect(viewModel.metrics.find(({ id }) => id === 'icc')).toMatchObject({
      status: 'estimated',
    });
    expect(viewModel.candidates.map(({ id }) => id)).toEqual([
        'provisional_5_10',
        'technical_n95',
        'longitudinal_n95',
        'repeatability_coefficient',
        'conservative_composite',
      ]);
    expect(viewModel.candidates[0]).toMatchObject({
      authority: expect.stringContaining('Currently used by consumer trials'),
      detectableBoundary: '5',
      strongBoundary: '10',
    });
  });

  it('keeps observations, explicit unavailable fields, timelines, strata, and exclusions inspectable', () => {
    const viewModel = buildRednessCalibrationInstrumentViewModel(
      syntheticRednessCalibrationFixtures(),
      { bootstrapIterations: 400 },
    );
    const standard = viewModel.sessions.find(
      ({ observationId }) => observationId === 'syn-p01-standard-a',
    );

    expect(standard).toMatchObject({
      collectionSource: 'Synthetic face-free fixture · No physical capture',
      rawScores: '60 · 61 · 62',
      median: '61',
      range: '2',
    });
    expect(standard?.unavailableMetrics).toEqual(
      expect.arrayContaining([
        { label: expect.stringMatching(/Region Overlap/i), value: 'Not available' },
        { label: expect.stringMatching(/Registration/i), value: 'Not available' },
        { label: expect.stringMatching(/Segmentation/i), value: 'Not available' },
      ]),
    );
    expect(viewModel.timeline.find(({ participantId }) => participantId === 'P-001'))
      .toMatchObject({ longitudinalDifferences: [expect.stringContaining('points')] });
    expect(viewModel.exclusions.map(({ observationId }) => observationId)).toEqual(
      expect.arrayContaining([
        'syn-p01-degraded',
        'syn-p02-intervention',
        'syn-p03-incomplete',
        'syn-p01-hard-failure',
      ]),
    );
    expect(viewModel.breakdowns.devices.length).toBeGreaterThan(0);
    expect(viewModel.breakdowns.apiVersions.length).toBeGreaterThan(0);
    expect(viewModel.breakdowns.modelVersions.length).toBeGreaterThan(0);
    expect(viewModel.breakdowns.conditions.length).toBeGreaterThan(0);
    expect(viewModel.breakdowns.measuredSkinTone).toBe('Not collected');
  });

  it('exports only a canonical exploratory registry with no activation authority', async () => {
    const first = await buildRednessCalibrationRegistryExport(
      syntheticRednessCalibrationFixtures(),
      '2026-08-01T12:00:00.000Z',
    );
    const second = await buildRednessCalibrationRegistryExport(
      syntheticRednessCalibrationFixtures(),
      '2026-08-01T12:00:00.000Z',
    );
    const registry = JSON.parse(first) as Record<string, unknown>;

    expect(second).toBe(first);
    expect(registry).toMatchObject({
      threshold_source: 'technical_calibration',
      status: 'exploratory',
      approved_by: null,
      provisional: true,
    });
    expect(registry.config_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
