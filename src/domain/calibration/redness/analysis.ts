import type { EffectClassification } from '../../evidence/redness';
import type { RednessCalibrationObservation } from './types';
import { validateRednessCalibrationObservation } from './validation';
import {
  REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM,
  REDNESS_CALIBRATION_QUANTILE_METHOD,
  empiricalQuantileR7,
  iccAbsoluteAgreementSingle,
  medianR7,
  participantClusterBootstrap,
  repeatabilityCoefficient,
  wilsonRateInterval,
  withinClusterResidualSd,
  type EstimableInterval,
  type IccEstimate,
} from './statistics';

export const REDNESS_CALIBRATION_ANALYSIS_VERSION = 'redness-calibration-analysis-v1' as const;
export const REDNESS_CALIBRATION_DEFAULT_BOOTSTRAP_SEED = 650_065 as const;
export const REDNESS_CALIBRATION_DEFAULT_BOOTSTRAP_ITERATIONS = 2_000 as const;

export const REDNESS_CALIBRATION_METHODS = Object.freeze({
  technicalPooling:
    'All unordered matched standard burst-median pairs within participant, calibration session, and condition; longitudinal sessions are excluded.',
  longitudinalPairing:
    'All valid within-participant session-median pairs sharing one no-treatment condition ID.',
  withinPerson:
    'Residual SD around participant means using every eligible observation median, retaining formal recaptures, and N minus participant residual degrees of freedom.',
  repeatabilityCoefficient: '1.96 × sqrt(2) × within-person SD',
  quantile: REDNESS_CALIBRATION_QUANTILE_METHOD,
  bootstrap: REDNESS_CALIBRATION_BOOTSTRAP_ALGORITHM,
  conservativeComposite:
    'Maximum finite Technical N95, Longitudinal N95, and repeatability-coefficient estimate; display only.',
  falseChange:
    'Eligible signed matched standard formal-recapture burst-median pairs plus matched no-treatment session-median pairs classified outside the no-detectable-change zone.',
});

export interface RednessCalibrationAnalysisOptions {
  bootstrapSeed?: number;
  bootstrapIterations?: number;
  compatibleApiVersion?: string;
  compatibleAnalysisModelVersion?: string;
  compatiblePreprocessingVersion?: string;
  compatibleCaptureProtocolVersion?: string;
}

export type RednessCalibrationExclusionReason =
  | 'corrupt_observation'
  | 'hard_capture_failure'
  | 'incompatible_api_version'
  | 'incompatible_analysis_model_version'
  | 'incompatible_analysis_mode'
  | 'incompatible_preprocessing_version'
  | 'incompatible_capture_protocol_version'
  | 'explicit_intervention'
  | 'degraded_condition'
  | 'missing_or_non_finite_raw_score'
  | 'fewer_than_three_accepted_frames';

export interface RednessCalibrationExclusion {
  observationId: string;
  participantId: string;
  sessionId: string;
  reasons: RednessCalibrationExclusionReason[];
  validationIssueCodes: string[];
}

export interface WithinBurstAgreement {
  observationId: string;
  participantId: string;
  sessionId: string;
  conditionType: RednessCalibrationObservation['conditionType'];
  acceptedScoreCount: number;
  rejectedFrameCount: number;
  rawScores: number[];
  sessionMedian: number | null;
  range: number | null;
  absolutePairwiseDifferences: number[];
  directionAgreement: {
    status: 'not_available' | 'agreeing' | 'mixed' | 'contradicted';
    assessedFrameCount: number;
    expectedDirection: 'not_available' | 'no_change' | 'improvement' | 'worsening';
  };
}

export interface CalibrationMetricEstimate {
  status: 'estimated' | 'not_estimable';
  value: number | null;
  reason: string | null;
  method: string;
  sampleCount: number;
  participantCount: number;
  sessionCount: number;
  frameCount: number;
  confidenceInterval: EstimableInterval;
}

export interface WithinPersonEstimate {
  status: 'estimated' | 'not_estimable';
  value: number | null;
  reason: string | null;
  method: string;
  observationCount: number;
  participantCount: number;
  residualDegreesOfFreedom: number;
}

export interface RepeatabilityCoefficientEstimate {
  status: 'estimated' | 'not_estimable';
  value: number | null;
  reason: string | null;
  formula: '1.96 × sqrt(2) × within-person SD';
  withinPersonSd: number | null;
  confidenceInterval: EstimableInterval;
}

interface NoChangeComparisonBase {
  comparisonId: string;
  participantId: string;
  earlierSessionId: string;
  laterSessionId: string;
  signedDifference: number;
  absoluteDifference: number;
}

export type NoChangeComparison = NoChangeComparisonBase &
  (
    | {
        kind: 'matched_formal_recapture';
        earlierObservationId: string;
        laterObservationId: string;
        conditionId: string;
      }
    | { kind: 'matched_longitudinal' }
  );

