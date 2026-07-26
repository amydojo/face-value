import type {
  AnalysisResult,
  CaptureMetadata,
  ProductPlacement,
  Specimen,
} from '../../domain/model';

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
  | 'archived'
  | 'release-error';

export type PrimaryActionOwner = 'machine' | 'artifact' | 'page' | 'none';

export type EvidenceRecordConfidence = 'established' | 'likely' | 'possible';

export interface RegisteredProduct {
  id: string;
  specimenCode: string;
  brand: string;
  name: string;
  volume: string;
  jobOptions: string[];
}

export type ProductJob = string;
export type EvidenceScan = CaptureMetadata;
export type TrialDisposition = ProductPlacement;

export interface EvidenceRecordDetail {
  observed: string;
  notEstablished: string;
  context: string;
  confidence: string;
  nextStep: string;
  comparison: string;
  claimBoundary: string;
  baselineCapturedAt: string | null;
  followUpCapturedAt: string | null;
  generatedAt: string;
  userNote: string | null;
  technical: {
    trialId: string;
    analysisSimulated: boolean;
    imageDataStored: false;
  };
}

export interface TrialVerdict {
  id: string;
  finding: {
    metric: string;
    summary: string;
  };
  confidence: EvidenceRecordConfidence;
  nextStep: string;
  source: AnalysisResult;
}

export interface EvidenceRecord {
  id: string;
  trialId: string;
  specimenCode: string;
  productName: string;
  recordNumber: string;
  trialWindow: {
    startedAt: string;
    endedAt: string;
  };
  finding: {
    metric: string;
    summary: string;
  };
  confidence: EvidenceRecordConfidence;
  nextStep: string;
  generatedAt: string;
  detail: EvidenceRecordDetail;
}

export interface TrialError {
  code: 'processing-failed' | 'release-failed';
  message: string;
  evidencePreserved: true;
}

export type TrialEventType =
  | 'REGISTRATION_STARTED'
  | 'PRODUCT_REGISTERED'
  | 'JOB_SELECTED'
  | 'JOB_ASSIGNED'
  | 'BASELINE_CAPTURE_REQUESTED'
  | 'BASELINE_CAPTURED'
  | 'CAPTURE_CANCELLED'
  | 'TRIAL_STARTED'
  | 'FOLLOW_UP_DUE'
  | 'FOLLOW_UP_CAPTURE_REQUESTED'
  | 'FOLLOW_UP_CAPTURED'
  | 'PROCESSING_STARTED'
  | 'PROCESSING_COMPLETED'
  | 'PROCESSING_FAILED'
  | 'PROCESSING_RETRIED'
  | 'VERDICT_REVEAL_STARTED'
  | 'RECORD_GENERATED'
  | 'RECORD_PRESENTED'
  | 'RELEASE_FAILED'
  | 'RECORD_COLLECTED'
  | 'DISPOSITION_SELECTED'
  | 'TRIAL_ARCHIVED';

export interface EvidenceTrialState {
  trialId: string;
  phase: TrialPhase;
  product: RegisteredProduct | null;
  specimenCode: string | null;
  assignedJob: ProductJob | null;
  baselineScan: EvidenceScan | null;
  followUpScan: EvidenceScan | null;
  trialStartDate: string | null;
  trialTargetDate: string | null;
  verdict: TrialVerdict | null;
  evidenceRecord: EvidenceRecord | null;
  disposition: TrialDisposition | null;
  lastSuccessfulEvent: TrialEventType | null;
  recoverableError: TrialError | null;
  userNote: string | null;
  actuatorLearned: boolean;
}

