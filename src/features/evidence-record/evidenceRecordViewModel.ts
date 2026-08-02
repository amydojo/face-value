import type {
  EffectClassification,
  EvidenceQuality,
  MeasurementQuality,
  RednessAction,
  RednessEvaluationSnapshot,
  ThresholdSource,
} from '../../domain/evidence/redness';
import type { EvidenceRecordData } from '../../domain/model';
import type { TrialTruthEvidence } from '../../domain/trialTruth';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import {
  canonicalActionLabel,
  verdictProduct,
  verdictViewModelFromRecord,
} from '../verdict/verdictViewModel';

export interface EvidenceRecordRow {
  id: string;
  label: string;
  value: string;
  canonicalValue?: string;
  provenance?: EvidenceRecordProvenance;
}

export type EvidenceRecordProvenance =
  | 'Provider measurement'
  | 'Face Value deterministic evaluation'
  | 'Participant report'
  | 'Unavailable evidence';

export interface EvidenceRecordSection {
  id: string;
  title: string;
  rows: EvidenceRecordRow[];
}

export interface EvidenceRecordComparison {
  baseline: string;
  followUp: string;
  change: string;
  interval: string;
  tone: 'favorable' | 'neutral' | 'unfavorable' | 'unavailable';
  accessibleSummary: string;
  interpretationNote?: string;
}

export interface EvidenceRecordNextStep {
  canonicalAction?: RednessAction;
  statusLabel: string;
  title: string;
  body: string;
  tone: 'default' | 'safety';
}

export interface EvidenceRecordWhy {
  supportingPoints: string[];
  limitation: string;
  claimBoundary: string;
}

export interface EvidenceRecordFull {
  sections: EvidenceRecordSection[];
  technicalMetadata: EvidenceRecordRow[];
  auditTrace: Array<{
    ruleId: string;
    outcome: string;
    detail: string;
  }>;
  technicalNote?: string;
}

export interface EvidenceRecordViewModel {
  canonical: boolean;
  recordId: string;
  folio: string;
  product: string;
  trialMetadata: string;
  headline: string;
  interpretation: string;
  evidenceStatus?: string;
  nextStep: EvidenceRecordNextStep;
  comparison?: EvidenceRecordComparison;
  comparisonUnavailableMessage?: string;
  atAGlance: EvidenceRecordRow[];
  why?: EvidenceRecordWhy;
  full?: EvidenceRecordFull;
  legacyMessage?: string;
  legacyNote?: string;
  privacyLabel: string;
}

const scoreFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const signedScoreFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

const savedDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const savedTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

const validDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sentenceCase = (value: string): string => {
  const lower = value.toLocaleLowerCase('en-US');
  return lower ? `${lower[0].toLocaleUpperCase('en-US')}${lower.slice(1)}` : value;
};

const humanizeCode = (value: string): string => sentenceCase(value.replaceAll('_', ' '));

const score = (value: number | null): string =>
  value === null || !Number.isFinite(value) ? 'Not available' : scoreFormatter.format(value);

const signedPoints = (value: number | null): string =>
  value === null || !Number.isFinite(value)
    ? 'Not available'
    : `${signedScoreFormatter.format(value)} ${Math.abs(value) === 1 ? 'point' : 'points'}`;

const acceptedMeasurements = (scores: number[]): string =>
  scores.length === 0 ? 'Not available' : scores.map(scoreFormatter.format).join(' · ');

const rejectedAttempts = (period: RednessEvaluationSnapshot['baseline']): string => {
  const reasons = [
    ...new Set(
      period.sessions.flatMap((session) =>
        session.rejectedFrames.flatMap((frame) => frame.reasons),
      ),
    ),
  ];
  if (period.rejectedFrameCount === 0) return 'None';
  const count = `${period.rejectedFrameCount} ${
    period.rejectedFrameCount === 1 ? 'attempt' : 'attempts'
  }`;
  return reasons.length > 0 ? `${count} · ${reasons.join(' · ')}` : count;
};

const days = (value: number): string => {
  if (!Number.isFinite(value)) return 'Not available';
  const formatted = scoreFormatter.format(value);
  return `${formatted} ${Math.abs(value) === 1 ? 'day' : 'days'}`;
};

const savedDate = (value: string): string => {
  const date = validDate(value);
  return date ? savedDateFormatter.format(date) : 'Date unavailable';
};

const savedTimestamp = (value: string): string => {
  const date = validDate(value);
  return date ? savedTimestampFormatter.format(date) : value;
};

const observationWindowForLegacy = (value: string): string => {
  const [startValue, endValue] = value.split(' to ');
  const start = startValue ? validDate(startValue) : null;
  const end = endValue ? validDate(endValue) : null;
  if (!start || !end) return value;
  return `${savedDateFormatter.format(start)} – ${savedDateFormatter.format(end)}`;
};