export interface ThresholdCandidateComparison {
  id:
    | 'provisional_5_10'
    | 'technical_n95'
    | 'longitudinal_n95'
    | 'repeatability_coefficient'
    | 'conservative_composite';
  label: string;
  authority: 'currently_used_by_consumer_trials' | 'exploratory_only';
  estimateStatus: 'available' | 'not_estimable';
  unavailableReason: string | null;
  detectableBoundary: number | null;
  strongBoundary: number | null;
  falseChangeCount: number;
  validNoChangeComparisonCount: number;
  falseChangeRate: number | null;
  uncertaintyInterval: EstimableInterval;
  classificationCounts: Record<EffectClassification, number>;
}

export interface CalibrationBreakdown {
  key: string;
  observationCount: number;
  eligibleObservationCount: number;
  acceptedFrameCount: number;
  rejectedFrameCount: number;
  attemptedFrameCount: number;
  rejectionRate: number | null;
  medianRepeatedCaptureRange: number | null;
  maximumRepeatedCaptureRange: number | null;
}

export interface RednessCalibrationAnalysis {
  analysisVersion: typeof REDNESS_CALIBRATION_ANALYSIS_VERSION;
  preliminary: true;
  methods: typeof REDNESS_CALIBRATION_METHODS;
  configuration: {
    bootstrapSeed: number;
    bootstrapIterations: number;
    compatibleApiVersion: string;
    compatibleAnalysisModelVersion: string;
    compatibleAnalysisMode: 'hd';
    compatiblePreprocessingVersion: string;
    compatibleCaptureProtocolVersion: string;
  };
  observations: WithinBurstAgreement[];
  exclusions: RednessCalibrationExclusion[];
  eligibleObservationIds: string[];
  technicalN95: CalibrationMetricEstimate;
  longitudinalN95: CalibrationMetricEstimate;
  withinPersonSd: WithinPersonEstimate;
  repeatabilityCoefficient: RepeatabilityCoefficientEstimate;
  icc: IccEstimate;
  noChangeComparisons: NoChangeComparison[];
  thresholdCandidates: ThresholdCandidateComparison[];
  rejection: {
    rejectedFrameCount: number;
    attemptedFrameCount: number;
    rate: number | null;
    uncertaintyInterval: EstimableInterval;
  };
  repeatedCaptureRange: {
    median: number | null;
    maximum: number | null;
  };
  counts: {
    observationCount: number;
    eligibleObservationCount: number;
    participantCount: number;
    sessionCount: number;
    acceptedFrameCount: number;
  };
  breakdowns: {
    byDeviceClass: CalibrationBreakdown[];
    byApiVersion: CalibrationBreakdown[];
    byAnalysisModelVersion: CalibrationBreakdown[];
    byConditionType: CalibrationBreakdown[];
    measuredSkinTone: {
      status: 'not_collected' | 'available';
      groups: CalibrationBreakdown[];
    };
  };
}

const safeId = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)
    ? value
    : 'unavailable';

const uniqueCount = (values: string[]): number => new Set(values).size;

function pairwise(
  values: number[],
): Array<{ signed: number; absolute: number; left: number; right: number }> {
  const differences: Array<{ signed: number; absolute: number; left: number; right: number }> = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const signed = values[right] - values[left];
      differences.push({ signed, absolute: Math.abs(signed), left, right });
    }
  }
  return differences;
}

function range(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return Math.max(...finite) - Math.min(...finite);
}

function directionAgreementFor(
  observation: RednessCalibrationObservation,
  scores: number[],
): WithinBurstAgreement['directionAgreement'] {
  if (observation.comparisonAnchor === 'not_available') {
    return {
      status: 'not_available',
      assessedFrameCount: 0,
      expectedDirection: 'not_available',
    };
  }
  const anchor = observation.comparisonAnchor;
  const directions = scores.map((score) => Math.sign(score - anchor.rawScore));
  const positive = directions.filter((direction) => direction > 0).length;
  const negative = directions.filter((direction) => direction < 0).length;
  const expected = anchor.expectedDirection;
  if (expected === 'no_change') {
    return {
      status:
        positive > 0 && negative > 0
          ? 'mixed'
          : positive > 0 || negative > 0
            ? 'contradicted'
            : 'agreeing',
      assessedFrameCount: scores.length,
      expectedDirection: expected,
    };
  }
  const expectedSign = expected === 'improvement' ? 1 : -1;
  const agreeing = directions.filter((direction) => direction === expectedSign).length;
  const contradicting = directions.filter((direction) => direction === -expectedSign).length;
  return {
    status:
      contradicting > 0 && agreeing > 0
        ? 'mixed'
        : contradicting > 0 || agreeing === 0
          ? 'contradicted'
          : 'agreeing',
    assessedFrameCount: scores.length,
    expectedDirection: expected,
  };
}

