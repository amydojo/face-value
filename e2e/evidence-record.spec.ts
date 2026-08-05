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

const screenshotDirectory = resolve('test-results/result-experience');

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
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  return { errors, serverErrors };
}

async function openSnapshot(page: Page, key: FixtureKey = 'C') {
  const snapshot = snapshotFor(key);
  const record = evidenceRecordForSnapshot(snapshot, {
    id: 'ER-RESULT-EXPERIENCE',
    accession: 'FV–014',
  });
  await loadRecordState(page, persistedRecordState(snapshot, record));
  await expect(page.getByRole('heading', { name: 'Visible redness' })).toBeVisible();
  return { snapshot, record };
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function captureViewport(page: Page, filename: string) {
  await page.screenshot({
    path: resolve(screenshotDirectory, filename),
    animations: 'disabled',
    fullPage: false,
  });
}

test.beforeAll(async () => {
  await mkdir(screenshotDirectory, { recursive: true });
});

test('result uses one primary action and fits the required responsive viewports', async ({ page }) => {
  const runtime = monitorRuntime(page);

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await openSnapshot(page);
    const experience = page.locator('[data-evidence-record]');
    const result = page.locator('[data-result-layer="result"]');

    await expect(experience).toHaveAttribute('data-record-id', 'ER-RESULT-EXPERIENCE');
    await expect(page.getByText('Favorable direction', { exact: true })).toBeVisible();
    await expect(page.getByText('Lab Dojo · One Thing')).toBeVisible();
    await expect(page.getByText('60', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('67', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('+7', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('3/3 ↔ 3/3', { exact: true }).first()).toBeVisible();
    await expect(page.locator('[data-primary-action]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'View evidence' })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const box = await experience.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(Math.min(viewport.width, 430));

    if (viewport.width === 390 && viewport.height === 844) {
      expect(
        await result.evaluate((element) => element.scrollHeight - element.clientHeight),
      ).toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
        ),
      ).toBeLessThanOrEqual(1);
      await captureViewport(page, '01-result-390x844.png');
    }
  }

  expect(runtime.errors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
});

test('progressive disclosure opens all four required states and restores each layer', async ({ page }) => {
  const runtime = monitorRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openSnapshot(page);

  const viewEvidence = page.getByRole('button', { name: 'View evidence' });
  await viewEvidence.click();
  const dialog = page.getByRole('dialog', { name: 'Evidence' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close evidence' })).toBeFocused();
  await expect(dialog.getByText('6/6', { exact: true })).toBeVisible();
  for (const label of ['Pose Pass', 'Framing Pass', 'Lighting Pass', 'Provider Pass']) {
    await expect(dialog.getByLabel(label)).toBeVisible();
  }
  await expect(dialog.getByText('Early evidence.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Visible redness only.', { exact: true })).toBeVisible();
  await captureViewport(page, '02-evidence-sheet-390x844.png');

  const technicalAction = dialog.getByRole('button', { name: 'Technical record' });
  await technicalAction.click();
  await expect(page.getByRole('heading', { name: 'Technical record' })).toBeVisible();
  for (const group of ['Provider', 'Capture', 'Evaluation', 'Exclusions']) {
    await expect(page.getByText(group, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Baseline median')).toHaveCount(0);
  await captureViewport(page, '03-technical-record-390x844.png');

  const provider = page.getByRole('button', { name: /Open Provider details/ });
  await provider.click();
  await expect(page.getByRole('heading', { name: 'Provider details' })).toBeVisible();
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
    await expect(page.getByText(field, { exact: true })).toBeVisible();
  }
  await captureViewport(page, '04-provider-details-390x844.png');

  await page.getByRole('button', { name: 'Back to previous inspection layer' }).click();
  await expect(page.getByRole('heading', { name: 'Technical record' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open Provider details/ })).toBeFocused();

  await page.getByRole('button', { name: 'Back to previous inspection layer' }).click();
  await expect(dialog).toBeVisible();
  await expect(technicalAction).toBeFocused();

  await page.getByRole('button', { name: 'Close evidence' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(viewEvidence).toBeFocused();
  expect(runtime.errors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
});

test('sheet dismissal, focus trapping, reduced motion, and semantic direction are accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSnapshot(page);
  await page.getByRole('button', { name: 'View evidence' }).click();

  const dialog = page.getByRole('dialog', { name: 'Evidence' });
  const close = page.getByRole('button', { name: 'Close evidence' });
  const technical = page.getByRole('button', { name: 'Technical record' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await close.press('Shift+Tab');
  await expect(technical).toBeFocused();
  await technical.press('Tab');
  await expect(close).toBeFocused();

  const direction = dialog.getByText('Favorable', { exact: true });
  await expect(direction).toHaveAttribute('data-direction', 'favorable');
  await expect(dialog.getByText('Direction', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View evidence' })).toBeFocused();

  await page.getByRole('button', { name: 'View evidence' }).click();
  await page.locator('[data-sheet-backdrop]').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'View evidence' }).click();
  const sheetBox = await dialog.boundingBox();
  if (!sheetBox) throw new Error('Expected an evidence sheet bounding box.');
  await page.mouse.move(sheetBox.x + sheetBox.width / 2, sheetBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(sheetBox.x + sheetBox.width / 2, sheetBox.y + 130, { steps: 4 });
  await page.mouse.up();
  await expect(dialog).toHaveCount(0);
});

test('missing provider values stay unavailable and the saved snapshot remains immutable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { snapshot, record } = await openSnapshot(page);
  const before = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as { record?: unknown };
    return JSON.stringify(stored.record);
  }, STORAGE_KEY);

  await page.getByRole('button', { name: 'View evidence' }).click();
  await page.getByRole('button', { name: 'Technical record' }).click();
  await page.getByRole('button', { name: /Open Provider details/ }).click();

  await expect(page.locator('[data-technical-field="region"]')).toContainText('Not collected');
  await expect(page.locator('[data-technical-field="skin-tone-model"]')).toContainText(
    'Not available',
  );
  await expect(page.locator('[data-technical-field="image-resolution"]')).toContainText(
    'Not available',
  );
  await expect(page.getByText('Cheeks / Left', { exact: true })).toHaveCount(0);
  await expect(page.getByText('12MP', { exact: true })).toHaveCount(0);
  await expect(page.getByText('HEIC', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Visible redness' })).toBeVisible();
  const after = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as { record?: unknown };
    return JSON.stringify(stored.record);
  }, STORAGE_KEY);
  expect(after).toBe(before);
  expect(JSON.parse(after)).toEqual(record);
  await expect(page.getByText('Favorable direction', { exact: true })).toBeVisible();
  expect(snapshot.rawScoreDelta).toBe(7);
});

test('legacy records do not gain measurements that were never saved', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = snapshotFor('C');
  const canonical = evidenceRecordForSnapshot(snapshot);
  const legacy = legacyEvidenceRecord(canonical);
  await loadRecordState(page, persistedRecordState(snapshot, legacy));

  await expect(page.locator('[data-evidence-record]')).toHaveAttribute(
    'data-snapshot-kind',
    'legacy',
  );
  await expect(page.getByText(legacy.finding)).toBeVisible();
  await page.getByRole('button', { name: 'View evidence' }).click();
  await page.getByRole('button', { name: 'Technical record' }).click();
  await page.getByRole('button', { name: /Open Provider details/ }).click();
  await expect(page.locator('[data-technical-field="baseline-median"]')).toContainText(
    'Not available',
  );
  await expect(page.locator('[data-technical-field="follow-up-median"]')).toContainText(
    'Not available',
  );
  await expect(page.getByText('Cheeks / Left', { exact: true })).toHaveCount(0);
  await expect(page.getByText('12MP', { exact: true })).toHaveCount(0);
});
