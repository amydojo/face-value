import { BASELINE_TEMPLATE_VERSION, type BaselineTemplate } from './guidance';
import {
  LOCAL_OPTICS_METRICS_VERSION,
  type CaptureComparison,
  type CaptureMeasurement,
  type Measured,
} from './opticsMetrics';

// The Living Trial record: one product, one intended outcome, one baseline and its check-ins, kept
// in this browser's localStorage only after the person explicitly chooses to save it.
//
// What is stored is deliberately small: the product's name, the intended outcome, timestamps,
// whether each capture passed the existing quality gates, whether its conditions matched the
// baseline, and the baseline's guide template (ten rounded numbers: framing, head angle, coarse
// light). No images, video, landmarks, contours, facial proportions, embeddings, camera settings,
// user agent or device identifiers. The template is still derived from a face, so it is saved only
// with consent and can be deleted at any time.

export const TRIAL_STORAGE_KEY = 'fv.livingTrial.v1';
export const TRIAL_ARCHIVE_PREFIX = 'fv.livingTrial.unreadable.';
export const TRIAL_SCHEMA = 'fv-living-trial';
export const TRIAL_VERSION = 1;
export const STORAGE_CONSENT_VERSION = 'fv-trial-storage-consent-1';
/** Suggested trial length shown to the person; the record keeps working after it. */
export const TRIAL_PLAN_DAYS = 14;
/** After this long without activity, the app asks whether to keep or delete the saved trial. */
export const TRIAL_RETENTION_DAYS = 60;
export const MAX_CHECK_INS = 120;
export const MAX_NAME = 80;
export const MAX_OUTCOME = 120;

const DAY = 24 * 60 * 60 * 1000;

export type ConditionReason = 'light' | 'distance' | 'position' | 'angle' | 'framing';
export type Conditions = 'matched' | 'not_matched' | 'unconfirmed';

export interface CheckIn {
  at: string;
  trigger: 'auto' | 'manual';
  /** Every recorded check-in passed the capture-quality gates; refused bursts are never recorded. */
  quality: 'passed';
  conditions: Conditions;
  reasons: ConditionReason[];
}

export interface TrialBaseline {
  capturedAt: string;
  trigger: 'auto' | 'manual';
  quality: 'passed';
  /** Size of the analysed frame, used to detect a change of orientation or crop. */
  frame: { width: number; height: number };
  guide: BaselineTemplate;
}

export interface TrialRecord {
  schema: typeof TRIAL_SCHEMA;
  version: typeof TRIAL_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Present only once the person chose to save the trial on this device. */
  consent: { storage: 'device-local'; grantedAt: string; version: typeof STORAGE_CONSENT_VERSION } | null;
  product: { name: string; outcome: string };
  plan: { days: number };
  baseline: TrialBaseline | null;
  checkIns: CheckIn[];
}

/** The minimal storage surface the store needs (localStorage in the browser). */
export type TrialStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export type LoadResult =
  | { status: 'unavailable' }
  | { status: 'none' }
  | { status: 'ok'; trial: TrialRecord }
  | { status: 'expired'; trial: TrialRecord; inactiveDays: number }
  | { status: 'unreadable'; reason: 'corrupt' | 'incompatible'; raw: string };

export type SaveError = 'unavailable' | 'quota' | 'blocked' | 'verify' | 'invalid' | 'conflict';
export type SaveResult = { ok: true } | { ok: false; error: SaveError };

