import { fireEvent, render, screen, within } from '@testing-library/react';
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
  id: 'ER-RESULT-EXPERIENCE',
  specimenId: evaluation?.productId ?? 'legacy-product',
  accession: 'FV–014',
  product: 'One Thing',
  productBrand: 'Lab Dojo',
  job: 'Reduce visible redness',
  observationWindow: '2026-01-01T12:00:00.000Z to 2026-01-09T12:00:00.000Z',
  comparison: evaluation?.measurementQuality === 'invalid' ? 'not_comparable' : 'comparable',
  finding: evaluation?.interpretation.finding ?? 'Earlier saved finding',
  nonFinding: evaluation?.interpretation.nonFinding ?? 'Earlier saved limitation',
  confidence: evaluation?.evidenceQuality ?? 'possible',
  disturbance: 'none',
  finalPlacement: 'observation',
  recommendedAction: 'wait',
  claimBoundary: evaluation?.interpretation.claimBoundary.join(' ') ?? 'Saved boundary',
  createdAt: evaluation?.evaluatedAt ?? '2026-01-09T12:00:00.000Z',
  includesFaceImage: false,
  rednessEvaluation: evaluation,
  baselineRawScore: evaluation?.baselineRawMedian ?? undefined,
  followUpRawScore: evaluation?.endpointRawMedian ?? undefined,
  comparisonDirection:
    evaluation?.rawScoreDelta === null || evaluation?.rawScoreDelta === undefined
      ? undefined
      : evaluation.rawScoreDelta > 0
        ? 'favorable'
        : evaluation.rawScoreDelta < 0
          ? 'unfavorable'
          : 'unchanged',
  ...overrides,
});

function renderRecord(record = recordFor(evaluateRedness(structuredClone(canonicalRednessFixtures.C)))) {
  const onArchive = vi.fn();
  const onBack = vi.fn();
  const result = render(
    <EvidenceRecord record={record} onArchive={onArchive} onBack={onBack} />,
  );
  return { ...result, onArchive, onBack };
}

async function openEvidence(user: ReturnType<typeof userEvent.setup>) {
  const action = screen.getByRole('button', { name: 'View evidence' });
  await user.click(action);
  return screen.getByRole('dialog', { name: 'Evidence' });
}

async function openTechnical(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await openEvidence(user);
  await user.click(within(dialog).getByRole('button', { name: 'Technical record' }));
  return screen.getByRole('heading', { name: 'Technical record' });
}

