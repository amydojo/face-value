import type {
  EffectClassification,
  EvidenceQuality,
  MeasurementQuality,
  RednessAction,
  RednessEvaluationSnapshot,
  ThresholdSource,
} from '../../domain/evidence/redness';
import type { EvidenceRecordData } from '../../domain/model';
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
}

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

const directionAgreement = (evaluation: RednessEvaluationSnapshot): string => {
  const direction = humanizeCode(evaluation.directionAgreement.status);
  const count = evaluation.directionAgreement.assessedEndpointFrameCount;
  return `${direction} · ${count} follow-up ${count === 1 ? 'measurement' : 'measurements'}`;
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

const expectedWindow = (evaluation: RednessEvaluationSnapshot): string => {
  const expected = evaluation.expectedObservationWindowDays;
  return `${expected.minimum}–${expected.target} days${
    expected.maximum === undefined ? '' : ` · maximum ${expected.maximum}`
  }`;
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
    ? 'Production thresholds require repeat-scan calibration.'
    : undefined;

  return {
    sections: [
      {
        id: 'evidence-checks',
        title: 'Evidence checks',
        rows: [
          {
            id: 'change-pattern',
            label: 'Change pattern',
            value: effectLabel(evaluation.effectClassification),
            canonicalValue: evaluation.effectClassification ?? 'not_available',
          },
          {
            id: 'scan-quality',
            label: 'Scan quality',
            value: measurementLabel(evaluation.measurementQuality),
            canonicalValue: evaluation.measurementQuality,
          },
          {
            id: 'product-isolation',
            label: 'Product isolation',
            value: attributionLabel(evaluation),
            canonicalValue: evaluation.attributionQuality,
          },
          {
            id: 'evidence-quality',
            label: 'Evidence so far',
            value: evidenceLabel(evaluation.evidenceQuality),
            canonicalValue: evaluation.evidenceQuality,
          },
          {
            id: 'safety-status',
            label: 'Skin response',
            value: safetyLabel(evaluation),
            canonicalValue: evaluation.safetyStatus,
          },
        ],
      },
      {
        id: 'measurements',
        title: 'Measurements',
        rows: [
          {
            id: 'baseline-score',
            label: 'Baseline score',
            value: score(evaluation.baselineRawMedian),
          },
          {
            id: 'follow-up-score',
            label: 'Follow-up score',
            value: score(evaluation.endpointRawMedian),
          },
          {
            id: 'baseline-measurements',
            label: 'Baseline measurements',
            value: acceptedMeasurements(evaluation.baseline.acceptedRawScores),
          },
          {
            id: 'follow-up-measurements',
            label: 'Follow-up measurements',
            value: acceptedMeasurements(evaluation.endpoint.acceptedRawScores),
          },
          {
            id: 'baseline-rejections',
            label: 'Baseline replacements',
            value: rejectedAttempts(evaluation.baseline),
          },
          {
            id: 'follow-up-rejections',
            label: 'Follow-up replacements',
            value: rejectedAttempts(evaluation.endpoint),
          },
          {
            id: 'direction-agreement',
            label: 'Follow-up agreement',
            value: directionAgreement(evaluation),
            canonicalValue: evaluation.directionAgreement.status,
          },
          {
            id: 'observed-change',
            label: 'Observed change',
            value: signedPoints(evaluation.rawScoreDelta),
          },
          {
            id: 'time-between',
            label: 'Time between scans',
            value: days(evaluation.actualObservationIntervalDays),
          },
          {
            id: 'baseline-sessions',
            label: 'Baseline sessions',
            value: scoreFormatter.format(evaluation.baseline.sessionCount),
          },
          {
            id: 'follow-up-sessions',
            label: 'Follow-up sessions',
            value: scoreFormatter.format(evaluation.endpoint.sessionCount),
          },
        ],
      },
      {
        id: 'trial-details',
        title: 'Trial details',
        rows: [
          {
            id: 'assigned-job',
            label: 'Assigned job',
            value: 'Calm visible redness',
            canonicalValue: evaluation.assignedJob,
          },
          {
            id: 'expected-window',
            label: 'Expected window',
            value: expectedWindow(evaluation),
          },
          {
            id: 'actual-interval',
            label: 'Actual interval',
            value: days(evaluation.actualObservationIntervalDays),
            canonicalValue: evaluation.observationWindowStatus,
          },
          {
            id: 'product-overlap',
            label: 'Product overlap',
            value: productOverlap(evaluation),
            canonicalValue: evaluation.secondProductStatus,
          },
          {
            id: 'confounders',
            label: 'Confounders or overlap',
            value: confounderSummary(evaluation),
          },
          {
            id: 'adherence',
            label: 'Product use',
            value: adherenceLabel(evaluation.adherence.status),
            canonicalValue: evaluation.adherence.status,
          },
          {
            id: 'missing-evidence',
            label: 'Data not collected',
            value: missingEvidence,
          },
          ...(record.note?.trim()
            ? [
                {
                  id: 'trial-note',
                  label: 'Trial note',
                  value: record.note.trim(),
                },
              ]
            : []),
        ],
      },
      {
        id: 'comparison-settings',
        title: 'Comparison settings',
        rows: [
          {
            id: 'threshold-description',
            label: 'Preliminary settings',
            value: comparisonSettingsDescription(evaluation),
          },
          {
            id: 'threshold-source',
            label: 'Threshold source',
            value: thresholdSourceLabel(evaluation.threshold.source),
            canonicalValue: evaluation.threshold.source,
          },
          {
            id: 'threshold-version',
            label: 'Threshold version',
            value: evaluation.threshold.version,
          },
          {
            id: 'provisional-status',
            label: 'Provisional status',
            value: evaluation.threshold.provisional ? 'Yes — preliminary' : 'No',
          },
        ],
      },
      {
        id: 'technical-methods',
        title: 'Technical methods',
        rows: [
          {
            id: 'framework-version',
            label: 'Framework version',
            value: evaluation.frameworkVersion,
          },
          {
            id: 'schema-version',
            label: 'Schema version',
            value: evaluation.schemaVersion,
          },
          {
            id: 'engine-version',
            label: 'Engine version',
            value: evaluation.engineVersion,
          },
          {
            id: 'api-version',
            label: 'Application programming interface',
            value: evaluation.versions.apiVersion,
          },
          {
            id: 'analysis-model',
            label: 'Analysis model version',
            value: versionValue(evaluation.versions.analysisModelVersion),
            canonicalValue: unavailableVersion(evaluation.versions.analysisModelVersion)
              ? evaluation.versions.analysisModelVersion
              : undefined,
          },
          {
            id: 'preprocessing-version',
            label: 'Preprocessing version',
            value: versionValue(evaluation.versions.preprocessingVersion),
          },
          {
            id: 'capture-protocol',
            label: 'Capture protocol version',
            value: versionValue(evaluation.versions.captureProtocolVersion),
          },
          {
            id: 'app-version',
            label: 'App version',
            value: versionValue(evaluation.versions.appBuildVersion),
          },
        ],
      },
    ],
    technicalMetadata: [
      {
        id: 'configuration-hash',
        label: 'Configuration hash',
        value: evaluation.threshold.configHash,
      },
      {
        id: 'triggered-rules',
        label: 'Triggered rule identifiers',
        value:
          evaluation.triggeredRuleIds.length > 0
            ? evaluation.triggeredRuleIds.join(' · ')
            : 'Not available',
      },
      {
        id: 'snapshot-identity',
        label: 'Immutable snapshot identity',
        value: `${evaluation.trialId} · ${evaluation.evaluatedAt}`,
      },
      {
        id: 'evaluated-at',
        label: 'Evaluated at',
        value: savedTimestamp(evaluation.evaluatedAt),
        canonicalValue: evaluation.evaluatedAt,
      },
      {
        id: 'privacy',
        label: 'Face image persistence',
        value: evaluation.privacy.includesFaceImage ? 'Included' : 'Excluded',
        canonicalValue: `includesFaceImage=${String(evaluation.privacy.includesFaceImage)}`,
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
    legacyMessage: 'Detailed measurements are not available for this earlier result.',
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
