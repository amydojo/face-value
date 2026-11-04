import { afterEach, describe, expect, it } from 'vitest';
import {
  loadStructuredDemoData,
  saveStructuredDemoData,
  STORAGE_KEY,
} from '../adapters/persistence/localObservationStore';
import { initialState } from '../app/machine';
import type { RednessEvaluationSnapshot } from '../domain/evidence/redness';
import type { EvidenceRecordData } from '../domain/model';
import { safetyGuidanceFor } from '../features/verdict/safetyGuidance';
import savedV1 from './fixtures/redness-snapshot-engine-v1.0.0.json';
import { evaluateLiveScenario, recordForSnapshot, surfacesFor } from './support/rednessScenarios';

// Saved records are immutable evidence. Loading them must never rewrite a snapshot, and an
// archive the current validator cannot read must never be destroyed.

const QUARANTINE_PREFIX = `${STORAGE_KEY}:quarantine:`;
const quarantined = () =>
  Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? '')
    .filter((key) => key.startsWith(QUARANTINE_PREFIX))
    .map((key) => localStorage.getItem(key));

const liveWorsening = () =>
  evaluateLiveScenario({
    comparability: null,
    delta: -20,
    pattern: 'unanimous',
    intervalDays: 29,
    adherence: 'complete',
    tolerance: 'none',
    anchor: -1,
    context: 'none',
  });

function saveArchive(records: EvidenceRecordData[]): string {
  saveStructuredDemoData({ ...initialState, stage: 'record', record: records[0], archive: records });
  return localStorage.getItem(STORAGE_KEY)!;
}

/** Writes an archive whose first record's evaluation was edited after saving (older shapes). */
function saveEditedArchive(edit: (evaluation: Record<string, unknown>) => void): string {
  const raw = saveArchive([recordForSnapshot(liveWorsening())]);
  const value = JSON.parse(raw);
  edit(value.archive[0].rednessEvaluation);
  edit(value.record.rednessEvaluation);
  const edited = JSON.stringify(value);
  localStorage.setItem(STORAGE_KEY, edited);
  return edited;
}

afterEach(() => localStorage.clear());

describe('saved records that load', () => {
  it('a current record with complete safety and effect metadata loads byte-identically', () => {
    const snapshot = liveWorsening();
    const serialized = JSON.stringify(snapshot);
    saveArchive([recordForSnapshot(snapshot)]);
    const restored = loadStructuredDemoData();
    expect(JSON.stringify(restored?.archive[0].rednessEvaluation)).toBe(serialized);
    expect(safetyGuidanceFor(restored?.archive[0].rednessEvaluation)?.kind).toBe('check_skin_first');
    expect(JSON.stringify(restored?.archive[0].rednessEvaluation)).toBe(serialized);
  });

  it('a V1 (engine v1.0.0) record keeps its previously saved conclusion', () => {
    const snapshot = structuredClone(savedV1) as unknown as RednessEvaluationSnapshot;
    saveArchive([recordForSnapshot(snapshot), recordForSnapshot(liveWorsening())]);
    const restored = loadStructuredDemoData();
    expect(restored?.archive).toHaveLength(2);
    const legacy = restored!.archive[0].rednessEvaluation!;
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(savedV1));
    expect(surfacesFor(legacy).recordHeadline).toBe('Visible redness worsened across comparable scans.');
    expect(safetyGuidanceFor(legacy)?.kind).toBe('check_skin_first');
  });
});

describe('saved records the current validator rejects are preserved, not deleted', () => {
  for (const [name, edit] of [
    ['missing safety metadata', (e: Record<string, unknown>) => delete e.safetyStatus],
    ['missing measurement-quality metadata', (e: Record<string, unknown>) => delete e.measurementQuality],
    ['an older schema version', (e: Record<string, unknown>) => (e.schemaVersion = 'redness-evaluation-v0')],
  ] as const) {
    it(name, () => {
      const raw = saveEditedArchive(edit);
      expect(loadStructuredDemoData()).toBeNull();
      // The app starts clean as before, but the archive bytes survive under a quarantine key.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(quarantined()).toEqual([raw]);
    });
  }

  it('a second unreadable load does not overwrite an earlier quarantine', () => {
    const first = saveEditedArchive((e) => delete e.safetyStatus);
    loadStructuredDemoData();
    const second = saveEditedArchive((e) => delete e.measurementQuality);
    loadStructuredDemoData();
    expect(quarantined().sort()).toEqual([first, second].sort());
  });
});

/** In-memory Storage whose writes can be made to fail, like a full localStorage quota. */
class FailingStorage implements Storage {
  private readonly items = new Map<string, string>();
  constructor(private readonly failWrite: (key: string) => boolean) {}
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrite(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.items.set(key, value);
  }
  seed(key: string, value: string) {
    this.items.set(key, value);
  }
  values() {
    return [...this.items.values()];
  }
}

describe('unreadable archives survive a failed quarantine write', () => {
  const unreadable = () => {
    const raw = saveEditedArchive((e) => delete e.safetyStatus);
    localStorage.clear();
    return raw;
  };

  it('quarantine write fails: the bytes stay in storage', () => {
    const raw = unreadable();
    const storage = new FailingStorage((key) => key.startsWith(QUARANTINE_PREFIX));
    storage.seed(STORAGE_KEY, raw);
    expect(loadStructuredDemoData(storage)).toBeNull();
    expect(storage.values()).toContain(raw);
  });

  it('every write fails: the bytes stay in storage', () => {
    const raw = unreadable();
    const storage = new FailingStorage(() => true);
    storage.seed(STORAGE_KEY, raw);
    expect(loadStructuredDemoData(storage)).toBeNull();
    expect(storage.values()).toContain(raw);
  });
});

describe('guidance fails safe when source facts are unavailable', () => {
  for (const [name, edit] of [
    ['safety status', (e: Record<string, unknown>) => delete e.safetyStatus],
    ['measurement quality', (e: Record<string, unknown>) => delete e.measurementQuality],
    ['interpretation', (e: Record<string, unknown>) => delete e.interpretation],
    ['direction agreement', (e: Record<string, unknown>) => delete e.directionAgreement],
  ] as const) {
    it(`missing ${name}: no claim, skin check, nothing mutated`, () => {
      const snapshot = structuredClone(liveWorsening()) as unknown as Record<string, unknown>;
      edit(snapshot);
      const before = JSON.stringify(snapshot);
      const guidance = safetyGuidanceFor(snapshot as unknown as RednessEvaluationSnapshot);
      expect(JSON.stringify(snapshot)).toBe(before);
      expect(guidance?.tone).toBe('safety');
      expect(guidance?.title).toBe('Check your skin before continuing');
      expect(guidance?.nextCaption).toBe('EVIDENCE');
      if (name !== 'direction agreement') {
        expect(guidance?.kind).toBe('facts_unavailable');
        expect(guidance?.evidenceLabel).toBe('INCONCLUSIVE');
        expect(guidance?.lines.join(' ')).not.toMatch(/favorable|unfavorable|higher|lower|improv|worse/i);
      }
    });
  }
});