const measurementLabel = (value: MeasurementQuality): string => {
  switch (value) {
    case 'invalid':
      return 'Not usable';
    case 'limited':
      return 'Limited';
    case 'adequate':
      return 'Good';
    case 'strong':
      return 'Strong';
  }
};

const evidenceLabel = (value: EvidenceQuality): string => {
  switch (value) {
    case 'insufficient':
      return 'Not enough evidence';
    case 'possible':
      return 'Early evidence';
    case 'likely':
      return 'Growing evidence';
  }
};

const attributionQualityLabel = (
  value: RednessEvaluationSnapshot['attributionQuality'],
): string => humanizeCode(value);

const safetyStatusLabel = (value: RednessEvaluationSnapshot['safetyStatus']): string => {
  switch (value) {
    case 'clear':
      return 'No concerns noted';
    case 'check_required':
      return 'Review recommended';
    case 'interrupted':
      return 'Trial interrupted';
  }
};

const attributionLabel = (evaluation: RednessEvaluationSnapshot): string => {
  if (evaluation.attributionQuality === 'blocked') return 'Another change interfered';
  if (evaluation.secondProductStatus === 'possible_overlap' || evaluation.confounders.length > 0) {
    return evaluation.attributionQuality === 'moderate'
      ? 'Minor changes reported'
      : 'Not fully isolated';
  }
  if (evaluation.adherence.status === 'unknown') return 'Not fully recorded';
  return 'None reported';
};

const safetyLabel = (evaluation: RednessEvaluationSnapshot): string => {
  if (!evaluation.tolerance) return 'Not collected';
  switch (evaluation.safetyStatus) {
    case 'clear':
      return 'No concerns noted';
    case 'check_required':
      return 'Review recommended';
    case 'interrupted':
      return 'Trial interrupted';
  }
};

const effectLabel = (value: EffectClassification | null): string => {
  switch (value) {
    case 'worsened':
      return 'Worsened';
    case 'no_detectable_change':
      return 'No clear change';
    case 'directional_improvement':
      return 'Favorable direction';
    case 'meaningful_candidate':
      return 'Meaningful candidate';
    case 'strong_improvement':
      return 'Strong improvement';
    case null:
      return 'Not available';
  }
};

const comparisonTone = (
  evaluation: RednessEvaluationSnapshot,
): EvidenceRecordComparison['tone'] => {
  if (evaluation.measurementQuality === 'invalid' || evaluation.effectClassification === null) {
    return 'unavailable';
  }
  switch (evaluation.effectClassification) {
    case 'worsened':
      return 'unfavorable';
    case 'no_detectable_change':
      return 'neutral';
    case 'directional_improvement':
    case 'meaningful_candidate':
    case 'strong_improvement':
      return 'favorable';
  }
};

const resultInterpretation = (evaluation: RednessEvaluationSnapshot): string => {
  if (evaluation.measurementQuality === 'invalid') {
    return 'The saved scans were not comparable enough to support a readable result.';
  }
  if (evaluation.interpretation.recommendedAction === 'retry_alone') {
    return 'Visible redness changed, but another trial change interfered.';
  }
  if (evaluation.interpretation.recommendedAction === 'safety_interruption') {
    return 'The recorded skin response interrupted ordinary product evaluation.';
  }
  switch (evaluation.effectClassification) {
    case 'strong_improvement':
    case 'meaningful_candidate':
      return 'Visible redness was lower in the saved comparison.';
    case 'directional_improvement':
      return 'Visible redness moved lower, but the evidence is still early.';
    case 'no_detectable_change':
      return 'Visible redness stayed close to the baseline.';
    case 'worsened':
      return 'Visible redness was higher in the saved comparison.';
    case null:
      return 'No readable visible-redness comparison was available.';
  }
};

const actionPresentation = (
  action: RednessAction,
  evaluation: RednessEvaluationSnapshot,
): EvidenceRecordNextStep => {
  const statusLabel = canonicalActionLabel(action);
  switch (action) {
    case 'keep':
      return {
        canonicalAction: action,
        statusLabel,
        title: 'Keep using it',
        body: 'Keep this product for its assigned visible-redness job under similar conditions.',
        tone: 'default',
      };
    case 'test_longer':
      return {
        canonicalAction: action,
        statusLabel,
        title: 'Test longer',
        body:
          evaluation.measurementQuality === 'invalid'
            ? 'Repeat the scans under matched conditions before reading this result.'
            : evaluation.observationWindowStatus === 'too_early'
              ? 'Continue the predeclared trial window, then repeat a comparable scan.'
              : 'Repeat a comparable scan to see whether the change holds.',
        tone: 'default',
      };
    case 'retry_alone':
      return {
        canonicalAction: action,
        statusLabel,
        title: 'Retry it alone',
        body: 'Repeat the trial without the other redness-changing product or routine change.',
        tone: 'default',
      };
    case 'not_proving_job':
      return {
        canonicalAction: action,
        statusLabel,
        title: 'Not proving its job',
        body:
          evaluation.safetyStatus === 'check_required'
            ? 'Reassess this product for the assigned job and review the recorded skin response.'
            : 'Reassess this product for the visible-redness job it was assigned.',
        tone: 'default',
      };
    case 'safety_interruption':
      return {
        canonicalAction: action,
        statusLabel,
        title: 'Safety interruption',
        body: 'Pause ordinary trial evaluation and review the recorded skin response. Face Value cannot diagnose a reaction.',
        tone: 'safety',
      };
  }
};

