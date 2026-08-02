import { canonicalJson } from './canonicalJson';
import type { RednessCalibrationAnalysis } from './analysis';
import type { EstimableInterval } from './statistics';
import {
  REDNESS_CALIBRATION_MAX_FIELD_BYTES,
  rednessCalibrationOversizedStringPaths,
  rednessCalibrationUtf8Bytes,
} from './validation';

export const REDNESS_CALIBRATION_REGISTRY_VERSION = 'redness-exploratory-calibration-v1' as const;
export const REDNESS_CALIBRATION_MAX_REGISTRY_BYTES = 64 * 1024;

export interface RednessCalibrationRegistryEntry {
  threshold_version: typeof REDNESS_CALIBRATION_REGISTRY_VERSION;
  threshold_source: 'technical_calibration';
  calibration_sample_size: number;
  participant_count: number;
  session_count: number;
  frame_count: number;
  technical_n95: number | null;
  longitudinal_n95: number | null;
  repeatability_coefficient: number | null;
  within_person_sd: number | null;
  icc_variant: 'ICC(A,1)';
  icc_value: number | null;
  bootstrap_ci: {
    technical_n95: EstimableInterval;
    longitudinal_n95: EstimableInterval;
    repeatability_coefficient: EstimableInterval;
  };
  false_change_rate: number | null;
  rejection_rate: number | null;
  supported_device_classes: string[];
  api_version: string;
  analysis_model_version: string;
  preprocessing_version: string;
  capture_protocol_version: string;
  created_at: string;
  approved_by: null;
  status: 'exploratory';
  provisional: true;
  config_hash: string;
}

type UnsignedRegistryEntry = Omit<RednessCalibrationRegistryEntry, 'config_hash'>;

function versionSummary(rows: Array<{ key: string; eligibleObservationCount: number }>): string {
  const versions = rows
    .filter(({ eligibleObservationCount }) => eligibleObservationCount > 0)
    .map(({ key }) => key)
    .sort();
  if (versions.length === 0) return 'not_available';
  return versions.length === 1 ? versions[0] : `mixed:${versions.join('|')}`;
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 registry export requires Web Crypto.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildExploratoryRednessCalibrationRegistry(input: {
  analysis: RednessCalibrationAnalysis;
  createdAt: string;
}): Promise<RednessCalibrationRegistryEntry> {
  if (
    !Number.isFinite(Date.parse(input.createdAt)) ||
    rednessCalibrationUtf8Bytes(input.createdAt) > REDNESS_CALIBRATION_MAX_FIELD_BYTES
  ) {
    throw new Error('Exploratory registry export requires an explicit valid creation timestamp.');
  }
  const composite = input.analysis.thresholdCandidates.find(
    ({ id }) => id === 'conservative_composite',
  );
  const unsigned: UnsignedRegistryEntry = {
    threshold_version: REDNESS_CALIBRATION_REGISTRY_VERSION,
    threshold_source: 'technical_calibration',
    calibration_sample_size: input.analysis.counts.eligibleObservationCount,
    participant_count: input.analysis.counts.participantCount,
    session_count: input.analysis.counts.sessionCount,
    frame_count: input.analysis.counts.acceptedFrameCount,
    technical_n95: input.analysis.technicalN95.value,
    longitudinal_n95: input.analysis.longitudinalN95.value,
    repeatability_coefficient: input.analysis.repeatabilityCoefficient.value,
    within_person_sd: input.analysis.withinPersonSd.value,
    icc_variant: 'ICC(A,1)',
    icc_value: input.analysis.icc.status === 'estimated' ? input.analysis.icc.value : null,
    bootstrap_ci: {
      technical_n95: structuredClone(input.analysis.technicalN95.confidenceInterval),
      longitudinal_n95: structuredClone(input.analysis.longitudinalN95.confidenceInterval),
      repeatability_coefficient: structuredClone(
        input.analysis.repeatabilityCoefficient.confidenceInterval,
      ),
    },
    false_change_rate: composite?.falseChangeRate ?? null,
    rejection_rate: input.analysis.rejection.rate,
    supported_device_classes: input.analysis.breakdowns.byDeviceClass
      .filter(({ eligibleObservationCount }) => eligibleObservationCount > 0)
      .map(({ key }) => key)
      .sort(),
    api_version: versionSummary(input.analysis.breakdowns.byApiVersion),
    analysis_model_version: versionSummary(input.analysis.breakdowns.byAnalysisModelVersion),
    preprocessing_version: input.analysis.configuration.compatiblePreprocessingVersion,
    capture_protocol_version: input.analysis.configuration.compatibleCaptureProtocolVersion,
    created_at: input.createdAt,
    approved_by: null,
    status: 'exploratory',
    provisional: true,
  };
  const config_hash = `sha256:${await sha256Hex(canonicalJson(unsigned))}`;
  return { ...unsigned, config_hash };
}

export function serializeRednessCalibrationRegistry(
  entry: RednessCalibrationRegistryEntry,
): string {
  if (
    entry.threshold_source !== 'technical_calibration' ||
    entry.status !== 'exploratory' ||
    entry.approved_by !== null ||
    entry.provisional !== true
  ) {
    throw new Error('Issue 65 registry output must remain exploratory and provisional.');
  }
  if (rednessCalibrationOversizedStringPaths(entry).length > 0) {
    throw new Error('Exploratory registry export contains an oversized text field.');
  }
  const serialized = canonicalJson(entry);
  if (rednessCalibrationUtf8Bytes(serialized) > REDNESS_CALIBRATION_MAX_REGISTRY_BYTES) {
    throw new Error('Exploratory registry export exceeds its serialized byte bound.');
  }
  return serialized;
}
