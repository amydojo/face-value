import { describe, expect, it } from 'vitest';
import {
  canonicalRednessFixtures,
  cleanNullFixture,
  clearImprovementFixture,
  invalidCaptureFixture,
  objectiveWorseningFixture,
  productOverlapFixture,
  tooEarlyFixture,
  worseningWithSymptomsFixture,
} from './fixtures';
import { evaluateRedness } from './evaluateRedness';
import { PROVISIONAL_REDNESS_THRESHOLDS, classifyProvisionalEffect } from './thresholds';
import type { RednessEvaluationInput } from './types';
import { isRednessEvaluationSnapshot } from './types';

const clone = <T>(value: T): T => structuredClone(value);

describe('canonical redness acceptance fixtures', () => {
  it.each([
    ['A', 'strong_improvement', 'adequate', 'strong', 'likely', 'clear', 'keep'],
    ['B', 'no_detectable_change', 'strong', 'strong', 'likely', 'clear', 'not_proving_job'],
    ['C', 'directional_improvement', 'adequate', 'strong', 'possible', 'clear', 'test_longer'],
    ['D', 'strong_improvement', 'adequate', 'blocked', 'possible', 'clear', 'retry_alone'],
    ['E', 'worsened', 'adequate', 'strong', 'likely', 'check_required', 'not_proving_job'],
    ['F', 'worsened', 'adequate', 'strong', 'likely', 'interrupted', 'safety_interruption'],
    ['G', 'strong_improvement', 'invalid', 'strong', 'insufficient', 'clear', 'test_longer'],
  ] as const)(
    'fixture %s resolves deterministic dimensions',
    (fixtureKey, effect, measurement, attribution, evidence, safety, action) => {
      const result = evaluateRedness(canonicalRednessFixtures[fixtureKey]);
      expect(result).toMatchObject({
        effectClassification: effect,
        measurementQuality: measurement,
        attributionQuality: attribution,
        evidenceQuality: evidence,
        safetyStatus: safety,
        interpretation: { recommendedAction: action },
      });
    },
  );
});

