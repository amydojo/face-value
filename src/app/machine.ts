import type {
  AnalysisResult,
  AnalysisScenario,
  AppStage,
  CaptureContractOutcome,
  CaptureMetadata,
  EvidenceRecordData,
  FaceValueState,
  ProductPlacement,
  TraceEntry,
} from '../domain/model';
import { PRODUCTS } from '../fixtures/products';

/*
 * Original MVP event keys and several evidence-domain fields remain internal for
 * persisted-state compatibility. Presentation code translates them into the
 * Human Butter language contract: trial, note, scan, result, next step, and
 * saved result.
 */
export type FaceValueEvent =
  | { type: 'OPEN_CABINET' }
  | { type: 'BROWSE_DRAWERS' }
  | { type: 'OPEN_REVIEW_DUE' }
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
  | { type: 'SAVE_RESULT'; now: string }
  | { type: 'OPEN_SAVED_RESULT' }
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
  processing: 'idle',
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
  announcement: 'Face Value is ready.',
  returnStage: null,
};

const cameraStateForReason = (reason: string): FaceValueState['camera'] => {
  if (reason === 'unsupported') return 'unsupported';
  if (reason === 'denied') return 'denied';
  if (reason === 'no_camera') return 'no_camera';
  if (reason === 'overconstrained') return 'overconstrained';
  return 'error';
};

const isFollowupCaptureAllowed = (state: FaceValueState): boolean =>
  ['observation', 'analysis_failure', 'comparison_refused'].includes(state.stage) ||
  (state.stage === 'cabinet' && ['active_stable', 'active_disturbed', 'waiting', 'review_due'].includes(state.observation));

const enforceOverlapBoundary = (state: FaceValueState, result: AnalysisResult): AnalysisResult => {
  if (state.disturbance !== 'overlap_retained' || result.comparison === 'not_comparable') return result;
  return {
    ...result,
    comparison: 'partially_comparable',
    confidence: 'possible',
    relevantContext: result.relevantContext.includes('overlap')
      ? result.relevantContext
      : `${result.relevantContext} A second active product overlapped the trial window.`,
    recommendedAction: 'continue_with_overlap',
  };
};

export function createEvidenceRecord(state: FaceValueState, now: string): EvidenceRecordData {
  if (!state.analysis || !state.assignedJob) throw new Error('Saved result requires analysis and job');
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
    note: state.trace?.detail ?? null,
    baselineCapture: state.baselineCapture,
    followupCapture: state.followupCapture,
  };
}

function returnToStage(state: FaceValueState, stage: AppStage, announcement: string): FaceValueState {
  return { ...state, stage, returnStage: null, camera: 'idle', announcement };
}