const supportingMovement = (evaluation: RednessEvaluationSnapshot): string => {
  if (evaluation.measurementQuality === 'invalid') {
    return 'The recorded score movement could not override the failed scan checks.';
  }
  switch (evaluation.effectClassification) {
    case 'strong_improvement':
    case 'meaningful_candidate':
      return 'The saved comparison showed less visible redness at follow-up.';
    case 'directional_improvement':
      return 'The saved comparison showed favorable visible-redness movement.';
    case 'no_detectable_change':
      return 'The saved comparison remained close to the baseline.';
    case 'worsened':
      return 'The saved comparison showed more visible redness at follow-up.';
    case null:
      return 'No readable visible-redness movement was available.';
  }
};

const supportingMeasurement = (value: MeasurementQuality): string => {
  switch (value) {
    case 'invalid':
      return 'The scans did not pass the recorded comparability checks.';
    case 'limited':
      return 'The scans were usable with recorded matching limits.';
    case 'adequate':
      return 'The scans met the recorded comparability checks.';
    case 'strong':
      return 'Repeated scans matched strongly.';
  }
};

const supportingAttribution = (evaluation: RednessEvaluationSnapshot): string => {
  switch (evaluation.attributionQuality) {
    case 'blocked':
      return 'Another recorded trial change prevents attribution to this product alone.';
    case 'weak':
      return evaluation.adherence.status === 'unknown' && evaluation.confounders.length === 0
        ? 'Product use was not fully recorded, so product isolation remains limited.'
        : 'Recorded trial context limits product isolation.';
    case 'moderate':
      return 'Only minor trial changes were recorded.';
    case 'strong':
      return 'No material product overlap or trial change was recorded.';
  }
};

const supportingSafety = (evaluation: RednessEvaluationSnapshot): string => {
  if (!evaluation.tolerance) return 'Skin response was not collected for this result.';
  switch (evaluation.safetyStatus) {
    case 'clear':
      return 'The recorded skin response did not contradict the result.';
    case 'check_required':
      return 'The saved result warrants reviewing the recorded skin response.';
    case 'interrupted':
      return 'The recorded skin response interrupted ordinary product evaluation.';
  }
};

const limitationSummary = (evaluation: RednessEvaluationSnapshot): string => {
  const sentences: string[] = [];
  if (evaluation.baseline.sessionCount === 1 && evaluation.endpoint.sessionCount === 1) {
    sentences.push('Only one baseline and one follow-up session were available.');
  } else if (evaluation.baseline.sessionCount < 2 || evaluation.endpoint.sessionCount < 2) {
    sentences.push('Repeated sessions were not available for both sides of the comparison.');
  }
  if (evaluation.missingEvidence.length > 0) {
    sentences.push('Some supporting evidence was not collected.');
  }
  if (sentences.length === 0 && evaluation.interpretation.limitations.length > 0) {
    sentences.push(evaluation.interpretation.limitations[0]);
  }
  return sentences.join(' ') || 'No additional limitation was recorded.';
};

const productOverlap = (evaluation: RednessEvaluationSnapshot): string => {
  switch (evaluation.secondProductStatus) {
    case 'none':
      return 'None recorded';
    case 'possible_overlap':
      return 'Possible overlap';
    case 'active_overlap':
      return 'Active overlap';
  }
};

const confounderSummary = (evaluation: RednessEvaluationSnapshot): string =>
  evaluation.confounders.length === 0
    ? 'None recorded'
    : evaluation.confounders.map((flag) => flag.note?.trim() || humanizeCode(flag.code)).join(' ');

const adherenceLabel = (value: RednessEvaluationSnapshot['adherence']['status']): string => {
  switch (value) {
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'poor':
      return 'Poor';
    case 'unknown':
      return 'Not collected';
  }
};

const toleranceLabel = (evidence: TrialTruthEvidence | undefined): string => {
  if (!evidence) return 'Not collected';
  return sentenceCase(evidence.tolerance.severity);
};