function structuralEligibilityReasons(value: unknown): RednessCalibrationExclusionReason[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['missing_or_non_finite_raw_score', 'fewer_than_three_accepted_frames'];
  }
  const burst = (value as Record<string, unknown>).burst;
  if (typeof burst !== 'object' || burst === null || Array.isArray(burst)) {
    return ['missing_or_non_finite_raw_score', 'fewer_than_three_accepted_frames'];
  }
  const acceptedFrames = (burst as Record<string, unknown>).acceptedFrames;
  if (!Array.isArray(acceptedFrames)) {
    return ['missing_or_non_finite_raw_score', 'fewer_than_three_accepted_frames'];
  }
  const rawScores = acceptedFrames.map((frame) => {
    if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) return undefined;
    const signal = (frame as Record<string, unknown>).signal;
    if (typeof signal !== 'object' || signal === null || Array.isArray(signal)) return undefined;
    return (signal as Record<string, unknown>).rawScore;
  });
  const reasons: RednessCalibrationExclusionReason[] = [];
  if (rawScores.some((score) => typeof score !== 'number' || !Number.isFinite(score))) {
    reasons.push('missing_or_non_finite_raw_score');
  }
  if (acceptedFrames.length < 3) reasons.push('fewer_than_three_accepted_frames');
  return reasons;
}

function withinBurst(observation: RednessCalibrationObservation): WithinBurstAgreement {
  const rawScores = observation.burst.acceptedFrames
    .map((frame) => frame.signal.rawScore)
    .filter(Number.isFinite);
  return {
    observationId: observation.observationId,
    participantId: observation.participantId,
    sessionId: observation.sessionId,
    conditionType: observation.conditionType,
    acceptedScoreCount: rawScores.length,
    rejectedFrameCount: observation.burst.rejectedFrames.length,
    rawScores,
    sessionMedian:
      observation.sessionRawMedian === 'not_available' ? null : observation.sessionRawMedian,
    range: range(rawScores),
    absolutePairwiseDifferences: pairwise(rawScores).map(({ absolute }) => absolute),
    directionAgreement: directionAgreementFor(observation, rawScores),
  };
}

function eligibilityReasons(
  observation: RednessCalibrationObservation,
  configuration: RednessCalibrationAnalysis['configuration'],
): RednessCalibrationExclusionReason[] {
  const reasons: RednessCalibrationExclusionReason[] = [];
  const scores = observation.burst.acceptedFrames.map((frame) => frame.signal.rawScore);
  const captureFailure =
    observation.captureOutcome === 'hard_failure' ||
    !observation.captureQuality.accepted ||
    observation.captureQuality.obstructionPresent ||
    observation.captureQuality.enhancementDetected ||
    [
      observation.captureQuality.lightingComparability,
      observation.captureQuality.poseComparability,
      observation.captureQuality.cropComparability,
      observation.captureQuality.faceSizeComparability,
      observation.captureQuality.colorCastComparability,
    ].includes('fail') ||
    observation.confounders.some(({ severity }) => severity === 'hard_failure');
  if (captureFailure) reasons.push('hard_capture_failure');
  if (observation.apiVersion !== configuration.compatibleApiVersion) {
    reasons.push('incompatible_api_version');
  }
  if (observation.analysisModelVersion !== configuration.compatibleAnalysisModelVersion) {
    reasons.push('incompatible_analysis_model_version');
  }
  if (observation.analysisMode !== configuration.compatibleAnalysisMode) {
    reasons.push('incompatible_analysis_mode');
  }
  if (observation.preprocessingVersion !== configuration.compatiblePreprocessingVersion) {
    reasons.push('incompatible_preprocessing_version');
  }
  if (observation.captureProtocolVersion !== configuration.compatibleCaptureProtocolVersion) {
    reasons.push('incompatible_capture_protocol_version');
  }
  if (
    observation.preCaptureContext.productRoutineState === 'explicit_change' ||
    observation.confounders.some(({ code }) => code === 'explicit_intervention')
  ) {
    reasons.push('explicit_intervention');
  }
  if (observation.conditionType === 'degraded') reasons.push('degraded_condition');
  if (scores.some((score) => !Number.isFinite(score))) {
    reasons.push('missing_or_non_finite_raw_score');
  }
  if (scores.length < 3) reasons.push('fewer_than_three_accepted_frames');
  return reasons;
}

interface SessionPoint {
  participantId: string;
  sessionId: string;
  conditionId: string;
  conditionType: RednessCalibrationObservation['conditionType'];
  timestamp: string;
  median: number;
}

