import type { EvidenceRecordData, FaceValueState } from '../../domain/model';

export const STORAGE_KEY = 'face-value:structured-demo:v1';

export interface PersistedDemoData {
  assignedJob: string | null;
  placement: FaceValueState['placement'];
  placementSealed: boolean;
  comparison: FaceValueState['comparison'];
  confidence: FaceValueState['confidence'];
  disturbance: FaceValueState['disturbance'];
  trace: FaceValueState['trace'];
  archive: EvidenceRecordData[];
}

export function toPersistedDemoData(state: FaceValueState): PersistedDemoData {
  return {
    assignedJob: state.assignedJob,
    placement: state.placement,
    placementSealed: state.placementSealed,
    comparison: state.comparison,
    confidence: state.confidence,
    disturbance: state.disturbance,
    trace: state.trace,
    archive: state.archive,
  };
}

export function saveStructuredDemoData(state: FaceValueState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(toPersistedDemoData(state)));
}

export function loadStructuredDemoData(storage: Storage = localStorage): PersistedDemoData | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedDemoData;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearStructuredDemoData(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
