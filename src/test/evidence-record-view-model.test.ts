import { describe, expect, it } from 'vitest';
import {
  canonicalRednessFixtures,
  evaluateRedness,
  type RednessEvaluationSnapshot,
} from '../domain/evidence/redness';
import type { EvidenceRecordData } from '../domain/model';
import {
  evidenceRecordViewModelFromRecord,
  type EvidenceRecordViewModel,
} from '../features/evidence-record/evidenceRecordViewModel';

const baseRecord = (
  evaluation?: RednessEvaluationSnapshot,
  overrides: Partial<EvidenceRecordData> = {},
): EvidenceRecordData => ({
  id: 'ER-EVIDENCE-RECORD',
  specimenId: evaluation?.productId ?? 'legacy-product',
  accession: 'FV–035',
  product: 'One Thing',
  productBrand: 'Lab Dojo',
  job: 'Reduce visible redness',
  observationWindow: '2026-01-01T12:00:00.000Z to 2026-02-05T12:00:00.000Z',
  comparison: 'comparable',
  finding: evaluation?.interpretation.finding ?? 'Legacy saved finding.',
  nonFinding: evaluation?.interpretation.nonFinding ?? 'Legacy saved limitation.',
  confidence: evaluation?.evidenceQuality ?? 'possible',
  disturbance: evaluation?.secondProductStatus === 'active_overlap' ? 'overlap_retained' : 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary: evaluation?.interpretation.claimBoundary.join(' ') ?? 'Legacy claim boundary.',
  createdAt: evaluation?.evaluatedAt ?? '2026-02-05T12:00:00.000Z',
  includesFaceImage: false,
  rednessEvaluation: evaluation,
  ...overrides,
});

const viewModelFor = (key: keyof typeof canonicalRednessFixtures): EvidenceRecordViewModel => {
  const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures[key]));
  return evidenceRecordViewModelFromRecord(baseRecord(evaluation));
};

const fullRow = (viewModel: EvidenceRecordViewModel, id: string) =>
  viewModel.full?.sections.flatMap((section) => section.rows).find((row) => row.id === id);