const symptomLabel = (evidence: TrialTruthEvidence | undefined): string => {
  if (!evidence) return 'Not collected';
  if (evidence.tolerance.symptoms.length === 0) return 'None reported';
  return evidence.tolerance.symptoms.map(humanizeCode).join(' · ');
};

const participantObservationLabel = (evidence: TrialTruthEvidence | undefined): string => {
  if (!evidence) return 'Not collected';
  switch (evidence.patientAnchor.visibleChange) {
    case 1:
    case 2:
      return 'Less';
    case 0:
      return 'Same';
    case -1:
    case -2:
      return 'More';
  }
};

const anchorRelationshipLabel = (record: EvidenceRecordData): string => {
  switch (record.anchorRelationship) {
    case 'agreed':
      return 'Agreed';
    case 'neutral':
      return 'Neutral';
    case 'contradicted':
      return 'Contradicted';
    case 'not_collected':
    case undefined:
      return 'Not collected';
  }
};

const thresholdSourceLabel = (value: ThresholdSource): string => {
  switch (value) {
    case 'provisional_fixture':
      return 'Preliminary fixture';
    case 'technical_calibration':
      return 'Technical calibration';
    case 'longitudinal_calibration':
      return 'Longitudinal calibration';
  }
};

const comparisonSettingsDescription = (evaluation: RednessEvaluationSnapshot): string => {
  const detectable = evaluation.threshold.provisionalDetectablePoints;
  const strong = evaluation.threshold.provisionalStrongPoints;
  if (typeof detectable === 'number' && typeof strong === 'number') {
    return `Detectable ${scoreFormatter.format(detectable)} · strong ${scoreFormatter.format(strong)} points`;
  }
  if (typeof evaluation.threshold.activeN95 === 'number') {
    return `Active repeat-scan boundary ${scoreFormatter.format(evaluation.threshold.activeN95)} points`;
  }
  return 'Not available';
};

const frameCounts = (period: RednessEvaluationSnapshot['baseline']): string =>
  `Accepted ${period.acceptedRawScores.length} · rejected ${period.rejectedFrameCount}`;

const captureComparability = (period: RednessEvaluationSnapshot['baseline']): string => {
  if (period.sessions.length === 0) return 'Not available';
  return period.sessions
    .map(({ sessionId, captureQuality }) => [
      `${sessionId}: lighting ${humanizeCode(captureQuality.lightingComparability)}`,
      `pose ${humanizeCode(captureQuality.poseComparability)}`,
      `crop ${humanizeCode(captureQuality.cropComparability)}`,
      `face size ${humanizeCode(captureQuality.faceSizeComparability)}`,
      `color cast ${humanizeCode(captureQuality.colorCastComparability)}`,
    ].join(' · '))
    .join(' | ');
};

const optionalMeasurement = (value: number | boolean | undefined): string => {
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    return 'Not available';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return scoreFormatter.format(value);
};

const optionalMeasurementProvenance = (
  value: number | boolean | undefined,
): EvidenceRecordProvenance =>
  value === undefined || (typeof value === 'number' && !Number.isFinite(value))
    ? 'Unavailable evidence'
    : 'Provider measurement';

const unavailableVersion = (value: string): boolean =>
  value === 'not_available' || value.includes('not-reported') || value.includes('not_reported');

const versionValue = (value: string): string =>
  unavailableVersion(value) ? 'Not reported' : value;

const comparisonFor = (
  evaluation: RednessEvaluationSnapshot,
): EvidenceRecordComparison | undefined => {
  if (
    evaluation.baselineRawMedian === null ||
    evaluation.endpointRawMedian === null ||
    evaluation.rawScoreDelta === null
  ) {
    return undefined;
  }
  const baseline = score(evaluation.baselineRawMedian);
  const followUp = score(evaluation.endpointRawMedian);
  const change = signedPoints(evaluation.rawScoreDelta);
  const interval = days(evaluation.actualObservationIntervalDays);
  return {
    baseline,
    followUp,
    change,
    interval,
    tone: comparisonTone(evaluation),
    accessibleSummary: `Visible redness score changed from ${baseline} at baseline to ${followUp} at follow-up. The saved change was ${change} over ${interval}. Higher scores mean less visible redness.`,
    interpretationNote:
      evaluation.measurementQuality === 'invalid'
        ? 'These values were recorded, but the scans were not comparable enough to interpret.'
        : undefined,
  };
};