/** The browser's localStorage if it can actually be written (Private Browsing and blocked storage fail). */
export function browserStorage(): TrialStorage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${TRIAL_STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const iso = (date: Date) => date.toISOString();
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isNumOrNull = (v: unknown, lo: number, hi: number) => v === null || isNum(v, lo, hi);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const REASONS: ConditionReason[] = ['light', 'distance', 'position', 'angle', 'framing'];
const CONDITIONS: Conditions[] = ['matched', 'not_matched', 'unconfirmed'];
const TRIGGERS = ['auto', 'manual'];

function readTemplate(v: unknown): BaselineTemplate | null {
  if (!isObject(v) || v.version !== BASELINE_TEMPLATE_VERSION) return null;
  if (v.orientation !== 'portrait' && v.orientation !== 'landscape') return null;
  if (!isNum(v.centerX, 0, 1) || !isNum(v.centerY, 0, 1) || !isNum(v.interocular, 0.001, 1) || !isNum(v.roll, -180, 180)) return null;
  if (!isNumOrNull(v.yaw, -180, 180) || !isNumOrNull(v.pitch, -180, 180) || !isNumOrNull(v.faceLuma, 0, 255) || !isNumOrNull(v.shading, -1, 1)) return null;
  // Rebuilt field by field: anything else that was stored is dropped.
  return {
    version: BASELINE_TEMPLATE_VERSION,
    orientation: v.orientation,
    centerX: v.centerX,
    centerY: v.centerY,
    interocular: v.interocular,
    roll: v.roll,
    yaw: v.yaw as number | null,
    pitch: v.pitch as number | null,
    faceLuma: v.faceLuma as number | null,
    shading: v.shading as number | null,
  };
}

function readCheckIn(v: unknown): CheckIn | null {
  if (!isObject(v) || !isIso(v.at) || !TRIGGERS.includes(v.trigger as string) || v.quality !== 'passed') return null;
  if (!CONDITIONS.includes(v.conditions as Conditions) || !Array.isArray(v.reasons)) return null;
  if (!v.reasons.every((r) => REASONS.includes(r as ConditionReason))) return null;
  return {
    at: v.at,
    trigger: v.trigger as CheckIn['trigger'],
    quality: 'passed',
    conditions: v.conditions as Conditions,
    reasons: [...new Set(v.reasons as ConditionReason[])],
  };
}

/** Validates a SAVED record and rebuilds it from known fields only. */
export function parseTrial(raw: string): { ok: true; trial: TrialRecord } | { ok: false; reason: 'corrupt' | 'incompatible' } {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isObject(v) || v.schema !== TRIAL_SCHEMA) return { ok: false, reason: 'corrupt' };
  if (v.version !== TRIAL_VERSION) return { ok: false, reason: 'incompatible' };
  const { consent, product, plan, baseline } = v;
  if (!isText(v.id, 64) || !isIso(v.createdAt) || !isIso(v.updatedAt)) return { ok: false, reason: 'corrupt' };
  if (!isObject(consent) || consent.storage !== 'device-local' || !isIso(consent.grantedAt) || consent.version !== STORAGE_CONSENT_VERSION) {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isObject(product) || !isText(product.name, MAX_NAME) || !isText(product.outcome, MAX_OUTCOME)) return { ok: false, reason: 'corrupt' };
  if (!isObject(plan) || !isNum(plan.days, 1, 365) || !Number.isInteger(plan.days)) return { ok: false, reason: 'corrupt' };
  if (!isObject(baseline) || !isIso(baseline.capturedAt) || !TRIGGERS.includes(baseline.trigger as string) || baseline.quality !== 'passed') {
    return { ok: false, reason: 'corrupt' };
  }
  const frame = baseline.frame;
  if (!isObject(frame) || !isNum(frame.width, 1, 10000) || !isNum(frame.height, 1, 10000)) return { ok: false, reason: 'corrupt' };
  const guide = readTemplate(baseline.guide);
  if (!guide) return { ok: false, reason: 'corrupt' };
  if (!Array.isArray(v.checkIns) || v.checkIns.length > MAX_CHECK_INS) return { ok: false, reason: 'corrupt' };
  const checkIns = v.checkIns.map(readCheckIn);
  if (checkIns.some((c) => c === null)) return { ok: false, reason: 'corrupt' };
  return {
    ok: true,
    trial: {
      schema: TRIAL_SCHEMA,
      version: TRIAL_VERSION,
      id: v.id,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      consent: { storage: 'device-local', grantedAt: consent.grantedAt, version: STORAGE_CONSENT_VERSION },
      product: { name: product.name.trim(), outcome: product.outcome.trim() },
      plan: { days: plan.days },
      baseline: {
        capturedAt: baseline.capturedAt,
        trigger: baseline.trigger as TrialBaseline['trigger'],
        quality: 'passed',
        frame: { width: frame.width, height: frame.height },
        guide,
      },
      checkIns: checkIns as CheckIn[],
    },
  };
}

/** Days since the last activity (latest of update, baseline and check-ins). */
export function inactiveDays(trial: TrialRecord, now: Date): number {
  const times = [trial.updatedAt, trial.baseline?.capturedAt, ...trial.checkIns.map((c) => c.at)]
    .filter((t): t is string => Boolean(t))
    .map((t) => Date.parse(t));
  return Math.floor((now.getTime() - Math.max(...times)) / DAY);
}

