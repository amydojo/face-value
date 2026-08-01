import type {
  AnalysisResult,
  AcceptedRednessFrame,
  AppStage,
  CaptureContext,
  CaptureKind,
  CaptureMetadata,
  ComparisonState,
  DisturbanceState,
  DurableSkinSignal,
  EvidenceConfidence,
  EvidenceRecordData,
  FaceValueState,
  LongitudinalSkinEvidence,
  ObservationState,
  ProductPlacement,
  RednessComparison,
  RednessEvidenceBurst,
  RejectedRednessFrame,
  RegisteredProduct,
  TraceEntry,
} from '../../domain/model';
import {
  baselineEvidenceCapturedAt,
  isCompleteRednessEvidenceBurst,
} from '../../domain/rednessEvidenceBurst';
import type { OracleRevealState } from '../../domain/oracleRevealMachine';
import {
  REDNESS_MVP_OBSERVATION_WINDOW,
  isRednessEvaluationSnapshot,
} from '../../domain/evidence/redness';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  addCalendarDays,
  isValidRegisteredProduct,
} from '../../domain/phaseB5';

export const STORAGE_KEY = 'face-value:structured-demo:v1';

export interface PersistedDemoData {
  stage: AppStage | null;
  selectedDrawerIndex: number;
  selectedSpecimenId: string;
  assignedJob: string | null;
  captureKind: CaptureKind;
  observation: ObservationState;
  placement: ProductPlacement;
  placementSealed: boolean;
  comparison: ComparisonState;
  confidence: EvidenceConfidence;
  disturbance: DisturbanceState;
  baselineCapture: CaptureMetadata | null;
  followupCapture: CaptureMetadata | null;
  trace: TraceEntry | null;
  analysis: AnalysisResult | null;
  record: EvidenceRecordData | null;
  archive: EvidenceRecordData[];
  longitudinalEvidence: LongitudinalSkinEvidence;
  registeredProduct: RegisteredProduct | null;
  baselineLockedAt: string | null;
  followUpEligibleAt: string | null;
  baselineContext: CaptureContext | null;
  followUpContext: CaptureContext | null;
  demoTimelineAdvanced: boolean;
  resultRevealed: boolean;
  oracleRevealState: OracleRevealState;
  oracleEvidenceDispensed: boolean;
  oracleCollectionStarted: boolean;
  oracleCommittedAt: string | null;
}