export function faceValueReducer(state: FaceValueState, event: FaceValueEvent): FaceValueState {
  switch (event.type) {
    case 'OPEN_CABINET':
      if (state.stage !== 'welcome') return state;
      return {
        ...state,
        stage: 'cabinet',
        cabinet: 'open',
        announcement: `Your trials are open. Trial ${state.selectedDrawerIndex + 1} of ${PRODUCTS.length} is selected.`,
      };

    case 'BROWSE_DRAWERS':
      if (state.stage !== 'cabinet') return state;
      return {
        ...state,
        stage: 'browse',
        announcement: `Trial ${state.selectedDrawerIndex + 1} of ${PRODUCTS.length} selected.`,
      };

    case 'OPEN_REVIEW_DUE':
      if (state.stage !== 'cabinet' || state.observation !== 'review_due') return state;
      if (state.analysis && state.analysis.comparison !== 'not_comparable') {
        return {
          ...state,
          stage: 'progress',
          announcement: `Result restored. ${state.analysis.finding} Confidence: ${state.confidence}.`,
        };
      }
      if (state.followupCapture) {
        return {
          ...state,
          stage: 'analysis',
          processing: 'idle',
          announcement: 'Follow-up scan restored. Comparison will begin automatically.',
        };
      }
      return state;

    case 'PREVIOUS_DRAWER': {
      if (state.stage !== 'browse' || state.selectedDrawerIndex === 0) return state;
      const index = state.selectedDrawerIndex - 1;
      return {
        ...state,
        selectedDrawerIndex: index,
        selectedSpecimenId: PRODUCTS[index].id,
        assignedJob: null,
        announcement: `Trial ${index + 1} of ${PRODUCTS.length} selected.`,
      };
    }

    case 'NEXT_DRAWER': {
      if (state.stage !== 'browse' || state.selectedDrawerIndex >= PRODUCTS.length - 1) return state;
      const index = state.selectedDrawerIndex + 1;
      return {
        ...state,
        selectedDrawerIndex: index,
        selectedSpecimenId: PRODUCTS[index].id,
        assignedJob: null,
        announcement: `Trial ${index + 1} of ${PRODUCTS.length} selected.`,
      };
    }

    case 'OPEN_DRAWER':
      if (state.stage === 'cabinet' && state.assignedJob && ['active_stable', 'active_disturbed', 'waiting'].includes(state.observation)) {
        return {
          ...state,
          stage: 'observation',
          announcement: `Trial in progress for ${PRODUCTS[state.selectedDrawerIndex].product}.`,
        };
      }
      if (state.stage !== 'browse') return state;
      return {
        ...state,
        stage: 'specimen',
        announcement: `Viewing trial for ${PRODUCTS[state.selectedDrawerIndex].product}.`,
      };

    case 'ASSIGN_JOB':
      if (state.stage !== 'specimen' && state.stage !== 'job') return state;
      return {
        ...state,
        stage: 'job',
        assignedJob: event.job,
        observation: 'baseline_pending',
        announcement: `Trial job assigned: ${event.job}.`,
      };

    case 'BEGIN_CAPTURE':
      if (event.kind === 'baseline' && state.stage !== 'job') return state;
      if (event.kind === 'followup' && !isFollowupCaptureAllowed(state)) return state;
      return {
        ...state,
        stage: 'capture_contract',
        captureKind: event.kind,
        contractOutcome: null,
        camera: 'idle',
        returnStage: state.stage,
        announcement: `${event.kind === 'baseline' ? 'Baseline' : 'Follow-up'} scan conditions opened.`,
      };

    case 'CONFIRM_CONTRACT':
      if (state.stage !== 'capture_contract') return state;
      if (state.captureKind === 'followup' && event.outcome === 'not_comparable') {
        return {
          ...state,
          contractOutcome: event.outcome,
          comparison: 'not_comparable',
          stage: 'comparison_refused',
          announcement: 'These scans are not fair to compare. Nothing was concluded from them.',
        };
      }
      return {
        ...state,
        contractOutcome: event.outcome,
        stage: 'camera',
        camera: 'idle',
        comparison: event.outcome === 'partially_comparable' ? 'partially_comparable' : state.comparison,
        announcement: 'Scan ready. Request camera access or choose a file.',
      };

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
      return {
        ...state,
        camera: cameraStateForReason(event.reason),
        announcement: 'Camera unavailable. File capture remains available.',
      };

    case 'CAPTURE_ACCEPTED':
      if (state.stage !== 'camera' || event.metadata.kind !== state.captureKind) return state;
      if (event.metadata.kind === 'baseline') {
        return {
          ...state,
          stage: 'observation',
          camera: 'captured',
          baselineCapture: event.metadata,
          observation: 'active_stable',
          comparison: 'not_available',
          confidence: 'insufficient',
          returnStage: null,
          processing: 'idle',
          announcement: 'Baseline scan saved. Trial in progress.',
        };
      }
      return {
        ...state,
        stage: 'analysis',
        camera: 'captured',
        followupCapture: event.metadata,
        observation: 'review_due',
        returnStage: null,
        processing: 'idle',
        analysis: null,
        announcement: 'Follow-up scan saved. Comparing automatically.',
      };

    case 'DELETE_CURRENT_CAPTURE':
      if (state.stage !== 'camera') return state;
      return state.captureKind === 'baseline'
        ? { ...state, baselineCapture: null, camera: 'idle', announcement: 'Current baseline scan deleted.' }
        : { ...state, followupCapture: null, camera: 'idle', announcement: 'Current follow-up scan deleted.' };

    case 'ADD_TRACE':
      if (state.stage !== 'observation' || !['active_stable', 'active_disturbed'].includes(state.observation)) return state;
      return { ...state, trace: event.trace, announcement: 'Note saved.' };

    case 'INTRODUCE_SECOND_PRODUCT':
      if (state.stage !== 'observation') return state;
      return {
        ...state,
        stage: 'disturbance',
        observation: 'active_disturbed',
        disturbance: 'detected',
        comparison: 'partially_comparable',
        confidence: 'possible',
        announcement: 'Another product was used during this trial.',
      };

    case 'RESOLVE_DISTURBANCE':
      if (state.stage !== 'disturbance') return state;
      if (event.resolution === 'cooling') {
        return {
          ...state,
          stage: 'observation',
          observation: 'active_stable',
          disturbance: 'returned_to_cooling',
          comparison: 'not_available',
          confidence: 'insufficient',
          announcement: 'The second product was removed. This trial can stay focused.',
        };
      }
      return {
        ...state,
        stage: 'observation',
        observation: 'active_disturbed',
        disturbance: 'overlap_retained',
        comparison: 'partially_comparable',
        confidence: 'possible',
        analysisScenario: 'overlap_reduced',
        announcement: 'Both products remain in the trial. The result will be less certain.',
      };

    case 'SET_SCENARIO':
      if (!['observation', 'analysis'].includes(state.stage)) return state;
      return { ...state, analysisScenario: event.scenario };

    case 'ANALYSIS_STARTED':
      if (state.stage !== 'analysis' || state.analysis || state.processing === 'running') return state;
      return { ...state, processing: 'running', announcement: 'Comparing your scans.' };

    case 'ANALYSIS_SUCCEEDED': {
      if (state.stage !== 'analysis') return state;
      const result = enforceOverlapBoundary(state, event.result);
      if (result.comparison === 'not_comparable') {
        return {
          ...state,
          stage: 'comparison_refused',
          analysis: result,
          comparison: 'not_comparable',
          confidence: 'insufficient',
          processing: 'succeeded',
          announcement: 'These scans are not fair to compare. Nothing was concluded from them.',
        };
      }
      return {
        ...state,
        analysis: result,
        comparison: result.comparison,
        confidence: result.confidence,
        observation: 'review_due',
        processing: 'succeeded',
        announcement: state.disturbance === 'overlap_retained'
          ? 'Result ready. The result will be less certain because two products shared the trial.'
          : 'Result ready. Pull the handle to reveal it.',
      };
    }

    case 'ANALYSIS_FAILED':
      if (state.stage !== 'analysis') return state;
      return {
        ...state,
        stage: 'analysis_failure',
        analysis: null,
        observation: 'waiting',
        confidence: state.disturbance === 'overlap_retained' ? 'possible' : 'insufficient',
        processing: 'failed',
        announcement: 'Comparison unavailable. The trial is still saved and nothing was fabricated.',
      };

    case 'RETAKE_FOLLOWUP':
      if (!['analysis_failure', 'comparison_refused'].includes(state.stage)) return state;
      return {
        ...state,
        stage: 'capture_contract',
        captureKind: 'followup',
        followupCapture: null,
        analysis: null,
        processing: 'idle',
        comparison: state.disturbance === 'overlap_retained' ? 'partially_comparable' : 'not_available',
        confidence: state.disturbance === 'overlap_retained' ? 'possible' : 'insufficient',
        returnStage: 'observation',
        announcement: 'Follow-up scan retake opened.',
      };

    case 'SAVE_CONTEXT_ONLY':
      if (state.stage !== 'comparison_refused') return state;
      return {
        ...state,
        stage: 'observation',
        observation: 'waiting',
        announcement: 'Saved as context only. No result was added.',
      };

    case 'ENTER_PROGRESS':
      if (state.stage !== 'analysis' || !state.analysis || state.analysis.comparison === 'not_comparable') return state;
      return {
        ...state,
        stage: 'progress',
        announcement: `Result. ${state.analysis.finding} Confidence: ${state.confidence}.`,
      };

    case 'SELECT_PLACEMENT':
      if (state.stage !== 'progress' && state.stage !== 'placement') return state;
      if (state.stage === 'placement' && state.placementSealed) return state;
      return {
        ...state,
        stage: 'placement',
        placement: event.placement,
        placementSealed: false,
        announcement: `Next step selected: ${event.placement.replaceAll('_', ' ')}.`,
      };

    case 'SAVE_RESULT': {
      if (state.stage !== 'placement' || !state.analysis || state.placementSealed) return state;
      const record = createEvidenceRecord(state, event.now);
      const archive = state.archive.some((item) => item.id === record.id)
        ? state.archive
        : [record, ...state.archive];
      return {
        ...state,
        observation: 'complete',
        placementSealed: true,
        record,
        archive,
        returnStage: 'cabinet',
        announcement: 'Saved to your evidence. Trial conditions, scans, note, confidence, and next step were preserved.',
      };
    }

    case 'OPEN_SAVED_RESULT':
      if (state.stage !== 'placement' || !state.placementSealed || !state.record) return state;
      return {
        ...state,
        stage: 'record',
        returnStage: 'cabinet',
        announcement: `Saved result ${state.record.id} opened.`,
      };

    case 'SEAL_PLACEMENT':
      if (state.stage !== 'placement' || !state.analysis || state.placementSealed) return state;
      return {
        ...state,
        observation: 'complete',
        placementSealed: true,
        announcement: `Next step committed: ${state.placement.replaceAll('_', ' ')}.`,
      };

    case 'GENERATE_RECORD': {
      if (state.stage !== 'placement' || !state.analysis || !state.placementSealed) return state;
      if (state.record && state.archive.some((item) => item.id === state.record?.id)) {
        return { ...state, stage: 'record', returnStage: 'cabinet' };
      }
      const record = createEvidenceRecord(state, event.now);
      const archive = state.archive.some((item) => item.id === record.id)
        ? state.archive
        : [record, ...state.archive];
      return {
        ...state,
        stage: 'record',
        record,
        archive,
        returnStage: 'cabinet',
        announcement: 'Saved result opened.',
      };
    }

    case 'VIEW_ARCHIVE':
      if (state.stage === 'archive') return state;
      return {
        ...state,
        returnStage: state.stage,
        stage: 'archive',
        announcement: `${state.archive.length} past result${state.archive.length === 1 ? '' : 's'}.`,
      };

    case 'VIEW_RECORD':
      if (state.stage !== 'archive') return state;
      return {
        ...state,
        returnStage: 'archive',
        stage: 'record',
        record: event.record,
        announcement: `Saved result ${event.record.id} opened.`,
      };

    case 'RETURN_TO_CABINET':
      return {
        ...state,
        stage: 'cabinet',
        cabinet: 'open',
        returnStage: null,
        announcement: 'Returned to Your trials.',
      };

    case 'DELETE_OBSERVATION':
      return {
        ...initialState,
        stage: 'cabinet',
        cabinet: 'open',
        archive: state.archive,
        announcement: 'Current trial deleted. Raw images were already memory-only.',
      };

    case 'CLEAR_DEMO_DATA':
      return { ...initialState, stage: 'welcome', announcement: 'Demo data cleared.' };

    case 'BACK':
      if (state.stage === 'browse') return returnToStage(state, 'cabinet', 'Returned to Your trials.');
      if (state.stage === 'specimen' || state.stage === 'job') return returnToStage(state, 'browse', 'Returned to trial selection.');
      if (state.stage === 'progress') return returnToStage(state, 'analysis', 'Returned to result-ready view.');
      if (state.stage === 'analysis') return returnToStage(state, 'observation', 'Returned to trial in progress.');
      if (state.stage === 'placement' && !state.placementSealed) return returnToStage(state, 'progress', 'Returned to result.');
      if (state.stage === 'archive') return returnToStage(state, state.returnStage ?? 'cabinet', 'Returned to previous view.');
      if (state.stage === 'record') return returnToStage(state, state.returnStage ?? 'cabinet', 'Saved result closed.');
      if (state.stage === 'camera' || state.stage === 'capture_contract') {
        return returnToStage(
          state,
          state.returnStage ?? (state.captureKind === 'baseline' ? 'job' : 'observation'),
          'Scan closed.',
        );
      }
      return state;

    default:
      return state;
  }
}
