import { describe, expect, it } from 'vitest';
import { applyTrialTruthToRednessEvaluation } from '../adapters/analysis/youcam/trialTruthEvidenceAdapter';
import {
  clearImprovementFixture,
  evaluateRedness,
  invalidCaptureFixture,
  productOverlapFixture,
  type AdherenceEvidence,
  type IrritationSignal,
  type RednessEvaluationInput,
  type RednessEvaluationSnapshot,
  type ToleranceEvidence,
} from '../domain/evidence/redness';
import type { TrialTruthEvidence } from '../domain/trialTruth';

const RECORDED_AT = '2026-08-01T19:30:00.000Z';

const clone = <T>(value: T): T => structuredClone(value);

function withoutTrialTruth(input: RednessEvaluationInput): RednessEvaluationSnapshot {
  const fixedScan = clone(input);
  fixedScan.patientAnchor = null;
  fixedScan.tolerance = null;
  fixedScan.adherence = { status: 'unknown' };
  return evaluateRedness(fixedScan);
}

function evidence(
  input: {
    adherence?: AdherenceEvidence['status'];
    severity?: ToleranceEvidence['severity'];
    symptoms?: IrritationSignal[];
    visibleChange?: -1 | 0 | 1;
  } = {},
): TrialTruthEvidence {
  return {
    generationId: 'fixed-scan:generation',
    adherence: { status: input.adherence ?? 'complete' },
    tolerance: {
      collectionStatus: 'collected',
      severity: input.severity ?? 'none',
      symptoms: [...(input.symptoms ?? [])],
    },
    patientAnchor: {
      visibleChange: input.visibleChange ?? 1,
      recordedAt: RECORDED_AT,
    },
    recordedAt: RECORDED_AT,
  };
}

const objectiveFields = (snapshot: RednessEvaluationSnapshot) => ({
  baselineRawMedian: snapshot.baselineRawMedian,
  endpointRawMedian: snapshot.endpointRawMedian,
  rawScoreDelta: snapshot.rawScoreDelta,
  threshold: snapshot.threshold,
  effectClassification: snapshot.effectClassification,
});

describe('trial truth application to one fixed favorable scan', () => {
  const fixedObjectiveScan = withoutTrialTruth(clearImprovementFixture);

  it.each([
    ['complete', 'strong'],
    ['partial', 'moderate'],
    ['poor', 'weak'],
  ] as const)('maps %s adherence to %s attribution', (adherence, attribution) => {
    const result = applyTrialTruthToRednessEvaluation(fixedObjectiveScan, evidence({ adherence }));
    expect(result.attributionQuality).toBe(attribution);
    if (adherence === 'poor') {
      expect(result.interpretation.recommendedAction).not.toBe('keep');
    }
  });

  it('keeps active product overlap blocked and selects retry alone', () => {
    const blockedScan = withoutTrialTruth(productOverlapFixture);
    const result = applyTrialTruthToRednessEvaluation(blockedScan, evidence());

    expect(result.attributionQuality).toBe('blocked');
    expect(result.interpretation.recommendedAction).toBe('retry_alone');
    expect(objectiveFields(result)).toEqual(objectiveFields(blockedScan));
  });

  it('always interrupts for severe reported tolerance', () => {
    const result = applyTrialTruthToRednessEvaluation(
      fixedObjectiveScan,
      evidence({ severity: 'severe', symptoms: [] }),
    );
    expect(result.safetyStatus).toBe('interrupted');
    expect(result.interpretation.recommendedAction).toBe('safety_interruption');
  });

  it.each(['swelling', 'blistering', 'eye_involvement', 'rapid_escalation'] as const)(
    'interrupts for serious symptom %s',
    (symptom) => {
      const result = applyTrialTruthToRednessEvaluation(
        fixedObjectiveScan,
        evidence({ severity: 'mild', symptoms: [symptom] }),
      );
      expect(result.safetyStatus).toBe('interrupted');
      expect(result.interpretation.recommendedAction).toBe('safety_interruption');
    },
  );

  it.each(['moderate', 'severe'] as const)('interrupts for %s burning', (severity) => {
    const result = applyTrialTruthToRednessEvaluation(
      fixedObjectiveScan,
      evidence({ severity, symptoms: ['burning'] }),
    );
    expect(result.safetyStatus).toBe('interrupted');
    expect(result.interpretation.recommendedAction).toBe('safety_interruption');
  });

  it('does not automatically interrupt ordinary mild symptoms', () => {
    const result = applyTrialTruthToRednessEvaluation(
      fixedObjectiveScan,
      evidence({
        severity: 'mild',
        symptoms: ['burning', 'stinging', 'itching', 'heat', 'peeling', 'unusual_sensitivity'],
      }),
    );
    expect(result.safetyStatus).toBe('clear');
    expect(result.interpretation.recommendedAction).not.toBe('safety_interruption');
  });

  it.each([
    ['less', 1, true],
    ['same', 0, false],
    ['more', -1, false],
  ] as const)('preserves %s participant anchoring', (_label, visibleChange, corroborates) => {
    const result = applyTrialTruthToRednessEvaluation(
      fixedObjectiveScan,
      evidence({ visibleChange }),
    );

    expect(result.patientAnchor?.visibleChange).toBe(visibleChange);
    expect(result.corroboratingSignals.includes('patient_anchor')).toBe(corroborates);
    expect(result.effectClassification).toBe(fixedObjectiveScan.effectClassification);
    if (visibleChange < 0) {
      expect(result.interpretation.limitations.join(' ')).toMatch(/contradicted improvement/i);
    }
  });

  it.each([
    ['invalid measurement', invalidCaptureFixture, 'invalid', 'test_longer'],
    ['blocked attribution', productOverlapFixture, 'adequate', 'retry_alone'],
  ] as const)(
    'does not let a favorable anchor rescue %s',
    (_label, fixture, measurement, action) => {
      const fixedScan = withoutTrialTruth(fixture);
      const result = applyTrialTruthToRednessEvaluation(fixedScan, evidence({ visibleChange: 1 }));

      expect(result.measurementQuality).toBe(measurement);
      expect(result.interpretation.recommendedAction).toBe(action);
      expect(objectiveFields(result)).toEqual(objectiveFields(fixedScan));
    },
  );

  const combinations = (['complete', 'partial', 'poor'] as const).flatMap((adherence) =>
    (['none', 'mild', 'moderate', 'severe'] as const).flatMap((severity) =>
      ([1, 0, -1] as const).map((visibleChange) => ({
        adherence,
        severity,
        visibleChange,
        symptoms:
          severity === 'moderate'
            ? (['itching'] as IrritationSignal[])
            : severity === 'severe'
              ? (['unusual_sensitivity'] as IrritationSignal[])
              : ([] as IrritationSignal[]),
      })),
    ),
  );

  it.each(combinations)(
    'keeps objective fields invariant for $adherence / $severity / $visibleChange',
    (answers) => {
      const result = applyTrialTruthToRednessEvaluation(fixedObjectiveScan, evidence(answers));
      expect(objectiveFields(result)).toEqual(objectiveFields(fixedObjectiveScan));
    },
  );
});
