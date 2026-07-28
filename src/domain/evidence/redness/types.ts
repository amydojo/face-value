export const REDNESS_FRAMEWORK_VERSION = 'redness-v1' as const;
export const REDNESS_SCHEMA_VERSION = 'redness-evidence-v1' as const;
export const REDNESS_ENGINE_VERSION = 'face-value-redness-engine-v1.0.0' as const;

export type EffectClassification =
  | 'worsened'
  | 'no_detectable_change'
  | 'directional_improvement'
  | 'meaningful_candidate'
  | 'strong_improvement';

export type MeasurementQuality = 'invalid' | 'limited' | 'adequate' | 'strong';
export type AttributionQuality = 'blocked' | 'weak' | 'moderate' | 'strong';
export type EvidenceQuality = 'insufficient' | 'possible' | 'likely';
export type SafetyStatus = 'clear' | 'check_required' | 'interrupted';

export type RednessAction =
  'keep' | 'test_longer' | 'retry_alone' | 'not_proving_job' | 'safety_interruption';

export type ThresholdSource =
  'provisional_fixture' | 'technical_calibration' | 'longitudinal_calibration';

export interface ObservationWindowDays {
  minimum: number;
  target: number;
  maximum?: number;
}

export interface RednessVersionMetadata {
  apiVersion: string;
  analysisModelVersion: string;
  analysisMode: 'hd';
  appBuildVersion: string;
  preprocessingVersion: string;
  captureProtocolVersion: string;
}

export interface CaptureQuality {
  accepted: boolean;
  lightingComparability: 'fail' | 'limited' | 'pass';
  poseComparability: 'fail' | 'limited' | 'pass';
  cropComparability: 'fail' | 'limited' | 'pass';
  faceSizeComparability: 'fail' | 'limited' | 'pass';
  colorCastComparability: 'fail' | 'limited' | 'pass';
  obstructionPresent: boolean;
  enhancementDetected: boolean;
  reasons: string[];
}

export interface RejectedFrame {
  frameId: string;
  reasons: string[];
}

export interface EvidenceSession {
  sessionId: string;
  capturedAt: string;
  deviceClass: string;
  cameraFacing: 'front';
  frameIds: string[];
  rawScores: number[];
  acceptedFrameIds: string[];
  rejectedFrames: RejectedFrame[];
  captureQuality: CaptureQuality;
  versions: RednessVersionMetadata;
}

export interface EvidencePeriodInput {
  sessions: EvidenceSession[];
}

export interface EvidencePeriod {
  sessionCount: number;
  sessions: EvidenceSession[];
  acceptedRawScores: number[];
  rejectedFrameCount: number;
  rawMedian: number | null;
}

export interface RednessThresholdConfiguration {
  version: string;
  source: ThresholdSource;
  technicalN95?: number;
  longitudinalN95?: number;
  activeN95?: number;
  provisionalDetectablePoints?: number;
  provisionalStrongPoints?: number;
  evidenceStrengthRatio?: number;
  configHash: string;
  provisional: boolean;
}

export interface MaskEvidence {
  baselineAreaPct?: number;
  endpointAreaPct?: number;
  areaDelta?: number;
  facialRegistrationQuality?: number;
  eligibleSkinPixelCount?: number;
  baselineMaskPixelCount?: number;
  endpointMaskPixelCount?: number;
  baselineRegionAgreement?: number;
  spatialConsistency?: number;
  segmentationStable?: boolean;
}

export interface PatientAnchor {
  visibleChange: -2 | -1 | 0 | 1 | 2;
  recordedAt: string;
}

export type IrritationSignal =
  | 'burning'
  | 'stinging'
  | 'itching'
  | 'heat'
  | 'swelling'
  | 'peeling'
  | 'blistering'
  | 'eye_involvement'
  | 'rapid_escalation'
  | 'unusual_sensitivity';

export interface ToleranceEvidence {
  collectionStatus: 'collected';
  symptoms: IrritationSignal[];
  severity: 'none' | 'mild' | 'moderate' | 'severe';
}

export interface AdherenceEvidence {
  status: 'complete' | 'partial' | 'poor' | 'unknown';
  missedApplications?: number;
}

export interface ConfounderFlag {
  code: string;
  severity: 'downgrade' | 'hard_failure' | 'attribution_blocker';
  source: 'capture' | 'user_report' | 'system';
  note?: string;
}

export interface ContextSignals {
  hdAcneRawDelta?: number;
  hdTextureRawDelta?: number;
  hdMoistureRawDelta?: number;
}

export interface RednessEvaluationInput {
  frameworkVersion: string;
  schemaVersion: string;
  trialId: string;
  productId: string;
  assignedJob: 'calm_visible_redness';
  expectedObservationWindowDays: ObservationWindowDays;
  actualObservationIntervalDays: number;
  evaluatedAt: string;
  baseline: EvidencePeriodInput;
  endpoint: EvidencePeriodInput;
  threshold?: RednessThresholdConfiguration;
  maskEvidence: MaskEvidence;
  patientAnchor: PatientAnchor | null;
  tolerance: ToleranceEvidence | null;
  adherence: AdherenceEvidence;
  confounders: ConfounderFlag[];
  secondProductStatus: 'none' | 'possible_overlap' | 'active_overlap';
  contextSignals?: ContextSignals;
}