export type TrialEvent =
  | { type: 'REGISTRATION_STARTED' }
  | { type: 'PRODUCT_REGISTERED'; product: RegisteredProduct }
  | { type: 'JOB_SELECTED'; job: ProductJob }
  | { type: 'JOB_ASSIGNED' }
  | { type: 'BASELINE_CAPTURE_REQUESTED' }
  | { type: 'BASELINE_CAPTURED'; scan: EvidenceScan }
  | { type: 'CAPTURE_CANCELLED' }
  | { type: 'TRIAL_STARTED'; startedAt: string; targetAt: string }
  | { type: 'FOLLOW_UP_DUE' }
  | { type: 'FOLLOW_UP_CAPTURE_REQUESTED' }
  | { type: 'FOLLOW_UP_CAPTURED'; scan: EvidenceScan }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_COMPLETED'; result: AnalysisResult }
  | { type: 'PROCESSING_FAILED' }
  | { type: 'PROCESSING_RETRIED' }
  | { type: 'VERDICT_REVEAL_STARTED' }
  | { type: 'RECORD_GENERATED'; generatedAt: string }
  | { type: 'RECORD_PRESENTED' }
  | { type: 'RELEASE_FAILED' }
  | { type: 'RECORD_COLLECTED' }
  | { type: 'DISPOSITION_SELECTED'; disposition: TrialDisposition }
  | { type: 'TRIAL_ARCHIVED' };

export type MachineActionId =
  | 'start-baseline-scan'
  | 'start-follow-up-scan'
  | 'retry-processing'
  | 'release-record';

export type CassetteDoorState =
  | 'closed'
  | 'releasing'
  | 'released'
  | 'opening'
  | 'open'
  | 'resealing';

export type CassetteGlassState =
  | 'empty'
  | 'frosted'
  | 'clear'
  | 'scanning'
  | 'processing'
  | 'error';

export interface MachineConfiguration {
  interactionMode:
    | 'informational'
    | 'awaiting-external-input'
    | 'actionable'
    | 'busy'
    | 'complete'
    | 'error';
  primaryActionOwner: PrimaryActionOwner;
  status: {
    primary: string;
    secondary?: string;
  };
  actuator: {
    state: 'parked' | 'armed' | 'pressed' | 'locked' | 'complete' | 'error';
    actionId?: MachineActionId;
    accessibleLabel?: string;
  };
  doorState: CassetteDoorState;
  glassState: CassetteGlassState;
  specimenVisibility: 'absent' | 'obscured' | 'visible' | 'presented';
}

export interface ScreenPrimaryConfig {
  machinePrimary?: boolean;
  artifactPrimary?: boolean;
  pagePrimary?: boolean;
}

export class InvalidTrialTransitionError extends Error {
  constructor(phase: TrialPhase, event: TrialEvent['type']) {
    super(`Invalid trial transition: ${phase} + ${event}`);
    this.name = 'InvalidTrialTransitionError';
  }
}

export const productFromSpecimen = (specimen: Specimen): RegisteredProduct => ({
  id: specimen.id,
  specimenCode: specimen.accession,
  brand: specimen.brand,
  name: specimen.product,
  volume: specimen.volume,
  jobOptions: [...specimen.jobOptions],
});

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
  userNote: null,
  actuatorLearned: false,
});

const withSuccess = (
  state: EvidenceTrialState,
  event: TrialEventType,
  patch: Partial<EvidenceTrialState>,
): EvidenceTrialState => ({
  ...state,
  ...patch,
  lastSuccessfulEvent: event,
  recoverableError: null,
});

const confidenceFor = (result: AnalysisResult): EvidenceRecordConfidence => {
  if (result.confidence === 'confirmed') return 'established';
  if (result.confidence === 'likely') return 'likely';
  return 'possible';
};

const verdictFor = (state: EvidenceTrialState, result: AnalysisResult): TrialVerdict => ({
  id: `verdict-${state.trialId}`,
  finding: {
    metric: state.assignedJob === 'Visible Tone Consistency' ? 'VISIBLE EVENNESS' : (state.assignedJob ?? 'VISIBLE CHANGE').toUpperCase(),
    summary: result.finding.toLowerCase().includes('slightly improved') ? 'SLIGHTLY IMPROVED' : (result.finding || 'SLIGHTLY IMPROVED').toUpperCase(),
  },
  confidence: confidenceFor(result),
  nextStep: result.recommendedAction === 'keep' ? 'Established routine' : 'Test longer',
  source: result,
});