export function loadTrial(storage: TrialStorage | null, now: Date): LoadResult {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(TRIAL_STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'none' };
  const parsed = parseTrial(raw);
  if (!parsed.ok) return { status: 'unreadable', reason: parsed.reason, raw };
  const days = inactiveDays(parsed.trial, now);
  if (days > TRIAL_RETENTION_DAYS) return { status: 'expired', trial: parsed.trial, inactiveDays: days };
  return { status: 'ok', trial: parsed.trial };
}

/**
 * Writes the trial and reads it back; reports success only if the saved copy is identical and
 * valid. Never replaces a different trial or an unreadable record (another tab, an older version):
 * that returns 'conflict' and leaves storage untouched.
 */
export function saveTrial(storage: TrialStorage | null, trial: TrialRecord): SaveResult {
  if (!storage) return { ok: false, error: 'unavailable' };
  const text = JSON.stringify(trial);
  if (!parseTrial(text).ok) return { ok: false, error: 'invalid' };
  try {
    const existing = storage.getItem(TRIAL_STORAGE_KEY);
    if (existing !== null) {
      const parsed = parseTrial(existing);
      if (!parsed.ok || parsed.trial.id !== trial.id) return { ok: false, error: 'conflict' };
    }
  } catch {
    return { ok: false, error: 'blocked' };
  }
  try {
    storage.setItem(TRIAL_STORAGE_KEY, text);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    return { ok: false, error: name === 'QuotaExceededError' ? 'quota' : 'blocked' };
  }
  try {
    if (storage.getItem(TRIAL_STORAGE_KEY) !== text) return { ok: false, error: 'verify' };
  } catch {
    return { ok: false, error: 'verify' };
  }
  return { ok: true };
}

/**
 * Moves an unreadable saved record aside (it is kept, not deleted) so a new trial can be started.
 * Returns the archive key, or null if the copy could not be written; then nothing is removed.
 */
export function archiveUnreadable(storage: TrialStorage | null, raw: string, now: Date): string | null {
  if (!storage) return null;
  const key = `${TRIAL_ARCHIVE_PREFIX}${iso(now)}`;
  try {
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) return null;
    storage.removeItem(TRIAL_STORAGE_KEY);
    return key;
  } catch {
    return null;
  }
}

export function archivedKeys(storage: TrialStorage | null): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(TRIAL_ARCHIVE_PREFIX)) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

/** Deletes the saved trial (and, with `everything`, set-aside unreadable copies). True if gone. */
export function deleteTrialData(storage: TrialStorage | null, everything = false): boolean {
  if (!storage) return false;
  try {
    const keys = [TRIAL_STORAGE_KEY, ...(everything ? archivedKeys(storage) : [])];
    for (const key of keys) storage.removeItem(key);
    return keys.every((key) => storage.getItem(key) === null);
  } catch {
    return false;
  }
}

export function newTrial(input: { name: string; outcome: string }, now: Date, id: string): TrialRecord {
  return {
    schema: TRIAL_SCHEMA,
    version: TRIAL_VERSION,
    id,
    createdAt: iso(now),
    updatedAt: iso(now),
    consent: null,
    product: { name: input.name.trim().slice(0, MAX_NAME), outcome: input.outcome.trim().slice(0, MAX_OUTCOME) },
    plan: { days: TRIAL_PLAN_DAYS },
    baseline: null,
    checkIns: [],
  };
}

export function withBaseline(
  trial: TrialRecord,
  guide: BaselineTemplate,
  frame: { width: number; height: number },
  trigger: 'auto' | 'manual',
  now: Date,
): TrialRecord {
  return {
    ...trial,
    updatedAt: iso(now),
    baseline: { capturedAt: iso(now), trigger, quality: 'passed', frame: { width: frame.width, height: frame.height }, guide },
  };
}

export function withConsent(trial: TrialRecord, now: Date): TrialRecord {
  return { ...trial, updatedAt: iso(now), consent: { storage: 'device-local', grantedAt: iso(now), version: STORAGE_CONSENT_VERSION } };
}

/** Appends a check-in; earlier check-ins are never replaced. The oldest drop off only past MAX_CHECK_INS. */
export function withCheckIn(trial: TrialRecord, checkIn: CheckIn, now: Date): TrialRecord {
  return { ...trial, updatedAt: iso(now), checkIns: [...trial.checkIns, checkIn].slice(-MAX_CHECK_INS) };
}

