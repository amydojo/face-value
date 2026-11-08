import { describe, expect, it } from 'vitest';
import { buildTestReport, exportPair } from '../features/local-optics/opticsExport';
import { compareCaptures, type CaptureMeasurement } from '../features/local-optics/opticsMetrics';
import { newScanRecord, type ScanRecord } from '../features/local-optics/scanMetrics';

const m = (value: number | null) => ({
  value,
  provenance: value === null ? ('unavailable' as const) : ('measured' as const),
});
const measurement = (shift = 0): CaptureMeasurement => ({
  version: 'fv-local-optics-metrics-0.1',
  frameCount: 12,
  frameSize: { width: 270, height: 360 },
  faceCounts: Array(12).fill(1),
  rejections: [],
  roll: m(1 + shift),
  yaw: { value: 2, provenance: 'model_estimate' },
  pitch: { value: 8, provenance: 'model_estimate' },
  interocular: m(0.3),
  faceHeight: m(0.41),
  centerX: m(0.5),
  centerY: m(0.47),
  edgeMargin: m(0.1),
  landmarkMotion: m(0.003),
  pixelMotion: m(0.3),
  faceLuma: m(140),
  faceLumaSpread: m(40),
  faceClipped: m(0),
  shadingAsymmetry: m(0.05),
  frameLuma: m(120),
  backgroundChroma: { value: { r: 0.33, g: 0.33 }, provenance: 'estimate' },
  colorCast: { value: null, provenance: 'unavailable' },
  camera: { settings: { width: 1080, height: 1440, facingMode: 'user', frameRate: 30 } },
});

const scan = (patch: Partial<ScanRecord>): ScanRecord => ({
  ...newScanRecord('baseline'),
  ...patch,
});

describe('one-tap test report', () => {
  const baseline = measurement();
  const scans = [
    scan({
      outcome: 'accepted',
      trigger: 'auto',
      acceptedMs: 7188,
      corrections: 2,
      instructions: ['center', 'hold_still', 'aligned'],
      bursts: [
        {
          trigger: 'auto',
          accepted: true,
          rejections: [],
          aligned: true,
          landmarkMotion: 0.0025,
          frameIntervalMs: 22,
        },
      ],
    }),
    scan({
      mode: 'follow_up',
      outcome: 'accepted',
      trigger: 'auto',
      acceptedMs: 1607,
      comparison: 'within_experimental_tolerances',
      bursts: [
        {
          trigger: 'auto',
          accepted: true,
          rejections: [],
          aligned: true,
          landmarkMotion: 0.0032,
          frameIntervalMs: 22,
        },
      ],
    }),
  ];
  const comparisons = [
    exportPair(
      'follow-up 1',
      compareCaptures(baseline, measurement(0.5)),
      baseline,
      measurement(0.5),
    ),
    exportPair('follow-up 2', compareCaptures(baseline, measurement(9)), baseline, measurement(9)),
  ];
  const report = buildTestReport({
    scans,
    comparisons,
    init: { delegate: 'GPU', requestedDelegate: 'auto', gpuFailure: null, initMs: 412 },
    requestedDelegate: 'auto',
    frame: { width: 1080, height: 1440 },
    now: new Date('2026-11-08T12:00:00Z'),
  });

  it('combines usability and every follow-up comparison in one structure', () => {
    expect(report).toMatchObject({
      reportVersion: 'fv-guided-test-report-0.1',
      generatedAt: '2026-11-08T12:00:00.000Z',
      versions: {
        guide: 'fv-guided-capture-guide-0.1-unvalidated',
        runtime: '@mediapipe/tasks-vision@0.10.35',
      },
      device: {
        delegate: 'GPU',
        modelInitMs: 412,
        frame: { width: 1080, height: 1440, orientation: 'portrait' },
        frameIntervalMs: [22, 22],
      },
      usability: {
        summary: {
          scans: 2,
          accepted: 2,
          bursts: 2,
          rejectedBursts: 0,
          medianTimeToAcceptMs: 4397.5,
        },
      },
    });
    expect(report.comparisons.map((c) => [c.label, c.overall])).toEqual([
      ['follow-up 1', 'within_experimental_tolerances'],
      ['follow-up 2', 'not_comparable'],
    ]);
    expect(report.latestComparison?.label).toBe('follow-up 2');
    expect(report.latestComparison?.rows.find((r) => r.property === 'Roll')).toMatchObject({
      baseline: 1,
      comparison: 10,
      status: 'outside_experimental_tolerance',
    });
  });

  it('holds numbers only: no images, landmarks, templates, user agent or device identifiers', () => {
    const json = JSON.stringify(report);
    expect(json).not.toMatch(
      /data:|blob:|"points"|"x":|deviceId|groupId|userAgent|Mozilla|faceHeight|edgeMargin|"template"|BASELINE_TEMPLATE|fv-guided-baseline/,
    );
    // The classification is the comparison's, untouched by the report.
    expect(report.comparisons[1].reasons).toEqual(
      compareCaptures(baseline, measurement(9)).reasons,
    );
  });

  it('is valid with nothing captured yet', () => {
    const empty = buildTestReport({
      scans: [],
      comparisons: [],
      init: null,
      requestedDelegate: 'CPU',
      frame: null,
    });
    expect(empty).toMatchObject({
      comparisons: [],
      latestComparison: null,
      device: { delegate: null, frame: null, frameIntervalMs: [] },
    });
    expect(empty.usability.summary.scans).toBe(0);
  });
});
