import assets from './local-optics-assets.json';
import { EXPERIMENTAL_TOLERANCES, LOCAL_OPTICS_METRICS_VERSION, type CaptureComparison, type CaptureMeasurement } from './opticsMetrics';
import type { ScanRecord } from './scanMetrics';
import type { TrialRecord } from './trialStore';

export const DIAGNOSTIC_VERSION = 'fv-trial-diagnostics-1';
export const CONTRACT_VERSION = 'fv-optical-measurement-1';
const fields = ['roll', 'yaw', 'pitch', 'interocular', 'centerX', 'centerY', 'landmarkMotion', 'pixelMotion', 'faceLuma', 'faceLumaSpread', 'faceClipped', 'shadingAsymmetry', 'frameLuma'] as const;
const properties = ['Roll', 'Yaw', 'Pitch', 'Apparent size', 'Horizontal position', 'Vertical position', 'Face brightness', 'Side shading', 'Face brightness spread', 'Whole-frame brightness', 'Background chromaticity r', 'Background chromaticity g'] as const;
const statuses = ['within_experimental_tolerance', 'outside_experimental_tolerance', 'shown_without_tolerance', 'not_measured'] as const;
const provenance = ['measured', 'model_estimate', 'estimate', 'reported', 'unavailable'] as const;
type Numeric = number | null;
type Property = typeof properties[number];
type Field = typeof fields[number];
type Row = { property: Property; baseline: Numeric; comparison: Numeric; difference: Numeric; tolerance: Numeric; status: typeof statuses[number]; provenance: typeof provenance[number] };
export interface CaptureDiagnostics {
  version: typeof DIAGNOSTIC_VERSION;
  frame: { width: number; height: number };
  frameCount: Numeric;
  measurements: Partial<Record<Field, { value: Numeric; provenance: typeof provenance[number] }>>;
  rows: Row[];
  durationMs: Numeric;
  rejectedBursts: Numeric;
  attempts: Numeric;
  interruptions: Numeric;
}
const obj = (x: unknown): Record<string, unknown> | null => typeof x === 'object' && x !== null && !Array.isArray(x) ? x as Record<string, unknown> : null;
const finite = (x: unknown): Numeric => typeof x === 'number' && Number.isFinite(x) ? x : null;
const nonnegative = (x: unknown): Numeric => typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
function member<T extends string>(values: readonly T[], x: unknown): x is T {
  return typeof x === 'string' && (values as readonly string[]).includes(x);
}

/** Explicit allowlist at both persistence and export boundaries; never serialize source objects. */
export function readCaptureDiagnostics(input: unknown): CaptureDiagnostics | null {
  const d = obj(input);
  if (!d || d.version !== DIAGNOSTIC_VERSION) return null;
  const frame = obj(d.frame);
  const width = nonnegative(frame?.width), height = nonnegative(frame?.height);
  if (!width || !height || width > 10000 || height > 10000) return null;
  const measurements: CaptureDiagnostics['measurements'] = {};
  const source = obj(d.measurements);
  for (const field of fields) {
    const m = obj(source?.[field]);
    if (m && member(provenance, m.provenance)) {
      const value = finite(m.value);
      measurements[field] = { value, provenance: value === null ? 'unavailable' : m.provenance };
    }
  }
  const rows: Row[] = [];
  if (Array.isArray(d.rows)) for (const item of d.rows.slice(0, properties.length)) {
    const r = obj(item);
    if (!r || !member(properties, r.property) || !member(statuses, r.status) || !member(provenance, r.provenance)) continue;
    rows.push({ property: r.property, baseline: finite(r.baseline), comparison: finite(r.comparison), difference: finite(r.difference), tolerance: nonnegative(r.tolerance), status: r.status, provenance: r.provenance });
  }
  return { version: DIAGNOSTIC_VERSION, frame: { width, height }, frameCount: nonnegative(d.frameCount), measurements, rows,
    durationMs: nonnegative(d.durationMs), rejectedBursts: nonnegative(d.rejectedBursts), attempts: nonnegative(d.attempts), interruptions: nonnegative(d.interruptions) };
}