function sessionPoints(observations: RednessCalibrationObservation[]): SessionPoint[] {
  const grouped = new Map<string, RednessCalibrationObservation[]>();
  for (const observation of observations) {
    const key = [
      observation.participantId,
      observation.sessionId,
      observation.conditionId,
      observation.conditionType,
    ].join('\u001f');
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }
  const points: SessionPoint[] = [];
  for (const group of grouped.values()) {
    const medians = group
      .map(({ sessionRawMedian }) => sessionRawMedian)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const sessionMedian = medianR7(medians);
    if (sessionMedian === null) continue;
    const first = [...group].sort((left, right) =>
      left.captureTimestamp.localeCompare(right.captureTimestamp),
    )[0];
    points.push({
      participantId: first.participantId,
      sessionId: first.sessionId,
      conditionId: first.conditionId,
      conditionType: first.conditionType,
      timestamp: first.captureTimestamp,
      median: sessionMedian,
    });
  }
  return points.sort((left, right) => {
    const participant = left.participantId.localeCompare(right.participantId);
    if (participant !== 0) return participant;
    const timestamp = left.timestamp.localeCompare(right.timestamp);
    return timestamp === 0 ? left.sessionId.localeCompare(right.sessionId) : timestamp;
  });
}

function observationMedianPoints(observations: RednessCalibrationObservation[]): SessionPoint[] {
  return observations
    .filter(
      (observation) =>
        typeof observation.sessionRawMedian === 'number' &&
        Number.isFinite(observation.sessionRawMedian),
    )
    .map((observation) => ({
      participantId: observation.participantId,
      sessionId: `${observation.sessionId}:${observation.observationId}`,
      conditionId: observation.conditionId,
      conditionType: observation.conditionType,
      timestamp: observation.captureTimestamp,
      median: observation.sessionRawMedian as number,
    }))
    .sort((left, right) => {
      const participant = left.participantId.localeCompare(right.participantId);
      if (participant !== 0) return participant;
      const timestamp = left.timestamp.localeCompare(right.timestamp);
      return timestamp === 0 ? left.sessionId.localeCompare(right.sessionId) : timestamp;
    });
}

