import {
  loadStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
  type PersistedDemoData,
} from './localObservationStore';
import type { PhaseBFaceValueState } from '../../app/phaseBMachine';
import {
  isDemoResultFixtureId,
  isDemoStartingPoint,
  type DemoLaunchMode,
  type DemoResultFixtureId,
  type DemoStartingPoint,
} from '../../domain/demoLab';

export const DEMO_JOURNEY_STORAGE_KEY = 'face-value:demo-lab:journey:v1';
export const DEMO_PREVIEW_SESSION_KEY = 'face-value:demo-lab:preview-once:v1';
export const DEMO_JOURNEY_QUERY = 'fv-demo-journey';
export const DEMO_ORIGIN = 'face-value-demo-lab' as const;
export const DEMO_ENVELOPE_SCHEMA = 'face-value-demo-envelope-v1' as const;

export interface DemoEnvelope {
  schemaVersion: typeof DEMO_ENVELOPE_SCHEMA;
  origin: typeof DEMO_ORIGIN;
  mode: DemoLaunchMode;
  startingPoint: DemoStartingPoint;
  resultFixture: DemoResultFixtureId;
  savedAt: string;
  state: PersistedDemoData;
}

export interface DemoLaunch {
  mode: DemoLaunchMode;
  startingPoint: DemoStartingPoint;
  resultFixture: DemoResultFixtureId;
  state: PhaseBFaceValueState;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class SingleStructuredStateStorage implements Storage {
  private value: string | null;

  constructor(value: unknown) {
    this.value = JSON.stringify(value);
  }

  get length(): number {
    return this.value === null ? 0 : 1;
  }

  clear(): void {
    this.value = null;
  }

  getItem(key: string): string | null {
    return key === STORAGE_KEY ? this.value : null;
  }

  key(index: number): string | null {
    return index === 0 && this.value !== null ? STORAGE_KEY : null;
  }

  removeItem(key: string): void {
    if (key === STORAGE_KEY) this.value = null;
  }

  setItem(key: string, value: string): void {
    if (key === STORAGE_KEY) this.value = value;
  }
}

function recordsAreDemoOriginated(state: PhaseBFaceValueState): boolean {
  const records = [...state.archive, ...(state.record ? [state.record] : [])];
  return records.every((record) => record.demoOriginated === true);
}

function envelopeFor(launch: DemoLaunch, savedAt: string): DemoEnvelope {
  if (!recordsAreDemoOriginated(launch.state)) {
    throw new Error('Every synthetic saved result must have explicit demo-origin metadata.');
  }

  return {
    schemaVersion: DEMO_ENVELOPE_SCHEMA,
    origin: DEMO_ORIGIN,
    mode: launch.mode,
    startingPoint: launch.startingPoint,
    resultFixture: launch.resultFixture,
    savedAt,
    state: toPersistedDemoData(launch.state),
  };
}

function parseEnvelope(raw: string | null): DemoEnvelope | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isObject(value) ||
      value.schemaVersion !== DEMO_ENVELOPE_SCHEMA ||
      value.origin !== DEMO_ORIGIN ||
      !['preview', 'journey'].includes(String(value.mode)) ||
      !isDemoStartingPoint(value.startingPoint) ||
      !isDemoResultFixtureId(value.resultFixture) ||
      typeof value.savedAt !== 'string'
    ) {
      return null;
    }

    const state = loadStructuredDemoData(new SingleStructuredStateStorage(value.state));
    if (!state) return null;
    const records = [...state.archive, ...(state.record ? [state.record] : [])];
    if (records.some((record) => record.demoOriginated !== true)) {
      return null;
    }

    return {
      schemaVersion: DEMO_ENVELOPE_SCHEMA,
      origin: DEMO_ORIGIN,
      mode: value.mode === 'preview' ? 'preview' : 'journey',
      startingPoint: value.startingPoint,
      resultFixture: value.resultFixture,
      savedAt: value.savedAt,
      state,
    };
  } catch {
    return null;
  }
}

export function saveDemoJourney(
  launch: DemoLaunch,
  storage: Storage = localStorage,
  savedAt = new Date().toISOString(),
): DemoEnvelope {
  if (launch.mode !== 'journey') {
    throw new Error('Persistent demo storage requires journey mode.');
  }
  const envelope = envelopeFor(launch, savedAt);
  storage.setItem(DEMO_JOURNEY_STORAGE_KEY, JSON.stringify(envelope));
  return envelope;
}

export function loadDemoJourney(storage: Storage = localStorage): DemoEnvelope | null {
  const envelope = parseEnvelope(storage.getItem(DEMO_JOURNEY_STORAGE_KEY));
  if (!envelope || envelope.mode !== 'journey') {
    storage.removeItem(DEMO_JOURNEY_STORAGE_KEY);
    return null;
  }
  return envelope;
}

export function clearDemoJourneyData(storage: Storage = localStorage): void {
  storage.removeItem(DEMO_JOURNEY_STORAGE_KEY);
}

export function saveDemoPreview(
  launch: DemoLaunch,
  storage: Storage = sessionStorage,
  savedAt = new Date().toISOString(),
): DemoEnvelope {
  if (launch.mode !== 'preview') {
    throw new Error('Preview storage requires preview mode.');
  }
  const envelope = envelopeFor(launch, savedAt);
  storage.setItem(DEMO_PREVIEW_SESSION_KEY, JSON.stringify(envelope));
  return envelope;
}

export function loadDemoPreview(storage: Storage = sessionStorage): DemoEnvelope | null {
  const envelope = parseEnvelope(storage.getItem(DEMO_PREVIEW_SESSION_KEY));
  if (!envelope || envelope.mode !== 'preview') return null;
  return envelope;
}

export function clearDemoPreview(storage: Storage = sessionStorage): void {
  storage.removeItem(DEMO_PREVIEW_SESSION_KEY);
}

export function demoJourneyRequested(search: string): boolean {
  return new URLSearchParams(search).get(DEMO_JOURNEY_QUERY) === '1';
}

export function demoJourneyUrl(): string {
  return `/?${DEMO_JOURNEY_QUERY}=1`;
}
