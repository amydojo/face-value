import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  canonicalRednessFixtures,
  evaluateRedness,
  type RednessEvaluationSnapshot,
} from '../domain/evidence/redness';
import type { EvidenceRecordData } from '../domain/model';
import { EvidenceRecord } from '../features/evidence-record/EvidenceRecord';
import { evidenceRecordViewModelFromRecord } from '../features/evidence-record/evidenceRecordViewModel';

const recordFor = (
  evaluation?: RednessEvaluationSnapshot,
  overrides: Partial<EvidenceRecordData> = {},
): EvidenceRecordData => ({
  id: 'ER-RECORD-COMPONENT',
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
  claimBoundary:
    evaluation?.interpretation.claimBoundary.join(' ') ?? 'Legacy claim boundary.',
  createdAt: evaluation?.evaluatedAt ?? '2026-02-05T12:00:00.000Z',
  includesFaceImage: false,
  rednessEvaluation: evaluation,
  ...overrides,
});

const renderRecord = (record: EvidenceRecordData) => {
  const onArchive = vi.fn();
  const onBack = vi.fn();
  const result = render(
    <EvidenceRecord record={record} onArchive={onArchive} onBack={onBack} />,
  );
  return { ...result, onArchive, onBack };
};

describe('EvidenceRecord', () => {
  it('leads with the saved result, accessible comparison, context, and next step', async () => {
    const user = userEvent.setup();
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.A));
    const { onArchive, onBack } = renderRecord(recordFor(evaluation));

    expect(screen.getByRole('heading', { name: 'Evidence record' })).toBeVisible();
    expect(screen.getByRole('heading', { name: evaluation.interpretation.finding })).toBeVisible();
    expect(screen.getByText('Lab Dojo · One Thing')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Visible redness' })).toBeVisible();
    expect(
      screen.getByText(
        /Visible redness score changed from 60 at baseline to 72 at follow-up.*Higher scores mean less visible redness/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Higher scores mean less visible redness.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Keep using it' })).toBeVisible();
    expect(screen.getByText('Scan match')).toBeVisible();
    expect(screen.getAllByText('Growing evidence')).toHaveLength(2);

    const initialRecord = document.querySelector('[data-evidence-record]')!;
    expect(initialRecord).not.toHaveTextContent('Configuration hash');
    expect(initialRecord).not.toHaveTextContent('Triggered rule identifiers');
    expect(initialRecord).not.toHaveTextContent('raw delta');
    expect(document.querySelector('[data-evidence-comparison]')).toHaveAttribute(
      'data-comparison-tone',
      'favorable',
    );

    await user.click(screen.getByRole('button', { name: 'Back to previous view' }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'View previous trials' }));
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('opens, switches, and closes semantic disclosure panels with the keyboard', async () => {
    const user = userEvent.setup();
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.C));
    const record = recordFor(evaluation, {
      trialTruth: {
        generationId: 'keyboard-trial-truth',
        adherence: { status: 'complete' },
        tolerance: { collectionStatus: 'collected', severity: 'none', symptoms: [] },
        patientAnchor: { visibleChange: 1, recordedAt: evaluation.evaluatedAt },
        recordedAt: evaluation.evaluatedAt,
      },
      anchorRelationship: 'agreed',
    });
    const immutableBeforeDisclosure = structuredClone(record);
    const { unmount } = renderRecord(record);
    const whyButton = screen.getByRole('button', {
      name: /Why Face Value reached this result/i,
    });
    const fullButton = screen.getByRole('button', { name: /Full evidence record/i });

    expect(whyButton).toHaveAttribute('aria-expanded', 'false');
    expect(whyButton).toHaveAttribute('aria-controls', 'why-disclosure-panel');
    expect(fullButton).toHaveAttribute('aria-expanded', 'false');

    whyButton.focus();
    await user.keyboard('{Enter}');
    expect(whyButton).toHaveAttribute('aria-expanded', 'true');
    const whyPanel = screen.getByRole('region', {
      name: /Why Face Value reached this result/i,
    });
    expect(within(whyPanel).getByRole('heading', { name: 'What supported this result' })).toBeVisible();
    expect(within(whyPanel).getByRole('heading', { name: 'What to keep in mind' })).toBeVisible();

    fullButton.focus();
    await user.keyboard(' ');
    expect(whyButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Why Face Value reached/i })).not.toBeInTheDocument();
    expect(fullButton).toHaveAttribute('aria-expanded', 'true');
    const fullPanel = screen.getByRole('region', { name: /Full evidence record/i });
    expect(within(fullPanel).getByRole('heading', { name: 'Redness Response Signature' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Observed change' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Measurement support' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Trial truth' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Evidence boundaries' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Supported next action' })).toBeVisible();
    expect(
      within(fullPanel).getByText(
        'Production thresholds remain provisional and require repeat-scan calibration.',
      ),
    ).toBeVisible();
    expect(within(fullPanel).getAllByText(/Provenance · Provider measurement/).length)
      .toBeGreaterThan(0);
    expect(
      within(fullPanel).getAllByText(/Provenance · Face Value deterministic evaluation/).length,
    ).toBeGreaterThan(0);
    expect(within(fullPanel).getAllByText(/Provenance · Unavailable evidence/).length)
      .toBeGreaterThan(0);
    expect(within(fullPanel).getAllByText(/Provenance · Participant report/).length)
      .toBeGreaterThan(0);

    await user.click(within(fullPanel).getByText('Technical metadata'));
    expect(within(fullPanel).getAllByText('Configuration hash')).toHaveLength(2);
    expect(within(fullPanel).getByRole('heading', { name: 'Audit trace' })).toBeVisible();

    await user.click(fullButton);
    expect(fullButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Full evidence record/i })).not.toBeInTheDocument();
    expect(record).toEqual(immutableBeforeDisclosure);

    unmount();
    renderRecord(recordFor(evaluation));
    expect(
      screen.getByRole('button', { name: /Why Face Value reached this result/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('builds a deterministic Response Signature from deliberately inconsistent saved fields', () => {
    const evaluation = structuredClone(evaluateRedness(canonicalRednessFixtures.A));
    evaluation.baselineRawMedian = 123;
    evaluation.endpointRawMedian = 7;
    evaluation.rawScoreDelta = -42;
    evaluation.effectClassification = 'strong_improvement';
    evaluation.actualObservationIntervalDays = 13;
    evaluation.observationWindowStatus = 'too_early';
    evaluation.baseline.acceptedRawScores = [9, 1, 7];
    evaluation.endpoint.acceptedRawScores = [88, 89, 87];
    evaluation.baseline.rejectedFrameCount = 2;
    evaluation.endpoint.rejectedFrameCount = 1;
    evaluation.directionAgreement = {
      status: 'contradicted',
      assessedEndpointFrameCount: 9,
      improvingEndpointFrameCount: 1,
      contradictionDetected: true,
    };
    evaluation.measurementQuality = 'limited';
    evaluation.evidenceQuality = 'possible';
    evaluation.attributionQuality = 'weak';
    evaluation.safetyStatus = 'check_required';
    evaluation.threshold = {
      ...evaluation.threshold,
      version: 'saved-provisional-threshold-v-sentinel',
      source: 'provisional_fixture',
      provisionalDetectablePoints: 5,
      provisionalStrongPoints: 10,
      configHash: 'sha256:saved-consumer-config-sentinel',
      provisional: true,
    };
    evaluation.interpretation = {
      ...evaluation.interpretation,
      recommendedAction: 'retry_alone',
      explanation: 'Saved deterministic explanation sentinel.',
    };
    evaluation.triggeredRuleIds = ['SAVED_RULE_SENTINEL'];
    evaluation.missingEvidence = ['Saved missing-evidence sentinel.'];
    const record = recordFor(evaluation, {
      trialTruth: {
        generationId: 'saved-trial-truth-sentinel',
        adherence: { status: 'partial' },
        tolerance: {
          collectionStatus: 'collected',
          severity: 'mild',
          symptoms: ['itching'],
        },
        patientAnchor: {
          visibleChange: -1,
          recordedAt: '2026-02-05T11:55:00.000Z',
        },
        recordedAt: '2026-02-05T11:55:00.000Z',
      },
      anchorRelationship: 'contradicted',
    });
    const immutableBeforePresentation = structuredClone(record);

    const first = evidenceRecordViewModelFromRecord(record);
    const second = evidenceRecordViewModelFromRecord(record);
    const rows = new Map(
      first.full?.sections.flatMap((section) => section.rows).map((row) => [row.id, row]),
    );

    expect(second).toEqual(first);
    expect(record).toEqual(immutableBeforePresentation);
    expect(first.full?.sections.map(({ title }) => title)).toEqual([
      'Observed change',
      'Measurement support',
      'Trial truth',
      'Evidence boundaries',
      'Supported next action',
    ]);
    expect(rows.get('baseline-median')?.value).toBe('123');
    expect(rows.get('follow-up-median')?.value).toBe('7');
    expect(rows.get('saved-score-delta')?.value).toBe('-42 points');
    expect(rows.get('saved-effect-classification')).toMatchObject({
      value: 'Strong improvement',
      canonicalValue: 'strong_improvement',
    });
    expect(rows.get('baseline-raw-scores')?.value).toBe('9 · 1 · 7');
    expect(rows.get('follow-up-raw-scores')?.value).toBe('88 · 89 · 87');
    expect(rows.get('baseline-frame-counts')?.value).toBe('Accepted 3 · rejected 2');
    expect(rows.get('direction-agreement')).toMatchObject({
      value: 'Contradicted',
      canonicalValue: 'contradicted',
    });
    expect(rows.get('assessed-endpoint-count')?.value).toBe('9');
    expect(rows.get('improving-endpoint-count')?.value).toBe('1');
    expect(rows.get('saved-measurement-quality')?.canonicalValue).toBe('limited');
    expect(rows.get('adherence')).toMatchObject({
      canonicalValue: 'partial',
      provenance: 'Participant report',
    });
    expect(rows.get('reported-symptoms')?.value).toBe('Itching');
    expect(rows.get('participant-observation')?.value).toBe('More');
    expect(rows.get('anchor-relationship')?.canonicalValue).toBe('contradicted');
    expect(rows.get('evidence-quality')?.canonicalValue).toBe('possible');
    expect(rows.get('attribution-quality')?.canonicalValue).toBe('weak');
    expect(rows.get('safety-status')?.canonicalValue).toBe('check_required');
    expect(rows.get('active-provisional-boundary')?.value).toBe('Detectable 5 · strong 10 points');
    expect(rows.get('threshold-source')?.canonicalValue).toBe('provisional_fixture');
    expect(rows.get('threshold-version')?.value).toBe('saved-provisional-threshold-v-sentinel');
    expect(rows.get('configuration-hash')?.value).toBe('sha256:saved-consumer-config-sentinel');
    expect(rows.get('recommended-action')?.canonicalValue).toBe('retry_alone');
    expect(rows.get('deterministic-explanation')?.value)
      .toBe('Saved deterministic explanation sentinel.');
    expect(rows.get('rule-trace')?.value).toBe('SAVED_RULE_SENTINEL');
    expect(rows.get('additional-evidence')?.value).toBe('Saved missing-evidence sentinel.');
    expect(rows.get('facial-registration-quality')).toMatchObject({
      value: 'Not available',
      provenance: 'Unavailable evidence',
    });
  });

  it('keeps safety interruption visually and semantically distinct without diagnosis', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.F));
    renderRecord(recordFor(evaluation));

    expect(screen.getByRole('heading', { name: 'Safety interruption' })).toBeVisible();
    expect(document.querySelector('[data-next-step]')).toHaveAttribute('data-tone', 'safety');
    expect(screen.getByText(/Face Value cannot diagnose a reaction/)).toBeVisible();
    expect(document.body).not.toHaveTextContent(/diagnosed|rosacea|clinical efficacy established/i);
  });

  it('renders an earlier saved result without fabricating measurements or disclosures', () => {
    const { onArchive } = renderRecord(
      recordFor(undefined, {
        product: 'Legacy Redness Product',
        productBrand: 'Face Value',
        note: 'Saved before detailed measurements were stored.',
      }),
    );

    expect(screen.getByRole('heading', { name: 'Legacy saved finding.' })).toBeVisible();
    expect(
      screen.getByText('Detailed measurements are not available for this earlier result.'),
    ).toBeVisible();
    expect(document.querySelector('[data-legacy-evidence-record]')).toBeVisible();
    expect(document.querySelector('[data-evidence-comparison]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Why Face Value reached/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Full evidence record/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Accepted baseline raw scores|Saved direction agreement/);
    expect(document.body).not.toHaveTextContent(/Baseline score|Follow-up score|Threshold source/);

    screen.getByRole('button', { name: 'View previous trials' }).click();
    expect(onArchive).toHaveBeenCalledOnce();
  });
});
