import type {
  AnalysisResult,
  ComparisonState,
  DisturbanceState,
  EvidenceConfidence,
  EvidenceRecordData,
  FaceValueState,
  ObservationState,
  ProductPlacement,
  TraceEntry,
} from '../../domain/model';

export const STORAGE_KEY = 'face-value:structured-demo:v1';

export interface PersistedDemoData {
  selectedDrawerIndex: number;
  selectedSpecimenId: string;
  assignedJob: string | null;
  observation: ObservationState;
  placement: ProductPlacement;
  placementSealed: boolean;
  comparison: ComparisonState;
  confidence: EvidenceConfidence;
  disturbance: DisturbanceState;
  trace: TraceEntry | null;
  analysis: AnalysisResult | null;
  record: EvidenceRecordData | null;
  archive: EvidenceRecordData[];
}

const placements = new Set<ProductPlacement>([
  'established',
  'observation',
  'cooling',
  'paused',
  'useful_elsewhere',
  'unclear',
  'retry_alone',
  'released',
]);
const observations = new Set<ObservationState>([
  'none',
  'baseline_pending',
  'baseline',
  'active_stable',
  'active_disturbed',
  'waiting',
  'review_due',
  'complete',
]);
const comparisons = new Set<ComparisonState>([
  'not_available',
  'comparable',
  'partially_comparable',
  'not_comparable',
]);
const confidenceStates = new Set<EvidenceConfidence>([
  'insufficient',
  'possible',
  'likely',
  'confirmed',
]);
const disturbanceStates = new Set<DisturbanceState>([
  'none',
  'detected',
  'returned_to_cooling',
  'overlap_retained',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTrace = (value: unknown): value is TraceEntry =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.detail === 'string' &&
  typeof value.observedAt === 'string';

const isEvidenceRecord = (value: unknown): value is EvidenceRecordData =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.specimenId === 'string' &&
  typeof value.accession === 'string' &&
  typeof value.product === 'string' &&
  typeof value.job === 'string' &&
  typeof value.finding === 'string' &&
  value.includesFaceImage === false;

const isAnalysisResult = (value: unknown): value is AnalysisResult =>
  isObject(value) &&
  typeof value.finding === 'string' &&
  typeof value.nonFinding === 'string' &&
  typeof value.claimBoundary === 'string' &&
  value.simulated === true;

export function toPersistedDemoData(state: FaceValueState): PersistedDemoData {
  return {
    selectedDrawerIndex: state.selectedDrawerIndex,
    selectedSpecimenId: state.selectedSpecimenId,
    assignedJob: state.assignedJob,
    observation: state.observation,
    placement: state.placement,
    placementSealed: state.placementSealed,
    comparison: state.comparison,
    confidence: state.confidence,
    disturbance: state.disturbance,
    trace: state.trace,
    analysis: state.analysis,
    record: state.record,
    archive: state.archive,
  };
}

export function saveStructuredDemoData(
  state: FaceValueState,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(toPersistedDemoData(state)));
}

export function loadStructuredDemoData(
  storage: Storage = localStorage,
): PersistedDemoData | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isObject(value)) throw new Error('Invalid persisted data');

    const archive = value.archive;
    const assignedJob = value.assignedJob;
    const trace = value.trace;
    const analysis = value.analysis;
    const record = value.record;

    if (
      typeof value.selectedDrawerIndex !== 'number' ||
      !Number.isInteger(value.selectedDrawerIndex) ||
      value.selectedDrawerIndex < 0 ||
      typeof value.selectedSpecimenId !== 'string' ||
      !(typeof assignedJob === 'string' || assignedJob === null) ||
      !observations.has(value.observation as ObservationState) ||
      !placements.has(value.placement as ProductPlacement) ||
      typeof value.placementSealed !== 'boolean' ||
      !comparisons.has(value.comparison as ComparisonState) ||
      !confidenceStates.has(value.confidence as EvidenceConfidence) ||
      !disturbanceStates.has(value.disturbance as DisturbanceState) ||
      !(trace === null || isTrace(trace)) ||
      !(analysis === null || isAnalysisResult(analysis)) ||
      !(record === null || isEvidenceRecord(record)) ||
      !Array.isArray(archive) ||
      !archive.every(isEvidenceRecord)
    ) {
      throw new Error('Invalid persisted data');
    }

    return value as unknown as PersistedDemoData;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearStructuredDemoData(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