describe('redness primary-signal and precedence invariants', () => {
  it('rejects ui_score instead of accepting it into redness evidence', () => {
    const input = {
      ...clone(clearImprovementFixture),
      ui_score: 100,
    } as RednessEvaluationInput;
    const result = evaluateRedness(input);

    expect(result.measurementQuality).toBe('invalid');
    expect(result.triggeredRuleIds).toContain('R01_UI_SCORE_REJECTED');
    expect(result.interpretation.recommendedAction).toBe('test_longer');
    expect(result).not.toHaveProperty('ui_score');
    expect(result).not.toHaveProperty('uiScore');
  });

  it('uses endpoint minus baseline raw_score direction', () => {
    expect(evaluateRedness(clearImprovementFixture).rawScoreDelta).toBe(12);
    expect(evaluateRedness(clearImprovementFixture).effectClassification).toBe(
      'strong_improvement',
    );
    expect(evaluateRedness(objectiveWorseningFixture).rawScoreDelta).toBe(-7);
    expect(evaluateRedness(objectiveWorseningFixture).effectClassification).toBe('worsened');
  });

  it('keeps a clean null result distinct from unreadable evidence', () => {
    const cleanNull = evaluateRedness(cleanNullFixture);
    const unreadable = evaluateRedness(invalidCaptureFixture);

    expect(cleanNull.effectClassification).toBe('no_detectable_change');
    expect(cleanNull.measurementQuality).toBe('strong');
    expect(cleanNull.evidenceQuality).toBe('likely');
    expect(unreadable.measurementQuality).toBe('invalid');
    expect(unreadable.evidenceQuality).toBe('insufficient');
  });

  it('does not let favorable movement override invalid capture', () => {
    const result = evaluateRedness(invalidCaptureFixture);
    expect(result.rawScoreDelta).toBe(15);
    expect(result.measurementQuality).toBe('invalid');
    expect(result.interpretation.recommendedAction).toBe('test_longer');
    expect(result.interpretation.explanation).toMatch(/not comparable enough/i);
  });

  it('does not let favorable movement override active product overlap', () => {
    const result = evaluateRedness(productOverlapFixture);
    expect(result.rawScoreDelta).toBe(11);
    expect(result.attributionQuality).toBe('blocked');
    expect(result.interpretation.recommendedAction).toBe('retry_alone');
  });

  it('never emits not_proving_job before the predeclared minimum window', () => {
    const result = evaluateRedness(tooEarlyFixture);
    expect(result.observationWindowStatus).toBe('too_early');
    expect(result.interpretation.recommendedAction).toBe('test_longer');
    expect(result.interpretation.recommendedAction).not.toBe('not_proving_job');
  });

  it('lets severe symptoms override normal product actions', () => {
    const favorableWithSymptoms = clone(clearImprovementFixture);
    favorableWithSymptoms.tolerance = clone(worseningWithSymptomsFixture.tolerance);
    const result = evaluateRedness(favorableWithSymptoms);

    expect(result.effectClassification).toBe('strong_improvement');
    expect(result.safetyStatus).toBe('interrupted');
    expect(result.interpretation.recommendedAction).toBe('safety_interruption');
    expect(result.interpretation.finding).toBe('Reported symptoms interrupted this trial.');
    expect(result.interpretation.nonFinding).toMatch(/No favorable product conclusion/i);
  });

  it('keeps objective worsening separate from safety interruption', () => {
    const result = evaluateRedness(objectiveWorseningFixture);
    expect(result.effectClassification).toBe('worsened');
    expect(result.safetyStatus).toBe('check_required');
    expect(result.interpretation.recommendedAction).toBe('not_proving_job');
  });

  it('invalidates incompatible API or model versions', () => {
    const input = clone(clearImprovementFixture);
    input.endpoint.sessions[0].versions.analysisModelVersion = 'youcam-hd-redness-fixture-v2';
    const result = evaluateRedness(input);

    expect(result.measurementQuality).toBe('invalid');
    expect(result.interpretation.recommendedAction).toBe('test_longer');
    expect(result.reasons.join(' ')).toMatch(/analysisModelVersion/);
  });

  it('does not let masks independently declare product success', () => {
    const input = clone(cleanNullFixture);
    input.maskEvidence = {
      baselineAreaPct: 20,
      endpointAreaPct: 4,
      areaDelta: -16,
      segmentationStable: true,
    };
    const result = evaluateRedness(input);

    expect(result.corroboratingSignals).toContain('mask');
    expect(result.effectClassification).toBe('no_detectable_change');
    expect(result.interpretation.recommendedAction).toBe('not_proving_job');
  });

  it('does not let unrelated YouCam signals rescue failed redness evidence', () => {
    const input = clone(cleanNullFixture);
    input.contextSignals = {
      hdAcneRawDelta: 30,
      hdTextureRawDelta: 30,
      hdMoistureRawDelta: 30,
    };
    const result = evaluateRedness(input);

    expect(result.effectClassification).toBe('no_detectable_change');
    expect(result.interpretation.recommendedAction).toBe('not_proving_job');
  });

  it('versions provisional thresholds and exposes the calibration limitation', () => {
    const result = evaluateRedness(clearImprovementFixture);
    expect(isRednessEvaluationSnapshot(result)).toBe(true);
    expect(result.threshold).toEqual({
      ...PROVISIONAL_REDNESS_THRESHOLDS,
      evidenceStrengthRatio: 2.4,
    });
    expect(result.interpretation.limitations).toContain(
      'Production thresholds require repeat-scan calibration.',
    );
  });

  it('returns an explicit invalid state for an incomplete threshold configuration', () => {
    const input = clone(clearImprovementFixture);
    input.threshold = {
      version: 'incomplete-provisional-test-only',
      source: 'provisional_fixture',
      configHash: 'incomplete-provisional-test-only',
      provisional: true,
    };
    const result = evaluateRedness(input);

    expect(result.effectClassification).toBeNull();
    expect(result.measurementQuality).toBe('invalid');
    expect(result.evidenceQuality).toBe('insufficient');
    expect(result.interpretation.recommendedAction).toBe('test_longer');
    expect(result.reasons.join(' ')).toMatch(/threshold configuration/i);
    expect(isRednessEvaluationSnapshot(result)).toBe(true);
  });

  it('reports optional evidence as missing instead of fabricating it', () => {
    const result = evaluateRedness(tooEarlyFixture);
    expect(result.patientAnchor).toBeNull();
    expect(result.maskEvidence).toEqual({});
    expect(result.missingEvidence).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/patient-observed/i),
        expect.stringMatching(/mask and facial-registration/i),
        expect.stringMatching(/acne, texture, and moisture/i),
      ]),
    );
  });

  it('does not mutate an already-created snapshot when another configuration is evaluated', () => {
    const snapshot = evaluateRedness(clearImprovementFixture);
    const serialized = JSON.stringify(snapshot);
    const nextInput = clone(clearImprovementFixture);
    nextInput.threshold = {
      version: 'future-test-only',
      source: 'technical_calibration',
      activeN95: 20,
      configHash: 'future-test-only',
      provisional: false,
    };
    evaluateRedness(nextInput);

    expect(JSON.stringify(snapshot)).toBe(serialized);
    expect(snapshot.threshold.version).toBe('redness-provisional-v1');
  });
});

describe('provisional boundary behavior', () => {
  it.each([
    [-5, 'worsened'],
    [-4.999, 'no_detectable_change'],
    [4.999, 'no_detectable_change'],
    [5, 'directional_improvement'],
    [9.999, 'directional_improvement'],
    [10, 'strong_improvement'],
  ] as const)('classifies delta %s as %s', (delta, expected) => {
    expect(classifyProvisionalEffect(delta)).toBe(expected);
  });
});