export interface DirectionAgreement {
  status: 'not_available' | 'agreeing' | 'mixed' | 'contradicted';
  assessedEndpointFrameCount: number;
  improvingEndpointFrameCount: number;
  contradictionDetected: boolean;
}

export interface AuditTraceEntry {
  ruleId: string;
  outcome: 'pass' | 'limited' | 'fail' | 'selected' | 'not_available';
  detail: string;
}

export interface RednessInterpretation {
  finding: string;
  nonFinding: string;
  limitations: string[];
  claimBoundary: string[];
  recommendedAction: RednessAction;
  explanation: string;
}

export interface RednessEvaluationSnapshot {
  frameworkVersion: typeof REDNESS_FRAMEWORK_VERSION;
  schemaVersion: typeof REDNESS_SCHEMA_VERSION;
  engineVersion: string;
  evaluatedAt: string;
  trialId: string;
  productId: string;
  assignedJob: 'calm_visible_redness';
  expectedObservationWindowDays: ObservationWindowDays;
  actualObservationIntervalDays: number;
  observationWindowStatus: 'too_early' | 'within_window' | 'past_maximum';
  baseline: EvidencePeriod;
  endpoint: EvidencePeriod;
  baselineRawMedian: number | null;
  endpointRawMedian: number | null;
  rawScoreDelta: number | null;
  threshold: RednessThresholdConfiguration;
  effectClassification: EffectClassification | null;
  measurementQuality: MeasurementQuality;
  attributionQuality: AttributionQuality;
  evidenceQuality: EvidenceQuality;
  safetyStatus: SafetyStatus;
  directionAgreement: DirectionAgreement;
  corroboratingSignals: Array<'mask' | 'patient_anchor'>;
  maskEvidence: MaskEvidence;
  patientAnchor: PatientAnchor | null;
  tolerance: (ToleranceEvidence & { safetyStatus: SafetyStatus }) | null;
  adherence: AdherenceEvidence;
  confounders: ConfounderFlag[];
  secondProductStatus: 'none' | 'possible_overlap' | 'active_overlap';
  contextSignals: ContextSignals;
  versions: RednessVersionMetadata;
  interpretation: RednessInterpretation;
  reasons: string[];
  missingEvidence: string[];
  triggeredRuleIds: string[];
  auditTrace: AuditTraceEntry[];
  privacy: {
    includesFaceImage: false;
    rawApiResponseHash?: string;
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function containsForbiddenEvidenceKey(value: unknown, visited = new WeakSet<object>()): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenEvidenceKey(item, visited));
  }
  const record = value as Record<string, unknown>;
  if ('ui_score' in record || 'uiScore' in record) return true;
  return Object.values(record).some((item) => containsForbiddenEvidenceKey(item, visited));
}

export function isRednessEvaluationSnapshot(value: unknown): value is RednessEvaluationSnapshot {
  if (
    !isObject(value) ||
    !isObject(value.interpretation) ||
    !isObject(value.threshold) ||
    !isObject(value.versions) ||
    containsForbiddenEvidenceKey(value)
  ) {
    return false;
  }

  return (
    value.frameworkVersion === REDNESS_FRAMEWORK_VERSION &&
    value.schemaVersion === REDNESS_SCHEMA_VERSION &&
    typeof value.engineVersion === 'string' &&
    value.engineVersion.length > 0 &&
    value.assignedJob === 'calm_visible_redness' &&
    typeof value.trialId === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.evaluatedAt === 'string' &&
    ['invalid', 'limited', 'adequate', 'strong'].includes(String(value.measurementQuality)) &&
    ['blocked', 'weak', 'moderate', 'strong'].includes(String(value.attributionQuality)) &&
    ['insufficient', 'possible', 'likely'].includes(String(value.evidenceQuality)) &&
    ['clear', 'check_required', 'interrupted'].includes(String(value.safetyStatus)) &&
    ['keep', 'test_longer', 'retry_alone', 'not_proving_job', 'safety_interruption'].includes(
      String(value.interpretation.recommendedAction),
    ) &&
    typeof value.interpretation.finding === 'string' &&
    typeof value.interpretation.nonFinding === 'string' &&
    typeof value.interpretation.explanation === 'string' &&
    Array.isArray(value.interpretation.limitations) &&
    Array.isArray(value.interpretation.claimBoundary) &&
    Array.isArray(value.reasons) &&
    Array.isArray(value.missingEvidence) &&
    Array.isArray(value.triggeredRuleIds) &&
    Array.isArray(value.auditTrace) &&
    typeof value.threshold.version === 'string' &&
    typeof value.threshold.configHash === 'string' &&
    typeof value.threshold.provisional === 'boolean' &&
    ['provisional_fixture', 'technical_calibration', 'longitudinal_calibration'].includes(
      String(value.threshold.source),
    ) &&
    (value.threshold.source !== 'provisional_fixture' || value.threshold.provisional === true) &&
    typeof value.versions.apiVersion === 'string' &&
    typeof value.versions.analysisModelVersion === 'string' &&
    value.versions.analysisMode === 'hd' &&
    typeof value.versions.appBuildVersion === 'string' &&
    typeof value.versions.preprocessingVersion === 'string' &&
    typeof value.versions.captureProtocolVersion === 'string' &&
    isObject(value.privacy) &&
    value.privacy.includesFaceImage === false
  );
}