describe('EvidenceRecordViewModel', () => {
  it('presents a strong favorable snapshot without recalculating its saved measurements', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.A));
    const savedDelta = evaluation.rawScoreDelta;
    const viewModel = evidenceRecordViewModelFromRecord(baseRecord(evaluation));

    expect(viewModel).toMatchObject({
      canonical: true,
      folio: 'FV–035',
      product: 'Lab Dojo · One Thing',
      headline: evaluation.interpretation.finding,
      evidenceStatus: 'Growing evidence',
      nextStep: {
        canonicalAction: 'keep',
        statusLabel: 'KEEP USING IT',
        title: 'Keep using it',
      },
      comparison: {
        baseline: '60',
        followUp: '72',
        change: '+12 points',
        interval: '35 days',
        tone: 'favorable',
      },
    });
    expect(savedDelta).toBe(12);
    expect(viewModel.comparison?.accessibleSummary).toContain(
      'changed from 60 at baseline to 72 at follow-up',
    );
    expect(viewModel.atAGlance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'scan-match', value: 'Good', canonicalValue: 'adequate' }),
        expect.objectContaining({
          id: 'evidence-so-far',
          value: 'Growing evidence',
          canonicalValue: 'likely',
        }),
        expect.objectContaining({ id: 'skin-response', value: 'No concerns noted' }),
      ]),
    );
    expect(viewModel.full?.technicalNote).toBe(
      'Production thresholds require repeat-scan calibration.',
    );
    expect(fullRow(viewModel, 'threshold-description')?.value).toBe(
      'Detectable 5 · strong 10 points',
    );
    expect(fullRow(viewModel, 'baseline-measurements')?.value).toBe('59 · 60 · 61');
    expect(fullRow(viewModel, 'follow-up-measurements')?.value).toBe('71 · 72 · 73');
    expect(fullRow(viewModel, 'baseline-rejections')?.value).toBe('None');
    expect(fullRow(viewModel, 'follow-up-rejections')?.value).toBe('None');
    expect(fullRow(viewModel, 'direction-agreement')).toMatchObject({
      value: 'Agreeing · 3 follow-up measurements',
      canonicalValue: 'agreeing',
    });
    expect(fullRow(viewModel, 'configuration-hash')).toBeUndefined();
    expect(viewModel.full?.technicalMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'configuration-hash',
          value: evaluation.threshold.configHash,
        }),
      ]),
    );
  });

  it('uses the immutable saved raw-score delta instead of subtracting scores again', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.A));
    const inconsistentSavedSnapshot = {
      ...evaluation,
      rawScoreDelta: 4.25,
    } satisfies RednessEvaluationSnapshot;

    const viewModel = evidenceRecordViewModelFromRecord(baseRecord(inconsistentSavedSnapshot));

    expect(viewModel.comparison).toMatchObject({
      baseline: '60',
      followUp: '72',
      change: '+4.25 points',
    });
    expect(viewModel.headline).toBe(evaluation.interpretation.finding);
  });

  it.each([
    ['C', 'test_longer', 'Early evidence', '+7 points', 'favorable'],
    ['B', 'not_proving_job', 'Growing evidence', '+2 points', 'neutral'],
    ['D', 'retry_alone', 'Early evidence', '+11 points', 'favorable'],
    ['E', 'not_proving_job', 'Growing evidence', '-7 points', 'unfavorable'],
    ['F', 'safety_interruption', 'Growing evidence', '-8 points', 'unfavorable'],
    ['G', 'test_longer', 'Not enough evidence', '+15 points', 'unavailable'],
  ] as const)(
    'maps canonical fixture %s into human presentation without changing its action',
    (key, action, evidence, change, tone) => {
      const viewModel = viewModelFor(key);
      expect(viewModel.nextStep.canonicalAction).toBe(action);
      expect(viewModel.evidenceStatus).toBe(evidence);
      expect(viewModel.comparison?.change).toBe(change);
      expect(viewModel.comparison?.tone).toBe(tone);
    },
  );

  it('keeps attribution, invalid measurement, worsening, and safety states distinct', () => {
    expect(viewModelFor('D').atAGlance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'trial-changes',
          value: 'Another change interfered',
          canonicalValue: 'blocked',
        }),
      ]),
    );
    expect(viewModelFor('G').atAGlance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'scan-match',
          value: 'Not usable',
          canonicalValue: 'invalid',
        }),
      ]),
    );
    expect(viewModelFor('E').atAGlance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skin-response',
          value: 'Review recommended',
          canonicalValue: 'check_required',
        }),
      ]),
    );
    expect(viewModelFor('F').nextStep).toMatchObject({
      canonicalAction: 'safety_interruption',
      title: 'Safety interruption',
      tone: 'safety',
    });
  });

  it('shows unavailable optional evidence and a missing model version honestly', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.C));
    const missingModelSnapshot = {
      ...evaluation,
      versions: {
        ...evaluation.versions,
        analysisModelVersion: 'youcam-hd-redness-model-version-not-reported',
      },
    } satisfies RednessEvaluationSnapshot;
    const viewModel = evidenceRecordViewModelFromRecord(baseRecord(missingModelSnapshot));

    expect(fullRow(viewModel, 'analysis-model')).toMatchObject({
      value: 'Not reported',
      canonicalValue: 'youcam-hd-redness-model-version-not-reported',
    });
    expect(fullRow(viewModel, 'missing-evidence')?.value).toContain('was not collected');
    expect(viewModel.why?.limitation).toContain('supporting evidence was not collected');
  });

  it('preserves a long product identity without shortening the record data', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.A));
    const product =
      'Barrier Support Serum With A Deliberately Long Product Name And Strength Descriptor';
    const viewModel = evidenceRecordViewModelFromRecord(
      baseRecord(evaluation, { product, productBrand: 'Example Laboratory' }),
    );
    expect(viewModel.product).toBe(`Example Laboratory · ${product}`);
  });

  it('renders a legacy record without inventing a comparison or richer evidence', () => {
    const record = baseRecord(undefined, { note: 'Saved before detailed scans were stored.' });
    const viewModel = evidenceRecordViewModelFromRecord(record);

    expect(viewModel).toMatchObject({
      canonical: false,
      headline: 'Legacy saved finding.',
      interpretation: 'Legacy saved limitation.',
      legacyMessage: 'Detailed measurements are not available for this earlier result.',
      legacyNote: 'Saved before detailed scans were stored.',
      nextStep: {
        statusLabel: 'TEST LONGER',
        title: 'Test longer',
      },
    });
    expect(viewModel.comparison).toBeUndefined();
    expect(viewModel.why).toBeUndefined();
    expect(viewModel.full).toBeUndefined();
  });
});
