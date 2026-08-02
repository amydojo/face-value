import {
  analyzeRednessCalibration,
  buildExploratoryRednessCalibrationRegistry,
  serializeRednessCalibrationRegistry,
  type CalibrationBreakdown,
  type EstimableInterval,
  type RednessCalibrationAnalysis,
  type RednessCalibrationAnalysisOptions,
  type RednessCalibrationObservation,
  type ThresholdCandidateComparison,
} from '../../domain/calibration/redness';

export interface CalibrationMetricCard {
  id: string;
  title: string;
  value: string;
  status: 'estimated' | 'not_estimable';
  detail: string;
  preliminaryLabel: 'PRELIMINARY INTERNAL ESTIMATE';
}

export interface CalibrationCandidateRow {
  id: string;
  label: string;
  authority: string;
  status: string;
  detectableBoundary: string;
  strongBoundary: string;
  falseChange: string;
  classifications: string;
}

export interface CalibrationSessionView {
  observationId: string;
  participantId: string;
  sessionId: string;
  conditionId: string;
  conditionType: string;
  collectionSource: string;
  captureTimestamp: string;
  deviceClass: string;
  captureQuality: string;
  acceptedFrameCount: string;
  rejectedFrameCount: string;
  rawScores: string;
  median: string;
  range: string;
  directionAgreement: string;
  rejectionReasons: string;
  confounders: string;
  measuredSkinToneAuditGroup: string;
  versions: Array<{ label: string; value: string }>;
  unavailableMetrics: Array<{ label: string; value: 'Not available' }>;
}

export interface CalibrationTimelineParticipant {
  participantId: string;
  sessions: Array<{
    observationId: string;
    timestamp: string;
    conditionType: string;
    median: string;
    range: string;
    confounders: string;
    deviceAndVersion: string;
  }>;
  longitudinalDifferences: string[];
}

export interface CalibrationExclusionView {
  observationId: string;
  participantId: string;
  sessionId: string;
  reasons: string[];
}

export interface CalibrationBreakdownView {
  key: string;
  observations: string;
  eligibility: string;
  rejectionRate: string;
  repeatedCaptureRange: string;
}

export interface RednessCalibrationInstrumentViewModel {
  analysis: RednessCalibrationAnalysis;
  metrics: CalibrationMetricCard[];
  candidates: CalibrationCandidateRow[];
  sessions: CalibrationSessionView[];
  timeline: CalibrationTimelineParticipant[];
  exclusions: CalibrationExclusionView[];
  breakdowns: {
    devices: CalibrationBreakdownView[];
    apiVersions: CalibrationBreakdownView[];
    modelVersions: CalibrationBreakdownView[];
    conditions: CalibrationBreakdownView[];
    measuredSkinTone: {
      status: 'not_collected' | 'available';
      groups: CalibrationBreakdownView[];
    };
  };
}

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

const numberValue = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? 'Not estimable' : numberFormatter.format(value);

const percentValue = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? 'Not estimable' : percentFormatter.format(value);

const sentenceCase = (value: string): string => {
  const spaced = value.replaceAll('_', ' ');
  return spaced ? `${spaced[0].toLocaleUpperCase('en-US')}${spaced.slice(1)}` : value;
};

const intervalLabel = (interval: EstimableInterval): string =>
  interval.status === 'estimated'
    ? `95% CI ${numberFormatter.format(interval.lower)}–${numberFormatter.format(interval.upper)} · ${interval.method}`
    : `95% CI not estimable · ${interval.reason}`;

const estimateCard = (input: {
  id: string;
  title: string;
  value: number | null;
  reason: string | null;
  detail: string;
}): CalibrationMetricCard => ({
  id: input.id,
  title: input.title,
  value: numberValue(input.value),
  status: input.value === null ? 'not_estimable' : 'estimated',
  detail: input.value === null ? (input.reason ?? 'Not estimable for this sample.') : input.detail,
  preliminaryLabel: 'PRELIMINARY INTERNAL ESTIMATE',
});

