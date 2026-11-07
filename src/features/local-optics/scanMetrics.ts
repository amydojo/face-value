import type { InstructionId } from './guidance';
import type { RejectionReason } from './opticsMetrics';

// Exploratory usability measures for one guided scan, kept in this tab's memory only. Numbers and
// state names: no pixels, landmarks or device identifiers. Not validated quality measures.

export const SCAN_METRICS_VERSION = 'fv-guided-scan-metrics-0.1';

export type ScanOutcome = 'accepted' | 'cancelled' | 'paused' | 'interrupted' | 'failed' | 'in_progress';

export interface ScanRecord {
  version: typeof SCAN_METRICS_VERSION;
  mode: 'baseline' | 'follow_up';
  outcome: ScanOutcome;
  /** How the accepted burst was triggered. */
  trigger: 'auto' | 'manual' | null;
  /** Milliseconds from "Start scan" (or "Resume"); null if the event did not happen. */
  cameraReadyMs: number | null;
  guideReadyMs: number | null;
  firstFaceMs: number | null;
  firstAlignedMs: number | null;
  acceptedMs: number | null;
  endedMs: number | null;
  corrections: number;
  instructions: InstructionId[];
  bursts: {
    trigger: 'auto' | 'manual';
    accepted: boolean;
    rejections: RejectionReason[];
    /** Whether the guide reported alignment when the burst started. */
    aligned: boolean;
    /** Measured landmark motion (interocular per analysed frame) and the frame interval it was measured over. */
    landmarkMotion: number | null;
    frameIntervalMs: number | null;
  }[];
  interruptions: number;
  helpShown: boolean;
  /** Follow-up only: compareCaptures' overall result for the accepted burst. */
  comparison: 'within_experimental_tolerances' | 'not_comparable' | 'insufficient_evidence' | null;
}

export function newScanRecord(mode: ScanRecord['mode']): ScanRecord {
  return {
    version: SCAN_METRICS_VERSION,
    mode,
    outcome: 'in_progress',
    trigger: null,
    cameraReadyMs: null,
    guideReadyMs: null,
    firstFaceMs: null,
    firstAlignedMs: null,
    acceptedMs: null,
    endedMs: null,
    corrections: 0,
    instructions: [],
    bursts: [],
    interruptions: 0,
    helpShown: false,
    comparison: null,
  };
}

export interface ScanSummary {
  scans: number;
  accepted: number;
  cancelled: number;
  medianTimeToAcceptMs: number | null;
  medianCorrections: number | null;
  bursts: number;
  rejectedBursts: number;
  /** Rejected automatic bursts over automatic bursts. */
  autoRejectionRate: number | null;
  manualRejectionRate: number | null;
}

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function summarize(records: ScanRecord[]): ScanSummary {
  const bursts = records.flatMap((r) => r.bursts);
  const rate = (trigger: 'auto' | 'manual') => {
    const of = bursts.filter((b) => b.trigger === trigger);
    return of.length ? of.filter((b) => !b.accepted).length / of.length : null;
  };
  const accepted = records.filter((r) => r.outcome === 'accepted');
  return {
    scans: records.length,
    accepted: accepted.length,
    cancelled: records.filter((r) => r.outcome === 'cancelled').length,
    medianTimeToAcceptMs: median(accepted.map((r) => r.acceptedMs!).filter((v) => v !== null)),
    medianCorrections: median(accepted.map((r) => r.corrections)),
    bursts: bursts.length,
    rejectedBursts: bursts.filter((b) => !b.accepted).length,
    autoRejectionRate: rate('auto'),
    manualRejectionRate: rate('manual'),
  };
}
