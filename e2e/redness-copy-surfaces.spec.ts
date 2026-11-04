import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { analysisResultFromRednessEvaluation } from '../src/adapters/analysis/youcam/rednessEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../src/domain/evidence/redness';
import {
  evaluateLiveScenario,
  recordForSnapshot,
} from '../src/test/support/rednessScenarios';
import { persistedRecordState } from './evidence-record-fixtures';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

// User-visible result copy for live-shaped evidence: limited measurement, as the production
// adapter writes it. Assertions are on what a person can see, not on hidden DOM.

// Read rather than imported: specs load as ESM, where a JSON import needs an import attribute.
const savedV1: RednessEvaluationSnapshot = JSON.parse(
  readFileSync(new URL('../src/test/fixtures/redness-snapshot-engine-v1.0.0.json', import.meta.url), 'utf8'),
);

const liveWorsening = (): RednessEvaluationSnapshot =>
  evaluateLiveScenario({
    comparability: null,
    delta: -20,
    pattern: 'unanimous',
    intervalDays: 29,
    adherence: 'complete',
    tolerance: 'none',
    anchor: -1,
    context: 'none',
  });

const sealedStateFor = (snapshot: RednessEvaluationSnapshot) => ({
  ...persistedSealedTrial,
  confidence: snapshot.evidenceQuality,
  analysis: analysisResultFromRednessEvaluation(snapshot),
  longitudinalEvidence: { ...persistedSealedTrial.longitudinalEvidence, evaluation: snapshot },
});

async function seed(page: Page, state: unknown): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
  );
  await page.reload();
}

const visibleText = async (page: Page): Promise<string> =>
  (await page.locator('body').innerText()).replace(/\s+/g, ' ');

test('live worsening reveals an honest finding with no comparable claim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = liveWorsening();
  await seed(page, sealedStateFor(snapshot));
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
  const sealedHtml = await page.locator('[data-fv-screen="oracle-reveal"]').innerHTML();
  expect(sealedHtml).not.toContain('Visible redness was higher at follow-up.');
  expect(sealedHtml).not.toContain('TEST LONGER');

  await page.getByRole('button', { name: /Reveal sealed result for/i }).press('Enter');
  const machine = page.locator('[data-oracle-machine]');
  await expect(machine).toHaveAttribute('data-oracle-state', 'verdict_revealed', { timeout: 8_000 });
  await expect(machine).toHaveAttribute('aria-label', /Visible redness was higher at follow-up\./);
  const firmware = page.locator('[data-firmware-state="resolved"]');
  await expect(firmware).toContainText('Visible redness was higher at follow-up.');
  await expect(firmware).toContainText('TEST LONGER');
  // The instrument paints the finding through its three-line projection, not fallback text.
  expect(
    await page.locator('[data-oracle-finding]').first().evaluate((el) => getComputedStyle(el, '::after').content),
  ).toContain('WAS HIGHER AT');

  await page.getByRole('button', { name: /why this result/i }).first().click();
  const revealed = await visibleText(page);
  expect(revealed).toContain('matching scan conditions were not measured');
  expect(revealed).not.toMatch(/comparable scans|encouraging/i);
});

test('live worsening record makes no comparable or verified claim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = liveWorsening();
  await seed(page, persistedRecordState(snapshot, recordForSnapshot(snapshot)));
  await expect(page.getByText('Visible redness was higher at follow-up.').first()).toBeVisible();
  const resultLayer = await visibleText(page);
  expect(resultLayer).not.toMatch(/comparable scans|COMPARISON VERIFIED|encouraging/i);

  await page.getByRole('button', { name: 'Open evidence record' }).first().click();
  const sheet = await visibleText(page);
  expect(sheet).not.toMatch(/comparable scans|COMPARISON VERIFIED|encouraging/i);
});

test('a V1 saved record keeps its saved words', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = structuredClone(savedV1);
  await seed(page, persistedRecordState(snapshot, recordForSnapshot(snapshot)));
  await expect(
    page.getByText('Visible redness worsened across comparable scans.').first(),
  ).toBeVisible();
});