const emptyLongitudinalEvidence = (): LongitudinalSkinEvidence => ({
  protocol: null,
  baseline: null,
  followUp: null,
  baselineBurst: null,
  followUpBurst: null,
  comparison: null,
  evaluation: null,
});

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
const captureKinds = new Set<CaptureMetadata['kind']>(['baseline', 'followup']);
const appStages = new Set<AppStage>([
  'welcome',
  'product_registration',
  'cabinet',
  'browse',
  'specimen',
  'job',
  'capture_contract',
  'camera',
  'baseline_context',
  'baseline_locked',
  'waiting_for_followup',
  'followup_ready',
  'followup_context',
  'observation',
  'disturbance',
  'analysis',
  'analysis_failure',
  'comparison_refused',
  'progress',
  'placement',
  'record',
  'archive',
]);
const captureSources = new Set<CaptureMetadata['source']>(['camera', 'file']);
const captureMimeTypes = new Set<CaptureMetadata['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/unknown',
]);
const cameraCaptureProfiles = new Set([
  'native-browser-camera-v1',
  'youcam-camera-kit-standard-720p',
  'youcam-camera-kit-hd-1080p',
  'youcam-camera-kit-hd-1920p',
]);
const oracleRevealStates = new Set<OracleRevealState>([
  'sealed',
  'opening',
  'transmitting',
  'verdict_revealed',
  'committing',
  'dispensing',
  'collected',
  'done',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTrace = (value: unknown): value is TraceEntry =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  typeof value.detail === 'string' &&
  typeof value.observedAt === 'string';

const isCaptureMetadata = (value: unknown): value is CaptureMetadata =>
  isObject(value) &&
  typeof value.id === 'string' &&
  captureKinds.has(value.kind as CaptureMetadata['kind']) &&
  captureSources.has(value.source as CaptureMetadata['source']) &&
  captureMimeTypes.has(value.mimeType as CaptureMetadata['mimeType']) &&
  typeof value.createdAt === 'string' &&
  value.orientationRule === 'analysis-unmirrored' &&
  (value.cameraProfileId === undefined ||
    value.cameraProfileId === null ||
    cameraCaptureProfiles.has(String(value.cameraProfileId)));

const isCaptureContext = (value: unknown): value is CaptureContext =>
  isObject(value) &&
  typeof value.makeup === 'boolean' &&
  typeof value.recentHeatOrExercise === 'boolean' &&
  typeof value.recentCleansingOrSkincare === 'boolean' &&
  typeof value.routineOrTreatmentChange === 'boolean' &&
  (value.note === null || typeof value.note === 'string');

const isEvidenceRecord = (value: unknown): value is EvidenceRecordData =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.specimenId === 'string' &&
  typeof value.accession === 'string' &&
  typeof value.product === 'string' &&
  typeof value.job === 'string' &&
  typeof value.finding === 'string' &&
  value.includesFaceImage === false &&
  (value.productBrand === undefined || typeof value.productBrand === 'string') &&
  (value.productStrength === undefined ||
    value.productStrength === null ||
    typeof value.productStrength === 'string') &&
  (value.productVolume === undefined ||
    value.productVolume === null ||
    typeof value.productVolume === 'string') &&
  (value.baselineContext === undefined ||
    value.baselineContext === null ||
    isCaptureContext(value.baselineContext)) &&
  (value.followUpContext === undefined ||
    value.followUpContext === null ||
    isCaptureContext(value.followUpContext)) &&
  (value.demoOriginated === undefined || typeof value.demoOriginated === 'boolean') &&
  (value.baselineRawScore === undefined ||
    (typeof value.baselineRawScore === 'number' && Number.isFinite(value.baselineRawScore))) &&
  (value.followUpRawScore === undefined ||
    (typeof value.followUpRawScore === 'number' && Number.isFinite(value.followUpRawScore))) &&
  (value.rednessEvaluation === undefined || isRednessEvaluationSnapshot(value.rednessEvaluation));

const isAnalysisResult = (value: unknown): value is AnalysisResult =>
  isObject(value) &&
  typeof value.finding === 'string' &&
  typeof value.nonFinding === 'string' &&
  typeof value.claimBoundary === 'string' &&
  typeof value.simulated === 'boolean' &&
  (value.baselineRawScore === undefined ||
    (typeof value.baselineRawScore === 'number' && Number.isFinite(value.baselineRawScore))) &&
  (value.followUpRawScore === undefined ||
    (typeof value.followUpRawScore === 'number' && Number.isFinite(value.followUpRawScore))) &&
  (value.delta === undefined ||
    (typeof value.delta === 'number' && Number.isFinite(value.delta))) &&
  (value.rednessEvaluation === undefined || isRednessEvaluationSnapshot(value.rednessEvaluation));

const isProtocol = (value: unknown): value is NonNullable<LongitudinalSkinEvidence['protocol']> =>
  isObject(value) &&
  value.provider === 'youcam' &&
  value.apiVersion === '2.1' &&
  value.mode === 'hd' &&
  value.concern === 'hd_redness' &&
  value.region === null &&
  value.scoreType === 'raw_score' &&
  value.captureProtocolVersion === 'face-value-youcam-1';

const isDurableSignal = (value: unknown): value is DurableSkinSignal =>
  isObject(value) &&
  value.provider === 'youcam' &&
  value.apiVersion === '2.1' &&
  value.mode === 'hd' &&
  value.concern === 'hd_redness' &&
  value.region === null &&
  value.scoreType === 'raw_score' &&
  value.captureProtocolVersion === 'face-value-youcam-1' &&
  typeof value.rawScore === 'number' &&
  Number.isFinite(value.rawScore) &&
  typeof value.capturedAt === 'string' &&
  value.captureQuality === 'accepted';

const isAcceptedRednessFrame = (value: unknown): value is AcceptedRednessFrame =>
  isObject(value) &&
  typeof value.frameId === 'string' &&
  isCaptureMetadata(value.capture) &&
  isObject(value.quality) &&
  value.quality.currentFrame === 'accepted' &&
  value.quality.exposure === 'accepted' &&
  value.quality.movement === 'accepted' &&
  isDurableSignal(value.signal) &&
  (value.providerAttemptCount === 1 || value.providerAttemptCount === 2);

const isRejectedRednessFrame = (value: unknown): value is RejectedRednessFrame =>
  isObject(value) &&
  typeof value.frameId === 'string' &&
  typeof value.attemptedAt === 'string' &&
  (value.stage === 'capture' || value.stage === 'provider') &&
  Array.isArray(value.reasons) &&
  value.reasons.length > 0 &&
  value.reasons.every((reason) => typeof reason === 'string' && reason.length > 0);

const isRednessEvidenceBurst = (value: unknown): value is RednessEvidenceBurst => {
  if (
    !isObject(value) ||
    typeof value.burstId !== 'string' ||
    (value.role !== 'baseline' && value.role !== 'followup') ||
    typeof value.sessionId !== 'string' ||
    !(
      value.captureProfileId === null || cameraCaptureProfiles.has(String(value.captureProfileId))
    ) ||
    typeof value.startedAt !== 'string' ||
    typeof value.completedAt !== 'string' ||
    typeof value.attemptedFrameCount !== 'number' ||
    !Number.isInteger(value.attemptedFrameCount) ||
    !Array.isArray(value.acceptedFrames) ||
    !value.acceptedFrames.every(isAcceptedRednessFrame) ||
    !Array.isArray(value.rejectedFrames) ||
    !value.rejectedFrames.every(isRejectedRednessFrame)
  ) {
    return false;
  }
  return isCompleteRednessEvidenceBurst(value as unknown as RednessEvidenceBurst);
};

const isRednessComparison = (value: unknown): value is RednessComparison =>
  isObject(value) &&
  typeof value.baselineRawScore === 'number' &&
  Number.isFinite(value.baselineRawScore) &&
  typeof value.followUpRawScore === 'number' &&
  Number.isFinite(value.followUpRawScore) &&
  typeof value.delta === 'number' &&
  Number.isFinite(value.delta) &&
  ['favorable', 'unfavorable', 'unchanged'].includes(String(value.direction)) &&
  ['pending', 'prototype_calibrated', 'provisional_fixture'].includes(String(value.calibration)) &&
  ['possible', 'likely', 'insufficient'].includes(String(value.confidence)) &&
  Array.isArray(value.limitations) &&
  value.limitations.every((item) => typeof item === 'string');

const isLongitudinalEvidence = (value: unknown): value is LongitudinalSkinEvidence => {
  if (
    !isObject(value) ||
    !(value.protocol === null || isProtocol(value.protocol)) ||
    !(value.baseline === null || isDurableSignal(value.baseline)) ||
    !(value.followUp === null || isDurableSignal(value.followUp)) ||
    !(
      value.baselineBurst === undefined ||
      value.baselineBurst === null ||
      (isRednessEvidenceBurst(value.baselineBurst) && value.baselineBurst.role === 'baseline')
    ) ||
    !(
      value.followUpBurst === undefined ||
      value.followUpBurst === null ||
      (isRednessEvidenceBurst(value.followUpBurst) && value.followUpBurst.role === 'followup')
    ) ||
    !(value.comparison === null || isRednessComparison(value.comparison)) ||
    !(
      value.evaluation === undefined ||
      value.evaluation === null ||
      isRednessEvaluationSnapshot(value.evaluation)
    )
  ) {
    return false;
  }

  const hasBurst = Boolean(value.baselineBurst || value.followUpBurst);
  const hasBaseline = Boolean(value.baseline || value.baselineBurst);
  return (!hasBurst || isProtocol(value.protocol)) && (!value.followUpBurst || hasBaseline);
};

const migrateLegacyRegisteredProduct = (input: {
  selectedSpecimenId: string;
  assignedJob: string | null;
  baselineCapture: CaptureMetadata | null;
  longitudinalEvidence: LongitudinalSkinEvidence;
}): RegisteredProduct | null => {
  if (
    input.selectedSpecimenId !== 'one-thing' ||
    input.assignedJob !== 'Reduce visible redness' ||
    !input.longitudinalEvidence.baseline
  ) {
    return null;
  }

  return {
    id: 'legacy-registered-product-one-thing',
    accession: '02',
    brand: 'FACE VALUE',
    productName: '02 / ONE THING',
    strength: null,
    volume: '30 ML',
    assignedJob: 'Reduce visible redness',
    protocolId: 'youcam-redness-v1',
    expectedObservationWindowDays: {
      ...REDNESS_MVP_OBSERVATION_WINDOW,
    },
    createdAt: input.baselineCapture?.createdAt ?? input.longitudinalEvidence.baseline.capturedAt,
  };
};

export function toPersistedDemoData(state: FaceValueState): PersistedDemoData {
  return {
    stage: state.stage,
    selectedDrawerIndex: state.selectedDrawerIndex,
    selectedSpecimenId: state.selectedSpecimenId,
    assignedJob: state.assignedJob,
    captureKind: state.captureKind,
    observation: state.observation,
    placement: state.placement,
    placementSealed: state.placementSealed,
    comparison: state.comparison,
    confidence: state.confidence,
    disturbance: state.disturbance,
    baselineCapture: state.baselineCapture,
    followupCapture: state.followupCapture,
    trace: state.trace,
    analysis: state.analysis,
    record: state.record,
    archive: state.archive,
    longitudinalEvidence: state.longitudinalEvidence ?? emptyLongitudinalEvidence(),
    registeredProduct: state.registeredProduct ?? null,
    baselineLockedAt: state.baselineLockedAt ?? null,
    followUpEligibleAt: state.followUpEligibleAt ?? null,
    baselineContext: state.baselineContext ?? null,
    followUpContext: state.followUpContext ?? null,
    demoTimelineAdvanced: state.demoTimelineAdvanced ?? false,
    resultRevealed: state.resultRevealed ?? false,
    oracleRevealState: state.oracleRevealState ?? 'sealed',
    oracleEvidenceDispensed: state.oracleEvidenceDispensed ?? false,
    oracleCollectionStarted: state.oracleCollectionStarted ?? false,
    oracleCommittedAt: state.oracleCommittedAt ?? null,
  };
}

export function saveStructuredDemoData(
  state: FaceValueState,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(toPersistedDemoData(state)));
}

export function loadStructuredDemoData(storage: Storage = localStorage): PersistedDemoData | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isObject(value)) throw new Error('Invalid persisted data');

    const archive = value.archive;
    const assignedJob = value.assignedJob;
    const baselineCapture = value.baselineCapture ?? null;
    const followupCapture = value.followupCapture ?? null;
    const trace = value.trace;
    const analysis = value.analysis;
    const record = value.record;
    const longitudinalEvidenceValue = value.longitudinalEvidence ?? emptyLongitudinalEvidence();
    const stage =
      typeof value.stage === 'string' && appStages.has(value.stage as AppStage)
        ? (value.stage as AppStage)
        : null;
    const captureKind = captureKinds.has(value.captureKind as CaptureKind)
      ? (value.captureKind as CaptureKind)
      : 'baseline';
    const baselineLockedAt = value.baselineLockedAt ?? null;
    const followUpEligibleAt = value.followUpEligibleAt ?? null;
    const baselineContext = value.baselineContext ?? null;
    const followUpContext = value.followUpContext ?? null;
    const demoTimelineAdvanced = value.demoTimelineAdvanced ?? false;
    const resultRevealed = value.resultRevealed ?? false;
    const oracleRevealState =
      typeof value.oracleRevealState === 'string' &&
      oracleRevealStates.has(value.oracleRevealState as OracleRevealState)
        ? (value.oracleRevealState as OracleRevealState)
        : value.stage === 'record' && record
          ? 'collected'
          : value.placementSealed === true && record
            ? 'dispensing'
            : resultRevealed
              ? 'verdict_revealed'
              : 'sealed';
    const oracleEvidenceDispensed =
      value.oracleEvidenceDispensed ?? Boolean(value.placementSealed === true && record);
    const oracleCollectionStarted = value.oracleCollectionStarted ?? false;
    const oracleCommittedAt =
      value.oracleCommittedAt ??
      (value.placementSealed === true && isObject(record) ? (record.createdAt ?? null) : null);
    const registeredProductValue = value.registeredProduct ?? null;

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
      !(baselineCapture === null || isCaptureMetadata(baselineCapture)) ||
      !(followupCapture === null || isCaptureMetadata(followupCapture)) ||
      !(trace === null || isTrace(trace)) ||
      !(analysis === null || isAnalysisResult(analysis)) ||
      !(record === null || isEvidenceRecord(record)) ||
      !Array.isArray(archive) ||
      !archive.every(isEvidenceRecord) ||
      !isLongitudinalEvidence(longitudinalEvidenceValue) ||
      !(
        registeredProductValue === null ||
        isValidRegisteredProduct(registeredProductValue as RegisteredProduct)
      ) ||
      !(baselineLockedAt === null || typeof baselineLockedAt === 'string') ||
      !(followUpEligibleAt === null || typeof followUpEligibleAt === 'string') ||
      !(baselineContext === null || isCaptureContext(baselineContext)) ||
      !(followUpContext === null || isCaptureContext(followUpContext)) ||
      typeof demoTimelineAdvanced !== 'boolean' ||
      typeof resultRevealed !== 'boolean' ||
      !oracleRevealStates.has(oracleRevealState) ||
      typeof oracleEvidenceDispensed !== 'boolean' ||
      typeof oracleCollectionStarted !== 'boolean' ||
      !(oracleCommittedAt === null || typeof oracleCommittedAt === 'string')
    ) {
      throw new Error('Invalid persisted data');
    }

    const longitudinalEvidence: LongitudinalSkinEvidence = {
      ...longitudinalEvidenceValue,
      baselineBurst: longitudinalEvidenceValue.baselineBurst ?? null,
      followUpBurst: longitudinalEvidenceValue.followUpBurst ?? null,
      evaluation: longitudinalEvidenceValue.evaluation ?? null,
    };
    const validatedRegisteredProduct =
      registeredProductValue === null ? null : (registeredProductValue as RegisteredProduct);
    const registeredProduct =
      validatedRegisteredProduct ??
      migrateLegacyRegisteredProduct({
        selectedSpecimenId: value.selectedSpecimenId,
        assignedJob,
        baselineCapture,
        longitudinalEvidence,
      });
    const restoredBaselineLockedAt =
      baselineLockedAt ??
      registeredProduct?.createdAt ??
      baselineEvidenceCapturedAt(longitudinalEvidence) ??
      null;
    const restoredFollowUpEligibleAt =
      followUpEligibleAt ??
      (restoredBaselineLockedAt && registeredProduct
        ? addCalendarDays(restoredBaselineLockedAt, FOLLOW_UP_INTERVAL_DAYS)
        : null);

    return {
      ...(value as unknown as Omit<
        PersistedDemoData,
        | 'stage'
        | 'captureKind'
        | 'baselineCapture'
        | 'followupCapture'
        | 'longitudinalEvidence'
        | 'registeredProduct'
        | 'baselineLockedAt'
        | 'followUpEligibleAt'
        | 'baselineContext'
        | 'followUpContext'
        | 'demoTimelineAdvanced'
        | 'resultRevealed'
        | 'oracleRevealState'
        | 'oracleEvidenceDispensed'
        | 'oracleCollectionStarted'
        | 'oracleCommittedAt'
      >),
      stage,
      captureKind,
      baselineCapture,
      followupCapture,
      longitudinalEvidence,
      registeredProduct,
      baselineLockedAt: restoredBaselineLockedAt,
      followUpEligibleAt: restoredFollowUpEligibleAt,
      baselineContext,
      followUpContext,
      demoTimelineAdvanced,
      resultRevealed,
      oracleRevealState,
      oracleEvidenceDispensed,
      oracleCollectionStarted,
      oracleCommittedAt,
    };
  } catch {
    storage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearStructuredDemoData(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