function metricCards(analysis: RednessCalibrationAnalysis): CalibrationMetricCard[] {
  const provisional = analysis.thresholdCandidates.find(({ id }) => id === 'provisional_5_10');
  return [
    estimateCard({
      id: 'technical-n95',
      title: 'Technical N95',
      value: analysis.technicalN95.value,
      reason: analysis.technicalN95.reason,
      detail: `${analysis.technicalN95.sampleCount} matched formal-recapture burst-median differences · ${intervalLabel(analysis.technicalN95.confidenceInterval)}`,
    }),
    estimateCard({
      id: 'longitudinal-n95',
      title: 'Longitudinal N95',
      value: analysis.longitudinalN95.value,
      reason: analysis.longitudinalN95.reason,
      detail: `${analysis.longitudinalN95.sampleCount} matched no-treatment comparisons · ${intervalLabel(analysis.longitudinalN95.confidenceInterval)}`,
    }),
    estimateCard({
      id: 'repeatability-coefficient',
      title: 'Repeatability coefficient',
      value: analysis.repeatabilityCoefficient.value,
      reason: analysis.repeatabilityCoefficient.reason,
      detail: `${analysis.repeatabilityCoefficient.formula} · ${intervalLabel(analysis.repeatabilityCoefficient.confidenceInterval)}`,
    }),
    estimateCard({
      id: 'within-person-sd',
      title: 'Within-person SD',
      value: analysis.withinPersonSd.value,
      reason: analysis.withinPersonSd.reason,
      detail: `${analysis.withinPersonSd.observationCount} session medians · ${analysis.withinPersonSd.residualDegreesOfFreedom} residual degrees of freedom`,
    }),
    estimateCard({
      id: 'icc',
      title: 'ICC(A,1)',
      value: analysis.icc.status === 'estimated' ? analysis.icc.value : null,
      reason: analysis.icc.status === 'not_estimable' ? analysis.icc.reason : null,
      detail:
        analysis.icc.status === 'estimated'
          ? `${analysis.icc.participantCount} participants · ${analysis.icc.repeatedObservationCount} balanced observations each · absolute agreement`
          : analysis.icc.reason,
    }),
    {
      id: 'false-change-rate',
      title: 'False-change rate · current 5-point boundary',
      value: percentValue(provisional?.falseChangeRate ?? null),
      status:
        provisional?.falseChangeRate === null || provisional === undefined
          ? 'not_estimable'
          : 'estimated',
      detail: provisional
        ? `${provisional.falseChangeCount} of ${provisional.validNoChangeComparisonCount} valid no-change comparisons · ${intervalLabel(provisional.uncertaintyInterval)}`
        : 'No valid no-change comparison is available.',
      preliminaryLabel: 'PRELIMINARY INTERNAL ESTIMATE',
    },
    {
      id: 'rejection-rate',
      title: 'Capture rejection rate',
      value: percentValue(analysis.rejection.rate),
      status: analysis.rejection.rate === null ? 'not_estimable' : 'estimated',
      detail: `${analysis.rejection.rejectedFrameCount} rejected of ${analysis.rejection.attemptedFrameCount} attempted frames · ${intervalLabel(analysis.rejection.uncertaintyInterval)}`,
      preliminaryLabel: 'PRELIMINARY INTERNAL ESTIMATE',
    },
    {
      id: 'sample-counts',
      title: 'Eligible sample',
      value: `${analysis.counts.participantCount} · ${analysis.counts.sessionCount} · ${analysis.counts.acceptedFrameCount}`,
      status: analysis.counts.eligibleObservationCount === 0 ? 'not_estimable' : 'estimated',
      detail: 'Participants · sessions · accepted frames',
      preliminaryLabel: 'PRELIMINARY INTERNAL ESTIMATE',
    },
  ];
}

