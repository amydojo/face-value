export type CabinetState = 'closed' | 'opening' | 'open' | 'closing';
export type ObservationState =
  | 'none'
  | 'baseline_pending'
  | 'baseline'
  | 'active_stable'
  | 'active_disturbed'
  | 'waiting'
  | 'review_due'
  | 'complete';
export type CameraState =
  | 'idle'
  | 'unsupported'
  | 'requesting'
  | 'ready'
  | 'capturing'
  | 'captured'
  | 'denied'
  | 'no_camera'
  | 'overconstrained'
  | 'error';
export type ComparisonState =
  | 'not_available'
  | 'comparable'
  | 'partially_comparable'
  | 'not_comparable';
export type EvidenceConfidence = 'insufficient' | 'possible' | 'likely' | 'confirmed';
export type ProductPlacement =
  | 'established'
  | 'observation'
  | 'cooling'
  | 'paused'
  | 'useful_elsewhere'
  | 'unclear'
  | 'retry_alone'
  | 'released';
export type RecommendedAction =
  | 'keep'
  | 'pause'
  | 'wait'
  | 'reassess'
  | 'return_to_cooling'
  | 'continue_with_overlap'
  | 'seek_professional_guidance';
export type DisturbanceState =
  | 'none'
  | 'detected'
  | 'returned_to_cooling'
  | 'overlap_retained';
export type CaptureKind = 'baseline' | 'followup';
export type CaptureContractOutcome =
  | 'ready'
  | 'comparable'
  | 'partially_comparable'
  | 'not_comparable'
  | 'context_only';
export type AppStage =
  | 'welcome'
  | 'cabinet'
  | 'specimen'
  | 'job'
  | 'capture_contract'
  | 'camera'
  | 'observation'
  | 'disturbance'
  | 'analysis'
  | 'analysis_failure'
  | 'comparison_refused'
  | 'progress'
  | 'placement'
  | 'record'
  | 'archive';

export interface Specimen {
  id: string;
  accession: string;
  brand: string;
  product: string;
  volume: string;
  shelf: ProductPlacement;
  jobOptions: string[];
}

export interface TraceEntry {
  id: string;
  label: string;
  detail: string;
  observedAt: string;
}

export interface CaptureMetadata {
  id: string;
  kind: CaptureKind;
  source: 'camera' | 'file';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/unknown';
  createdAt: string;
  orientationRule: 'analysis-unmirrored';
}

export interface AnalysisResult {
  captureQuality: 'accepted' | 'context_only' | 'rejected';
  comparison: ComparisonState;
  visibleSignal: string;
  confidence: EvidenceConfidence;
  finding: string;
  nonFinding: string;
  relevantContext: string;
  recommendedAction: RecommendedAction;
  claimBoundary: string;
  simulated: true;
}

export interface EvidenceRecordData {
  id: string;
  specimenId: string;
  accession: string;
  product: string;
  job: string;
  observationWindow: string;
  comparison: ComparisonState;
  finding: string;
  nonFinding: string;
  confidence: EvidenceConfidence;
  disturbance: DisturbanceState;
  finalPlacement: ProductPlacement;
  recommendedAction: RecommendedAction;
  claimBoundary: string;
  createdAt: string;
  includesFaceImage: false;
}

export interface FaceValueState {
  stage: AppStage;
  cabinet: CabinetState;
  observation: ObservationState;
  camera: CameraState;
  comparison: ComparisonState;
  confidence: EvidenceConfidence;
  disturbance: DisturbanceState;
  placement: ProductPlacement;
  placementSealed: boolean;
  selectedDrawerIndex: number;
  selectedSpecimenId: string;
  assignedJob: string | null;
  captureKind: CaptureKind;
  contractOutcome: CaptureContractOutcome | null;
  baselineCapture: CaptureMetadata | null;
  followupCapture: CaptureMetadata | null;
  trace: TraceEntry | null;
  analysis: AnalysisResult | null;
  record: EvidenceRecordData | null;
  archive: EvidenceRecordData[];
  analysisScenario: AnalysisScenario;
  announcement: string;
  returnStage: AppStage | null;
}

export type AnalysisScenario =
  | 'no_change'
  | 'likely_change'
  | 'partial'
  | 'not_comparable'
  | 'failure'
  | 'overlap_reduced';
