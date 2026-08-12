import type { EvidenceRecordData } from '../../domain/model';

export interface SavedResultCompatibilityRow {
  id:
    | 'adherence'
    | 'tolerance-severity'
    | 'reported-symptoms'
    | 'participant-observation'
    | 'participant-report-timestamp'
    | 'anchor-relationship';
  canonicalValue?: string;
  value: string;
}

const sentenceCase = (value: string): string => {
  const normalized = value.replaceAll('_', ' ').toLocaleLowerCase('en-US');
  return normalized
    ? `${normalized[0].toLocaleUpperCase('en-US')}${normalized.slice(1)}`
    : value;
};

const participantObservation = (visibleChange: number | undefined): string => {
  if (typeof visibleChange !== 'number') return 'Not collected';
  if (visibleChange > 0) return 'Less';
  if (visibleChange < 0) return 'More';
  return 'Same';
};

export function savedResultCompatibilityRows(
  record: EvidenceRecordData,
): SavedResultCompatibilityRow[] {
  const truth = record.trialTruth;
  const adherence = truth?.adherence.status ?? 'not_collected';
  const tolerance = truth?.tolerance.severity ?? 'not_collected';
  const reported = truth?.tolerance.symptoms.length
    ? truth.tolerance.symptoms.map(sentenceCase).join(', ')
    : truth
      ? 'None reported'
      : 'Not collected';
  const recordedAt = truth?.recordedAt ?? 'not_collected';
  const relationship = record.anchorRelationship ?? 'not_collected';

  return [
    {
      id: 'adherence',
      canonicalValue: adherence,
      value: adherence === 'not_collected' ? 'Not collected' : sentenceCase(adherence),
    },
    {
      id: 'tolerance-severity',
      canonicalValue: tolerance,
      value: tolerance === 'not_collected' ? 'Not collected' : sentenceCase(tolerance),
    },
    {
      id: 'reported-symptoms',
      value: reported,
    },
    {
      id: 'participant-observation',
      value: participantObservation(truth?.patientAnchor.visibleChange),
    },
    {
      id: 'participant-report-timestamp',
      canonicalValue: recordedAt,
      value: recordedAt === 'not_collected' ? 'Not collected' : recordedAt,
    },
    {
      id: 'anchor-relationship',
      canonicalValue: relationship,
      value: relationship === 'not_collected' ? 'Not collected' : sentenceCase(relationship),
    },
  ];
}
