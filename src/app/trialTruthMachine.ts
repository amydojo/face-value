import {
  analysisResultFromRednessEvaluation,
  placementForRednessAction,
  rednessComparisonFromEvaluation,
} from '../adapters/analysis/youcam/rednessEvidenceAdapter';
import { applyTrialTruthToRednessEvaluation } from '../adapters/analysis/youcam/trialTruthEvidenceAdapter';
import type { EvidenceRecordData } from '../domain/model';
import { hasFollowUpEvidence } from '../domain/rednessEvidenceBurst';
import {
  IRRITATION_SIGNALS,
  anchorRelationshipFor,
  cloneTrialTruthEvidence,
  commitTrialTruth,
  emptyTrialTruthDraft,
  validateTrialTruthDraft,
  type TrialTruthAdherenceAnswer,
  type TrialTruthDraft,
  type TrialTruthEvidence,
  type TrialTruthToleranceAnswer,
  type TrialTruthValidation,
  type TrialTruthVisibleChangeAnswer,
} from '../domain/trialTruth';
import {
  faceValueReducer as phaseBReducer,
  initialState as phaseBInitialState,
  normalizePhaseBState,
  type PhaseBFaceValueEvent,
  type PhaseBFaceValueState,
} from './phaseBMachine';

export type TrialTruthFaceValueState = PhaseBFaceValueState & {
  trialTruthDraft: TrialTruthDraft;
  trialTruthEvidence: TrialTruthEvidence | null;
  trialTruthValidation: TrialTruthValidation | null;
};

export type TrialTruthCompatibleState = PhaseBFaceValueState &
  Partial<
    Pick<
      TrialTruthFaceValueState,
      'trialTruthDraft' | 'trialTruthEvidence' | 'trialTruthValidation'
    >
  >;

