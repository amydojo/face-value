import { describe, expect, it } from 'vitest';
import {
  loadTrialTruthStructuredData,
  saveTrialTruthStructuredData,
} from '../adapters/persistence/trialTruthObservationStore';
import {
  faceValueReducer,
  trialTruthGenerationFor,
  type TrialTruthFaceValueState,
} from '../app/trialTruthMachine';
import { commitTrialTruth, type TrialTruthDraft } from '../domain/trialTruth';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const recordedAt = '2026-08-01T19:30:00.000Z';

function evidenceFor(draft: TrialTruthDraft) {
  return commitTrialTruth({
    draft,
    generationId: 'trial:generation',
    recordedAt,
  });
}

function committedState(): TrialTruthFaceValueState {
  let state = buildDemoFixtureState(
    'trial_truth',
    'clear_favorable_change',
  ) as TrialTruthFaceValueState;
  const generationId = trialTruthGenerationFor(state);
  if (!generationId) throw new Error('Missing trial-truth fixture generation.');

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
    answer: 'less',
  });
  return faceValueReducer(state, {
    type: 'TRIAL_TRUTH_SUBMITTED',
    generationId,
    now: recordedAt,
  });
}

function comparedState(): TrialTruthFaceValueState {
  const committed = committedState();
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
  return faceValueReducer(withContext, { type: 'COMPARISON_CREATED' });
}

describe('trial truth canonical mappings', () => {
  it.each([
    ['none', [], []],
    ['mild', [], []],
    ['moderate', ['burning'], ['burning']],
    ['severe', ['swelling'], ['swelling']],
  ] as const)(
    'maps %s tolerance without inventing symptom values',
    (severity, symptoms, expectedSymptoms) => {
      const evidence = evidenceFor({
        adherence: 'yes',
        tolerance: severity,
        symptoms: [...symptoms],
        visibleChange: 'less',
      });
      expect(evidence?.tolerance).toEqual({
        collectionStatus: 'collected',
        severity,
        symptoms: expectedSymptoms,
      });
    },
  );

  it('rejects moderate and severe responses without a canonical symptom', () => {
    for (const tolerance of ['moderate', 'severe'] as const) {
      expect(
        evidenceFor({
          adherence: 'yes',
          tolerance,
          symptoms: [],
          visibleChange: 'less',
        }),
      ).toBeNull();
    }
  });
});

describe('trial truth exactly-once lifecycle', () => {
  it('creates one deterministic comparison across duplicate dispatches', () => {
    const first = comparedState();
    const second = faceValueReducer(first, { type: 'COMPARISON_CREATED' });

    expect(first.longitudinalEvidence.comparison).not.toBeNull();
    expect(second.longitudinalEvidence.comparison).toEqual(first.longitudinalEvidence.comparison);
    expect(second.longitudinalEvidence.evaluation).toEqual(first.longitudinalEvidence.evaluation);
    expect(second.analysis).toEqual(first.analysis);
    expect(second.trialTruthEvidence).toEqual(first.trialTruthEvidence);
  });

  it('creates one immutable Evidence Record across duplicate collection events', () => {
    const finalized = buildDemoFixtureState(
      'evidence_recorded',
      'clear_favorable_change',
    ) as TrialTruthFaceValueState;
    const readyToCollect: TrialTruthFaceValueState = {
      ...finalized,
      stage: 'analysis',
      record: null,
      archive: [],
      oracleRevealState: 'dispensing',
      oracleEvidenceDispensed: true,
      oracleCollectionStarted: true,
    };

    const collected = faceValueReducer(readyToCollect, {
      type: 'EVIDENCE_COLLECTED',
    });
    const duplicate = faceValueReducer(collected, { type: 'EVIDENCE_COLLECTED' });

    expect(collected.oracleRevealState).toBe('collected');
    expect(collected.record).not.toBeNull();
    expect(collected.archive).toHaveLength(1);
    expect(collected.archive[0]?.id).toBe(collected.record?.id);
    expect(collected.record?.trialTruth).toEqual(collected.trialTruthEvidence);
    expect(duplicate.record).toEqual(collected.record);
    expect(duplicate.archive).toEqual(collected.archive);
  });

  it('keeps one byte-equivalent evaluation through result, placement, Oracle, Home, history, and record state', () => {
    let state = comparedState();
    const evaluation = state.longitudinalEvidence.evaluation;
    if (!evaluation || !state.analysis?.rednessEvaluation) {
      throw new Error('Expected one canonical compared evaluation.');
    }
    const serialized = JSON.stringify(evaluation);

    expect(JSON.stringify(state.analysis.rednessEvaluation)).toBe(serialized);
    expect(state.placement).toBe('paused');

    state = faceValueReducer(state, { type: 'REVEAL_STARTED' });
    state = faceValueReducer(state, { type: 'REVEAL_PULL_COMPLETED' });
    state = faceValueReducer(state, { type: 'TRANSMISSION_COMPLETED' });
    state = faceValueReducer(state, {
      type: 'RECOMMENDATION_ACCEPTED',
      placement: state.placement,
      now: recordedAt,
    });
    state = faceValueReducer(state, { type: 'DISPENSE_STARTED' });
    state = faceValueReducer(state, { type: 'EVIDENCE_DISPENSED' });
    state = faceValueReducer(state, { type: 'EVIDENCE_COLLECTION_STARTED' });
    state = faceValueReducer(state, { type: 'EVIDENCE_COLLECTED' });

    expect(JSON.stringify(state.longitudinalEvidence.evaluation)).toBe(serialized);
    expect(JSON.stringify(state.analysis?.rednessEvaluation)).toBe(serialized);
    expect(JSON.stringify(state.record?.rednessEvaluation)).toBe(serialized);
    expect(JSON.stringify(state.archive[0]?.rednessEvaluation)).toBe(serialized);
    expect(state.record?.finalPlacement).toBe(state.placement);

    const duplicate = faceValueReducer(state, { type: 'EVIDENCE_COLLECTED' });
    expect(duplicate.record).toEqual(state.record);
    expect(duplicate.archive).toEqual(state.archive);
  });
});

describe('trial truth persistence and legacy honesty', () => {
  it('hydrates committed evidence exactly and does not force re-entry', () => {
    const state = committedState();
    const storage = new MemoryStorage();
    saveTrialTruthStructuredData(state, storage);

    const hydrated = loadTrialTruthStructuredData(storage);
    expect(hydrated?.trialTruthEvidence).toEqual(state.trialTruthEvidence);
    expect(hydrated?.trialTruthEvidence?.recordedAt).toBe(recordedAt);
    expect(hydrated?.longitudinalEvidence.comparison).toBeNull();
  });

  it('hydrates a legacy saved record without fabricated trial truth defaults', () => {
    const legacy = buildDemoFixtureState('saved_result', 'legacy_trial_truth_not_collected');
    const storage = new MemoryStorage();
    saveTrialTruthStructuredData(legacy, storage);

    const hydrated = loadTrialTruthStructuredData(storage);
    expect(hydrated?.trialTruthEvidence).toBeNull();
    expect(hydrated?.record?.trialTruth).toBeUndefined();
    expect(hydrated?.record?.anchorRelationship).toBeUndefined();
    expect(hydrated?.record?.rednessEvaluation?.adherence.status).toBe('unknown');
    expect(hydrated?.record?.rednessEvaluation?.tolerance).toBeNull();
    expect(hydrated?.record?.rednessEvaluation?.patientAnchor).toBeNull();
  });
});
