import type { AnalysisProtocol } from '../adapters/analysis/youcam/contracts';
import type { ObservationWindowDays, RednessEvaluationSnapshot } from './evidence/redness/types';
import type { OracleRevealState } from './oracleRevealMachine';

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
  'not_available' | 'comparable' | 'partially_comparable' | 'not_comparable';
export type EvidenceConfidence = 'insufficient' | 'possible' | 'likely' | 'confirmed';
export type AnalysisProcessingState = 'idle' | 'running' | 'succeeded' | 'failed';
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
export type DisturbanceState = 'none' | 'detected' | 'returned_to_cooling' | 'overlap_retained';
export type CaptureKind = 'baseline' | 'followup';
export type SupportedAssignedJob = 'Reduce visible redness';
export type RegisteredProductProtocolId = 'youcam-redness-v1';
export type CaptureContractOutcome =
  'ready' | 'comparable' | 'partially_comparable' | 'not_comparable' | 'context_only';
export type AppStage =
  | 'welcome'
  | 'product_registration'
  | 'cabinet'
  | 'browse'
  | 'specimen'
  | 'job'
  | 'capture_contract'
  | 'camera'
  | 'baseline_context'
  | 'baseline_locked'
  | 'waiting_for_followup'
  | 'followup_ready'
  | 'followup_context'
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

export interface RegisteredProduct {
  id: string;
  accession: string;
  brand: string;
  productName: string;
  strength: string | null;
  volume: string | null;
  assignedJob: SupportedAssignedJob;
  protocolId: RegisteredProductProtocolId;
  expectedObservationWindowDays?: ObservationWindowDays;
  createdAt: string;
}

export interface CaptureContext {
  makeup: boolean;
  recentHeatOrExercise: boolean;
  recentCleansingOrSkincare: boolean;
  routineOrTreatmentChange: boolean;
  note: string | null;
}

export type CameraCaptureProfileId =
  | 'native-browser-camera-v1'
  | 'youcam-camera-kit-standard-720p'
  | 'youcam-camera-kit-hd-1080p'
  | 'youcam-camera-kit-hd-1920p';

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
  cameraProfileId?: CameraCaptureProfileId | null;
}

export interface DurableSkinSignal {
  provider: 'youcam';
  apiVersion: '2.1';
  mode: 'hd';
  concern: 'hd_redness';
  region: null;
  scoreType: 'raw_score';
  captureProtocolVersion: 'face-value-youcam-1';
  rawScore: number;
  capturedAt: string;
  captureQuality: 'accepted';
}

export interface RednessComparison {
  baselineRawScore: number;
  followUpRawScore: number;
  delta: number;
  direction: 'favorable' | 'unfavorable' | 'unchanged';
  calibration: 'pending' | 'prototype_calibrated' | 'provisional_fixture';
  confidence: 'possible' | 'likely' | 'insufficient';
  limitations: string[];
}

export interface LongitudinalSkinEvidence {
  protocol: AnalysisProtocol | null;
  baseline: DurableSkinSignal | null;
  followUp: DurableSkinSignal | null;
  comparison: RednessComparison | null;
  evaluation?: RednessEvaluationSnapshot | null;
}

export interface AnalysisErrorState {
  role: CaptureKind;
  code: string;
  message: string;
  retryable: boolean;
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
  simulated: boolean;
  provider?: 'fixture' | 'youcam';
  baselineRawScore?: number;
  followUpRawScore?: number;
  delta?: number;
  direction?: RednessComparison['direction'];
  limitations?: string[];
  rednessEvaluation?: RednessEvaluationSnapshot;
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
  note?: string | null;
  baselineCapture?: CaptureMetadata | null;
  followupCapture?: CaptureMetadata | null;
  evidenceSource?: 'YouCam Skin Analysis v2.1';
  comparisonDirection?: RednessComparison['direction'];
  limitations?: string[];
  baselineRawScore?: number;
  followUpRawScore?: number;
  productBrand?: string;
  productStrength?: string | null;
  productVolume?: string | null;
  baselineContext?: CaptureContext | null;
  followUpContext?: CaptureContext | null;
  demoOriginated?: boolean;
  rednessEvaluation?: RednessEvaluationSnapshot;
}

export interface FaceValueState {
  stage: AppStage;
  cabinet: CabinetState;
  observation: ObservationState;
  camera: CameraState;
  comparison: ComparisonState;
  confidence: EvidenceConfidence;
  processing: AnalysisProcessingState;
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
  longitudinalEvidence?: LongitudinalSkinEvidence;
  analysisRole?: CaptureKind | null;
  activeAnalysisRequestId?: string | null;
  pendingAnalysisCapture?: CaptureMetadata | null;
  analysisError?: AnalysisErrorState | null;
  registeredProduct?: RegisteredProduct | null;
  baselineLockedAt?: string | null;
  followUpEligibleAt?: string | null;
  baselineContext?: CaptureContext | null;
  followUpContext?: CaptureContext | null;
  demoTimelineAdvanced?: boolean;
  resultRevealed?: boolean;
  oracleRevealState?: OracleRevealState;
  oracleEvidenceDispensed?: boolean;
  oracleCollectionStarted?: boolean;
  oracleCommittedAt?: string | null;
}

export type AnalysisScenario =
  'no_change' | 'likely_change' | 'partial' | 'not_comparable' | 'failure' | 'overlap_reduced';