describe('EvidenceRecord updated result experience', () => {
  it('renders the one viewport result from the saved immutable payload', () => {
    const evaluation = evaluateRedness(structuredClone(canonicalRednessFixtures.C));
    const { onBack } = renderRecord(recordFor(evaluation));

    expect(screen.getByRole('heading', { name: 'Visible redness' })).toBeVisible();
    expect(screen.getByText('Favorable direction')).toBeVisible();
    expect(screen.getByText('Lab Dojo · One Thing')).toBeVisible();
    expect(screen.getAllByText('60').length).toBeGreaterThan(0);
    expect(screen.getAllByText('67').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+7').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3/3 ↔ 3/3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Early').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-primary-action]')).toHaveLength(1);
    expect(screen.queryByText('Technical record')).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Back to previous view' }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('opens and closes the accessible evidence sheet and restores focus', async () => {
    const user = userEvent.setup();
    renderRecord();
    const action = screen.getByRole('button', { name: 'View evidence' });
    const dialog = await openEvidence(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close evidence' })).toHaveFocus();
    expect(within(dialog).getByText('Agreement')).toBeVisible();
    expect(within(dialog).getByText('6/6')).toBeVisible();
    for (const label of ['Pose Pass', 'Framing Pass', 'Lighting Pass', 'Provider Pass']) {
      expect(within(dialog).getByLabelText(label)).toBeVisible();
    }
    expect(within(dialog).getByText('Early evidence.')).toBeVisible();
    expect(within(dialog).getByText('Visible redness only.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Close evidence' }));
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).not.toBeInTheDocument();
    expect(action).toHaveFocus();
  });

  it('supports Escape, backdrop dismissal, and focus trapping without leaving the record', async () => {
    const user = userEvent.setup();
    renderRecord();

    await openEvidence(user);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Technical record' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close evidence' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).not.toBeInTheDocument();

    await openEvidence(user);
    fireEvent.pointerDown(document.querySelector('[data-sheet-backdrop]')!);
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).not.toBeInTheDocument();
  });

  it('opens the grouped technical record and provider detail from real fields', async () => {
    const user = userEvent.setup();
    renderRecord();
    await openTechnical(user);

    for (const title of ['Provider', 'Capture', 'Evaluation', 'Exclusions']) {
      expect(screen.getByText(title, { exact: true })).toBeVisible();
    }
    expect(screen.queryByText('Baseline median')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Open Provider details/ }));
    expect(screen.getByRole('heading', { name: 'Provider details' })).toBeVisible();
    for (const field of [
      'Baseline median',
      'Follow-up median',
      'Accepted frames',
      'Skin tone model',
      'Region',
      'Time since cleanse',
      'Device skin fit',
      'Image resolution',
      'File format',
    ]) {
      expect(screen.getByText(field)).toBeVisible();
    }
    expect(screen.getByText('60')).toBeVisible();
    expect(screen.getByText('67')).toBeVisible();
    expect(screen.getByText('3/3 ↔ 3/3')).toBeVisible();
  });

  it('restores each previous inspection layer through deterministic back navigation', async () => {
    const user = userEvent.setup();
    renderRecord();
    await openTechnical(user);
    const provider = screen.getByRole('button', { name: /Open Provider details/ });
    await user.click(provider);

    await user.click(screen.getByRole('button', { name: 'Back to previous inspection layer' }));
    expect(screen.getByRole('heading', { name: 'Technical record' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Open Provider details/ })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Back to previous inspection layer' }));
    expect(screen.getByRole('dialog', { name: 'Evidence' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Technical record' })).toHaveFocus();
  });

  it('does not fabricate unavailable provider values', async () => {
    const user = userEvent.setup();
    renderRecord();
    await openTechnical(user);
    await user.click(screen.getByRole('button', { name: /Open Provider details/ }));

    const region = document.querySelector('[data-technical-field="region"]')!;
    const skinTone = document.querySelector('[data-technical-field="skin-tone-model"]')!;
    const resolution = document.querySelector('[data-technical-field="image-resolution"]')!;
    expect(within(region as HTMLElement).getByText('Not collected')).toBeVisible();
    expect(within(skinTone as HTMLElement).getByText('Not available')).toBeVisible();
    expect(within(resolution as HTMLElement).getByText('Not available')).toBeVisible();
    expect(document.body).not.toHaveTextContent(/Cheeks \/ Left|12MP|HEIC|Skin tone model\s+True/i);
  });

  it('uses text and semantic state in addition to orange for direction', async () => {
    const user = userEvent.setup();
    renderRecord();
    const resultDirection = document.querySelector('[data-result-direction="favorable"]');
    expect(resultDirection).toBeVisible();
    expect(resultDirection).toHaveTextContent('Favorable direction');

    const dialog = await openEvidence(user);
    const direction = within(dialog).getByText('Favorable', { exact: true });
    expect(direction).toHaveAttribute('data-direction', 'favorable');
    expect(within(dialog).getByText('Direction')).toBeVisible();
  });

  it('keeps an earlier saved result honest instead of inventing detailed evidence', async () => {
    const user = userEvent.setup();
    renderRecord(
      recordFor(undefined, {
        finding: 'Earlier favorable signal',
        baselineRawScore: undefined,
        followUpRawScore: undefined,
      }),
    );

    expect(screen.getByText('Earlier favorable signal')).toBeVisible();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
    await openTechnical(user);
    await user.click(screen.getByRole('button', { name: /Open Provider details/ }));
    expect(document.querySelectorAll('[data-unavailable="true"]').length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/Cheeks \/ Left|12MP|HEIC/);
  });
});
