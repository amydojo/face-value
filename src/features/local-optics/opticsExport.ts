import { GUIDE_VERSION } from './guidance';
import { MEDIAPIPE_TASKS_VISION_VERSION, type LandmarkerInitReport } from './landmarkSource';
import { EXPERIMENTAL_TOLERANCES, LOCAL_OPTICS_METRICS_VERSION, type CaptureComparison, type CaptureMeasurement } from './opticsMetrics';
import { SCAN_METRICS_VERSION, summarize, type ScanRecord, type ScanSummary } from './scanMetrics';

/**
 * Manual, numbers-only export of a comparison for the iPhone protocol. Built only when the person
 * taps "Add to log"; held in memory; copied out by the person. Never contains pixels, images,
 * landmarks or device identifiers, and is never sent anywhere by the app.
 */
export const LOCAL_OPTICS_EXPORT_VERSION = 'fv-local-optics-export-0.1';

export interface ExportedPair {
  label: string;
  recordedAt: string;
  overall: CaptureComparison['overall'];
  reasons: string[];
  rows: Array<{
    property: string;
    provenance: string;
    baseline: number | null;
    comparison: number | null;
    difference: number | null;
    tolerance: number | null;
    status: string;
  }>;
  captures: Record<'baseline' | 'comparison', {
    frameCount: number;
    frameSize: { width: number; height: number };
    faceCounts: number[];
    rejections: string[];
    camera: Record<string, string | number | boolean>;
  }>;
}

export interface ExportLog {
  exportVersion: typeof LOCAL_OPTICS_EXPORT_VERSION;
  metricsVersion: string;
  tolerancesVersion: string;
  runtime: string;
  delegate: string | null;
  userAgent: string;
  pairs: ExportedPair[];
}

const round = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 1e5) / 1e5);

const captureSummary = (m: CaptureMeasurement) => ({
  frameCount: m.frameCount,
  frameSize: { ...m.frameSize },
  faceCounts: [...m.faceCounts],
  rejections: [...m.rejections],
  camera: { ...m.camera.settings },
});

export function exportPair(
  label: string,
  comparison: CaptureComparison,
  baseline: CaptureMeasurement,
  other: CaptureMeasurement,
  now: Date = new Date(),
): ExportedPair {
  return {
    label: label.trim().slice(0, 40) || 'unlabelled',
    recordedAt: now.toISOString(),
    overall: comparison.overall,
    reasons: [...comparison.reasons],
    rows: comparison.rows.map((r) => ({
      property: r.property,
      provenance: r.provenance,
      baseline: round(r.baseline),
      comparison: round(r.comparison),
      difference: round(r.difference),
      tolerance: r.tolerance,
      status: r.status,
    })),
    captures: { baseline: captureSummary(baseline), comparison: captureSummary(other) },
  };
}

export function exportLog(
  pairs: ExportedPair[],
  comparison: Pick<CaptureComparison, 'metricsVersion' | 'tolerancesVersion'>,
  init: LandmarkerInitReport | null,
  userAgent: string,
): ExportLog {
  return {
    exportVersion: LOCAL_OPTICS_EXPORT_VERSION,
    metricsVersion: comparison.metricsVersion,
    tolerancesVersion: comparison.tolerancesVersion,
    runtime: `@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}`,
    delegate: init?.delegate ?? null,
    userAgent,
    pairs,
  };
}

/**
 * One-tap test report: the usability log and every follow-up comparison of this session, with the
 * versions and the device path (delegate, frame) needed to read them. Numbers and state names
 * only: no images, landmarks, baseline template, user agent or device identifiers.
 */
export const TEST_REPORT_VERSION = 'fv-guided-test-report-0.1';

export interface TestReport {
  reportVersion: typeof TEST_REPORT_VERSION;
  generatedAt: string;
  versions: { metrics: string; tolerances: string; guide: string; scanMetrics: string; runtime: string };
  device: {
    delegate: string | null;
    requestedDelegate: 'auto' | 'CPU';
    gpuFailure: string | null;
    modelInitMs: number | null;
    frame: { width: number; height: number; orientation: 'portrait' | 'landscape' } | null;
    frameIntervalMs: number[];
  };
  usability: { summary: ScanSummary; scans: ScanRecord[] };
  comparisons: ExportedPair[];
  latestComparison: ExportedPair | null;
  privacy: string;
}

export function buildTestReport(input: {
  scans: ScanRecord[];
  comparisons: ExportedPair[];
  init: LandmarkerInitReport | null;
  requestedDelegate: 'auto' | 'CPU';
  frame: { width: number; height: number } | null;
  now?: Date;
}): TestReport {
  const { scans, comparisons, init, frame } = input;
  return {
    reportVersion: TEST_REPORT_VERSION,
    generatedAt: (input.now ?? new Date()).toISOString(),
    versions: {
      metrics: LOCAL_OPTICS_METRICS_VERSION,
      tolerances: EXPERIMENTAL_TOLERANCES.version,
      guide: GUIDE_VERSION,
      scanMetrics: SCAN_METRICS_VERSION,
      runtime: `@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}`,
    },
    device: {
      delegate: init?.delegate ?? null,
      requestedDelegate: input.requestedDelegate,
      gpuFailure: init?.gpuFailure ? init.gpuFailure.slice(0, 160) : null,
      modelInitMs: init?.initMs ?? null,
      frame: frame ? { width: frame.width, height: frame.height, orientation: frame.height >= frame.width ? 'portrait' : 'landscape' } : null,
      frameIntervalMs: scans.flatMap((s) => s.bursts.map((b) => b.frameIntervalMs)).filter((v): v is number => v !== null),
    },
    usability: { summary: summarize(scans), scans },
    comparisons,
    latestComparison: comparisons.at(-1) ?? null,
    privacy: 'Numbers only: no images, landmarks, face templates, user agent or device identifiers.',
  };
}