export function createEvidenceRecord(
  state: EvidenceTrialState,
  generatedAt: string,
): EvidenceRecord {
  if (state.evidenceRecord) return state.evidenceRecord;
  if (!state.product || !state.specimenCode || !state.verdict || !state.trialStartDate || !state.followUpScan) {
    throw new Error('Evidence Record requires product, verdict, dates, and completed scans.');
  }

  const endedAt = state.followUpScan.createdAt;
  return {
    id: `ER-014-${state.trialId}`,
    trialId: state.trialId,
    specimenCode: state.specimenCode,
    productName: state.product.name,
    recordNumber: '014',
    trialWindow: {
      startedAt: state.trialStartDate,
      endedAt,
    },
    finding: state.verdict.finding,
    confidence: state.verdict.confidence,
    nextStep: state.verdict.nextStep,
    generatedAt,
    detail: {
      observed: state.verdict.source.finding,
      notEstablished: state.verdict.source.nonFinding,
      context: state.verdict.source.relevantContext,
      confidence: state.verdict.source.claimBoundary,
      nextStep: state.verdict.nextStep,
      comparison: state.verdict.source.comparison.replaceAll('_', ' '),
      claimBoundary: state.verdict.source.claimBoundary,
      baselineCapturedAt: state.baselineScan?.createdAt ?? null,
      followUpCapturedAt: state.followUpScan.createdAt,
      generatedAt,
      userNote: state.userNote,
      technical: {
        trialId: state.trialId,
        analysisSimulated: state.verdict.source.simulated,
        imageDataStored: false,
      },
    },
  };
}

export function transitionTrial(
  state: EvidenceTrialState,
  event: TrialEvent,
): EvidenceTrialState {
  switch (event.type) {
    case 'REGISTRATION_STARTED':
      if (state.phase !== 'empty') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'registering' });

    case 'PRODUCT_REGISTERED':
      if (!['registering', 'empty'].includes(state.phase)) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, {
        phase: 'job-selection',
        product: event.product,
        specimenCode: event.product.specimenCode,
        assignedJob: null,
      });

    case 'JOB_SELECTED':
      if (state.phase !== 'job-selection' || !state.product?.jobOptions.includes(event.job)) {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, { assignedJob: event.job });

    case 'JOB_ASSIGNED':
      if (state.phase !== 'job-selection' || !state.assignedJob) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'baseline-required' });

    case 'BASELINE_CAPTURE_REQUESTED':
      if (state.phase !== 'baseline-required') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'baseline-capturing' });

    case 'BASELINE_CAPTURED':
      if (state.phase !== 'baseline-capturing' || event.scan.kind !== 'baseline') {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, { phase: 'baseline-recorded', baselineScan: event.scan });

    case 'CAPTURE_CANCELLED':
      if (state.phase === 'baseline-capturing') return withSuccess(state, event.type, { phase: 'baseline-required' });
      if (state.phase === 'follow-up-capturing') return withSuccess(state, event.type, { phase: 'follow-up-required' });
      throw new InvalidTrialTransitionError(state.phase, event.type);

    case 'TRIAL_STARTED':
      if (state.phase !== 'baseline-recorded' || !state.baselineScan) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, {
        phase: 'trial-active',
        trialStartDate: event.startedAt,
        trialTargetDate: event.targetAt,
      });

    case 'FOLLOW_UP_DUE':
      if (state.phase !== 'trial-active') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'follow-up-required' });

    case 'FOLLOW_UP_CAPTURE_REQUESTED':
      if (state.phase !== 'follow-up-required') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'follow-up-capturing' });

    case 'FOLLOW_UP_CAPTURED':
      if (state.phase !== 'follow-up-capturing' || event.scan.kind !== 'followup') {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, { phase: 'processing', followUpScan: event.scan });

    case 'PROCESSING_STARTED':
      if (state.phase !== 'processing' || !state.followUpScan) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'processing' });

    case 'PROCESSING_COMPLETED':
      if (state.phase !== 'processing') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, {
        phase: 'verdict-ready',
        verdict: verdictFor(state, event.result),
      });

    case 'PROCESSING_FAILED':
      if (state.phase !== 'processing') throw new InvalidTrialTransitionError(state.phase, event.type);
      return {
        ...state,
        phase: 'processing-error',
        recoverableError: {
          code: 'processing-failed',
          message: 'The comparison stopped before a verdict was produced.',
          evidencePreserved: true,
        },
      };

    case 'PROCESSING_RETRIED':
      if (state.phase !== 'processing-error') throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'processing' });

    case 'VERDICT_REVEAL_STARTED':
      if (!['verdict-ready', 'release-error'].includes(state.phase)) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'verdict-revealing' });

    case 'RECORD_GENERATED':
      if (!['verdict-revealing', 'verdict-ready', 'release-error'].includes(state.phase)) {
        if (state.evidenceRecord) return state;
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, {
        phase: 'verdict-revealing',
        evidenceRecord: createEvidenceRecord(state, event.generatedAt),
        actuatorLearned: true,
      });

    case 'RECORD_PRESENTED':
      if (state.phase !== 'verdict-revealing' || !state.evidenceRecord) {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, { phase: 'record-presented' });

    case 'RELEASE_FAILED':
      if (!['verdict-revealing', 'verdict-ready'].includes(state.phase)) {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return {
        ...state,
        phase: 'release-error',
        recoverableError: {
          code: 'release-failed',
          message: 'The release stopped. Your verdict and scans are preserved.',
          evidencePreserved: true,
        },
      };

    case 'RECORD_COLLECTED':
      if (state.phase !== 'record-presented' || !state.evidenceRecord) {
        if (state.phase === 'record-collected') return state;
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, { phase: 'record-collected' });

    case 'DISPOSITION_SELECTED':
      if (!['record-collected', 'disposition-required'].includes(state.phase)) {
        throw new InvalidTrialTransitionError(state.phase, event.type);
      }
      return withSuccess(state, event.type, {
        phase: 'complete',
        disposition: event.disposition,
      });

    case 'TRIAL_ARCHIVED':
      if (!['record-collected', 'complete'].includes(state.phase)) throw new InvalidTrialTransitionError(state.phase, event.type);
      return withSuccess(state, event.type, { phase: 'archived' });

    default:
      return state;
  }
}