/**
 * Records a check-in on the SAVED copy when there is one (so a second tab's check-ins are kept),
 * otherwise on the in-memory trial, and saves it if the trial has storage consent.
 */
export function recordCheckIn(
  storage: TrialStorage | null,
  trial: TrialRecord,
  checkIn: CheckIn,
  now: Date,
): { trial: TrialRecord; save: SaveResult | null } {
  if (!trial.consent) return { trial: withCheckIn(trial, checkIn, now), save: null };
  let base = trial;
  try {
    const raw = storage?.getItem(TRIAL_STORAGE_KEY) ?? null;
    const parsed = raw === null ? null : parseTrial(raw);
    if (parsed?.ok && parsed.trial.id === trial.id && parsed.trial.checkIns.length > trial.checkIns.length) base = parsed.trial;
  } catch {
    // saveTrial reports the storage problem below
  }
  const next = withCheckIn(base, checkIn, now);
  return { trial: next, save: saveTrial(storage, next) };
}

export function touched(trial: TrialRecord, now: Date): TrialRecord {
  return { ...trial, updatedAt: iso(now) };
}

/** Plain condition categories from the experimental comparison; the comparison itself is unchanged. */
export function checkInFromComparison(comparison: CaptureComparison, trigger: 'auto' | 'manual', now: Date): CheckIn {
  const off = new Set(comparison.rows.filter((r) => r.status === 'outside_experimental_tolerance').map((r) => r.property));
  const reasons: ConditionReason[] = [];
  if (comparison.reasons.some((r) => r.startsWith('Frame size or orientation changed'))) reasons.push('framing');
  if (off.has('Apparent size')) reasons.push('distance');
  if (off.has('Horizontal position') || off.has('Vertical position')) reasons.push('position');
  if (off.has('Roll') || off.has('Yaw') || off.has('Pitch')) reasons.push('angle');
  if (off.has('Face brightness') || off.has('Side shading')) reasons.push('light');
  return {
    at: iso(now),
    trigger,
    quality: 'passed',
    conditions:
      comparison.overall === 'within_experimental_tolerances' ? 'matched' : comparison.overall === 'not_comparable' ? 'not_matched' : 'unconfirmed',
    reasons,
  };
}

const unavailable = <T,>(note: string): Measured<T> => ({ value: null, provenance: 'unavailable', note });
const known = (value: number | null, provenance: 'measured' | 'model_estimate'): Measured<number> =>
  value === null ? unavailable('Not saved with the baseline') : { value, provenance };

/**
 * The baseline as compareCaptures needs it, rebuilt from the saved (rounded) template. Used for
 * every follow-up, in the same session and after a return, so all check-ins compare alike.
 */
export function baselineMeasurement(baseline: TrialBaseline): CaptureMeasurement {
  const g = baseline.guide;
  const off = unavailable<number>('Not saved with the baseline');
  return {
    version: LOCAL_OPTICS_METRICS_VERSION,
    frameCount: 12,
    frameSize: { width: baseline.frame.width, height: baseline.frame.height },
    faceCounts: [],
    rejections: [],
    roll: known(g.roll, 'measured'),
    yaw: known(g.yaw, 'model_estimate'),
    pitch: known(g.pitch, 'model_estimate'),
    interocular: known(g.interocular, 'measured'),
    faceHeight: off,
    centerX: known(g.centerX, 'measured'),
    centerY: known(g.centerY, 'measured'),
    edgeMargin: off,
    landmarkMotion: off,
    pixelMotion: off,
    faceLuma: known(g.faceLuma, 'measured'),
    faceLumaSpread: off,
    faceClipped: off,
    shadingAsymmetry: known(g.shading, 'measured'),
    frameLuma: off,
    backgroundChroma: unavailable('Not saved with the baseline'),
    colorCast: unavailable('Needs a neutral reference target in frame; skin colour is never used'),
    camera: { settings: {} },
  };
}

/** "Day N" of the trial, counting the baseline day as day 1. */
export function trialDay(trial: TrialRecord, now: Date): number {
  const start = Date.parse(trial.baseline?.capturedAt ?? trial.createdAt);
  return Math.max(1, Math.floor((now.getTime() - start) / DAY) + 1);
}