function candidateRow(candidate: ThresholdCandidateComparison): CalibrationCandidateRow {
  const counts = candidate.classificationCounts;
  return {
    id: candidate.id,
    label: candidate.label,
    authority:
      candidate.authority === 'currently_used_by_consumer_trials'
        ? 'Currently used by consumer trials · Production thresholds remain provisional'
        : 'Exploratory threshold candidate · Not active',
    status:
      candidate.estimateStatus === 'available'
        ? 'Available for internal comparison'
        : `Not estimable · ${candidate.unavailableReason}`,
    detectableBoundary: numberValue(candidate.detectableBoundary),
    strongBoundary: numberValue(candidate.strongBoundary),
    falseChange:
      candidate.falseChangeRate === null
        ? 'Not estimable'
        : `${candidate.falseChangeCount} / ${candidate.validNoChangeComparisonCount} · ${percentValue(candidate.falseChangeRate)}`,
    classifications: [
      `worsened ${counts.worsened}`,
      `no change ${counts.no_detectable_change}`,
      `directional ${counts.directional_improvement}`,
      `meaningful ${counts.meaningful_candidate}`,
      `strong ${counts.strong_improvement}`,
    ].join(' · '),
  };
}

function sessionViews(
  observations: RednessCalibrationObservation[],
  analysis: RednessCalibrationAnalysis,
): CalibrationSessionView[] {
  const agreements = new Map(
    analysis.observations.map((agreement) => [agreement.observationId, agreement]),
  );
  return [...observations]
    .sort((left, right) => {
      const timestamp = right.captureTimestamp.localeCompare(left.captureTimestamp);
      return timestamp === 0 ? left.observationId.localeCompare(right.observationId) : timestamp;
    })
    .map((observation) => {
      const agreement = agreements.get(observation.observationId);
      const rejectionReasons = observation.burst.rejectedFrames.flatMap(({ reasons }) => reasons);
      return {
        observationId: observation.observationId,
        participantId: observation.participantId,
        sessionId: observation.sessionId,
        conditionId: observation.conditionId,
        conditionType: sentenceCase(observation.conditionType),
        collectionSource:
          observation.collectionSource === 'synthetic_face_free_fixture'
            ? 'Synthetic face-free fixture · No physical capture'
            : observation.collectionSource === 'live_provider'
              ? 'Completed internal live provider capture'
              : 'Imported observation · Unverified provenance',
        captureTimestamp: timestampFormatter.format(new Date(observation.captureTimestamp)),
        deviceClass: observation.deviceClass,
        captureQuality:
          observation.captureOutcome === 'accepted'
            ? 'Accepted with unavailable comparability metrics'
            : 'Hard failure · excluded',
        acceptedFrameCount: String(agreement?.acceptedScoreCount ?? 0),
        rejectedFrameCount: String(agreement?.rejectedFrameCount ?? 0),
        rawScores:
          agreement && agreement.rawScores.length > 0
            ? agreement.rawScores.map(numberFormatter.format).join(' · ')
            : 'Not available',
        median: numberValue(agreement?.sessionMedian ?? null),
        range: numberValue(agreement?.range ?? null),
        directionAgreement:
          agreement?.directionAgreement.status === 'not_available'
            ? 'Not available · no comparison anchor'
            : sentenceCase(agreement?.directionAgreement.status ?? 'not_available'),
        rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons.join(' · ') : 'None',
        confounders:
          observation.confounders.length > 0
            ? observation.confounders.map(({ code }) => sentenceCase(code)).join(' · ')
            : 'None reported',
        versions: [
          { label: 'App build', value: observation.appBuildVersion },
          { label: 'API', value: observation.apiVersion },
          {
            label: 'Analysis model',
            value:
              observation.analysisModelVersion === 'not_reported'
                ? 'Not reported'
                : observation.analysisModelVersion,
          },
          { label: 'Analysis mode', value: observation.analysisMode },
          { label: 'Preprocessing', value: observation.preprocessingVersion },
          { label: 'Capture protocol', value: observation.captureProtocolVersion },
        ],
        unavailableMetrics: Object.keys(observation.unavailableMetrics).map((key) => ({
          label: sentenceCase(key.replace(/([A-Z])/g, ' $1')),
          value: 'Not available' as const,
        })),
        measuredSkinToneAuditGroup:
          observation.measuredSkinToneSource === 'validated_audit_input' &&
          observation.measuredSkinToneGroup !== null
            ? observation.measuredSkinToneGroup
            : 'Not collected',
      };
    });
}