const atAGlanceRows = (evaluation: RednessEvaluationSnapshot): EvidenceRecordRow[] => [
  {
    id: 'scan-match',
    label: 'Scan match',
    value: measurementLabel(evaluation.measurementQuality),
    canonicalValue: evaluation.measurementQuality,
  },
  {
    id: 'trial-changes',
    label: 'Other trial changes',
    value: attributionLabel(evaluation),
    canonicalValue: evaluation.attributionQuality,
  },
  {
    id: 'evidence-so-far',
    label: 'Evidence so far',
    value: evidenceLabel(evaluation.evidenceQuality),
    canonicalValue: evaluation.evidenceQuality,
  },
  {
    id: 'skin-response',
    label: 'Skin response',
    value: safetyLabel(evaluation),
    canonicalValue: evaluation.safetyStatus,
  },
];

const fullRecordFor = (
  evaluation: RednessEvaluationSnapshot,
  record: EvidenceRecordData,
): EvidenceRecordFull => {
  const missingEvidence =
    evaluation.missingEvidence.length > 0
      ? evaluation.missingEvidence.join(' ')
      : 'No missing evidence was recorded.';
  const technicalNote = evaluation.threshold.provisional
    ? 'Production thresholds remain provisional and require repeat-scan calibration.'
    : undefined;
  const additionalEvidence = evaluation.missingEvidence.length > 0
    ? evaluation.missingEvidence.join(' ')
    : 'No additional missing evidence was identified in the saved snapshot.';

  return {
    sections: [
      {
        id: 'observed-change',
        title: 'Observed change',
        rows: [
          {
            id: 'assigned-job',
            label: 'Assigned product job',
            value: humanizeCode(evaluation.assignedJob),
            canonicalValue: evaluation.assignedJob,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'baseline-median',
            label: 'Baseline median',
            value: score(evaluation.baselineRawMedian),
            provenance: 'Provider measurement',
          },
          {
            id: 'follow-up-median',
            label: 'Follow-up median',
            value: score(evaluation.endpointRawMedian),
            provenance: 'Provider measurement',
          },
          {
            id: 'saved-score-delta',
            label: 'Saved raw-score delta',
            value: signedPoints(evaluation.rawScoreDelta),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'saved-effect-classification',
            label: 'Saved effect classification',
            value: effectLabel(evaluation.effectClassification),
            canonicalValue: evaluation.effectClassification ?? 'not_available',
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'elapsed-time',
            label: 'Elapsed time',
            value: days(evaluation.actualObservationIntervalDays),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'observation-window-status',
            label: 'Saved observation-window status',
            value: humanizeCode(evaluation.observationWindowStatus),
            canonicalValue: evaluation.observationWindowStatus,
            provenance: 'Face Value deterministic evaluation',
          },
        ],
      },
      {
        id: 'measurement-support',
        title: 'Measurement support',
        rows: [
          {
            id: 'baseline-raw-scores',
            label: 'Accepted baseline raw scores',
            value: acceptedMeasurements(evaluation.baseline.acceptedRawScores),
            provenance: 'Provider measurement',
          },
          {
            id: 'follow-up-raw-scores',
            label: 'Accepted follow-up raw scores',
            value: acceptedMeasurements(evaluation.endpoint.acceptedRawScores),
            provenance: 'Provider measurement',
          },
          {
            id: 'baseline-frame-counts',
            label: 'Baseline frame counts',
            value: frameCounts(evaluation.baseline),
            provenance: 'Provider measurement',
          },
          {
            id: 'follow-up-frame-counts',
            label: 'Follow-up frame counts',
            value: frameCounts(evaluation.endpoint),
            provenance: 'Provider measurement',
          },
          {
            id: 'measurement-baseline-median',
            label: 'Baseline median',
            value: score(evaluation.baselineRawMedian),
            provenance: 'Provider measurement',
          },
          {
            id: 'measurement-follow-up-median',
            label: 'Follow-up median',
            value: score(evaluation.endpointRawMedian),
            provenance: 'Provider measurement',
          },
          {
            id: 'baseline-rejections',
            label: 'Baseline rejected attempts',
            value: rejectedAttempts(evaluation.baseline),
            provenance: 'Provider measurement',
          },
          {
            id: 'follow-up-rejections',
            label: 'Follow-up rejected attempts',
            value: rejectedAttempts(evaluation.endpoint),
            provenance: 'Provider measurement',
          },
          {
            id: 'direction-agreement',
            label: 'Saved direction agreement',
            value: humanizeCode(evaluation.directionAgreement.status),
            canonicalValue: evaluation.directionAgreement.status,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'assessed-endpoint-count',
            label: 'Assessed follow-up frame count',
            value: String(evaluation.directionAgreement.assessedEndpointFrameCount),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'improving-endpoint-count',
            label: 'Improving follow-up frame count',
            value: String(evaluation.directionAgreement.improvingEndpointFrameCount),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'saved-measurement-quality',
            label: 'Saved measurement quality',
            value: measurementLabel(evaluation.measurementQuality),
            canonicalValue: evaluation.measurementQuality,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'baseline-capture-comparability',
            label: 'Baseline capture comparability',
            value: captureComparability(evaluation.baseline),
            provenance: evaluation.baseline.sessions.length > 0
              ? 'Provider measurement'
              : 'Unavailable evidence',
          },
          {
            id: 'follow-up-capture-comparability',
            label: 'Follow-up capture comparability',
            value: captureComparability(evaluation.endpoint),
            provenance: evaluation.endpoint.sessions.length > 0
              ? 'Provider measurement'
              : 'Unavailable evidence',
          },
          {
            id: 'facial-registration-quality',
            label: 'Facial registration quality',
            value: optionalMeasurement(evaluation.maskEvidence.facialRegistrationQuality),
            provenance: optionalMeasurementProvenance(
              evaluation.maskEvidence.facialRegistrationQuality,
            ),
          },
          {
            id: 'eligible-skin-pixel-count',
            label: 'Eligible skin pixel count',
            value: optionalMeasurement(evaluation.maskEvidence.eligibleSkinPixelCount),
            provenance: optionalMeasurementProvenance(
              evaluation.maskEvidence.eligibleSkinPixelCount,
            ),
          },
          {
            id: 'baseline-mask-area',
            label: 'Baseline redness-mask area',
            value: optionalMeasurement(evaluation.maskEvidence.baselineAreaPct),
            provenance: optionalMeasurementProvenance(evaluation.maskEvidence.baselineAreaPct),
          },
          {
            id: 'follow-up-mask-area',
            label: 'Follow-up redness-mask area',
            value: optionalMeasurement(evaluation.maskEvidence.endpointAreaPct),
            provenance: optionalMeasurementProvenance(evaluation.maskEvidence.endpointAreaPct),
          },
          {
            id: 'baseline-mask-pixel-count',
            label: 'Baseline redness-mask pixel count',
            value: optionalMeasurement(evaluation.maskEvidence.baselineMaskPixelCount),
            provenance: optionalMeasurementProvenance(
              evaluation.maskEvidence.baselineMaskPixelCount,
            ),
          },
          {
            id: 'follow-up-mask-pixel-count',
            label: 'Follow-up redness-mask pixel count',
            value: optionalMeasurement(evaluation.maskEvidence.endpointMaskPixelCount),
            provenance: optionalMeasurementProvenance(
              evaluation.maskEvidence.endpointMaskPixelCount,
            ),
          },
          {
            id: 'baseline-region-agreement',
            label: 'Baseline region agreement',
            value: optionalMeasurement(evaluation.maskEvidence.baselineRegionAgreement),
            provenance: optionalMeasurementProvenance(
              evaluation.maskEvidence.baselineRegionAgreement,
            ),
          },
          {
            id: 'spatial-consistency',
            label: 'Spatial consistency',
            value: optionalMeasurement(evaluation.maskEvidence.spatialConsistency),
            provenance: optionalMeasurementProvenance(evaluation.maskEvidence.spatialConsistency),
          },
          {
            id: 'segmentation-stability',
            label: 'Segmentation stability',
            value: optionalMeasurement(evaluation.maskEvidence.segmentationStable),
            provenance: optionalMeasurementProvenance(evaluation.maskEvidence.segmentationStable),
          },
        ],
      },
      {
        id: 'trial-truth',
        title: 'Trial truth',
        rows: [
          {
            id: 'product-overlap',
            label: 'Product overlap',
            value: productOverlap(evaluation),
            canonicalValue: evaluation.secondProductStatus,
            provenance: 'Participant report',
          },
          {
            id: 'confounders',
            label: 'Confounders or overlap',
            value: confounderSummary(evaluation),
            provenance: 'Participant report',
          },
          {
            id: 'adherence',
            label: 'Product use',
            value: adherenceLabel(record.trialTruth?.adherence.status ?? 'unknown'),
            canonicalValue: record.trialTruth?.adherence.status ?? 'not_collected',
            provenance: record.trialTruth ? 'Participant report' : 'Unavailable evidence',
          },
          {
            id: 'tolerance-severity',
            label: 'Skin response',
            value: toleranceLabel(record.trialTruth),
            canonicalValue: record.trialTruth?.tolerance.severity ?? 'not_collected',
            provenance: record.trialTruth ? 'Participant report' : 'Unavailable evidence',
          },
          {
            id: 'reported-symptoms',
            label: 'Reported symptoms',
            value: symptomLabel(record.trialTruth),
            provenance: record.trialTruth ? 'Participant report' : 'Unavailable evidence',
          },
          {
            id: 'participant-observation',
            label: 'Participant-observed redness direction',
            value: participantObservationLabel(record.trialTruth),
            provenance: record.trialTruth ? 'Participant report' : 'Unavailable evidence',
          },
          {
            id: 'participant-report-timestamp',
            label: 'Participant report timestamp',
            value: record.trialTruth
              ? savedTimestamp(record.trialTruth.recordedAt)
              : 'Not collected',
            canonicalValue: record.trialTruth?.recordedAt ?? 'not_collected',
            provenance: record.trialTruth ? 'Participant report' : 'Unavailable evidence',
          },
          {
            id: 'anchor-relationship',
            label: 'Saved objective/participant relationship',
            value: anchorRelationshipLabel(record),
            canonicalValue: record.anchorRelationship ?? 'not_collected',
            provenance: record.anchorRelationship && record.anchorRelationship !== 'not_collected'
              ? 'Face Value deterministic evaluation'
              : 'Unavailable evidence',
          },
          ...(record.note?.trim()
            ? [
                {
                  id: 'trial-note',
                  label: 'Trial note',
                  value: record.note.trim(),
                  provenance: 'Participant report' as const,
                },
              ]
            : []),
        ],
      },
      {
        id: 'evidence-boundaries',
        title: 'Evidence boundaries',
        rows: [
          {
            id: 'evidence-quality',
            label: 'Saved evidence quality',
            value: evidenceLabel(evaluation.evidenceQuality),
            canonicalValue: evaluation.evidenceQuality,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'attribution-quality',
            label: 'Saved attribution quality',
            value: attributionQualityLabel(evaluation.attributionQuality),
            canonicalValue: evaluation.attributionQuality,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'safety-status',
            label: 'Saved safety status',
            value: safetyStatusLabel(evaluation.safetyStatus),
            canonicalValue: evaluation.safetyStatus,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'active-provisional-boundary',
            label: 'Active provisional boundary',
            value: comparisonSettingsDescription(evaluation),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'threshold-source',
            label: 'Threshold source',
            value: thresholdSourceLabel(evaluation.threshold.source),
            canonicalValue: evaluation.threshold.source,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'threshold-version',
            label: 'Threshold version',
            value: evaluation.threshold.version,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'provisional-status',
            label: 'Provisional status',
            value: evaluation.threshold.provisional ? 'Yes — preliminary' : 'No',
            canonicalValue: String(evaluation.threshold.provisional),
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'configuration-hash',
            label: 'Configuration hash',
            value: evaluation.threshold.configHash,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'missing-evidence',
            label: 'Missing or not-collected evidence',
            value: missingEvidence,
            provenance: 'Unavailable evidence',
          },
        ],
      },
      {
        id: 'supported-next-action',
        title: 'Supported next action',
        rows: [
          {
            id: 'recommended-action',
            label: 'Saved recommended action',
            value: canonicalActionLabel(evaluation.interpretation.recommendedAction),
            canonicalValue: evaluation.interpretation.recommendedAction,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'deterministic-explanation',
            label: 'Saved deterministic explanation',
            value: evaluation.interpretation.explanation,
            provenance: 'Face Value deterministic evaluation',
          },
          {
            id: 'rule-trace',
            label: 'Saved rule trace',
            value: evaluation.triggeredRuleIds.length > 0
              ? evaluation.triggeredRuleIds.join(' · ')
              : 'Not available',
            provenance: evaluation.triggeredRuleIds.length > 0
              ? 'Face Value deterministic evaluation'
              : 'Unavailable evidence',
          },
          {
            id: 'additional-evidence',
            label: 'Additional evidence that would strengthen this result',
            value: additionalEvidence,
            provenance: evaluation.missingEvidence.length > 0
              ? 'Unavailable evidence'
              : 'Face Value deterministic evaluation',
          },
        ],
      },
    ],
    technicalMetadata: [
      {
        id: 'framework-version',
        label: 'Framework version',
        value: evaluation.frameworkVersion,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'schema-version',
        label: 'Schema version',
        value: evaluation.schemaVersion,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'engine-version',
        label: 'Engine version',
        value: evaluation.engineVersion,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'api-version',
        label: 'Application programming interface',
        value: evaluation.versions.apiVersion,
        provenance: 'Provider measurement',
      },
      {
        id: 'analysis-model',
        label: 'Analysis model version',
        value: versionValue(evaluation.versions.analysisModelVersion),
        canonicalValue: unavailableVersion(evaluation.versions.analysisModelVersion)
          ? evaluation.versions.analysisModelVersion
          : undefined,
        provenance: unavailableVersion(evaluation.versions.analysisModelVersion)
          ? 'Unavailable evidence'
          : 'Provider measurement',
      },
      {
        id: 'preprocessing-version',
        label: 'Preprocessing version',
        value: versionValue(evaluation.versions.preprocessingVersion),
        provenance: unavailableVersion(evaluation.versions.preprocessingVersion)
          ? 'Unavailable evidence'
          : 'Provider measurement',
      },
      {
        id: 'capture-protocol',
        label: 'Capture protocol version',
        value: versionValue(evaluation.versions.captureProtocolVersion),
        provenance: unavailableVersion(evaluation.versions.captureProtocolVersion)
          ? 'Unavailable evidence'
          : 'Provider measurement',
      },
      {
        id: 'app-version',
        label: 'App version',
        value: versionValue(evaluation.versions.appBuildVersion),
        provenance: unavailableVersion(evaluation.versions.appBuildVersion)
          ? 'Unavailable evidence'
          : 'Provider measurement',
      },
      {
        id: 'configuration-hash-metadata',
        label: 'Configuration hash',
        value: evaluation.threshold.configHash,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'triggered-rules',
        label: 'Triggered rule identifiers',
        value:
          evaluation.triggeredRuleIds.length > 0
            ? evaluation.triggeredRuleIds.join(' · ')
            : 'Not available',
        provenance: evaluation.triggeredRuleIds.length > 0
          ? 'Face Value deterministic evaluation'
          : 'Unavailable evidence',
      },
      {
        id: 'snapshot-identity',
        label: 'Immutable snapshot identity',
        value: `${evaluation.trialId} · ${evaluation.evaluatedAt}`,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'evaluated-at',
        label: 'Evaluated at',
        value: savedTimestamp(evaluation.evaluatedAt),
        canonicalValue: evaluation.evaluatedAt,
        provenance: 'Face Value deterministic evaluation',
      },
      {
        id: 'privacy',
        label: 'Face image persistence',
        value: evaluation.privacy.includesFaceImage ? 'Included' : 'Excluded',
        canonicalValue: `includesFaceImage=${String(evaluation.privacy.includesFaceImage)}`,
        provenance: 'Face Value deterministic evaluation',
      },
    ],
    auditTrace: evaluation.auditTrace.map((entry) => ({ ...entry })),
    technicalNote,
  };
};

