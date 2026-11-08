import { describe, expect, it } from 'vitest';
import { BASELINE_TEMPLATE_VERSION, type BaselineTemplate } from '../features/local-optics/guidance';
import { compareCaptures, type CaptureMeasurement } from '../features/local-optics/opticsMetrics';
import {
  ARCHIVE_DAYS,
  archivedKeys,
  browserStorage,
  canWrite,
  purgeExpiredArchives,
  archiveUnreadable,
  baselineMeasurement,
  checkInFromComparison,
  deleteTrialData,
  inactiveDays,
  loadTrial,
  MAX_CHECK_INS,
  newTrial,
  parseTrial,
  recordCheckIn,
  saveTrial,
  TRIAL_ARCHIVE_PREFIX,
  TRIAL_RETENTION_DAYS,
  TRIAL_STORAGE_KEY,
  trialDay,
  withBaseline,
  withCheckIn,
  withConsent,
  type CheckIn,
  type TrialRecord,
  type TrialStorage,
} from '../features/local-optics/trialStore';

const DAY = 86_400_000;
const T0 = new Date('2026-11-01T09:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

class MemoryStorage implements TrialStorage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const guide: BaselineTemplate = {
  version: BASELINE_TEMPLATE_VERSION,
  orientation: 'portrait',
  centerX: 0.502,
  centerY: 0.471,
  interocular: 0.298,
  roll: 1.2,
  yaw: -2.4,
  pitch: 7.9,
  faceLuma: 132,
  shading: 0.041,
};
const frame = { width: 360, height: 640 };

function savedTrial(): TrialRecord {
  return withConsent(withBaseline(newTrial({ name: 'Azelaic serum', outcome: 'Reduce visible redness' }, T0, 'trial-1'), guide, frame, 'auto', T0), T0);
}

const checkIn = (day: number, conditions: CheckIn['conditions'] = 'matched'): CheckIn => ({
  at: at(day).toISOString(),
  trigger: 'auto',
  quality: 'passed',
  conditions,
  reasons: conditions === 'matched' ? [] : ['light'],
});

describe('Living Trial record', () => {
  it('saves only with consent and a baseline, then reads back the same trial', () => {
    const storage = new MemoryStorage();
    const draft = newTrial({ name: '  Azelaic serum ', outcome: 'Reduce visible redness' }, T0, 'trial-1');
    expect(saveTrial(storage, draft)).toEqual({ ok: false, error: 'invalid' }); // no consent, no baseline
    const unconsented = withBaseline(draft, guide, frame, 'auto', T0);
    expect(saveTrial(storage, unconsented)).toEqual({ ok: false, error: 'invalid' });
    expect(storage.length).toBe(0);

    const trial = withConsent(unconsented, T0);
    expect(saveTrial(storage, trial)).toEqual({ ok: true });
    const loaded = loadTrial(storage, at(3));
    expect(loaded).toEqual({ status: 'ok', trial });
    expect(trial.product.name).toBe('Azelaic serum');
  });

  it('stores only the documented fields: no images, landmarks, camera settings or device details', () => {
    const storage = new MemoryStorage();
    saveTrial(storage, withCheckIn(savedTrial(), checkIn(7, 'not_matched'), at(7)));
    const raw = storage.getItem(TRIAL_STORAGE_KEY)!;
    const record = JSON.parse(raw);
    expect(Object.keys(record).sort()).toEqual(['baseline', 'checkIns', 'consent', 'createdAt', 'id', 'plan', 'product', 'schema', 'updatedAt', 'version']);
    expect(Object.keys(record.baseline).sort()).toEqual(['capturedAt', 'frame', 'guide', 'quality', 'trigger']);
    expect(Object.keys(record.baseline.guide).sort()).toEqual(
      ['centerX', 'centerY', 'faceLuma', 'interocular', 'orientation', 'pitch', 'roll', 'shading', 'version', 'yaw'].sort(),
    );
    expect(Object.keys(record.checkIns[0]).sort()).toEqual(['at', 'conditions', 'quality', 'reasons', 'trigger']);
    expect(raw).not.toMatch(/data:image|base64|landmark|points|userAgent|deviceId|settings/i);
    expect(raw.length).toBeLessThan(1200);
  });

  it('rebuilds parsed records from known fields only, dropping anything extra', () => {
    const tampered = { ...savedTrial(), extra: 'x', baseline: { ...savedTrial().baseline, landmarks: [[0.1, 0.2]], guide: { ...guide, mesh: [1, 2] } } };
    const parsed = parseTrial(JSON.stringify(tampered));
    expect(parsed.ok).toBe(true);
    const text = JSON.stringify(parsed.ok && parsed.trial);
    expect(text).not.toMatch(/extra|landmarks|mesh/);
  });

  it('reports missing, unavailable, corrupt and incompatible storage without deleting anything', () => {
    expect(loadTrial(null, T0)).toEqual({ status: 'unavailable' });
    const throwing = { ...new MemoryStorage(), getItem: () => { throw new DOMException('denied', 'SecurityError'); } } as unknown as TrialStorage;
    expect(loadTrial(throwing, T0)).toEqual({ status: 'unavailable' });

    const storage = new MemoryStorage();
    expect(loadTrial(storage, T0)).toEqual({ status: 'none' });

    storage.setItem(TRIAL_STORAGE_KEY, '{"schema":"fv-living-trial",');
    expect(loadTrial(storage, T0)).toMatchObject({ status: 'unreadable', reason: 'corrupt' });
    storage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ ...savedTrial(), version: 2 }));
    expect(loadTrial(storage, T0)).toMatchObject({ status: 'unreadable', reason: 'incompatible' });
    storage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ ...savedTrial(), baseline: { ...savedTrial().baseline, guide: { ...guide, centerX: 7 } } }));
    expect(loadTrial(storage, T0)).toMatchObject({ status: 'unreadable', reason: 'corrupt' });
    storage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ ...savedTrial(), consent: null }));
    expect(loadTrial(storage, T0)).toMatchObject({ status: 'unreadable', reason: 'corrupt' });
    expect(storage.getItem(TRIAL_STORAGE_KEY)).not.toBeNull(); // still there
  });

  it('never overwrites a different or unreadable saved trial', () => {
    const storage = new MemoryStorage();
    const other = { ...savedTrial(), id: 'trial-other' };
    saveTrial(storage, other);
    expect(saveTrial(storage, savedTrial())).toEqual({ ok: false, error: 'conflict' });
    expect(JSON.parse(storage.getItem(TRIAL_STORAGE_KEY)!).id).toBe('trial-other');
    storage.setItem(TRIAL_STORAGE_KEY, 'garbage');
    expect(saveTrial(storage, savedTrial())).toEqual({ ok: false, error: 'conflict' });
    expect(storage.getItem(TRIAL_STORAGE_KEY)).toBe('garbage');
  });

  it('distinguishes full and blocked storage, and refuses to claim an unverified save', () => {
    const quota = new MemoryStorage();
    quota.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(saveTrial(quota, savedTrial())).toEqual({ ok: false, error: 'quota' });
    const blocked = new MemoryStorage();
    blocked.setItem = () => {
      throw new DOMException('no', 'SecurityError');
    };
    expect(saveTrial(blocked, savedTrial())).toEqual({ ok: false, error: 'blocked' });
    const lossy = new MemoryStorage();
    lossy.setItem = () => undefined; // silently drops writes
    expect(saveTrial(lossy, savedTrial())).toEqual({ ok: false, error: 'verify' });
    expect(saveTrial(null, savedTrial())).toEqual({ ok: false, error: 'unavailable' });
  });

  it('keeps trials through the 14-day plan and asks before anything older than the retention window', () => {
    const storage = new MemoryStorage();
    saveTrial(storage, savedTrial());
    expect(loadTrial(storage, at(14)).status).toBe('ok');
    expect(loadTrial(storage, at(TRIAL_RETENTION_DAYS)).status).toBe('ok');
    expect(loadTrial(storage, at(TRIAL_RETENTION_DAYS + 1))).toMatchObject({ status: 'expired', inactiveDays: TRIAL_RETENTION_DAYS + 1 });
    expect(storage.getItem(TRIAL_STORAGE_KEY)).not.toBeNull(); // asking, not deleting
    // A recent check-in counts as activity.
    const active = { ...withCheckIn(savedTrial(), checkIn(50), at(50)), updatedAt: T0.toISOString() };
    expect(inactiveDays(active, at(TRIAL_RETENTION_DAYS + 20))).toBe(30);
  });

  it('sets unreadable data aside before a new trial, and only deletes on request', () => {
    const storage = new MemoryStorage();
    storage.setItem(TRIAL_STORAGE_KEY, 'broken{');
    const key = archiveUnreadable(storage, 'broken{', T0);
    expect(key).toBe(`${TRIAL_ARCHIVE_PREFIX}${T0.toISOString()}`);
    expect(storage.getItem(key!)).toBe('broken{');
    expect(storage.getItem(TRIAL_STORAGE_KEY)).toBeNull();
    expect(archivedKeys(storage)).toEqual([key]);

    // If the copy can't be written, nothing is removed.
    const stuck = new MemoryStorage();
    stuck.setItem(TRIAL_STORAGE_KEY, 'broken{');
    stuck.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(archiveUnreadable(stuck, 'broken{', T0)).toBeNull();
    expect(stuck.getItem(TRIAL_STORAGE_KEY)).toBe('broken{');

    saveTrial(storage, savedTrial());
    expect(deleteTrialData(storage)).toBe(true);
    expect(storage.getItem(TRIAL_STORAGE_KEY)).toBeNull();
    expect(archivedKeys(storage)).toHaveLength(1);
    expect(deleteTrialData(storage, true)).toBe(true);
    expect(storage.length).toBe(0);
  });

  it('appends check-ins without replacing earlier ones, including ones saved from another tab', () => {
    const storage = new MemoryStorage();
    const trial = savedTrial();
    saveTrial(storage, trial);
    const first = recordCheckIn(storage, trial, checkIn(3), at(3));
    expect(first.save).toEqual({ ok: true });
    const second = recordCheckIn(storage, first.trial, checkIn(7, 'not_matched'), at(7));
    expect(second.trial.checkIns.map((c) => c.conditions)).toEqual(['matched', 'not_matched']);

    // A stale tab that still holds the trial without check-ins records a third: all three are kept.
    const stale = recordCheckIn(storage, trial, checkIn(9), at(9));
    expect(stale.trial.checkIns).toHaveLength(3);
    expect((loadTrial(storage, at(9)) as { trial: TrialRecord }).trial.checkIns).toHaveLength(3);

    // Without consent nothing is written.
    const unsaved = recordCheckIn(new MemoryStorage(), { ...trial, consent: null }, checkIn(3), at(3));
    expect(unsaved.save).toBeNull();
    expect(unsaved.trial.checkIns).toHaveLength(1);

    let many = trial;
    for (let i = 0; i < MAX_CHECK_INS + 5; i += 1) many = withCheckIn(many, checkIn(1), at(1));
    expect(many.checkIns).toHaveLength(MAX_CHECK_INS);
  });

  it('counts trial days from the baseline', () => {
    const trial = savedTrial();
    expect(trialDay(trial, T0)).toBe(1);
    expect(trialDay(trial, new Date(T0.getTime() + 23 * 3_600_000))).toBe(1);
    expect(trialDay(trial, at(3))).toBe(4);
    expect(trialDay(trial, at(-1))).toBe(1);
  });
});

