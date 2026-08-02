import {
  normalizeTrialTruthState,
  type TrialTruthCompatibleState,
} from '../../app/trialTruthMachine';
import {
  cloneTrialTruthEvidence,
  isTrialTruthEvidence,
  type TrialTruthEvidence,
} from '../../domain/trialTruth';
import {
  STORAGE_KEY,
  loadStructuredDemoData,
  toPersistedDemoData,
  type PersistedDemoData,
} from './localObservationStore';

export type PersistedTrialTruthData = PersistedDemoData & {
  trialTruthEvidence: TrialTruthEvidence | null;
};

export function toPersistedTrialTruthData(
  state: TrialTruthCompatibleState,
): PersistedTrialTruthData {
  const normalized = normalizeTrialTruthState(state);
  return {
    ...toPersistedDemoData(normalized),
    trialTruthEvidence: normalized.trialTruthEvidence
      ? cloneTrialTruthEvidence(normalized.trialTruthEvidence)
      : null,
  };
}

export function saveTrialTruthStructuredData(
  state: TrialTruthCompatibleState,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(toPersistedTrialTruthData(state)));
}

export function loadTrialTruthStructuredData(
  storage: Storage = localStorage,
): PersistedTrialTruthData | null {
  const raw = storage.getItem(STORAGE_KEY);
  const base = loadStructuredDemoData(storage);
  if (!raw || !base) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed.trialTruthEvidence ?? null;
    if (!(value === null || isTrialTruthEvidence(value))) {
      throw new Error('Invalid trial truth evidence');
    }
    return {
      ...base,
      trialTruthEvidence: value ? cloneTrialTruthEvidence(value) : null,
    };
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}
