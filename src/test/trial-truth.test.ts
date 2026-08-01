import { describe, expect, it } from 'vitest';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import {
  faceValueReducer,
  trialTruthGenerationFor,
  type TrialTruthFaceValueState,
} from '../app/trialTruthMachine';
import {
  adherenceEvidenceForAnswer,
  commitTrialTruth,
  emptyTrialTruthDraft,
  visibleChangeForAnswer,
} from '../domain/trialTruth';

const completedDraft = () => ({
  adherence: 'yes' as const,
  tolerance: 'none' as const,
  symptoms: [],
  visibleChange: 'less' as const,
});

function trialTruthState(): TrialTruthFaceValueState {
  return buildDemoFixtureState('trial_truth', 'clear_favorable_change');
}

function commitComplete(state = trialTruthState()) {
  const generationId = trialTruthGenerationFor(state);
  if (!generationId) throw new Error('Missing fixture generation');
  let next = faceValueReducer(state, {
    type: 'TRIAL_TRUTH_ADHERENCE_SELECTED',
    answer: 'yes',
  });
  next = faceValueReducer(next, {
    type: 'TRIAL_TRUTH_TOLERANCE_SELECTED',
    answer: 'none',
  });
  next = faceValueReducer(next, {
    type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED',
    answer: 'less',
  });
  return faceValueReducer(next, {
    type: 'TRIAL_TRUTH_SUBMITTED',
    generationId,
    now: '2026-08-01T19:30:00.000Z',
  });
}

describe('trial truth mappings', () => {
  it('maps adherence and visible-change answers exactly', () => {
    expect(adherenceEvidenceForAnswer('yes').status).toBe('complete');
    expect(adherenceEvidenceForAnswer('mostly').status).toBe('partial');
    expect(adherenceEvidenceForAnswer('no').status).toBe('poor');
    expect(visibleChangeForAnswer('less')).toBe(1);
    expect(visibleChangeForAnswer('same')).toBe(0);
    expect(visibleChangeForAnswer('more')).toBe(-1);
  });

  it('uses the injected timestamp and clears symptoms for none', () => {
    const evidence = commitTrialTruth({
      draft: completedDraft(),
      generationId: 'trial:generation',
      recordedAt: '2026-08-01T19:30:00.000Z',
    });
    expect(evidence?.recordedAt).toBe('2026-08-01T19:30:00.000Z');
    expect(evidence?.patientAnchor.recordedAt).toBe('2026-08-01T19:30:00.000Z');
    expect(evidence?.tolerance).toMatchObject({ severity: 'none', symptoms: [] });
  });
});