export function restoreInterruptedTrial(state: EvidenceTrialState): EvidenceTrialState {
  if (state.evidenceRecord) {
    if (['record-collected', 'disposition-required', 'complete', 'archived'].includes(state.phase)) return state;
    return { ...state, phase: 'record-presented', recoverableError: null };
  }
  if (state.phase === 'verdict-revealing') return { ...state, phase: 'verdict-ready', recoverableError: null };
  if (state.phase === 'baseline-capturing') return { ...state, phase: 'baseline-required', recoverableError: null };
  if (state.phase === 'follow-up-capturing') return { ...state, phase: 'follow-up-required', recoverableError: null };
  return state;
}

export function resolveMachineConfiguration(state: EvidenceTrialState): MachineConfiguration {
  const job = state.assignedJob ?? 'CHOOSE ONE BELOW';
  const product = state.product?.name ?? 'READY FOR PRODUCT';

  switch (state.phase) {
    case 'empty':
      return machine('informational', 'page', 'STANDBY', 'READY FOR PRODUCT', 'parked', 'closed', 'empty', 'absent');
    case 'registering':
      return machine('awaiting-external-input', 'page', 'AWAITING PRODUCT', 'ENTER DETAILS BELOW', 'parked', 'closed', 'empty', 'absent');
    case 'registered':
    case 'job-selection':
      return machine(
        'awaiting-external-input',
        'page',
        state.assignedJob ? 'JOB SELECTED' : 'AWAITING JOB',
        state.assignedJob ? job : 'CHOOSE ONE BELOW',
        'parked',
        'closed',
        'frosted',
        'obscured',
      );
    case 'job-assigned':
    case 'baseline-required':
      return machine('actionable', 'machine', 'BASELINE READY', 'PRESS TO SCAN', 'armed', 'closed', 'clear', 'visible', 'start-baseline-scan', `Start baseline scan for ${product}`);
    case 'baseline-capturing':
      return machine('awaiting-external-input', 'page', 'BASELINE CAPTURE', 'LATCH LOCKED', 'locked', 'closed', 'scanning', 'visible');
    case 'baseline-recorded':
      return machine('complete', 'page', 'BASELINE RECORDED', 'DAY 0', 'complete', 'closed', 'frosted', 'obscured');
    case 'trial-active':
      return machine('informational', 'none', 'TRIAL ACTIVE', 'EVIDENCE ALIGNING OVER TIME', 'locked', 'closed', 'frosted', 'obscured');
    case 'follow-up-required':
      return machine('actionable', 'machine', 'FOLLOW-UP READY', 'PRESS TO SCAN', 'armed', 'closed', 'clear', 'visible', 'start-follow-up-scan', `Start follow-up scan for ${product}`);
    case 'follow-up-capturing':
      return machine('awaiting-external-input', 'page', 'FOLLOW-UP CAPTURE', 'LATCH LOCKED', 'locked', 'closed', 'scanning', 'visible');
    case 'processing':
      return machine('busy', 'none', 'COMPARING SCANS', 'LATCH LOCKED', 'locked', 'closed', 'processing', 'obscured');
    case 'processing-error':
      return machine('error', 'machine', 'PROCESS INTERRUPTED', 'PRESS TO RETRY', 'error', 'closed', 'error', 'obscured', 'retry-processing', 'Retry evidence processing');
    case 'verdict-ready':
      return machine('actionable', 'machine', 'VERDICT READY', state.actuatorLearned ? 'PRESS AMBER ACTUATOR' : 'PRESS TO RELEASE EVIDENCE', 'armed', 'closed', 'frosted', 'obscured', 'release-record', 'Release Evidence Record');
    case 'verdict-revealing':
      return machine('busy', 'none', 'RELEASING RECORD', 'LATCH ENGAGED', 'pressed', 'releasing', 'clear', 'presented');
    case 'verdict-revealed':
      return machine('complete', 'none', 'VERDICT RELEASED', 'RESULT RECORDED', 'complete', 'open', 'clear', 'presented');
    case 'record-presented':
      return machine('complete', 'artifact', 'RECORD RELEASED', 'TAKE YOUR EVIDENCE', 'complete', 'open', 'clear', 'presented');
    case 'record-collected':
    case 'disposition-required':
      return machine('complete', 'page', 'EVIDENCE COLLECTED', 'RESULT RECORDED', 'complete', 'open', 'clear', 'presented');
    case 'complete':
      return machine('complete', 'page', 'RESULT RECORDED', state.disposition?.replaceAll('_', ' ').toUpperCase() ?? 'COMPLETE', 'complete', 'resealing', 'clear', 'presented');
    case 'archived':
      return machine('complete', 'none', 'EVIDENCE ARCHIVED', state.specimenCode ?? '', 'complete', 'closed', 'frosted', 'obscured');
    case 'release-error':
      return machine('error', 'machine', 'RELEASE INTERRUPTED', 'PRESS TO RETRY', 'error', 'released', 'error', 'presented', 'release-record', 'Retry Evidence Record release');
    default:
      return machine('informational', 'none', 'STANDBY', product, 'parked', 'closed', 'frosted', 'obscured');
  }
}

function machine(
  interactionMode: MachineConfiguration['interactionMode'],
  primaryActionOwner: PrimaryActionOwner,
  primary: string,
  secondary: string,
  actuatorState: MachineConfiguration['actuator']['state'],
  doorState: CassetteDoorState,
  glassState: CassetteGlassState,
  specimenVisibility: MachineConfiguration['specimenVisibility'],
  actionId?: MachineActionId,
  accessibleLabel?: string,
): MachineConfiguration {
  return {
    interactionMode,
    primaryActionOwner,
    status: { primary, secondary },
    actuator: { state: actuatorState, actionId, accessibleLabel },
    doorState,
    glassState,
    specimenVisibility,
  };
}

export function assertSinglePrimaryAction(config: ScreenPrimaryConfig): void {
  const count = [config.machinePrimary, config.artifactPrimary, config.pagePrimary].filter(Boolean).length;
  if (count > 1) throw new Error('A screen may not expose competing primary actions.');
}

export function confidenceSeal(confidence: EvidenceRecordConfidence): 'solid' | 'partial' | 'open' {
  if (confidence === 'established') return 'solid';
  if (confidence === 'likely') return 'partial';
  return 'open';
}
