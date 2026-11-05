import { MEDIAPIPE_TASKS_VISION_VERSION, type LandmarkerInitReport } from './landmarkSource';
import type { CaptureComparison, CaptureMeasurement } from './opticsMetrics';

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