const canonicalViewModel = (
  record: EvidenceRecordData,
  evaluation: RednessEvaluationSnapshot,
): EvidenceRecordViewModel => {
  const verdict = verdictViewModelFromRecord(record);
  const folio = oracleTrialIdentityForRecord(record).folio;
  const comparison = comparisonFor(evaluation);
  const atAGlance = atAGlanceRows(evaluation);

  return {
    canonical: true,
    recordId: record.id,
    folio,
    product: verdictProduct(verdict),
    trialMetadata: `${days(evaluation.actualObservationIntervalDays)} · Saved ${savedDate(record.createdAt)}`,
    headline: evaluation.interpretation.finding,
    interpretation: resultInterpretation(evaluation),
    evidenceStatus: evidenceLabel(evaluation.evidenceQuality),
    nextStep: actionPresentation(evaluation.interpretation.recommendedAction, evaluation),
    comparison,
    comparisonUnavailableMessage: comparison
      ? undefined
      : 'Detailed measurements are not available in this saved snapshot.',
    atAGlance,
    why: {
      supportingPoints: [
        supportingMovement(evaluation),
        supportingMeasurement(evaluation.measurementQuality),
        supportingAttribution(evaluation),
        supportingSafety(evaluation),
      ],
      limitation: limitationSummary(evaluation),
      claimBoundary: evaluation.interpretation.claimBoundary.join(' '),
    },
    full: fullRecordFor(evaluation, record),
    privacyLabel: 'Private by default · Face image excluded',
  };
};