/** UI-independent numerical snapshot of an accepted burst, not a skin measurement. */
export function captureDiagnostics(m: CaptureMeasurement, comparison: CaptureComparison | null, scan: ScanRecord | null): CaptureDiagnostics {
  const measurements = Object.fromEntries(fields.map(field => [field, { value: m[field].value, provenance: m[field].provenance }]));
  const result = readCaptureDiagnostics({
    version: DIAGNOSTIC_VERSION, frame: m.frameSize, frameCount: m.frameCount, measurements,
    rows: comparison?.rows ?? [], durationMs: scan?.acceptedMs ?? null, rejectedBursts: scan ? scan.bursts.filter(b => !b.accepted).length : null,
    attempts: scan?.bursts.length ?? null, interruptions: scan?.interruptions ?? null,
  });
  if (!result) throw new Error('Invalid diagnostic frame');
  return result;
}

/** This is optical eligibility only; scientific measurement uncertainty has not been established. */
export function opticalEligibility(conditions: 'matched' | 'not_matched' | 'unconfirmed') {
  return conditions === 'matched' ? 'experimental_conditions_match' : conditions === 'not_matched' ? 'ineligible' : 'insufficient_evidence';
}

export function buildTrialDiagnostics(trial: TrialRecord) {
  const baseline = trial.baseline;
  const elapsedMinutes = (at: string) => baseline ? Math.round((Date.parse(at) - Date.parse(baseline.capturedAt)) / 60000) : null;
  return {
    schema: DIAGNOSTIC_VERSION, contract: CONTRACT_VERSION, application: 'FV06-candidate',
    metrics: LOCAL_OPTICS_METRICS_VERSION, thresholds: EXPERIMENTAL_TOLERANCES,
    model: { runtime: assets.runtime.version, variant: assets.model.variant, sha256: assets.model.sha256 },
    sessionId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trial.id) || /^t-[a-z0-9]+-[a-z0-9]+$/.test(trial.id) ? trial.id : null,
    uncertainty: 'not_quantified', skinMeasurementEligible: false,
    baseline: baseline ? { id: 'baseline', elapsedMinutes: 0, captureQuality: baseline.quality, trigger: baseline.trigger,
      frame: { width: baseline.frame.width, height: baseline.frame.height }, orientation: baseline.guide.orientation,
      reference: { centerX: baseline.guide.centerX, centerY: baseline.guide.centerY, interocular: baseline.guide.interocular, roll: baseline.guide.roll, yaw: baseline.guide.yaw, pitch: baseline.guide.pitch, faceLuma: baseline.guide.faceLuma, shading: baseline.guide.shading },
      diagnostics: readCaptureDiagnostics(baseline.diagnostics), role: 'reference_not_comparison' } : null,
    checkIns: trial.checkIns.map((c, i) => ({ id: 'check-in-' + (i + 1), elapsedMinutes: elapsedMinutes(c.at), captureQuality: c.quality, trigger: c.trigger,
      conditions: c.conditions, reasons: c.reasons.filter(r => ['light', 'distance', 'position', 'angle', 'framing'].includes(r)), comparisonEligibility: opticalEligibility(c.conditions),
      diagnostics: readCaptureDiagnostics(c.diagnostics) })),
    missing: ['Historical or non-opted-in capture diagnostics are null; not reconstructed.', 'Calibrated distance, illumination, color temperature and measurement uncertainty are unavailable.', 'Cancelled or failed scans outside an accepted capture are not retained.'],
    privacy: 'User-initiated numeric export; no frames, landmarks, product, free text, device identifiers or network telemetry.',
  };
}

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded' | 'copied' | 'unavailable';
export async function shareTrialDiagnostics(report: ReturnType<typeof buildTrialDiagnostics>, mode: 'share' | 'download' | 'copy' = 'share'): Promise<ShareOutcome> {
  const json = JSON.stringify(report, null, 2);
  if (mode === 'share' && typeof navigator.share === 'function') {
    try {
      const file = new File([json], 'face-value-diagnostics.json', { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return 'shared'; }
      await navigator.share({ text: json }); return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // A new user gesture may be needed for copy/download: explicit buttons remain available.
      return 'unavailable';
    }
  }
  if (mode === 'copy') {
    try { await navigator.clipboard.writeText(json); return 'copied'; } catch { return 'unavailable'; }
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'face-value-diagnostics.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'downloaded';
  } catch { return 'unavailable'; }
}
