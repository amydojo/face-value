import type {
  CaptureQuality,
  EvidencePeriod,
  EvidenceQuality,
  MeasurementQuality,
  RednessEvaluationSnapshot,
} from '../../domain/evidence/redness';
import type { CaptureMetadata, EvidenceRecordData } from '../../domain/model';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { verdictViewModelFromRecord } from '../verdict/verdictViewModel';

export type ResultDirection = 'favorable' | 'unfavorable' | 'unchanged' | 'unavailable';
export type EvidenceCheckTone = 'pass' | 'limited' | 'fail' | 'unavailable';
export type TechnicalGroupId = 'provider' | 'capture' | 'evaluation' | 'exclusions';

export interface EvidenceCheckViewModel {
  id: 'pose' | 'framing' | 'lighting' | 'provider';
  label: string;
  value: string;
  tone: EvidenceCheckTone;
}

export interface TechnicalFieldViewModel {
  id: string;
  label: string;
  value: string;
  unavailable: boolean;
  accent?: boolean;
}

export interface TechnicalGroupViewModel {
  id: TechnicalGroupId;
  index: string;
  title: string;
  description: string;
  fields: TechnicalFieldViewModel[];
}

export interface ResultExperienceViewModel {
  canonical: boolean;
  recordId: string;
  folio: string;
  trialNumber: string;
  product: string;
  duration: string;
  durationCompact: string;
  concern: string;
  verdict: string;
  direction: ResultDirection;
  directionLabel: string;
  baseline: string;
  followUp: string;
  change: string;
  changeCompact: string;
  comparison: string;
  agreement: string;
  evidenceLevel: string;
  evidenceBoundary: string[];
  checks: EvidenceCheckViewModel[];
  groups: TechnicalGroupViewModel[];
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const score = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? numberFormatter.format(value)
    : 'Not available';

const signedScore = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  if (value === 0) return '0';
  return `${value > 0 ? '+' : ''}${numberFormatter.format(value)}`;
};

const sentenceCase = (value: string): string => {
  const normalized = value.replaceAll('_', ' ').trim().toLocaleLowerCase('en-US');
  return normalized
    ? `${normalized[0].toLocaleUpperCase('en-US')}${normalized.slice(1)}`
    : value;
};