function longitudinalComparisons(points: SessionPoint[]): NoChangeComparison[] {
  const groups = new Map<string, SessionPoint[]>();
  for (const point of points.filter(
    ({ conditionType }) => conditionType === 'no_treatment_longitudinal',
  )) {
    const key = `${point.participantId}\u001f${point.conditionId}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  const comparisons: NoChangeComparison[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => {
      const timestamp = left.timestamp.localeCompare(right.timestamp);
      return timestamp === 0 ? left.sessionId.localeCompare(right.sessionId) : timestamp;
    });
    for (let left = 0; left < sorted.length; left += 1) {
      for (let right = left + 1; right < sorted.length; right += 1) {
        const earlier = sorted[left];
        const later = sorted[right];
        const signedDifference = later.median - earlier.median;
        comparisons.push({
          comparisonId: `longitudinal:${earlier.participantId}:${earlier.sessionId}:${later.sessionId}`,
          participantId: earlier.participantId,
          kind: 'matched_longitudinal',
          earlierSessionId: earlier.sessionId,
          laterSessionId: later.sessionId,
          signedDifference,
          absoluteDifference: Math.abs(signedDifference),
        });
      }
    }
  }
  return comparisons.sort((left, right) => left.comparisonId.localeCompare(right.comparisonId));
}

type FormalRecaptureComparison = Extract<NoChangeComparison, { kind: 'matched_formal_recapture' }>;

function formalRecaptureComparisons(
  observations: RednessCalibrationObservation[],
): FormalRecaptureComparison[] {
  const groups = new Map<string, RednessCalibrationObservation[]>();
  for (const observation of observations.filter(
    ({ conditionType }) => conditionType === 'standard',
  )) {
    const key = [observation.participantId, observation.sessionId, observation.conditionId].join(
      '\u001f',
    );
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }

  const comparisons: FormalRecaptureComparison[] = [];
  for (const group of groups.values()) {
    const sorted = [...group]
      .filter(
        (observation) =>
          typeof observation.sessionRawMedian === 'number' &&
          Number.isFinite(observation.sessionRawMedian),
      )
      .sort((left, right) => {
        const timestamp = left.captureTimestamp.localeCompare(right.captureTimestamp);
        return timestamp === 0 ? left.observationId.localeCompare(right.observationId) : timestamp;
      });
    for (let left = 0; left < sorted.length; left += 1) {
      for (let right = left + 1; right < sorted.length; right += 1) {
        const earlier = sorted[left];
        const later = sorted[right];
        const signedDifference =
          (later.sessionRawMedian as number) - (earlier.sessionRawMedian as number);
        comparisons.push({
          comparisonId: `formal:${earlier.participantId}:${earlier.sessionId}:${earlier.conditionId}:${earlier.observationId}:${later.observationId}`,
          participantId: earlier.participantId,
          kind: 'matched_formal_recapture',
          earlierSessionId: earlier.sessionId,
          laterSessionId: later.sessionId,
          earlierObservationId: earlier.observationId,
          laterObservationId: later.observationId,
          conditionId: earlier.conditionId,
          signedDifference,
          absoluteDifference: Math.abs(signedDifference),
        });
      }
    }
  }
  return comparisons.sort((left, right) => left.comparisonId.localeCompare(right.comparisonId));
}

function iccForSessionPoints(points: SessionPoint[]): IccEstimate {
  const participantGroups = new Map<string, SessionPoint[]>();
  for (const point of points) {
    participantGroups.set(point.participantId, [
      ...(participantGroups.get(point.participantId) ?? []),
      point,
    ]);
  }
  const participants = [...participantGroups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const rows = participants.map(([, participantPoints]) => {
    const byCondition = new Map<SessionPoint['conditionType'], SessionPoint[]>();
    for (const point of participantPoints) {
      byCondition.set(point.conditionType, [
        ...(byCondition.get(point.conditionType) ?? []),
        point,
      ]);
    }
    return [...byCondition.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([conditionType, conditionPoints]) =>
        [...conditionPoints]
          .sort((left, right) => {
            const timestamp = left.timestamp.localeCompare(right.timestamp);
            return timestamp === 0 ? left.sessionId.localeCompare(right.sessionId) : timestamp;
          })
          .map((point, index) => ({
            slot: `${conditionType}:${index + 1}`,
            value: point.median,
          })),
      );
  });
  const referenceSlots = rows[0]?.map(({ slot }) => slot) ?? [];
  const aligned = rows.every(
    (row) =>
      row.length === referenceSlots.length &&
      row.every(({ slot }, index) => slot === referenceSlots[index]),
  );
  if (!aligned) {
    return {
      status: 'not_estimable',
      variant: 'ICC(A,1)',
      reason: 'ICC(A,1) requires the same ordered condition/occasion slots for every participant.',
      participantCount: participants.length,
      repeatedObservationCount: null,
      totalObservationCount: points.length,
      method: 'two-way random-effects absolute agreement single measurement',
    };
  }
  return iccAbsoluteAgreementSingle(rows.map((row) => row.map(({ value }) => value)));
}

function participantClusters<T>(
  values: T[],
  participantFor: (value: T) => string,
  numericFor: (value: T) => number[],
): number[][] {
  const groups = new Map<string, number[]>();
  for (const value of values) {
    const participant = participantFor(value);
    groups.set(participant, [...(groups.get(participant) ?? []), ...numericFor(value)]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, cluster]) => cluster);
}

function metricEstimate(input: {
  values: number[];
  clusters: number[][];
  seed: number;
  iterations: number;
  method: string;
  participantCount: number;
  sessionCount: number;
  frameCount: number;
}): CalibrationMetricEstimate {
  const value = empiricalQuantileR7(input.values, 0.95);
  const confidenceInterval = participantClusterBootstrap({
    clusters: input.clusters,
    seed: input.seed,
    iterations: input.iterations,
    statistic: (clusters) => empiricalQuantileR7(clusters.flat(), 0.95),
  });
  return value === null
    ? {
        status: 'not_estimable',
        value: null,
        reason: 'No eligible differences were available.',
        method: input.method,
        sampleCount: 0,
        participantCount: input.participantCount,
        sessionCount: input.sessionCount,
        frameCount: input.frameCount,
        confidenceInterval,
      }
    : {
        status: 'estimated',
        value,
        reason: null,
        method: input.method,
        sampleCount: input.values.length,
        participantCount: input.participantCount,
        sessionCount: input.sessionCount,
        frameCount: input.frameCount,
        confidenceInterval,
      };
}

function emptyClassificationCounts(): Record<EffectClassification, number> {
  return {
    worsened: 0,
    no_detectable_change: 0,
    directional_improvement: 0,
    meaningful_candidate: 0,
    strong_improvement: 0,
  };
}

function classifyCandidate(
  delta: number,
  detectable: number,
  strong: number,
  provisional: boolean,
): EffectClassification {
  if (delta <= -detectable) return 'worsened';
  if (delta < detectable) return 'no_detectable_change';
  if (provisional) return delta < strong ? 'directional_improvement' : 'strong_improvement';
  if (delta < detectable * 1.5) return 'directional_improvement';
  if (delta < strong) return 'meaningful_candidate';
  return 'strong_improvement';
}

function candidateComparison(input: {
  id: ThresholdCandidateComparison['id'];
  label: string;
  authority: ThresholdCandidateComparison['authority'];
  detectable: number | null;
  strong: number | null;
  unavailableReason?: string;
  comparisons: NoChangeComparison[];
}): ThresholdCandidateComparison {
  const counts = emptyClassificationCounts();
  if (
    input.detectable === null ||
    input.strong === null ||
    !Number.isFinite(input.detectable) ||
    !Number.isFinite(input.strong) ||
    input.detectable <= 0 ||
    input.strong <= input.detectable
  ) {
    return {
      id: input.id,
      label: input.label,
      authority: input.authority,
      estimateStatus: 'not_estimable',
      unavailableReason: input.unavailableReason ?? 'The candidate estimate is unavailable.',
      detectableBoundary: null,
      strongBoundary: null,
      falseChangeCount: 0,
      validNoChangeComparisonCount: input.comparisons.length,
      falseChangeRate: null,
      uncertaintyInterval: {
        status: 'not_estimable',
        reason: 'A finite candidate boundary is required.',
      },
      classificationCounts: counts,
    };
  }
  const provisional = input.id === 'provisional_5_10';
  for (const comparison of input.comparisons) {
    counts[
      classifyCandidate(comparison.signedDifference, input.detectable, input.strong, provisional)
    ] += 1;
  }
  const falseChangeCount = input.comparisons.length - counts.no_detectable_change;
  return {
    id: input.id,
    label: input.label,
    authority: input.authority,
    estimateStatus: 'available',
    unavailableReason: null,
    detectableBoundary: input.detectable,
    strongBoundary: input.strong,
    falseChangeCount,
    validNoChangeComparisonCount: input.comparisons.length,
    falseChangeRate:
      input.comparisons.length === 0 ? null : falseChangeCount / input.comparisons.length,
    uncertaintyInterval: wilsonRateInterval(falseChangeCount, input.comparisons.length),
    classificationCounts: counts,
  };
}

function breakdownsFor(input: {
  observations: RednessCalibrationObservation[];
  eligibleIds: Set<string>;
  keyFor: (observation: RednessCalibrationObservation) => string;
}): CalibrationBreakdown[] {
  const groups = new Map<string, RednessCalibrationObservation[]>();
  for (const observation of input.observations) {
    const key = input.keyFor(observation);
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, observations]) => {
      const attemptedFrameCount = observations.reduce(
        (total, observation) => total + observation.burst.attemptedFrameCount,
        0,
      );
      const rejectedFrameCount = observations.reduce(
        (total, observation) => total + observation.burst.rejectedFrames.length,
        0,
      );
      const acceptedFrameCount = observations.reduce(
        (total, observation) => total + observation.burst.acceptedFrames.length,
        0,
      );
      const ranges = observations
        .map((observation) =>
          range(observation.burst.acceptedFrames.map(({ signal }) => signal.rawScore)),
        )
        .filter((value): value is number => value !== null);
      return {
        key,
        observationCount: observations.length,
        eligibleObservationCount: observations.filter(({ observationId }) =>
          input.eligibleIds.has(observationId),
        ).length,
        acceptedFrameCount,
        rejectedFrameCount,
        attemptedFrameCount,
        rejectionRate: attemptedFrameCount === 0 ? null : rejectedFrameCount / attemptedFrameCount,
        medianRepeatedCaptureRange: medianR7(ranges),
        maximumRepeatedCaptureRange: ranges.length === 0 ? null : Math.max(...ranges),
      };
    });
}

export function analyzeRednessCalibration(
  input: RednessCalibrationObservation[],
  options: RednessCalibrationAnalysisOptions = {},
): RednessCalibrationAnalysis {
  const configuration: RednessCalibrationAnalysis['configuration'] = {
    bootstrapSeed: options.bootstrapSeed ?? REDNESS_CALIBRATION_DEFAULT_BOOTSTRAP_SEED,
    bootstrapIterations:
      options.bootstrapIterations ?? REDNESS_CALIBRATION_DEFAULT_BOOTSTRAP_ITERATIONS,
    compatibleApiVersion: options.compatibleApiVersion ?? '2.1',
    compatibleAnalysisModelVersion: options.compatibleAnalysisModelVersion ?? 'not_reported',
    compatibleAnalysisMode: 'hd',
    compatiblePreprocessingVersion:
      options.compatiblePreprocessingVersion ?? 'face-value-unmodified-upload-v1',
    compatibleCaptureProtocolVersion:
      options.compatibleCaptureProtocolVersion ?? 'face-value-youcam-1',
  };
  const observations: RednessCalibrationObservation[] = [];
  const exclusions: RednessCalibrationExclusion[] = [];
  for (const candidate of input) {
    const validation = validateRednessCalibrationObservation(candidate);
    if (!validation.valid) {
      exclusions.push({
        observationId: safeId((candidate as RednessCalibrationObservation).observationId),
        participantId: safeId((candidate as RednessCalibrationObservation).participantId),
        sessionId: safeId((candidate as RednessCalibrationObservation).sessionId),
        reasons: ['corrupt_observation', ...structuralEligibilityReasons(candidate)],
        validationIssueCodes: [...new Set(validation.issues.map(({ code }) => code))],
      });
      continue;
    }
    observations.push(validation.observation);
  }

  const eligible: RednessCalibrationObservation[] = [];
  for (const observation of observations) {
    const reasons = eligibilityReasons(observation, configuration);
    if (reasons.length === 0) eligible.push(observation);
    else {
      exclusions.push({
        observationId: observation.observationId,
        participantId: observation.participantId,
        sessionId: observation.sessionId,
        reasons,
        validationIssueCodes: [],
      });
    }
  }
  exclusions.sort((left, right) => left.observationId.localeCompare(right.observationId));
  const eligibleIds = new Set(eligible.map(({ observationId }) => observationId));
  const agreement = observations.map(withinBurst);
  const technical = formalRecaptureComparisons(eligible);
  const technicalDifferences = technical.map(({ absoluteDifference }) => absoluteDifference);
  const technicalClusters = participantClusters(
    technical,
    ({ participantId }) => participantId,
    ({ absoluteDifference }) => [absoluteDifference],
  );
  const longitudinalPoints = sessionPoints(eligible);
  const longitudinal = longitudinalComparisons(longitudinalPoints);
  const longitudinalClusters = participantClusters(
    longitudinal,
    ({ participantId }) => participantId,
    ({ absoluteDifference }) => [absoluteDifference],
  );

  const technicalN95 = metricEstimate({
    values: technicalDifferences,
    clusters: technicalClusters,
    seed: configuration.bootstrapSeed ^ 0x54454348,
    iterations: configuration.bootstrapIterations,
    method: `${REDNESS_CALIBRATION_METHODS.technicalPooling} ${REDNESS_CALIBRATION_QUANTILE_METHOD}.`,
    participantCount: uniqueCount(technical.map(({ participantId }) => participantId)),
    sessionCount: uniqueCount(
      technical.map(({ participantId, earlierSessionId, conditionId }) =>
        [participantId, earlierSessionId, conditionId].join('\u001f'),
      ),
    ),
    frameCount: (() => {
      const participatingObservationIds = new Set(
        technical.flatMap(({ earlierObservationId, laterObservationId }) => [
          earlierObservationId,
          laterObservationId,
        ]),
      );
      return eligible
        .filter(({ observationId }) => participatingObservationIds.has(observationId))
        .reduce((total, observation) => total + observation.burst.acceptedFrames.length, 0);
    })(),
  });
  const longitudinalN95 = metricEstimate({
    values: longitudinal.map(({ absoluteDifference }) => absoluteDifference),
    clusters: longitudinalClusters,
    seed: configuration.bootstrapSeed ^ 0x4c4f4e47,
    iterations: configuration.bootstrapIterations,
    method: `${REDNESS_CALIBRATION_METHODS.longitudinalPairing} ${REDNESS_CALIBRATION_QUANTILE_METHOD}.`,
    participantCount: uniqueCount(longitudinal.map(({ participantId }) => participantId)),
    sessionCount: uniqueCount(
      longitudinal.flatMap(({ earlierSessionId, laterSessionId }) => [
        earlierSessionId,
        laterSessionId,
      ]),
    ),
    frameCount: 0,
  });

  const repeatedObservationPoints = observationMedianPoints(eligible);
  const pointsByParticipant = participantClusters(
    repeatedObservationPoints,
    ({ participantId }) => participantId,
    ({ median }) => [median],
  );
  const withinPerson = withinClusterResidualSd(pointsByParticipant);
  const withinPersonSd: WithinPersonEstimate = {
    status: withinPerson.status,
    value: withinPerson.status === 'estimated' ? withinPerson.value : null,
    reason: withinPerson.status === 'not_estimable' ? withinPerson.reason : null,
    method: REDNESS_CALIBRATION_METHODS.withinPerson,
    observationCount: withinPerson.observationCount ?? 0,
    participantCount: withinPerson.clusterCount ?? 0,
    residualDegreesOfFreedom: withinPerson.residualDegreesOfFreedom ?? 0,
  };
  const repeatabilityValue =
    withinPersonSd.value === null ? null : repeatabilityCoefficient(withinPersonSd.value);
  const repeatabilityInterval = participantClusterBootstrap({
    clusters: pointsByParticipant,
    seed: configuration.bootstrapSeed ^ 0x52455045,
    iterations: configuration.bootstrapIterations,
    statistic: (clusters) => {
      const estimate = withinClusterResidualSd(clusters);
      return estimate.status === 'estimated' ? repeatabilityCoefficient(estimate.value) : null;
    },
  });
  const repeatability: RepeatabilityCoefficientEstimate =
    repeatabilityValue === null
      ? {
          status: 'not_estimable',
          value: null,
          reason: withinPersonSd.reason ?? 'Within-person SD is unavailable.',
          formula: '1.96 × sqrt(2) × within-person SD',
          withinPersonSd: withinPersonSd.value,
          confidenceInterval: repeatabilityInterval,
        }
      : {
          status: 'estimated',
          value: repeatabilityValue,
          reason: null,
          formula: '1.96 × sqrt(2) × within-person SD',
          withinPersonSd: withinPersonSd.value,
          confidenceInterval: repeatabilityInterval,
        };

  const icc = iccForSessionPoints(repeatedObservationPoints);

  const noChangeComparisons: NoChangeComparison[] = [...technical, ...longitudinal].sort(
    (left, right) => left.comparisonId.localeCompare(right.comparisonId),
  );
  const finiteCompositeParts = [
    technicalN95.value,
    longitudinalN95.value,
    repeatability.value,
  ].filter((value): value is number => value !== null && Number.isFinite(value));
  const conservativeComposite =
    finiteCompositeParts.length === 0 ? null : Math.max(...finiteCompositeParts);
  const thresholdCandidates: ThresholdCandidateComparison[] = [
    candidateComparison({
      id: 'provisional_5_10',
      label: 'Current provisional 5 / 10 boundaries',
      authority: 'currently_used_by_consumer_trials',
      detectable: 5,
      strong: 10,
      comparisons: noChangeComparisons,
    }),
    candidateComparison({
      id: 'technical_n95',
      label: 'Empirical Technical N95 candidate',
      authority: 'exploratory_only',
      detectable: technicalN95.value,
      strong: technicalN95.value === null ? null : technicalN95.value * 2,
      unavailableReason: technicalN95.reason ?? undefined,
      comparisons: noChangeComparisons,
    }),
    candidateComparison({
      id: 'longitudinal_n95',
      label: 'Empirical Longitudinal N95 candidate',
      authority: 'exploratory_only',
      detectable: longitudinalN95.value,
      strong: longitudinalN95.value === null ? null : longitudinalN95.value * 2,
      unavailableReason: longitudinalN95.reason ?? undefined,
      comparisons: noChangeComparisons,
    }),
    candidateComparison({
      id: 'repeatability_coefficient',
      label: 'Repeatability-coefficient candidate',
      authority: 'exploratory_only',
      detectable: repeatability.value,
      strong: repeatability.value === null ? null : repeatability.value * 2,
      unavailableReason: repeatability.reason ?? undefined,
      comparisons: noChangeComparisons,
    }),
    candidateComparison({
      id: 'conservative_composite',
      label: 'Conservative composite candidate',
      authority: 'exploratory_only',
      detectable: conservativeComposite,
      strong: conservativeComposite === null ? null : conservativeComposite * 2,
      unavailableReason: 'No finite repeatability estimate is available for the maximum rule.',
      comparisons: noChangeComparisons,
    }),
  ];

  const attemptedFrameCount = observations.reduce(
    (total, observation) => total + observation.burst.attemptedFrameCount,
    0,
  );
  const rejectedFrameCount = observations.reduce(
    (total, observation) => total + observation.burst.rejectedFrames.length,
    0,
  );
  const eligibleRanges = agreement
    .filter(({ observationId }) => eligibleIds.has(observationId))
    .map(({ range: value }) => value)
    .filter((value): value is number => value !== null);
  const baseBreakdownInput = { observations, eligibleIds };
  const measuredSkinToneObservations = observations.filter(
    ({ measuredSkinToneSource, measuredSkinToneGroup }) =>
      measuredSkinToneSource === 'validated_audit_input' && measuredSkinToneGroup !== null,
  );
  return {
    analysisVersion: REDNESS_CALIBRATION_ANALYSIS_VERSION,
    preliminary: true,
    methods: REDNESS_CALIBRATION_METHODS,
    configuration,
    observations: agreement,
    exclusions,
    eligibleObservationIds: eligible.map(({ observationId }) => observationId).sort(),
    technicalN95,
    longitudinalN95,
    withinPersonSd,
    repeatabilityCoefficient: repeatability,
    icc,
    noChangeComparisons,
    thresholdCandidates,
    rejection: {
      rejectedFrameCount,
      attemptedFrameCount,
      rate: attemptedFrameCount === 0 ? null : rejectedFrameCount / attemptedFrameCount,
      uncertaintyInterval: wilsonRateInterval(rejectedFrameCount, attemptedFrameCount),
    },
    repeatedCaptureRange: {
      median: medianR7(eligibleRanges),
      maximum: eligibleRanges.length === 0 ? null : Math.max(...eligibleRanges),
    },
    counts: {
      observationCount: input.length,
      eligibleObservationCount: eligible.length,
      participantCount: uniqueCount(eligible.map(({ participantId }) => participantId)),
      sessionCount: uniqueCount(eligible.map(({ sessionId }) => sessionId)),
      acceptedFrameCount: eligible.reduce(
        (total, observation) => total + observation.burst.acceptedFrames.length,
        0,
      ),
    },
    breakdowns: {
      byDeviceClass: breakdownsFor({
        ...baseBreakdownInput,
        keyFor: ({ deviceClass }) => deviceClass,
      }),
      byApiVersion: breakdownsFor({
        ...baseBreakdownInput,
        keyFor: ({ apiVersion }) => apiVersion,
      }),
      byAnalysisModelVersion: breakdownsFor({
        ...baseBreakdownInput,
        keyFor: ({ analysisModelVersion }) => analysisModelVersion,
      }),
      byConditionType: breakdownsFor({
        ...baseBreakdownInput,
        keyFor: ({ conditionType }) => conditionType,
      }),
      measuredSkinTone: {
        status: measuredSkinToneObservations.length === 0 ? 'not_collected' : 'available',
        groups:
          measuredSkinToneObservations.length === 0
            ? []
            : breakdownsFor({
                observations: measuredSkinToneObservations,
                eligibleIds,
                keyFor: ({ measuredSkinToneGroup }) => measuredSkinToneGroup ?? 'not_collected',
              }),
      },
    },
  };
}