function timelineFor(
  sessions: CalibrationSessionView[],
  analysis: RednessCalibrationAnalysis,
): CalibrationTimelineParticipant[] {
  const participantIds = [...new Set(sessions.map(({ participantId }) => participantId))].sort();
  return participantIds.map((participantId) => ({
    participantId,
    sessions: sessions
      .filter((session) => session.participantId === participantId)
      .map((session) => ({
        observationId: session.observationId,
        timestamp: session.captureTimestamp,
        conditionType: session.conditionType,
        median: session.median,
        range: session.range,
        confounders: session.confounders,
        deviceAndVersion: `${session.deviceClass} · API ${session.versions.find(({ label }) => label === 'API')?.value ?? 'Not available'}`,
      })),
    longitudinalDifferences: analysis.noChangeComparisons
      .filter(
        (comparison) =>
          comparison.participantId === participantId && comparison.kind === 'matched_longitudinal',
      )
      .map(
        (comparison) =>
          `${comparison.earlierSessionId} → ${comparison.laterSessionId}: ${numberFormatter.format(comparison.absoluteDifference)} points`,
      ),
  }));
}

function breakdownView(row: CalibrationBreakdown, preserveKey = false): CalibrationBreakdownView {
  return {
    key:
      row.key === 'not_reported' ? 'Not reported' : preserveKey ? row.key : sentenceCase(row.key),
    observations: `${row.observationCount} observations · ${row.acceptedFrameCount} accepted frames`,
    eligibility: `${row.eligibleObservationCount} eligible`,
    rejectionRate: percentValue(row.rejectionRate),
    repeatedCaptureRange:
      row.medianRepeatedCaptureRange === null
        ? 'Not estimable'
        : `median ${numberValue(row.medianRepeatedCaptureRange)} · max ${numberValue(row.maximumRepeatedCaptureRange)}`,
  };
}

export function buildRednessCalibrationInstrumentViewModel(
  observations: RednessCalibrationObservation[],
  options?: RednessCalibrationAnalysisOptions,
): RednessCalibrationInstrumentViewModel {
  const analysis = analyzeRednessCalibration(observations, options);
  const sessions = sessionViews(observations, analysis);
  return {
    analysis,
    metrics: metricCards(analysis),
    candidates: analysis.thresholdCandidates.map(candidateRow),
    sessions,
    timeline: timelineFor(sessions, analysis),
    exclusions: analysis.exclusions.map((exclusion) => ({
      observationId: exclusion.observationId,
      participantId: exclusion.participantId,
      sessionId: exclusion.sessionId,
      reasons: exclusion.reasons.map(sentenceCase),
    })),
    breakdowns: {
      devices: analysis.breakdowns.byDeviceClass.map((row) => breakdownView(row)),
      apiVersions: analysis.breakdowns.byApiVersion.map((row) => breakdownView(row)),
      modelVersions: analysis.breakdowns.byAnalysisModelVersion.map((row) => breakdownView(row)),
      conditions: analysis.breakdowns.byConditionType.map((row) => breakdownView(row)),
      measuredSkinTone: {
        status: analysis.breakdowns.measuredSkinTone.status,
        groups: analysis.breakdowns.measuredSkinTone.groups.map((row) => breakdownView(row, true)),
      },
    },
  };
}

export async function buildRednessCalibrationRegistryExport(
  observations: RednessCalibrationObservation[],
  createdAt: string,
): Promise<string> {
  const analysis = analyzeRednessCalibration(observations);
  return serializeRednessCalibrationRegistry(
    await buildExploratoryRednessCalibrationRegistry({ analysis, createdAt }),
  );
}
