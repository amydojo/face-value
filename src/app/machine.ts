import type {
  AnalysisResult,
  AnalysisScenario,
  CaptureContractOutcome,
  CaptureMetadata,
  EvidenceRecordData,
  FaceValueState,
  ProductPlacement,
  TraceEntry,
} from '../domain/model';
import { PRODUCTS } from '../fixtures/products';

export type FaceValueEvent =
  | { type: 'OPEN_CABINET' }
  | { type: 'PREVIOUS_DRAWER' }
  | { type: 'NEXT_DRAWER' }
  | { type: 'OPEN_DRAWER' }
  | { type: 'ASSIGN_JOB'; job: string }
  | { type: 'BEGIN_CAPTURE'; kind: 'baseline' | 'followup' }
  | { type: 'CONFIRM_CONTRACT'; outcome: CaptureContractOutcome }
  | { type: 'CAMERA_REQUESTED' }
  | { type: 'CAMERA_READY' }
  | { type: 'CAMERA_CAPTURING' }
  | { type: 'CAMERA_FAILED'; reason: 'unsupported' | 'denied' | 'no_camera' | 'overconstrained' | 'unknown' }
  | { type: 'CAPTURE_ACCEPTED'; metadata: CaptureMetadata }
  | { type: 'DELETE_CURRENT_CAPTURE' }
  | { type: 'ADD_TRACE'; trace: TraceEntry }
  | { type: 'INTRODUCE_SECOND_PRODUCT' }
  | { type: 'RESOLVE_DISTURBANCE'; resolution: 'cooling' | 'overlap' }
  | { type: 'SET_SCENARIO'; scenario: AnalysisScenario }
  | { type: 'ANALYSIS_STARTED' }
  | { type: 'ANALYSIS_SUCCEEDED'; result: AnalysisResult }
  | { type: 'ANALYSIS_FAILED' }
  | { type: 'RETAKE_FOLLOWUP' }
  | { type: 'SAVE_CONTEXT_ONLY' }
  | { type: 'ENTER_PROGRESS' }
  | { type: 'SELECT_PLACEMENT'; placement: ProductPlacement }
  | { type: 'SEAL_PLACEMENT' }
  | { type: 'GENERATE_RECORD'; now: string }
  | { type: 'VIEW_ARCHIVE' }
  | { type: 'VIEW_RECORD'; record: EvidenceRecordData }
  | { type: 'RETURN_TO_CABINET' }
  | { type: 'DELETE_OBSERVATION' }
  | { type: 'CLEAR_DEMO_DATA' }
  | { type: 'BACK' };

export const initialState: FaceValueState = {
  stage: 'welcome',
  cabinet: 'closed',
  observation: 'none',
  camera: 'idle',
  comparison: 'not_available',
  confidence: 'insufficient',
  disturbance: 'none',
  placement: 'observation',
  placementSealed: false,
  selectedDrawerIndex: 0,
  selectedSpecimenId: PRODUCTS[0].id,
  assignedJob: null,
  captureKind: 'baseline',
  contractOutcome: null,
  baselineCapture: null,
  followupCapture: null,
  trace: null,
  analysis: null,
  record: null,
  archive: [],
  analysisScenario: 'likely_change',
  announcement: 'Evidence Fridge closed.',
  returnStage: null,
};

const cameraStateForReason = (reason: string): FaceValueState['camera'] => {
  if (reason === 'unsupported') return 'unsupported';
  if (reason === 'denied') return 'denied';
  if (reason === 'no_camera') return 'no_camera';
  if (reason === 'overconstrained') return 'overconstrained';
  return 'error';
};

export function createEvidenceRecord(state: FaceValueState, now: string): EvidenceRecordData {
  if (!state.analysis || !state.assignedJob) throw new Error('Evidence Record requires analysis and job');
  const specimen = PRODUCTS.find((item) => item.id === state.selectedSpecimenId) ?? PRODUCTS[0];
  return {
    id: `ER-${now.replace(/\D/g, '').slice(0, 12)}`,
    specimenId: specimen.id,
    accession: specimen.accession,
    product: specimen.product,
    job: state.assignedJob,
    observationWindow: 'Baseline to follow-up · fixture timeline',
    comparison: state.analysis.comparison,
    finding: state.analysis.finding,
    nonFinding: state.analysis.nonFinding,
    confidence: state.confidence,
    disturbance: state.disturbance,
    finalPlacement: state.placement,
    recommendedAction: state.analysis.recommendedAction,
    claimBoundary: state.analysis.claimBoundary,
    createdAt: now,
    includesFaceImage: false,
  };
}