describe('blocked, read-only and bounded storage', () => {
  it('reading localStorage that throws on access gives null instead of crashing', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      expect(browserStorage()).toBeNull();
      expect(canWrite(browserStorage())).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('a store that reads but cannot write still restores, and reports itself unwritable', () => {
    const storage = new MemoryStorage();
    saveTrial(storage, savedTrial());
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(canWrite(storage)).toBe(false);
    expect(loadTrial(storage, at(1)).status).toBe('ok');
    expect(canWrite(new MemoryStorage())).toBe(true);
    expect(new MemoryStorage().length).toBe(0); // the probe leaves nothing behind
  });

  it('set-aside copies are bounded in number and age', () => {
    const storage = new MemoryStorage();
    for (const day of [0, 1, 2]) {
      storage.setItem(TRIAL_STORAGE_KEY, `broken-${day}`);
      archiveUnreadable(storage, `broken-${day}`, at(day));
    }
    expect(archivedKeys(storage)).toEqual([`${TRIAL_ARCHIVE_PREFIX}${at(1).toISOString()}`, `${TRIAL_ARCHIVE_PREFIX}${at(2).toISOString()}`]);
    expect(purgeExpiredArchives(storage, at(ARCHIVE_DAYS))).toBe(0);
    expect(purgeExpiredArchives(storage, at(ARCHIVE_DAYS + 1.5))).toBe(1);
    storage.setItem(`${TRIAL_ARCHIVE_PREFIX}not-a-date`, 'x');
    expect(purgeExpiredArchives(storage, at(ARCHIVE_DAYS + 3))).toBe(2);
    expect(storage.length).toBe(0);
  });
});

describe('check-in conditions from the unchanged experimental comparison', () => {
  const base = baselineMeasurement(savedTrial().baseline!);
  const followUp = (patch: Partial<CaptureMeasurement>): CaptureMeasurement => ({ ...base, ...patch });

  it('the rebuilt baseline compares within tolerance against itself', () => {
    const comparison = compareCaptures(base, base);
    expect(comparison.overall).toBe('within_experimental_tolerances');
    expect(checkInFromComparison(comparison, 'auto', T0)).toEqual({ at: T0.toISOString(), trigger: 'auto', quality: 'passed', conditions: 'matched', reasons: [] });
  });

  it('maps outside-tolerance rows to plain reasons', () => {
    const c = compareCaptures(
      base,
      followUp({
        faceLuma: { value: 132 * 1.5, provenance: 'measured' },
        interocular: { value: 0.298 * 1.3, provenance: 'measured' },
        centerX: { value: 0.502 + 0.2, provenance: 'measured' },
        yaw: { value: 20, provenance: 'model_estimate' },
      }),
    );
    const result = checkInFromComparison(c, 'manual', T0);
    expect(result.conditions).toBe('not_matched');
    expect(result.reasons).toEqual(['distance', 'position', 'angle', 'light']);
  });

  it('a changed frame is a framing mismatch; an unmeasured property is unconfirmed', () => {
    const rotated = checkInFromComparison(compareCaptures(base, followUp({ frameSize: { width: 640, height: 360 } })), 'auto', T0);
    expect(rotated).toMatchObject({ conditions: 'not_matched', reasons: ['framing'] });
    const missing = checkInFromComparison(
      compareCaptures(base, followUp({ yaw: { value: null, provenance: 'unavailable' } })),
      'auto',
      T0,
    );
    expect(missing).toMatchObject({ conditions: 'unconfirmed', reasons: [] });
  });
});