const evidenceLevel = (value: EvidenceQuality | EvidenceRecordData['confidence']): string => {
  switch (value) {
    case 'possible':
      return 'Early';
    case 'likely':
      return 'Growing';
    case 'confirmed':
      return 'Established';
    case 'insufficient':
      return 'Insufficient';
  }
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

const directionFor = (record: EvidenceRecordData): ResultDirection => {
  if (record.comparisonDirection) return record.comparisonDirection;
  const classification = record.rednessEvaluation?.effectClassification;
  switch (classification) {
    case 'directional_improvement':
    case 'meaningful_candidate':
    case 'strong_improvement':
      return 'favorable';
    case 'worsened':
      return 'unfavorable';
    case 'no_detectable_change':
      return 'unchanged';
    case null:
    case undefined:
      return 'unavailable';
  }
};

const directionLabel = (direction: ResultDirection): string => {
  switch (direction) {
    case 'favorable':
      return 'Favorable';
    case 'unfavorable':
      return 'Unfavorable';
    case 'unchanged':
      return 'Unchanged';
    case 'unavailable':
      return 'Not available';
  }
};

const durationDays = (record: EvidenceRecordData): number | null => {
  const snapshotDuration = record.rednessEvaluation?.actualObservationIntervalDays;
  if (typeof snapshotDuration === 'number' && Number.isFinite(snapshotDuration)) {
    return snapshotDuration;
  }
  const [baselineValue, followUpValue] = record.observationWindow.split(' to ');
  const baseline = new Date(baselineValue).getTime();
  const followUp = new Date(followUpValue).getTime();
  if (!Number.isFinite(baseline) || !Number.isFinite(followUp) || followUp <= baseline) {
    return null;
  }
  const days = Math.round((followUp - baseline) / 86_400_000);
  return days > 0 ? days : null;
};

const formatDuration = (days: number | null): string =>
  days === null ? 'Not available' : `${numberFormatter.format(days)} ${days === 1 ? 'day' : 'days'}`;

const compactDuration = (days: number | null): string =>
  days === null ? 'NOT AVAILABLE' : `${numberFormatter.format(days)} ${days === 1 ? 'DAY' : 'DAYS'}`;

const attemptedCount = (period: EvidencePeriod): number =>
  period.acceptedRawScores.length + period.rejectedFrameCount;

const acceptedComparison = (evaluation: RednessEvaluationSnapshot | undefined): string => {
  if (!evaluation) return 'Not available';
  const baselineAccepted = evaluation.baseline.acceptedRawScores.length;
  const endpointAccepted = evaluation.endpoint.acceptedRawScores.length;
  const baselineAttempted = attemptedCount(evaluation.baseline);
  const endpointAttempted = attemptedCount(evaluation.endpoint);
  if (baselineAttempted === 0 && endpointAttempted === 0) return 'Not available';
  return `${baselineAccepted}/${baselineAttempted} ↔ ${endpointAccepted}/${endpointAttempted}`;
};

const agreement = (evaluation: RednessEvaluationSnapshot | undefined): string => {
  if (!evaluation) return 'Not available';
  const accepted =
    evaluation.baseline.acceptedRawScores.length + evaluation.endpoint.acceptedRawScores.length;
  const attempted = attemptedCount(evaluation.baseline) + attemptedCount(evaluation.endpoint);
  return attempted > 0 ? `${accepted}/${attempted}` : 'Not available';
};

const toneRank: Record<EvidenceCheckTone, number> = {
  pass: 0,
  limited: 1,
  fail: 2,
  unavailable: 3,
};

const worstTone = (tones: EvidenceCheckTone[]): EvidenceCheckTone => {
  if (tones.length === 0) return 'unavailable';
  return tones.reduce((worst, tone) => (toneRank[tone] > toneRank[worst] ? tone : worst));
};

const comparabilityTone = (
  evaluation: RednessEvaluationSnapshot | undefined,
  read: (quality: CaptureQuality) => 'fail' | 'limited' | 'pass',
): EvidenceCheckTone => {
  if (!evaluation) return 'unavailable';
  const sessions = [...evaluation.baseline.sessions, ...evaluation.endpoint.sessions];
  if (sessions.length === 0) return 'unavailable';
  return worstTone(sessions.map(({ captureQuality }) => read(captureQuality)));
};

const checkValue = (tone: EvidenceCheckTone): string => {
  switch (tone) {
    case 'pass':
      return 'Pass';
    case 'limited':
      return 'Limited';
    case 'fail':
      return 'Fail';
    case 'unavailable':
      return 'Not available';
  }
};

const providerTone = (
  evaluation: RednessEvaluationSnapshot | undefined,
): EvidenceCheckTone => {
  if (!evaluation) return 'unavailable';
  const sessions = [...evaluation.baseline.sessions, ...evaluation.endpoint.sessions];
  const accepted =
    evaluation.baseline.acceptedRawScores.length + evaluation.endpoint.acceptedRawScores.length;
  if (sessions.length === 0 && accepted === 0) return 'unavailable';
  if (accepted === 0) return 'fail';
  const providerRejections = sessions.flatMap(({ rejectedFrames }) => rejectedFrames)
    .filter(({ stage }) => stage === 'provider').length;
  return providerRejections > 0 ? 'limited' : 'pass';
};

const evidenceChecks = (
  evaluation: RednessEvaluationSnapshot | undefined,
): EvidenceCheckViewModel[] => {
  const pose = comparabilityTone(evaluation, ({ poseComparability }) => poseComparability);
  const framing = worstTone([
    comparabilityTone(evaluation, ({ cropComparability }) => cropComparability),
    comparabilityTone(evaluation, ({ faceSizeComparability }) => faceSizeComparability),
  ]);
  const lighting = worstTone([
    comparabilityTone(evaluation, ({ lightingComparability }) => lightingComparability),
    comparabilityTone(evaluation, ({ colorCastComparability }) => colorCastComparability),
  ]);
  const provider = providerTone(evaluation);
  return [
    { id: 'pose', label: 'Pose', value: checkValue(pose), tone: pose },
    { id: 'framing', label: 'Framing', value: checkValue(framing), tone: framing },
    { id: 'lighting', label: 'Lighting', value: checkValue(lighting), tone: lighting },
    { id: 'provider', label: 'Provider', value: checkValue(provider), tone: provider },
  ];
};

const mimeLabel = (capture: CaptureMetadata | null | undefined): string | null => {
  switch (capture?.mimeType) {
    case 'image/jpeg':
      return 'JPEG';
    case 'image/png':
      return 'PNG';
    case 'image/webp':
      return 'WebP';
    case 'image/heic':
      return 'HEIC';
    case 'image/unknown':
    case undefined:
      return null;
  }
};

const fileFormat = (record: EvidenceRecordData): string => {
  const baseline = mimeLabel(record.baselineCapture);
  const followUp = mimeLabel(record.followupCapture);
  if (!baseline && !followUp) return 'Not available';
  if (baseline && followUp && baseline !== followUp) return `${baseline} ↔ ${followUp}`;
  return baseline ?? followUp ?? 'Not available';
};

const field = (
  id: string,
  label: string,
  value: string,
  accent = false,
): TechnicalFieldViewModel => ({
  id,
  label,
  value,
  unavailable: value === 'Not available' || value === 'Not collected' || value === 'Not reported',
  accent,
});

const providerFields = (
  record: EvidenceRecordData,
  evaluation: RednessEvaluationSnapshot | undefined,
): TechnicalFieldViewModel[] => [
  field('baseline-median', 'Baseline median', score(evaluation?.baselineRawMedian ?? record.baselineRawScore)),
  field(
    'follow-up-median',
    'Follow-up median',
    score(evaluation?.endpointRawMedian ?? record.followUpRawScore),
    true,
  ),
  field('accepted-frames', 'Accepted frames', acceptedComparison(evaluation)),
  field('skin-tone-model', 'Skin tone model', 'Not available'),
  field('region', 'Region', 'Not collected'),
  field('time-since-cleanse', 'Time since cleanse', 'Not collected'),
  field('device-skin-fit', 'Device skin fit', 'Not available'),
  field('image-resolution', 'Image resolution', 'Not available'),
  field('file-format', 'File format', fileFormat(record)),
];

const technicalGroups = (
  record: EvidenceRecordData,
  evaluation: RednessEvaluationSnapshot | undefined,
  checks: EvidenceCheckViewModel[],
  duration: number | null,
  recommendation: string,
): TechnicalGroupViewModel[] => {
  const captureFields = [
    ...checks.map(({ id, label, value }) => field(`capture-${id}`, label, value)),
    field(
      'baseline-device-class',
      'Baseline device class',
      evaluation?.baseline.sessions[0]?.deviceClass ?? 'Not available',
    ),
    field(
      'follow-up-device-class',
      'Follow-up device class',
      evaluation?.endpoint.sessions[0]?.deviceClass ?? 'Not available',
    ),
    field(
      'baseline-attempts',
      'Baseline frame counts',
      evaluation
        ? `${evaluation.baseline.acceptedRawScores.length} accepted · ${evaluation.baseline.rejectedFrameCount} rejected`
        : 'Not available',
    ),
    field(
      'follow-up-attempts',
      'Follow-up frame counts',
      evaluation
        ? `${evaluation.endpoint.acceptedRawScores.length} accepted · ${evaluation.endpoint.rejectedFrameCount} rejected`
        : 'Not available',
    ),
  ];

  const evaluationFields = [
    field('saved-verdict', 'Saved verdict', record.finding),
    field('saved-direction', 'Saved direction', directionLabel(directionFor(record))),
    field('saved-change', 'Saved score change', signedScore(evaluation?.rawScoreDelta), true),
    field('elapsed-time', 'Elapsed time', formatDuration(duration)),
    field(
      'measurement-quality',
      'Measurement quality',
      evaluation ? measurementLabel(evaluation.measurementQuality) : 'Not available',
    ),
    field(
      'evidence-quality',
      'Evidence quality',
      evaluation ? evidenceLevel(evaluation.evidenceQuality) : evidenceLevel(record.confidence),
    ),
    field(
      'attribution-quality',
      'Attribution quality',
      evaluation ? sentenceCase(evaluation.attributionQuality) : 'Not available',
    ),
    field(
      'safety-status',
      'Safety status',
      evaluation ? sentenceCase(evaluation.safetyStatus) : 'Not available',
    ),
    field(
      'direction-agreement',
      'Direction agreement',
      evaluation ? sentenceCase(evaluation.directionAgreement.status) : 'Not available',
    ),
    field(
      'recommended-action',
      'Recommended action',
      recommendation,
    ),
  ];

  const exclusions = evaluation?.missingEvidence.length
    ? evaluation.missingEvidence.map((value, index) =>
        field(`missing-${index + 1}`, `Unavailable evidence ${index + 1}`, value),
      )
    : [field('missing-evidence', 'Missing evidence', 'None recorded')];

  return [
    {
      id: 'provider',
      index: '01',
      title: 'Provider',
      description: 'Measurements',
      fields: providerFields(record, evaluation),
    },
    {
      id: 'capture',
      index: '02',
      title: 'Capture',
      description: 'Comparability',
      fields: captureFields,
    },
    {
      id: 'evaluation',
      index: '03',
      title: 'Evaluation',
      description: 'Evidence quality',
      fields: evaluationFields,
    },
    {
      id: 'exclusions',
      index: '04',
      title: 'Exclusions',
      description: 'Unavailable or uncollected',
      fields: exclusions,
    },
  ];
};

export function resultExperienceViewModelFromRecord(
  record: EvidenceRecordData,
): ResultExperienceViewModel {
  const evaluation = record.rednessEvaluation;
  const identity = oracleTrialIdentityForRecord(record);
  const days = durationDays(record);
  const direction = directionFor(record);
  const checks = evidenceChecks(evaluation);
  const changeValue = evaluation?.rawScoreDelta ??
    (typeof record.baselineRawScore === 'number' && typeof record.followUpRawScore === 'number'
      ? record.followUpRawScore - record.baselineRawScore
      : null);
  const level = evaluation ? evidenceLevel(evaluation.evidenceQuality) : evidenceLevel(record.confidence);
  const product = [record.productBrand, record.product].filter(Boolean).join(' · ');
  const recommendation = verdictViewModelFromRecord(record).nextStepLabel;

  return {
    canonical: Boolean(evaluation),
    recordId: record.id,
    folio: identity.folio,
    trialNumber: identity.firmware,
    product: product || record.product,
    duration: formatDuration(days),
    durationCompact: compactDuration(days),
    concern: 'Visible redness',
    verdict: record.finding,
    direction,
    directionLabel: directionLabel(direction),
    baseline: score(evaluation?.baselineRawMedian ?? record.baselineRawScore),
    followUp: score(evaluation?.endpointRawMedian ?? record.followUpRawScore),
    change: changeValue === null ? 'Not available' : `${signedScore(changeValue)} points`,
    changeCompact: signedScore(changeValue),
    comparison: acceptedComparison(evaluation),
    agreement: agreement(evaluation),
    evidenceLevel: level,
    evidenceBoundary: [`${level} evidence.`, 'Visible redness only.'],
    checks,
    groups: technicalGroups(record, evaluation, checks, days, recommendation),
  };
}