export function faceValueReducer(state: FaceValueState, event: FaceValueEvent): FaceValueState {
  switch (event.type) {
    case 'OPEN_CABINET':
      if (state.stage !== 'welcome') return state;
      return { ...state, stage: 'cabinet', cabinet: 'open', announcement: 'Evidence Fridge open. Drawer 1 of 3 selected.' };
    case 'PREVIOUS_DRAWER': {
      if (state.stage !== 'cabinet' || state.selectedDrawerIndex === 0) return state;
      const index = state.selectedDrawerIndex - 1;
      return { ...state, selectedDrawerIndex: index, selectedSpecimenId: PRODUCTS[index].id, announcement: `Drawer ${index + 1} of ${PRODUCTS.length} selected.` };
    }
    case 'NEXT_DRAWER': {
      if (state.stage !== 'cabinet' || state.selectedDrawerIndex >= PRODUCTS.length - 1) return state;
      const index = state.selectedDrawerIndex + 1;
      return { ...state, selectedDrawerIndex: index, selectedSpecimenId: PRODUCTS[index].id, announcement: `Drawer ${index + 1} of ${PRODUCTS.length} selected.` };
    }
    case 'OPEN_DRAWER':
      if (state.stage !== 'cabinet') return state;
      return { ...state, stage: 'specimen', announcement: `${PRODUCTS[state.selectedDrawerIndex].accession} drawer open.` };
    case 'ASSIGN_JOB':
      if (state.stage !== 'specimen' && state.stage !== 'job') return state;
      return { ...state, stage: 'job', assignedJob: event.job, observation: 'baseline_pending', announcement: `Product job assigned: ${event.job}.` };
    case 'BEGIN_CAPTURE':
      if (event.kind === 'baseline' && state.stage !== 'job') return state;
      if (event.kind === 'followup' && !['observation', 'analysis_failure', 'comparison_refused'].includes(state.stage)) return state;
      return { ...state, stage: 'capture_contract', captureKind: event.kind, contractOutcome: null, camera: 'idle', announcement: `${event.kind === 'baseline' ? 'Baseline' : 'Follow-up'} Capture Contract opened.` };
    case 'CONFIRM_CONTRACT':
      if (state.stage !== 'capture_contract') return state;
      if (state.captureKind === 'followup' && event.outcome === 'not_comparable') {
        return { ...state, contractOutcome: event.outcome, comparison: 'not_comparable', stage: 'comparison_refused', announcement: 'Comparison refused. Conditions are not suitable for progress comparison.' };
      }
      return { ...state, contractOutcome: event.outcome, stage: 'camera', camera: 'idle', comparison: event.outcome === 'partially_comparable' ? 'partially_comparable' : state.comparison, announcement: 'Ready to request camera or choose a file.' };
    case 'CAMERA_REQUESTED':
      if (state.stage !== 'camera') return state;
      return { ...state, camera: 'requesting', announcement: 'Requesting camera permission.' };
    case 'CAMERA_READY':
      if (state.stage !== 'camera' || state.camera !== 'requesting') return state;
      return { ...state, camera: 'ready', announcement: 'Camera ready.' };
    case 'CAMERA_CAPTURING':
      if (state.stage !== 'camera' || state.camera !== 'ready') return state;
      return { ...state, camera: 'capturing', announcement: 'Capturing current frame.' };
    case 'CAMERA_FAILED':
      if (state.stage !== 'camera') return state;
      return { ...state, camera: cameraStateForReason(event.reason), announcement: 'Camera unavailable. File capture remains available.' };
    case 'CAPTURE_ACCEPTED':
      if (state.stage !== 'camera' || event.metadata.kind !== state.captureKind) return state;
      if (event.metadata.kind === 'baseline') {
        return { ...state, stage: 'observation', camera: 'captured', baselineCapture: event.metadata, observation: 'active_stable', comparison: 'not_available', confidence: 'insufficient', announcement: 'Baseline saved in memory. Stable observation active.' };
      }
      return { ...state, stage: 'analysis', camera: 'captured', followupCapture: event.metadata, observation: 'review_due', announcement: 'Follow-up captured. Simulated optical comparison is ready.' };
    case 'DELETE_CURRENT_CAPTURE':
      if (state.stage !== 'camera') return state;
      if (state.captureKind === 'baseline') return { ...state, baselineCapture: null, camera: 'idle', announcement: 'Current baseline capture deleted.' };
      return { ...state, followupCapture: null, camera: 'idle', announcement: 'Current follow-up capture deleted.' };
    case 'ADD_TRACE':
      if (state.stage !== 'observation' || state.observation !== 'active_stable') return state;
      return { ...state, trace: event.trace, announcement: 'Trace added to the observation rail.' };
    case 'INTRODUCE_SECOND_PRODUCT':
      if (state.stage !== 'observation' || !state.trace) return state;
      return { ...state, stage: 'disturbance', observation: 'active_disturbed', disturbance: 'detected', comparison: 'partially_comparable', confidence: 'possible', announcement: 'Two products are active in the current observation window. Attribution confidence is reduced.' };
    case 'RESOLVE_DISTURBANCE':
      if (state.stage !== 'disturbance') return state;
      if (event.resolution === 'cooling') {
        return { ...state, stage: 'observation', observation: 'active_stable', disturbance: 'returned_to_cooling', comparison: 'not_available', confidence: 'insufficient', announcement: 'Second product returned to Cooling. Stable attribution restored.' };
      }
      return { ...state, stage: 'observation', observation: 'active_disturbed', disturbance: 'overlap_retained', comparison: 'partially_comparable', confidence: 'possible', analysisScenario: 'overlap_reduced', announcement: 'Lower confidence retained for the remainder of this observation.' };
    case 'SET_SCENARIO':
      return { ...state, analysisScenario: event.scenario };
    case 'ANALYSIS_STARTED':
      if (state.stage !== 'analysis') return state;
      return { ...state, announcement: 'Simulated optical comparison running.' };
    case 'ANALYSIS_SUCCEEDED': {
      if (state.stage !== 'analysis') return state;
      const confidence = state.disturbance === 'overlap_retained' ? 'possible' : event.result.confidence;
      if (event.result.comparison === 'not_comparable') {
        return { ...state, stage: 'comparison_refused', analysis: event.result, comparison: 'not_comparable', confidence: 'insufficient', announcement: 'Comparison refused. No progress conclusion was generated.' };
      }
      return { ...state, analysis: event.result, comparison: event.result.comparison, confidence, observation: 'review_due', announcement: state.disturbance === 'overlap_retained' ? 'Finding ready with lower confidence retained.' : 'Finding ready for Progress Mode.' };
    }
    case 'ANALYSIS_FAILED':
      if (state.stage !== 'analysis') return state;
      return { ...state, stage: 'analysis_failure', analysis: null, observation: 'waiting', confidence: 'insufficient', announcement: 'Optical analysis unavailable. Observation remains saved and no finding was fabricated.' };
    case 'RETAKE_FOLLOWUP':
      if (!['analysis_failure', 'comparison_refused'].includes(state.stage)) return state;
      return { ...state, stage: 'capture_contract', captureKind: 'followup', followupCapture: null, analysis: null, comparison: 'not_available', announcement: 'Follow-up retake opened.' };
    case 'SAVE_CONTEXT_ONLY':
      if (state.stage !== 'comparison_refused') return state;
      return { ...state, stage: 'observation', observation: 'waiting', announcement: 'Capture saved as context only. No progress conclusion was added.' };
    case 'ENTER_PROGRESS':
      if (state.stage !== 'analysis' || !state.analysis || state.analysis.comparison === 'not_comparable') return state;
      return { ...state, stage: 'progress', announcement: `Progress Mode. ${state.analysis.finding} Confidence: ${state.confidence}.` };
    case 'SELECT_PLACEMENT':
      if (state.stage !== 'progress' && state.stage !== 'placement') return state;
      return { ...state, stage: 'placement', placement: event.placement, placementSealed: false, announcement: `Placement selected: ${event.placement}.` };
    case 'SEAL_PLACEMENT':
      if (state.stage !== 'placement' || !state.analysis) return state;
      return {
        ...state,
        observation: 'complete',
        placementSealed: true,
        announcement: `Final placement sealed: ${state.placement}.`,
      };
    case 'GENERATE_RECORD': {
      if (state.stage !== 'placement' || !state.analysis || !state.placementSealed) return state;
      const record = createEvidenceRecord(state, event.now);
      return {
        ...state,
        stage: 'record',
        record,
        archive: [record, ...state.archive],
        announcement: 'Evidence Record generated without a face image.',
      };
    }
    case 'VIEW_ARCHIVE':
      return { ...state, returnStage: state.stage, stage: 'archive', announcement: `${state.archive.length} Evidence Record${state.archive.length === 1 ? '' : 's'} in archive.` };
    case 'VIEW_RECORD':
      return { ...state, returnStage: 'archive', stage: 'record', record: event.record, announcement: `Evidence Record ${event.record.id} opened.` };
    case 'RETURN_TO_CABINET':
      return { ...state, stage: 'cabinet', cabinet: 'open', returnStage: null, announcement: 'Returned to the Evidence Fridge.' };
    case 'DELETE_OBSERVATION':
      return { ...initialState, stage: 'cabinet', cabinet: 'open', archive: state.archive, announcement: 'Current observation deleted. Raw images were already memory-only.' };
    case 'CLEAR_DEMO_DATA':
      return { ...initialState, stage: 'welcome', announcement: 'Demo data cleared.' };
    case 'BACK':
      if (state.stage === 'progress') return { ...state, stage: 'analysis', announcement: 'Returned to comparison review.' };
      if (state.stage === 'archive') return { ...state, stage: state.returnStage ?? 'cabinet', returnStage: null, announcement: 'Returned to previous view.' };
      if (state.stage === 'record') return { ...state, stage: state.returnStage ?? 'cabinet', returnStage: null, announcement: 'Record closed.' };
      if (['camera', 'capture_contract'].includes(state.stage)) return { ...state, stage: state.captureKind === 'baseline' ? 'job' : 'observation', camera: 'idle', announcement: 'Capture closed.' };
      return state;
    default:
      return state;
  }
}