const legacyViewModel = (record: EvidenceRecordData): EvidenceRecordViewModel => {
  const verdict = verdictViewModelFromRecord(record);
  return {
    canonical: false,
    recordId: record.id,
    folio: oracleTrialIdentityForRecord(record).folio,
    product: verdictProduct(verdict),
    trialMetadata: `${observationWindowForLegacy(record.observationWindow)} · Saved ${savedDate(record.createdAt)}`,
    headline: record.finding,
    interpretation: record.nonFinding,
    nextStep: {
      statusLabel: verdict.nextStepLabel,
      title: sentenceCase(verdict.nextStepLabel),
      body: 'Continue from the saved next step for this earlier result.',
      tone: 'default',
    },
    atAGlance: [],
    legacyMessage:
      'Redness Response Signature evidence was not collected for this earlier result. Detailed burst measurements and trial-truth evidence are not available.',
    legacyNote: record.note?.trim() || undefined,
    privacyLabel: 'Private by default · Face image excluded',
  };
};

export function evidenceRecordViewModelFromRecord(
  record: EvidenceRecordData,
): EvidenceRecordViewModel {
  return record.rednessEvaluation
    ? canonicalViewModel(record, record.rednessEvaluation)
    : legacyViewModel(record);
}

export const evidenceRecordPresentationLabels = {
  measurement: measurementLabel,
  evidence: evidenceLabel,
} as const;
