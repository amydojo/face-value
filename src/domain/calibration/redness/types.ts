import type { CaptureQuality } from '../../evidence/redness';
import type { RednessEvidenceBurst } from '../../model';

export const REDNESS_CALIBRATION_OBSERVATION_SCHEMA =
  'redness-calibration-observation-v1' as const;
export const REDNESS_CALIBRATION_ANALYSIS_MODE = 'hd' as const;

export type RednessCalibrationConditionType =
  | 'standard'
  | 'no_treatment_longitudinal'
  | 'degraded';

export type RednessCalibrationCollectionSource =
  | 'live_provider'
  | 'synthetic_face_free_fixture';

export type CalibrationReportedState = 'absent' | 'present' | 'not_reported';

export interface RednessCalibrationPreCaptureContext {
  makeup: CalibrationReportedState;
  concealer: CalibrationReportedState;
  tintedMoisturizer: CalibrationReportedState;
  tintedSpf: CalibrationReportedState;
  filter: CalibrationReportedState;
  selfTanner: CalibrationReportedState;
  otherEnhancement: CalibrationReportedState;
  recentHeat: CalibrationReportedState;
  recentExercise: CalibrationReportedState;
  recentShower: CalibrationReportedState;
  recentCleansing: CalibrationReportedState;
  recentRubbing: CalibrationReportedState;
  recentSunExposure: CalibrationReportedState;
  recentProcedureOrIllness: CalibrationReportedState;
  medicationOrRoutineChange: CalibrationReportedState;
  emotionalFlushing: CalibrationReportedState;
  timeOfDay: string | 'not_reported';
  productRoutineState: 'no_intervention' | 'explicit_change' | 'not_reported';
}

export type RednessCalibrationConfounderCode =
  | 'makeup_or_tint'
  | 'filter_or_enhancement'
  | 'recent_heat'
  | 'recent_exercise'
  | 'recent_shower'
  | 'recent_cleansing'
  | 'recent_rubbing'
  | 'recent_sun_exposure'
  | 'recent_procedure_or_illness'
  | 'medication_or_routine_change'
  | 'emotional_flushing'
  | 'explicit_intervention'
  | 'degraded_capture_condition';

export interface RednessCalibrationConfounder {
  code: RednessCalibrationConfounderCode;
  severity: 'downgrade' | 'hard_failure' | 'exclusion';
  source: 'capture' | 'participant_report' | 'protocol';
}

export interface RednessCalibrationUnavailableMetrics {
  lightingMetrics: 'not_available';
  poseMetrics: 'not_available';
  cropMetrics: 'not_available';
  faceSizeMetrics: 'not_available';
  colorCastMetrics: 'not_available';
  facialRegistrationQuality: 'not_available';
  eligibleSkinPixelCount: 'not_available';
  rednessMaskPixelCount: 'not_available';
  rednessMaskAreaPct: 'not_available';
  baselineRegionOverlap: 'not_available';
  segmentationStability: 'not_available';
}

export type RednessCalibrationComparisonAnchor =
  | 'not_available'
  | {
      rawScore: number;
      expectedDirection: 'no_change' | 'improvement' | 'worsening';
    };

/**
 * Face-free, append-only observation produced at the completed burst boundary.
 * Incomplete/hard-failure bursts remain representable so exclusions can be
 * inspected instead of silently dropped.
 */
export interface RednessCalibrationObservation {
  schemaVersion: typeof REDNESS_CALIBRATION_OBSERVATION_SCHEMA;
  observationId: string;
  participantId: string;
  sessionId: string;
  conditionId: string;
  conditionType: RednessCalibrationConditionType;
  collectionSource: RednessCalibrationCollectionSource;
  captureTimestamp: string;
  deviceClass: string;
  cameraFacing: 'front';
  appBuildVersion: string;
  apiVersion: string;
  analysisModelVersion: string | 'not_reported';
  analysisMode: typeof REDNESS_CALIBRATION_ANALYSIS_MODE;
  preprocessingVersion: string;
  captureProtocolVersion: string;
  thresholdCandidateVersion: string;
  burst: RednessEvidenceBurst;
  sessionRawMedian: number | 'not_available';
  captureQuality: CaptureQuality;
  captureOutcome: 'accepted' | 'hard_failure';
  preCaptureContext: RednessCalibrationPreCaptureContext;
  confounders: RednessCalibrationConfounder[];
  comparisonAnchor: RednessCalibrationComparisonAnchor;
  measuredSkinToneGroup: string | null;
  measuredSkinToneSource: 'not_collected' | 'validated_audit_input';
  unavailableMetrics: RednessCalibrationUnavailableMetrics;
  includesFaceImage: false;
}

export const REDNESS_CALIBRATION_UNAVAILABLE_METRICS: Readonly<RednessCalibrationUnavailableMetrics> =
  Object.freeze({
    lightingMetrics: 'not_available',
    poseMetrics: 'not_available',
    cropMetrics: 'not_available',
    faceSizeMetrics: 'not_available',
    colorCastMetrics: 'not_available',
    facialRegistrationQuality: 'not_available',
    eligibleSkinPixelCount: 'not_available',
    rednessMaskPixelCount: 'not_available',
    rednessMaskAreaPct: 'not_available',
    baselineRegionOverlap: 'not_available',
    segmentationStability: 'not_available',
  });
