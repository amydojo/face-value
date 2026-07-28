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
    const { unmount } = renderRecord(recordFor(evaluation));
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
    expect(within(fullPanel).getByRole('heading', { name: 'Evidence checks' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Measurements' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Trial details' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Comparison settings' })).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Technical methods' })).toBeVisible();
    expect(
      within(fullPanel).getByText('Production thresholds require repeat-scan calibration.'),
    ).toBeVisible();

    await user.click(within(fullPanel).getByText('Technical metadata'));
    expect(within(fullPanel).getByText('Configuration hash')).toBeVisible();
    expect(within(fullPanel).getByRole('heading', { name: 'Audit trace' })).toBeVisible();

    await user.click(fullButton);
    expect(fullButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Full evidence record/i })).not.toBeInTheDocument();

    unmount();
    renderRecord(recordFor(evaluation));
    expect(
      screen.getByRole('button', { name: /Why Face Value reached this result/i }),
    ).toHaveAttribute('aria-expanded', 'false');
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
    expect(document.body).not.toHaveTextContent(/Baseline score|Follow-up score|Threshold source/);

    screen.getByRole('button', { name: 'View previous trials' }).click();
    expect(onArchive).toHaveBeenCalledOnce();
  });
});
