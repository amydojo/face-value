import type {
  AdherenceEvidence,
  EffectClassification,
  IrritationSignal,
  PatientAnchor,
  RednessEvaluationSnapshot,
  ToleranceEvidence,
} from './evidence/redness';

export type TrialTruthAdherenceAnswer = 'yes' | 'mostly' | 'no';
export type TrialTruthToleranceAnswer = ToleranceEvidence['severity'];
export type TrialTruthVisibleChangeAnswer = 'less' | 'same' | 'more';
export type TrialTruthGroup = 'adherence' | 'tolerance' | 'symptoms' | 'visibleChange';
export type AnchorRelationship = 'agreed' | 'neutral' | 'contradicted' | 'not_collected';

export interface TrialTruthDraft {
  adherence: TrialTruthAdherenceAnswer | null;
  tolerance: TrialTruthToleranceAnswer | null;
  symptoms: IrritationSignal[];
  visibleChange: TrialTruthVisibleChangeAnswer | null;
}

export interface TrialTruthEvidence {
  generationId: string;
  adherence: AdherenceEvidence;
  tolerance: ToleranceEvidence;
  patientAnchor: PatientAnchor;
  recordedAt: string;
}

export interface TrialTruthValidation {
  valid: boolean;
  firstInvalidGroup: TrialTruthGroup | null;
  messages: string[];
}

export const IRRITATION_SIGNALS: readonly IrritationSignal[] = [
  'burning',
  'stinging',
  'itching',
  'heat',
  'swelling',
  'peeling',
  'blistering',
  'eye_involvement',
  'rapid_escalation',
  'unusual_sensitivity',
] as const;

const irritationSignalSet = new Set<IrritationSignal>(IRRITATION_SIGNALS);
const adherenceStatuses = new Set<AdherenceEvidence['status']>([
  'complete',
  'partial',
  'poor',
  'unknown',
]);
const toleranceSeverities = new Set<TrialTruthToleranceAnswer>([
  'none',
  'mild',
  'moderate',
  'severe',
]);

export const emptyTrialTruthDraft = (): TrialTruthDraft => ({
  adherence: null,
  tolerance: null,
  symptoms: [],
  visibleChange: null,
});

export function adherenceEvidenceForAnswer(
  answer: TrialTruthAdherenceAnswer,
): AdherenceEvidence {
  switch (answer) {
    case 'yes':
      return { status: 'complete' };
    case 'mostly':
      return { status: 'partial' };
    case 'no':
      return { status: 'poor' };
  }
}

export function visibleChangeForAnswer(answer: TrialTruthVisibleChangeAnswer): -1 | 0 | 1 {
  switch (answer) {
    case 'less':
      return 1;
    case 'same':
      return 0;
    case 'more':
      return -1;
  }
}

export function validateTrialTruthDraft(draft: TrialTruthDraft): TrialTruthValidation {
  const messages: string[] = [];
  let firstInvalidGroup: TrialTruthGroup | null = null;
  const add = (group: TrialTruthGroup, message: string) => {
    if (firstInvalidGroup === null) firstInvalidGroup = group;
    messages.push(message);
  };

  if (draft.adherence === null) {
    add('adherence', 'Choose whether the product was used as planned.');
  }
  if (draft.tolerance === null) {
    add('tolerance', 'Choose how your skin tolerated the product.');
  }
  if (
    (draft.tolerance === 'moderate' || draft.tolerance === 'severe') &&
    draft.symptoms.length === 0
  ) {
    add('symptoms', 'Choose at least one reported symptom for a moderate or severe response.');
  }
  if (draft.visibleChange === null) {
    add('visibleChange', 'Choose whether visible redness looked less, the same, or more.');
  }

  return {
    valid: messages.length === 0,
    firstInvalidGroup,
    messages,
  };
}

export function commitTrialTruth(input: {
  draft: TrialTruthDraft;
  generationId: string;
  recordedAt: string;
}): TrialTruthEvidence | null {
  const validation = validateTrialTruthDraft(input.draft);
  if (
    !validation.valid ||
    !input.generationId ||
    !input.recordedAt ||
    input.draft.adherence === null ||
    input.draft.tolerance === null ||
    input.draft.visibleChange === null
  ) {
    return null;
  }

  const symptoms =
    input.draft.tolerance === 'none' ? [] : [...new Set(input.draft.symptoms)];
  return {
    generationId: input.generationId,
    adherence: adherenceEvidenceForAnswer(input.draft.adherence),
    tolerance: {
      collectionStatus: 'collected',
      severity: input.draft.tolerance,
      symptoms,
    },
    patientAnchor: {
      visibleChange: visibleChangeForAnswer(input.draft.visibleChange),
      recordedAt: input.recordedAt,
    },
    recordedAt: input.recordedAt,
  };
}

export function cloneTrialTruthEvidence(evidence: TrialTruthEvidence): TrialTruthEvidence {
  return {
    generationId: evidence.generationId,
    adherence: { ...evidence.adherence },
    tolerance: {
      ...evidence.tolerance,
      symptoms: [...evidence.tolerance.symptoms],
    },
    patientAnchor: { ...evidence.patientAnchor },
    recordedAt: evidence.recordedAt,
  };
}

export function isTrialTruthEvidence(value: unknown): value is TrialTruthEvidence {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const adherence = record.adherence as Record<string, unknown> | undefined;
  const tolerance = record.tolerance as Record<string, unknown> | undefined;
  const patientAnchor = record.patientAnchor as Record<string, unknown> | undefined;
  return (
    typeof record.generationId === 'string' &&
    record.generationId.length > 0 &&
    typeof record.recordedAt === 'string' &&
    Boolean(adherence) &&
    adherenceStatuses.has(adherence?.status as AdherenceEvidence['status']) &&
    Boolean(tolerance) &&
    tolerance?.collectionStatus === 'collected' &&
    toleranceSeverities.has(tolerance?.severity as TrialTruthToleranceAnswer) &&
    Array.isArray(tolerance?.symptoms) &&
    tolerance.symptoms.every((item) => irritationSignalSet.has(item as IrritationSignal)) &&
    Boolean(patientAnchor) &&
    [-2, -1, 0, 1, 2].includes(Number(patientAnchor?.visibleChange)) &&
    typeof patientAnchor?.recordedAt === 'string'
  );
}

export function anchorRelationshipFor(
  effect: EffectClassification | null,
  patientAnchor: PatientAnchor | null,
): AnchorRelationship {
  if (!patientAnchor) return 'not_collected';
  if (patientAnchor.visibleChange === 0) return 'neutral';
  const objectiveDirection =
    effect === 'worsened'
      ? -1
      : effect === 'no_detectable_change' || effect === null
        ? 0
        : 1;
  if (objectiveDirection === 0) return 'contradicted';
  return Math.sign(patientAnchor.visibleChange) === objectiveDirection ? 'agreed' : 'contradicted';
}

export function trialTruthEvidenceFromSnapshot(
  snapshot: RednessEvaluationSnapshot,
  generationId: string,
): TrialTruthEvidence | null {
  if (
    !snapshot.patientAnchor ||
    !snapshot.tolerance ||
    snapshot.adherence.status === 'unknown'
  ) {
    return null;
  }
  return {
    generationId,
    adherence: { ...snapshot.adherence },
    tolerance: {
      ...snapshot.tolerance,
      symptoms: [...snapshot.tolerance.symptoms],
      collectionStatus: 'collected',
    },
    patientAnchor: { ...snapshot.patientAnchor },
    recordedAt: snapshot.patientAnchor.recordedAt,
  };
}
