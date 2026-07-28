import { describe, expect, it } from 'vitest';
import { clearImprovementFixture, evaluateRedness } from '../domain/evidence/redness';
import type { EvidenceRecordData } from '../domain/model';
import {
  evidenceDetailViewModelFromRecord,
  verdictProduct,
  verdictViewModelFromRecord,
} from '../features/verdict/verdictViewModel';

const record: EvidenceRecordData = {
  id: 'ER-202607151230',
  specimenId: 'registered-product-20260701120000000',
  accession: 'FV–014',
  product: 'Azelaic Topical Acid',
  productBrand: 'Naturium',
  job: 'Reduce visible redness',
  observationWindow: '2026-07-01T12:00:00.000Z to 2026-07-15T12:00:00.000Z',
  comparison: 'comparable',
  finding: 'A small favorable shift showed up.',
  nonFinding: 'Visible redness moved in the intended direction.',
  confidence: 'possible',
  disturbance: 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary:
    'Possible directional evidence only. This does not establish product efficacy or clinical significance.',
  createdAt: '2026-07-15T12:30:00.000Z',
  includesFaceImage: false,
};

describe('VerdictViewModel', () => {
  it('adapts durable evidence without adding verdict or scientific rules', () => {
    const viewModel = verdictViewModelFromRecord(record);

    expect(viewModel).toEqual({
      trialId: 'FV–014',
      productName: 'Azelaic Topical Acid',
      productBrand: 'Naturium',
      verdictCode: 'COMPARABLE',
      headline: record.finding,
      explanation: record.nonFinding,
      confidence: 'POSSIBLE',
      evidenceQuality: 'POSSIBLE',
      nextStepLabel: 'TEST LONGER',
      evaluatedAt: record.createdAt,
    });
    expect(verdictProduct(viewModel)).toBe('Naturium · Azelaic Topical Acid');
  });

  it('populates the frozen presentation boundary from one canonical snapshot', () => {
    const evaluation = evaluateRedness(structuredClone(clearImprovementFixture));
    const canonicalRecord: EvidenceRecordData = {
      ...record,
      finding: 'stale compatibility finding',
      nonFinding: 'stale compatibility limitation',
      finalPlacement: 'paused',
      recommendedAction: 'wait',
      rednessEvaluation: evaluation,
    };

    const viewModel = verdictViewModelFromRecord(canonicalRecord);
    expect(viewModel).toMatchObject({
      verdictCode: 'STRONG IMPROVEMENT',
      headline: evaluation.interpretation.finding,
      explanation: evaluation.interpretation.explanation,
      confidence: 'LIKELY',
      measurementQuality: 'ADEQUATE',
      attributionQuality: 'STRONG',
      safetyStatus: 'CLEAR',
      canonicalAction: 'keep',
      nextStepLabel: 'KEEP USING IT',
      evaluatedAt: evaluation.evaluatedAt,
    });
    expect(viewModel.headline).not.toBe(canonicalRecord.finding);

    const detail = evidenceDetailViewModelFromRecord(canonicalRecord);
    expect(detail.canonical).toBe(true);
    expect(detail.rows).toEqual(
      expect.arrayContaining([
        {
          label: 'THRESHOLD',
          value: expect.stringContaining('redness-provisional-v1'),
        },
        {
          label: 'THRESHOLD CONFIG',
          value: evaluation.threshold.configHash,
        },
        { label: 'NEXT STEP', value: 'KEEP USING IT' },
      ]),
    );
    expect(detail.technicalNote).toBe('Production thresholds require repeat-scan calibration.');
  });
});
