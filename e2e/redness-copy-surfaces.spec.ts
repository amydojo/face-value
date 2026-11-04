import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { analysisResultFromRednessEvaluation } from '../src/adapters/analysis/youcam/rednessEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../src/domain/evidence/redness';
import {
  evaluateLiveScenario,
  recordForSnapshot,
  type LiveScenario,
} from '../src/test/support/rednessScenarios';
import { persistedRecordState } from './evidence-record-fixtures';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

// User-visible result copy for live-shaped evidence: limited measurement, as the production
// adapter writes it. Assertions are on what a person can see, not on hidden DOM.

// Read rather than imported: specs load as ESM, where a JSON import needs an import attribute.
const savedV1: RednessEvaluationSnapshot = JSON.parse(
  readFileSync(new URL('../src/test/fixtures/redness-snapshot-engine-v1.0.0.json', import.meta.url), 'utf8'),
);

const liveScenario = (overrides: Partial<LiveScenario>): RednessEvaluationSnapshot =>
  evaluateLiveScenario({
    comparability: null,
    delta: 0,
    pattern: 'unanimous',
    intervalDays: 29,
    adherence: 'complete',
    tolerance: 'none',
    anchor: 0,
    context: 'none',
    ...overrides,
  });
const liveWorsening = (): RednessEvaluationSnapshot => liveScenario({ delta: -20, anchor: -1 });

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

// Rendering guidance writes no evidence: the saved record, its evaluation and the archive stay
// byte-identical and no duplicate record appears. (Load-time normalisation of unrelated empty
// fields, such as a missing burst becoming null, predates this change.)
async function expectSavedEvidenceUnchanged(page: Page, seeded: Record<string, unknown>) {
  const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '{}');
  expect((stored.archive as unknown[]).length).toBe((seeded.archive as unknown[]).length);
  for (const key of ['record', 'archive', 'analysis']) {
    expect(JSON.stringify(stored[key])).toBe(JSON.stringify(seeded[key]));
  }
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
  expect(sealedHtml).not.toContain('Check your skin before you continue');
  await expect(page.locator('[data-safety-guidance]')).toHaveCount(0);

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

  // Safety guidance is on screen without opening anything, and comes before the WHY control.
  const guidance = page.getByRole('note', { name: 'Check your skin before you continue' });
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('The measurements moved in an unfavorable direction.');
  await expect(guidance).toContainText('Matching scan conditions were not measured');
  await expect(guidance).toContainText('Face Value cannot tell whether the product caused it.');
  await expect(guidance).toContainText('Look at how your skin feels before using the product again.');
  await expect(guidance).toContainText('It does not mean continued use has been shown to be safe.');
  await expect(guidance).toBeInViewport();
  // Readable ink, not a faded overlay, and the Save control points assistive tech at the guidance.
  expect(await guidance.locator('p').first().evaluate((el) => getComputedStyle(el).color)).toBe(
    'rgb(41, 36, 30)',
  );
  await expect(page.getByRole('button', { name: 'Save result' })).toHaveAccessibleDescription(
    /Check your skin before you continue/,
  );
  const why = page.getByRole('button', { name: /why this result/i }).first();
  expect(
    await guidance.evaluate(
      (node, whyButton) =>
        Boolean(node.compareDocumentPosition(whyButton as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await why.elementHandle(),
    ),
  ).toBe(true);
  // The action stays the evaluator's, but no longer sits under a bare NEXT caption.
  await expect(firmware).toContainText('EVIDENCE');
  await expect(firmware).not.toContainText(/\bNEXT\b/);

  await why.click();
  const revealed = await visibleText(page);
  expect(revealed).toContain('matching scan conditions were not measured');
  expect(revealed).not.toMatch(/comparable scans|encouraging/i);
});

test('live worsening record makes no comparable or verified claim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = liveWorsening();
  const state = persistedRecordState(snapshot, recordForSnapshot(snapshot));
  await seed(page, state);
  await expect(page.getByText('Visible redness was higher at follow-up.').first()).toBeVisible();
  const resultLayer = await visibleText(page);
  expect(resultLayer).not.toMatch(/comparable scans|COMPARISON VERIFIED|encouraging/i);
  const guidance = page.getByRole('note', { name: 'Check your skin before you continue' });
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('It does not mean continued use has been shown to be safe.');
  await expect(page.locator('[data-canonical-recommendation]').first()).toContainText('EVIDENCE');
  await expectSavedEvidenceUnchanged(page, state);

  await page.getByRole('button', { name: 'Open evidence record' }).first().click();
  const sheet = await visibleText(page);
  expect(sheet).not.toMatch(/comparable scans|COMPARISON VERIFIED|encouraging/i);
});

test('a V1 saved record keeps its saved words and gains the skin check', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = structuredClone(savedV1);
  const state = persistedRecordState(snapshot, recordForSnapshot(snapshot));
  await seed(page, state);
  await expect(
    page.getByText('Visible redness worsened across comparable scans.').first(),
  ).toBeVisible();
  await expect(page.getByRole('note', { name: 'Check your skin before you continue' })).toBeVisible();
  await expectSavedEvidenceUnchanged(page, state);
});

test('neutral guidance sits in the evidence sheet and keeps the approved result fit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = liveScenario({ delta: 20, anchor: 1 });
  await seed(page, persistedRecordState(snapshot, recordForSnapshot(snapshot)));
  const result = page.locator('[data-result-layer="result"]');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-safety-guidance]')).toHaveCount(0);
  expect(await result.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Open evidence record' }).first().click();
  const guidance = page
    .getByRole('dialog', { name: 'Evidence record' })
    .getByRole('note', { name: 'Favorable direction, not proof' });
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('This does not show that the product works.');
});

for (const { name, scenario, title, says } of [
  {
    name: 'reported symptoms',
    scenario: { delta: -20, anchor: -1, tolerance: 'severe' } as Partial<LiveScenario>,
    title: 'Pause the product',
    says: 'pharmacist, doctor, or dermatologist',
  },
  {
    name: 'no detectable change',
    scenario: { delta: 0 } as Partial<LiveScenario>,
    title: 'No change detected',
    says: 'This is not a sign of improvement.',
  },
  {
    name: 'favorable but unproven',
    scenario: { delta: 20, anchor: 1 } as Partial<LiveScenario>,
    title: 'Favorable direction, not proof',
    says: 'This does not show that the product works.',
  },
  {
    name: 'unreadable comparison',
    scenario: { delta: -20, context: 'makeup' } as Partial<LiveScenario>,
    title: 'No result was read',
    says: 'makes no claim about whether redness went up or down',
  },
]) {
  test(`revealed ${name} shows its guidance on screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, sealedStateFor(liveScenario(scenario)));
    await page.getByRole('button', { name: /Reveal sealed result for/i }).press('Enter');
    await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
      'data-oracle-state',
      'verdict_revealed',
      { timeout: 8_000 },
    );
    const guidance = page.getByRole('note', { name: title });
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText(says);
    expect(await visibleText(page)).not.toMatch(/encouraging|promising|comparable scans/i);
  });
}