describe('trial truth reducer gate', () => {
  it('does not commit a partial form or create a comparison before commit', () => {
    const state = trialTruthState();
    const generationId = trialTruthGenerationFor(state)!;
    const invalid = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_SUBMITTED',
      generationId,
      now: '2026-08-01T19:30:00.000Z',
    });
    expect(invalid.trialTruthEvidence).toBeNull();
    expect(invalid.trialTruthValidation?.valid).toBe(false);
    expect(faceValueReducer(invalid, { type: 'COMPARISON_CREATED' }).analysis).toBeNull();
  });

  it('commits once, rejects stale submits, and preserves the injected evidence', () => {
    const committed = commitComplete();
    expect(committed.trialTruthEvidence?.adherence.status).toBe('complete');
    const duplicate = faceValueReducer(committed, {
      type: 'TRIAL_TRUTH_SUBMITTED',
      generationId: committed.trialTruthEvidence!.generationId,
      now: '2026-08-02T00:00:00.000Z',
    });
    expect(duplicate.trialTruthEvidence?.recordedAt).toBe('2026-08-01T19:30:00.000Z');
    const stale = faceValueReducer(committed, {
      type: 'TRIAL_TRUTH_SUBMITTED',
      generationId: 'stale:generation',
      now: '2026-08-02T00:00:00.000Z',
    });
    expect(stale).toEqual(committed);
  });

  it('preserves the follow-up burst when backing out before commit', () => {
    const state = trialTruthState();
    const backed = faceValueReducer(state, { type: 'TRIAL_TRUTH_BACK' });
    expect(backed.stage).toBe('followup_ready');
    expect(backed.longitudinalEvidence.followUp).toEqual(state.longitudinalEvidence.followUp);
    const reentered = faceValueReducer(backed, {
      type: 'BEGIN_CAPTURE',
      kind: 'followup',
      now: '2026-08-01T19:30:00.000Z',
    });
    expect(reentered.stage).toBe('followup_context');
    expect(reentered.longitudinalEvidence.followUp).toEqual(state.longitudinalEvidence.followUp);
  });

  it('feeds committed evidence into the canonical evaluator without changing objective effect', () => {
    const committed = commitComplete();
    const withContext = faceValueReducer(committed, {
      type: 'CAPTURE_CONTEXT_RECORDED',
      kind: 'followup',
      context: {
        makeup: false,
        recentHeatOrExercise: false,
        recentCleansingOrSkincare: false,
        routineOrTreatmentChange: false,
        note: null,
      },
    });
    const compared = faceValueReducer(withContext, { type: 'COMPARISON_CREATED' });
    expect(compared.longitudinalEvidence.evaluation?.effectClassification).toBe(
      'strong_improvement',
    );
    expect(compared.longitudinalEvidence.evaluation?.adherence.status).toBe('complete');
    expect(compared.longitudinalEvidence.evaluation?.tolerance?.severity).toBe('none');
    expect(compared.longitudinalEvidence.evaluation?.patientAnchor?.visibleChange).toBe(1);
  });

  it('keeps a contradictory participant anchor from reversing objective effect', () => {
    let state = trialTruthState();
    const generationId = trialTruthGenerationFor(state)!;
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_ADHERENCE_SELECTED',
      answer: 'yes',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_TOLERANCE_SELECTED',
      answer: 'none',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED',
      answer: 'more',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_SUBMITTED',
      generationId,
      now: '2026-08-01T19:30:00.000Z',
    });
    state = faceValueReducer(state, {
      type: 'CAPTURE_CONTEXT_RECORDED',
      kind: 'followup',
      context: {
        makeup: false,
        recentHeatOrExercise: false,
        recentCleansingOrSkincare: false,
        routineOrTreatmentChange: false,
        note: null,
      },
    });
    const compared = faceValueReducer(state, { type: 'COMPARISON_CREATED' });
    expect(compared.longitudinalEvidence.evaluation?.effectClassification).toBe(
      'strong_improvement',
    );
    expect(compared.longitudinalEvidence.evaluation?.patientAnchor?.visibleChange).toBe(-1);
    expect(compared.longitudinalEvidence.evaluation?.corroboratingSignals).not.toContain(
      'patient_anchor',
    );
  });

  it('routes severe reported symptoms through existing safety precedence', () => {
    let state = trialTruthState();
    const generationId = trialTruthGenerationFor(state)!;
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_ADHERENCE_SELECTED',
      answer: 'yes',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_TOLERANCE_SELECTED',
      answer: 'severe',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_SYMPTOM_TOGGLED',
      symptom: 'swelling',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED',
      answer: 'less',
    });
    state = faceValueReducer(state, {
      type: 'TRIAL_TRUTH_SUBMITTED',
      generationId,
      now: '2026-08-01T19:30:00.000Z',
    });
    state = faceValueReducer(state, {
      type: 'CAPTURE_CONTEXT_RECORDED',
      kind: 'followup',
      context: {
        makeup: false,
        recentHeatOrExercise: false,
        recentCleansingOrSkincare: false,
        routineOrTreatmentChange: false,
        note: null,
      },
    });
    const compared = faceValueReducer(state, { type: 'COMPARISON_CREATED' });
    expect(compared.longitudinalEvidence.evaluation?.safetyStatus).toBe('interrupted');
    expect(compared.longitudinalEvidence.evaluation?.interpretation.recommendedAction).toBe(
      'safety_interruption',
    );
  });

  it('starts with an empty reducer-owned draft', () => {
    expect(trialTruthState().trialTruthDraft).toEqual(emptyTrialTruthDraft());
  });
});
