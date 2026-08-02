import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  canonicalRednessFixtures,
  evaluateRedness,
  type RednessEvaluationSnapshot,
} from '../src/domain/evidence/redness';
import { STORAGE_KEY } from './phase-b5-fixtures';
import {
  evidenceRecordForSnapshot,
  legacyEvidenceRecord,
  loadRecordState,
  persistedRecordState,
} from './evidence-record-fixtures';

const captureEvidence = process.env.CAPTURE_EVIDENCE_RECORD === 'true';
const evidenceDirectory = resolve('docs/verification/evidence-record-53');

type FixtureKey = keyof typeof canonicalRednessFixtures;

function snapshotFor(key: FixtureKey): RednessEvaluationSnapshot {
  return evaluateRedness(structuredClone(canonicalRednessFixtures[key]));
}

function monitorRuntime(page: Page) {
  const errors: string[] = [];
  const serverErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  return { errors, serverErrors };
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function openSnapshot(
  page: Page,
  key: FixtureKey,
  options: Parameters<typeof evidenceRecordForSnapshot>[1] = {},
): Promise<{
  snapshot: RednessEvaluationSnapshot;
  record: ReturnType<typeof evidenceRecordForSnapshot>;
}> {
  const snapshot = snapshotFor(key);
  const record = evidenceRecordForSnapshot(snapshot, options);
  await loadRecordState(page, persistedRecordState(snapshot, record));
  await expect(page.getByRole('heading', { name: 'Evidence record' })).toBeVisible();
  return { snapshot, record };
}

async function captureState(page: Page, name: string, order: number): Promise<void> {
  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    fullPage: true,
  });
  if (!captureEvidence) return;
  await page.screenshot({
    path: resolve(evidenceDirectory, `${String(order).padStart(2, '0')}-${name}.png`),
    animations: 'disabled',
    fullPage: true,
  });
}

test.beforeAll(async () => {
  if (captureEvidence) await mkdir(evidenceDirectory, { recursive: true });
});