export type TrialTruthFaceValueEvent =
  | PhaseBFaceValueEvent
  | { type: 'TRIAL_TRUTH_ADHERENCE_SELECTED'; answer: TrialTruthAdherenceAnswer }
  | { type: 'TRIAL_TRUTH_TOLERANCE_SELECTED'; answer: TrialTruthToleranceAnswer }
  | { type: 'TRIAL_TRUTH_SYMPTOM_TOGGLED'; symptom: (typeof IRRITATION_SIGNALS)[number] }
  | { type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED'; answer: TrialTruthVisibleChangeAnswer }
  | { type: 'TRIAL_TRUTH_SUBMITTED'; generationId: string; now: string }
  | { type: 'TRIAL_TRUTH_BACK' };

export type FaceValueEvent = TrialTruthFaceValueEvent;

export const initialState: TrialTruthFaceValueState = {
  ...phaseBInitialState,
  trialTruthDraft: emptyTrialTruthDraft(),
  trialTruthEvidence: null,
  trialTruthValidation: null,
};

export function normalizeTrialTruthState(
  state: TrialTruthCompatibleState,
): TrialTruthFaceValueState {
  return {
    ...normalizePhaseBState(state),
    trialTruthDraft: state.trialTruthDraft
      ? {
          ...state.trialTruthDraft,
          symptoms: [...state.trialTruthDraft.symptoms],
        }
      : emptyTrialTruthDraft(),
    trialTruthEvidence: state.trialTruthEvidence
      ? cloneTrialTruthEvidence(state.trialTruthEvidence)
      : null,
    trialTruthValidation: state.trialTruthValidation
      ? {
          ...state.trialTruthValidation,
          messages: [...state.trialTruthValidation.messages],
        }
      : null,
  };
}

export function trialTruthGenerationFor(state: PhaseBFaceValueState): string | null {
  const productId = state.registeredProduct?.id ?? state.selectedSpecimenId;
  if (state.longitudinalEvidence.followUpBurst) {
    return `${productId}:${state.longitudinalEvidence.followUpBurst.burstId}`;
  }
  if (state.longitudinalEvidence.followUp) {
    return `${productId}:${state.longitudinalEvidence.followUp.capturedAt}`;
  }
  if (state.followupCapture) return `${productId}:${state.followupCapture.id}`;
  return null;
}

export function trialTruthMatchesCurrentTrial(rawState: TrialTruthCompatibleState): boolean {
  const state = normalizeTrialTruthState(rawState);
  const generationId = trialTruthGenerationFor(state);
  return Boolean(
    generationId &&
    state.trialTruthEvidence &&
    state.trialTruthEvidence.generationId === generationId,
  );
}

export function trialTruthRequired(rawState: TrialTruthCompatibleState): boolean {
  const state = normalizeTrialTruthState(rawState);
  return Boolean(
    state.registeredProduct &&
    hasFollowUpEvidence(state.longitudinalEvidence) &&
    !state.analysis &&
    !state.longitudinalEvidence.comparison &&
    !trialTruthMatchesCurrentTrial(state),
  );
}

const canEditTrialTruth = (state: TrialTruthFaceValueState): boolean =>
  state.stage === 'followup_context' &&
  trialTruthRequired(state) &&
  trialTruthGenerationFor(state) !== null;

const clearTrialTruth = (state: PhaseBFaceValueState): TrialTruthFaceValueState => ({
  ...normalizeTrialTruthState(state),
  trialTruthDraft: emptyTrialTruthDraft(),
  trialTruthEvidence: null,
  trialTruthValidation: null,
});

function recordWithTrialTruth(
  record: EvidenceRecordData,
  state: TrialTruthFaceValueState,
): EvidenceRecordData {
  const evidence = state.trialTruthEvidence;
  const evaluation = record.rednessEvaluation;
  if (
    !evidence ||
    !evaluation ||
    state.longitudinalEvidence.evaluation?.trialId !== evaluation.trialId
  ) {
    return record;
  }
  return {
    ...record,
    trialTruth: cloneTrialTruthEvidence(evidence),
    anchorRelationship: anchorRelationshipFor(
      evaluation.effectClassification,
      evidence.patientAnchor,
    ),
  };
}

function preserveTrialTruth(
  previous: TrialTruthFaceValueState,
  next: PhaseBFaceValueState,
): TrialTruthFaceValueState {
  return normalizeTrialTruthState({
    ...next,
    trialTruthDraft: previous.trialTruthDraft,
    trialTruthEvidence: previous.trialTruthEvidence,
    trialTruthValidation: previous.trialTruthValidation,
  });
}

export function faceValueReducer(
  rawState: TrialTruthFaceValueState,
  event: TrialTruthFaceValueEvent,
): TrialTruthFaceValueState {
  const state = normalizeTrialTruthState(rawState);

  switch (event.type) {
    case 'TRIAL_TRUTH_ADHERENCE_SELECTED':
      if (!canEditTrialTruth(state)) return state;
      return {
        ...state,
        trialTruthDraft: { ...state.trialTruthDraft, adherence: event.answer },
        trialTruthValidation: null,
        announcement: 'Product use recorded.',
      };

    case 'TRIAL_TRUTH_TOLERANCE_SELECTED':
      if (!canEditTrialTruth(state)) return state;
      return {
        ...state,
        trialTruthDraft: {
          ...state.trialTruthDraft,
          tolerance: event.answer,
          symptoms: event.answer === 'none' ? [] : state.trialTruthDraft.symptoms,
        },
        trialTruthValidation: null,
        announcement: 'Skin response recorded.',
      };

    case 'TRIAL_TRUTH_SYMPTOM_TOGGLED': {
      if (
        !canEditTrialTruth(state) ||
        state.trialTruthDraft.tolerance === null ||
        state.trialTruthDraft.tolerance === 'none' ||
        !IRRITATION_SIGNALS.includes(event.symptom)
      ) {
        return state;
      }
      const selected = state.trialTruthDraft.symptoms.includes(event.symptom);
      return {
        ...state,
        trialTruthDraft: {
          ...state.trialTruthDraft,
          symptoms: selected
            ? state.trialTruthDraft.symptoms.filter((item) => item !== event.symptom)
            : [...state.trialTruthDraft.symptoms, event.symptom],
        },
        trialTruthValidation: null,
        announcement: selected ? 'Reported symptom removed.' : 'Reported symptom recorded.',
      };
    }

    case 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED':
      if (!canEditTrialTruth(state)) return state;
      return {
        ...state,
        trialTruthDraft: { ...state.trialTruthDraft, visibleChange: event.answer },
        trialTruthValidation: null,
        announcement: 'Participant observation recorded.',
      };

    case 'TRIAL_TRUTH_SUBMITTED': {
      const currentGeneration = trialTruthGenerationFor(state);
      if (!currentGeneration || event.generationId !== currentGeneration || !event.now)
        return state;
      if (trialTruthMatchesCurrentTrial(state)) return state;
      if (!canEditTrialTruth(state)) return state;
      const validation = validateTrialTruthDraft(state.trialTruthDraft);
      if (!validation.valid) {
        return {
          ...state,
          trialTruthValidation: validation,
          announcement: validation.messages.join(' '),
        };
      }
      const evidence = commitTrialTruth({
        draft: state.trialTruthDraft,
        generationId: currentGeneration,
        recordedAt: event.now,
      });
      if (!evidence) return state;
      return {
        ...state,
        trialTruthEvidence: evidence,
        trialTruthValidation: null,
        announcement: 'Trial truth committed. Optional capture context is next.',
      };
    }

    case 'TRIAL_TRUTH_BACK':
      if (!trialTruthRequired(state)) return state;
      return {
        ...state,
        stage: 'followup_ready',
        announcement: 'Follow-up evidence is preserved. Trial truth remains ready to complete.',
      };

    case 'BEGIN_CAPTURE':
      if (
        event.kind === 'followup' &&
        hasFollowUpEvidence(state.longitudinalEvidence) &&
        trialTruthRequired(state)
      ) {
        return {
          ...state,
          stage: 'followup_context',
          announcement: 'Follow-up secured. Complete trial truth before comparison.',
        };
      }
      break;

    case 'OPEN_REVIEW_DUE':
      if (hasFollowUpEvidence(state.longitudinalEvidence) && trialTruthRequired(state)) {
        return {
          ...state,
          stage: 'followup_context',
          announcement: 'Follow-up secured. Complete trial truth before comparison.',
        };
      }
      break;

    case 'CAPTURE_CONTEXT_RECORDED':
      if (event.kind === 'followup' && !trialTruthMatchesCurrentTrial(state)) return state;
      break;

    case 'COMPARISON_CREATED': {
      if (!trialTruthMatchesCurrentTrial(state)) return state;
      const baseNext = phaseBReducer(state, event);
      const snapshot = baseNext.longitudinalEvidence.evaluation;
      if (!snapshot || !state.trialTruthEvidence) return preserveTrialTruth(state, baseNext);
      const evaluation = applyTrialTruthToRednessEvaluation(snapshot, state.trialTruthEvidence);
      const comparison = rednessComparisonFromEvaluation(evaluation);
      const analysis = analysisResultFromRednessEvaluation(evaluation);
      return normalizeTrialTruthState({
        ...baseNext,
        analysis,
        comparison: analysis.comparison,
        confidence: analysis.confidence,
        placement: placementForRednessAction(evaluation.interpretation.recommendedAction),
        longitudinalEvidence: {
          ...baseNext.longitudinalEvidence,
          comparison,
          evaluation,
        },
        trialTruthDraft: state.trialTruthDraft,
        trialTruthEvidence: state.trialTruthEvidence,
        trialTruthValidation: null,
      });
    }
  }

  const baseNext = phaseBReducer(state, event as PhaseBFaceValueEvent);

  if (
    event.type === 'REGISTER_PRODUCT' ||
    event.type === 'RETAKE_FOLLOWUP' ||
    event.type === 'CLEAR_DEMO_DATA' ||
    event.type === 'DELETE_OBSERVATION' ||
    event.type === 'ORACLE_DONE'
  ) {
    return clearTrialTruth(baseNext);
  }

  const nextGeneration = trialTruthGenerationFor(baseNext);
  const previousGeneration = trialTruthGenerationFor(state);
  if (
    nextGeneration &&
    nextGeneration !== previousGeneration &&
    (event.type === 'REDNESS_BURST_COMMIT_REQUESTED' || event.type === 'FOLLOWUP_ANALYSIS_ACCEPTED')
  ) {
    return clearTrialTruth(baseNext);
  }

  let next = preserveTrialTruth(state, baseNext);
  if (
    (event.type === 'EVIDENCE_COLLECTED' ||
      event.type === 'SAVE_RESULT' ||
      event.type === 'GENERATE_RECORD') &&
    next.record
  ) {
    const record = recordWithTrialTruth(next.record, next);
    next = {
      ...next,
      record,
      archive: next.archive.map((item) => (item.id === record.id ? record : item)),
    };
  }
  return next;
}
