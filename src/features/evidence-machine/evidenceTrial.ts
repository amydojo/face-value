import type { AnalysisResult, CaptureMetadata, ProductPlacement, Specimen } from '../../domain/model';

export type TrialPhase =
  | 'empty'
  | 'registering'
  | 'registered'
  | 'job-selection'
  | 'job-assigned'
  | 'baseline-required'
  | 'baseline-capturing'
  | 'baseline-recorded'
  | 'trial-active'
  | 'follow-up-required'
  | 'follow-up-capturing'
  | 'processing'
  | 'processing-error'
  | 'verdict-ready'
  | 'verdict-revealing'
  | 'verdict-revealed'
  | 'record-presented'
  | 'record-collected'
  | 'disposition-required'
  | 'complete'
  | 'archived';

export type PrimaryActionOwner = 'machine' | 'artifact' | 'page' | 'none';
export type TrialDisposition = ProductPlacement;
export type TrialEventType = TrialEvent['type'];
export type TrialError = { code: 'processing' | 'release'; message: string };

export type EvidenceRecordDetail = {
  observed: string;
  notEstablished: string;
  context: string;
  confidence: string;
  nextStep: string;
  metadata: {
    comparison: string;
    generatedFrom: 'baseline-and-follow-up';
    exactTimestamp: string;
  };
};

export type EvidenceRecord = {
  id: string;
  trialId: string;
  specimenCode: string;
  productName: string;
  trialWindow: { startedAt: string; endedAt: string };
  finding: { metric: string; summary: string };
  confidence: 'established' | 'likely' | 'possible';
  nextStep: string;
  generatedAt: string;
  detail: EvidenceRecordDetail;
};

export type EvidenceTrialState = {
  trialId: string;
  phase: TrialPhase;
  product: Specimen | null;
  specimenCode: string | null;
  assignedJob: string | null;
  baselineScan: CaptureMetadata | null;
  followUpScan: CaptureMetadata | null;
  trialStartDate: string | null;
  trialTargetDate: string | null;
  verdict: AnalysisResult | null;
  evidenceRecord: EvidenceRecord | null;
  disposition: TrialDisposition | null;
  lastSuccessfulEvent: TrialEventType | null;
  recoverableError: TrialError | null;
};

export type TrialEvent =
  | { type: 'PRODUCT_REGISTERED'; product: Specimen }
  | { type: 'JOB_SELECTED'; job: string }
  | { type: 'JOB_ASSIGNED'; job: string }
  | { type: 'BASELINE_CAPTURE_STARTED' }
  | { type: 'BASELINE_CAPTURED'; scan: CaptureMetadata; startedAt: string; targetAt: string }
  | { type: 'TRIAL_STARTED' }
  | { type: 'FOLLOW_UP_CAPTURE_STARTED' }
  | { type: 'FOLLOW_UP_CAPTURED'; scan: CaptureMetadata }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_COMPLETED'; verdict: AnalysisResult }
  | { type: 'PROCESSING_FAILED'; message: string }
  | { type: 'RETRY_PROCESSING' }
  | { type: 'VERDICT_RELEASE_STARTED' }
  | { type: 'RECORD_GENERATED'; record: EvidenceRecord }
  | { type: 'RECORD_PRESENTED' }
  | { type: 'RECORD_COLLECTED' }
  | { type: 'RELEASE_FAILED'; message: string }
  | { type: 'RETRY_RELEASE' }
  | { type: 'DISPOSITION_SELECTED'; disposition: TrialDisposition }
  | { type: 'TRIAL_COMPLETED' }
  | { type: 'ARCHIVED' };

const invalid = (state: EvidenceTrialState, event: TrialEvent): never => {
  throw new Error(`Invalid trial transition: ${state.phase} -> ${event.type}`);
};

export const createInitialEvidenceTrial = (trialId = 'trial-face-value-014'): EvidenceTrialState => ({
  trialId,
  phase: 'empty',
  product: null,
  specimenCode: null,
  assignedJob: null,
  baselineScan: null,
  followUpScan: null,
  trialStartDate: null,
  trialTargetDate: null,
  verdict: null,
  evidenceRecord: null,
  disposition: null,
  lastSuccessfulEvent: null,
  recoverableError: null,
});