test('summary leads with the saved result, useful comparison, and canonical next step', async ({
  page,
}) => {
  const runtime = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const { snapshot } = await openSnapshot(page, 'C');
  const record = page.locator('[data-evidence-record]');
  const comparison = page.locator('[data-evidence-comparison]');

  await expect(record).toHaveAttribute('data-snapshot-kind', 'canonical');
  await expect(page.getByRole('heading', { name: snapshot.interpretation.finding })).toBeVisible();
  await expect(page.getByText('Lab Dojo · One Thing')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
  await expect(comparison).toContainText('Baseline');
  await expect(comparison).toContainText('Follow-up');
  await expect(comparison).toContainText('+7 points');
  await expect(comparison).toContainText('8 days');
  await expect(
    comparison.getByText(
      'Visible redness score changed from 60 at baseline to 67 at follow-up. The saved change was +7 points over 8 days. Higher scores mean less visible redness.',
    ),
  ).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Test longer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible();
  await expect(page.getByText('Early evidence', { exact: true }).last()).toBeVisible();

  await expect(page.getByText('raw delta')).toHaveCount(0);
  await expect(page.getByText('configuration hash', { exact: true })).toHaveCount(0);
  await expect(page.getByText('provisional_fixture', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Generic confidence', { exact: true })).toHaveCount(0);

  const comparisonBox = await comparison.boundingBox();
  expect(comparisonBox?.y).toBeLessThan(760);
  expect(comparisonBox?.width).toBeLessThanOrEqual(382);
  await assertNoHorizontalOverflow(page);
  expect(runtime.errors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
});

test('disclosures are semantic, keyboard operable, mutually exclusive, and motion-safe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSnapshot(page, 'A');

  const why = page.getByRole('button', { name: /Why Face Value reached this result/i });
  const full = page.getByRole('button', { name: /Full evidence record/i });
  await expect(why).toHaveAttribute('aria-expanded', 'false');
  await expect(why).toHaveAttribute('aria-controls', 'why-disclosure-panel');
  await expect(full).toHaveAttribute('aria-controls', 'full-disclosure-panel');
  expect((await why.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await why.scrollIntoViewIfNeeded();
  const topBeforeOpen = (await why.boundingBox())?.y;
  await why.focus();
  await expect(why).toBeFocused();
  expect(await why.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(why).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: /Why Face Value reached this result/i })).toBeVisible();
  expect(Math.abs(((await why.boundingBox())?.y ?? 0) - (topBeforeOpen ?? 0))).toBeLessThanOrEqual(1);
  await expect(why).toHaveCSS('transition-duration', '0s');

  await full.focus();
  await page.keyboard.press('Space');
  await expect(full).toHaveAttribute('aria-expanded', 'true');
  await expect(why).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Full evidence record' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Redness Response Signature' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Observed change' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Measurement support' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trial truth' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence boundaries' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Supported next action' })).toBeVisible();
  for (const provenance of [
    'Provider measurement',
    'Face Value deterministic evaluation',
    'Participant report',
    'Unavailable evidence',
  ]) {
    await expect(page.locator(`[data-evidence-provenance="${provenance}"]`).first()).toBeVisible();
  }

  const technical = page.locator('details').filter({ hasText: 'Technical metadata' });
  await technical.locator('summary').click();
  await expect(technical).toHaveAttribute('open', '');
  await expect(technical).toContainText('Configuration hash');
  await expect(technical).toContainText('Immutable snapshot identity');

  await full.click();
  await expect(full).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#full-disclosure-panel')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test('responsive record handles long identity, decimals, negative change, and unavailable data', async ({
  page,
}) => {
  const worsening = snapshotFor('E');
  const storedWorsening: RednessEvaluationSnapshot = {
    ...worsening,
    baselineRawMedian: 99.125,
    endpointRawMedian: 3.5,
    rawScoreDelta: -95.625,
  };
  const longRecord = evidenceRecordForSnapshot(storedWorsening, {
    productBrand: 'Clinical Laboratory',
    productName:
      'Azelaic Topical Acid Barrier Support Concentrate With An Intentionally Long Name',
  });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await loadRecordState(page, persistedRecordState(storedWorsening, longRecord));
    const comparison = page.locator('[data-evidence-comparison]');
    await expect(comparison).toContainText('99.13');
    await expect(comparison).toContainText('3.5');
    await expect(comparison).toContainText('-95.63 points');
    expect((await comparison.boundingBox())?.width).toBeLessThanOrEqual(viewport.width);
    await page.getByRole('button', { name: 'View previous trials' }).scrollIntoViewIfNeeded();
    await assertNoHorizontalOverflow(page);
  }

  const invalid = snapshotFor('G');
  const invalidRecord = evidenceRecordForSnapshot(invalid);
  await loadRecordState(page, persistedRecordState(invalid, invalidRecord));
  await expect(page.locator('[data-evidence-comparison]')).toContainText(
    'These values were recorded, but the scans were not comparable enough to interpret.',
  );

  const unavailable: RednessEvaluationSnapshot = {
    ...invalid,
    baselineRawMedian: null,
    endpointRawMedian: null,
    rawScoreDelta: null,
    tolerance: null,
  };
  const unavailableRecord = evidenceRecordForSnapshot(unavailable);
  await loadRecordState(page, persistedRecordState(unavailable, unavailableRecord));
  await expect(page.locator('[data-evidence-comparison]')).toHaveCount(0);
  await expect(page.getByText('Detailed measurements are not available in this saved snapshot.')).toBeVisible();
  await expect(page.getByText('Not collected', { exact: true }).last()).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('legacy record preserves its saved verdict and navigation without invented evidence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const reference = snapshotFor('A');
  const canonical = evidenceRecordForSnapshot(reference);
  const legacy = legacyEvidenceRecord(canonical);
  await loadRecordState(page, persistedRecordState(reference, legacy));

  await expect(page.locator('[data-evidence-record]')).toHaveAttribute(
    'data-snapshot-kind',
    'legacy',
  );
  await expect(page.getByRole('heading', { name: legacy.finding })).toBeVisible();
  await expect(
    page.getByText('Detailed measurements are not available for this earlier result.'),
  ).toBeVisible();
  await expect(page.locator('[data-evidence-comparison]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Why Face Value reached this result/i })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: /Full evidence record/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View previous trials' })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('complete saved-result journey retains one immutable snapshot and stable verdict', async ({
  page,
}) => {
  const runtime = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = snapshotFor('A');
  const record = evidenceRecordForSnapshot(snapshot, {
    id: 'ER-IMMUTABLE-JOURNEY',
    accession: 'FV–035',
  });
  await loadRecordState(page, persistedRecordState(snapshot, record, 'archive'));

  await expect(page.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  await page
    .getByRole('button', { name: /Open saved result FV–035 for One Thing/i })
    .click();
  const headline = page.getByRole('heading', { name: snapshot.interpretation.finding });
  await expect(headline).toBeVisible();
  await expect(page.locator('[data-evidence-comparison]')).toContainText('+12 points');

  const why = page.getByRole('button', { name: /Why Face Value reached this result/i });
  await why.click();
  await expect(page.getByRole('heading', { name: 'What supported this result' })).toBeVisible();
  await why.click();
  await expect(page.locator('#why-disclosure-panel')).toHaveCount(0);

  const full = page.getByRole('button', { name: /Full evidence record/i });
  await full.click();
  const configurationHash = page.locator('[data-evidence-row="configuration-hash"]');
  const metadataConfigurationHash = page.locator(
    '[data-evidence-row="configuration-hash-metadata"]',
  );
  const baselineScores = page.locator('[data-evidence-row="baseline-raw-scores"]');
  const followUpScores = page.locator('[data-evidence-row="follow-up-raw-scores"]');
  const baselineMedian = page.locator('[data-evidence-row="baseline-median"]');
  await expect(configurationHash).toBeVisible();
  await expect(configurationHash).toContainText(snapshot.threshold.configHash);
  await expect(metadataConfigurationHash).toBeHidden();
  await expect(baselineScores).toContainText(snapshot.baseline.acceptedRawScores.join(' · '));
  await expect(followUpScores).toContainText(snapshot.endpoint.acceptedRawScores.join(' · '));
  await expect(baselineMedian).toContainText(String(snapshot.baselineRawMedian));
  await page.locator('details summary').click();
  await expect(metadataConfigurationHash).toBeVisible();
  await expect(metadataConfigurationHash).toContainText(snapshot.threshold.configHash);

  await page.getByRole('button', { name: 'Back to previous view' }).click();
  await expect(page.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  await page
    .getByRole('button', { name: /Open saved result FV–035 for One Thing/i })
    .click();
  await expect(headline).toBeVisible();
  await full.click();
  await expect(baselineScores).toContainText(snapshot.baseline.acceptedRawScores.join(' · '));
  await expect(followUpScores).toContainText(snapshot.endpoint.acceptedRawScores.join(' · '));
  await full.click();

  const beforeReload = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      record?: { rednessEvaluation?: unknown };
    };
    return JSON.stringify(stored.record?.rednessEvaluation);
  }, STORAGE_KEY);
  await page.reload();
  await expect(headline).toBeVisible();
  const afterReload = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      record?: { rednessEvaluation?: unknown };
    };
    return JSON.stringify(stored.record?.rednessEvaluation);
  }, STORAGE_KEY);
  expect(afterReload).toBe(beforeReload);
  await expect(page.locator('[data-evidence-comparison]')).toContainText('+12 points');
  await expect(page.getByRole('heading', { name: 'Keep using it' })).toBeVisible();
  await expect(full).toHaveAttribute('aria-expanded', 'false');
  await full.click();
  await expect(baselineScores).toContainText(snapshot.baseline.acceptedRawScores.join(' · '));
  await expect(followUpScores).toContainText(snapshot.endpoint.acceptedRawScores.join(' · '));
  await expect(configurationHash).toContainText(snapshot.threshold.configHash);
  await full.click();

  await page.getByRole('button', { name: 'View previous trials' }).click();
  await expect(page.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  expect(runtime.errors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
});

test('captures the ten requested premium progressive-disclosure states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await openSnapshot(page, 'C');
  await captureState(page, 'evidence-record-summary-390', 1);

  await page.setViewportSize({ width: 320, height: 568 });
  await openSnapshot(page, 'C', {
    productName: 'One Thing Calming Serum With A Long Product Name',
  });
  await captureState(page, 'evidence-record-summary-320', 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await openSnapshot(page, 'C');
  await page.getByRole('button', { name: /Why Face Value reached this result/i }).click();
  await captureState(page, 'evidence-record-why-expanded', 3);

  await openSnapshot(page, 'C');
  await page.getByRole('button', { name: /Full evidence record/i }).click();
  await captureState(page, 'evidence-record-full-expanded', 4);

  await openSnapshot(page, 'A');
  await captureState(page, 'evidence-record-clear-favorable', 5);

  await openSnapshot(page, 'B');
  await captureState(page, 'evidence-record-no-clear-change', 6);

  await openSnapshot(page, 'D');
  await captureState(page, 'evidence-record-retry-alone', 7);

  await openSnapshot(page, 'F');
  await captureState(page, 'evidence-record-safety-interruption', 8);

  const reference = snapshotFor('A');
  const legacy = legacyEvidenceRecord(evidenceRecordForSnapshot(reference));
  await loadRecordState(page, persistedRecordState(reference, legacy));
  await captureState(page, 'evidence-record-legacy', 9);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSnapshot(page, 'C');
  await page.getByRole('button', { name: /Why Face Value reached this result/i }).click();
  await captureState(page, 'evidence-record-reduced-motion', 10);
});