export function transitionTrial(state: EvidenceTrialState, event: TrialEvent): EvidenceTrialState {
  switch (event.type) {
    case 'PRODUCT_REGISTERED':
      if (!['empty', 'registering'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'registered', product: event.product, specimenCode: event.product.accession, lastSuccessfulEvent: event.type };
    case 'JOB_SELECTED':
      if (!['registered', 'job-selection'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'job-selection', assignedJob: event.job, lastSuccessfulEvent: event.type };
    case 'JOB_ASSIGNED':
      if (state.phase !== 'job-selection' || !event.job) return invalid(state, event);
      return { ...state, phase: 'baseline-required', assignedJob: event.job, lastSuccessfulEvent: event.type };
    case 'BASELINE_CAPTURE_STARTED':
      if (state.phase !== 'baseline-required') return invalid(state, event);
      return { ...state, phase: 'baseline-capturing', recoverableError: null };
    case 'BASELINE_CAPTURED':
      if (state.phase !== 'baseline-capturing') return invalid(state, event);
      return { ...state, phase: 'baseline-recorded', baselineScan: event.scan, trialStartDate: event.startedAt, trialTargetDate: event.targetAt, lastSuccessfulEvent: event.type };
    case 'TRIAL_STARTED':
      if (state.phase !== 'baseline-recorded') return invalid(state, event);
      return { ...state, phase: 'trial-active', lastSuccessfulEvent: event.type };
    case 'FOLLOW_UP_CAPTURE_STARTED':
      if (!['trial-active', 'follow-up-required'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'follow-up-capturing', recoverableError: null };
    case 'FOLLOW_UP_CAPTURED':
      if (state.phase !== 'follow-up-capturing') return invalid(state, event);
      return { ...state, phase: 'processing', followUpScan: event.scan, lastSuccessfulEvent: event.type };
    case 'PROCESSING_STARTED':
      if (!['processing', 'processing-error'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'processing', recoverableError: null };
    case 'PROCESSING_COMPLETED':
      if (state.phase !== 'processing') return invalid(state, event);
      return { ...state, phase: 'verdict-ready', verdict: event.verdict, lastSuccessfulEvent: event.type };
    case 'PROCESSING_FAILED':
      if (state.phase !== 'processing') return invalid(state, event);
      return { ...state, phase: 'processing-error', recoverableError: { code: 'processing', message: event.message } };
    case 'RETRY_PROCESSING':
      if (state.phase !== 'processing-error') return invalid(state, event);
      return { ...state, phase: 'processing', recoverableError: null };
    case 'VERDICT_RELEASE_STARTED':
      if (!['verdict-ready', 'processing-error'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'verdict-revealing', recoverableError: null };
    case 'RECORD_GENERATED':
      if (state.phase !== 'verdict-revealing') return invalid(state, event);
      if (state.evidenceRecord) return state;
      return { ...state, phase: 'verdict-revealed', evidenceRecord: event.record, lastSuccessfulEvent: event.type };
    case 'RECORD_PRESENTED':
      if (!['verdict-revealed', 'record-presented'].includes(state.phase) || !state.evidenceRecord) return invalid(state, event);
      return { ...state, phase: 'record-presented', lastSuccessfulEvent: event.type };
    case 'RECORD_COLLECTED':
      if (state.phase !== 'record-presented' || !state.evidenceRecord) return invalid(state, event);
      return { ...state, phase: 'record-collected', lastSuccessfulEvent: event.type };
    case 'RELEASE_FAILED':
      if (!['verdict-revealing', 'verdict-revealed'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'verdict-ready', recoverableError: { code: 'release', message: event.message } };
    case 'RETRY_RELEASE':
      if (state.phase !== 'verdict-ready' || state.recoverableError?.code !== 'release') return invalid(state, event);
      return { ...state, phase: 'verdict-ready', recoverableError: null };
    case 'DISPOSITION_SELECTED':
      if (state.phase !== 'record-collected') return invalid(state, event);
      return { ...state, phase: 'disposition-required', disposition: event.disposition, lastSuccessfulEvent: event.type };
    case 'TRIAL_COMPLETED':
      if (state.phase !== 'disposition-required' || !state.disposition) return invalid(state, event);
      return { ...state, phase: 'complete', lastSuccessfulEvent: event.type };
    case 'ARCHIVED':
      if (!['complete', 'record-collected'].includes(state.phase)) return invalid(state, event);
      return { ...state, phase: 'archived', lastSuccessfulEvent: event.type };
    default:
      return invalid(state, event);
  }
}

export function restoreStableTrial(state: EvidenceTrialState): EvidenceTrialState {
  if (state.phase === 'verdict-revealing') return { ...state, phase: state.evidenceRecord ? 'record-presented' : 'verdict-ready' };
  if (state.phase === 'verdict-revealed') return { ...state, phase: 'record-presented' };
  if (state.phase === 'baseline-capturing') return { ...state, phase: 'baseline-required' };
  if (state.phase === 'follow-up-capturing') return { ...state, phase: 'follow-up-required' };
  return state;
}

export function createEvidenceRecordForTrial(state: EvidenceTrialState, generatedAt: string): EvidenceRecord {
  if (state.evidenceRecord) return state.evidenceRecord;
  if (!state.product || !state.specimenCode || !state.assignedJob || !state.verdict || !state.trialStartDate) {
    throw new Error('Evidence Record requires a complete trial and verdict.');
  }
  const confidence: EvidenceRecord['confidence'] = state.verdict.confidence === 'confirmed' ? 'established' : state.verdict.confidence === 'possible' ? 'possible' : 'likely';
  return {
    id: `ER-${state.trialId.replace(/\W/g, '').slice(-8).toUpperCase()}`,
    trialId: state.trialId,
    specimenCode: state.specimenCode,
    productName: state.product.product,
    trialWindow: { startedAt: state.trialStartDate, endedAt: generatedAt },
    finding: { metric: state.assignedJob, summary: state.verdict.finding },
    confidence,
    nextStep: 'Established routine',
    generatedAt,
    detail: {
      observed: state.verdict.finding,
      notEstablished: state.verdict.nonFinding,
      context: state.verdict.relevantContext,
      confidence: state.verdict.claimBoundary,
      nextStep: 'Keep using it for the tested job and continue watching for change.',
      metadata: { comparison: state.verdict.comparison, generatedFrom: 'baseline-and-follow-up', exactTimestamp: generatedAt },
    },
  };
}