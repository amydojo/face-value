import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openPreview(page: Page, startingPoint: string): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'preview',
  );
}

test('baseline capture context stays inside the light-bench instrument and continues to baseline locked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'baseline_context');

  const context = page.locator('[data-fv-screen="baseline-context"]');
  await expect(context).toBeVisible();
  await expect(context.locator('[data-cassette-variant="trial-truth"]')).toBeVisible();
  await expect(context.locator('[data-capture-context-question]')).toBeVisible();
  await expect(context.getByText('BASELINE SECURED', { exact: true })).toBeVisible();
  await expect(
    context.getByRole('heading', { name: 'Anything meaningfully different today?' }),
  ).toBeVisible();
  await expect(context.getByLabel('Makeup')).toBeVisible();
  await expect(context.getByLabel('Recent heat or exercise')).toBeVisible();
  await expect(context.getByLabel('Recent cleansing or skincare')).toBeVisible();
  await expect(context.getByLabel('Routine or treatment change')).toBeVisible();
  await expect(context.getByRole('button', { name: 'NOTHING DIFFERENT' })).toBeVisible();
  await expect(context.locator('[data-oracle-specimen]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await context.getByLabel('Makeup').check();
  await expect(context.getByRole('button', { name: 'SAVE CONTEXT' })).toBeVisible();
  await context.getByRole('button', { name: 'SAVE CONTEXT' }).click();

  const locked = page.locator('[data-fv-screen="baseline-locked"]');
  await expect(locked).toBeVisible();
  await expect(locked.getByText('BASELINE LOCKED', { exact: true })).toBeVisible();
  await expect(locked.getByRole('heading', { name: 'That’s everything for today.' })).toBeVisible();
  await expect(locked.getByText('NOW', { exact: true })).toBeVisible();
  await expect(locked.getByText('NEXT SCAN', { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('comparison preserves follow-up as one typographic unit at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'comparison_processing');

  const heading = page.getByRole('heading', { name: 'Baseline ↔ follow-up' });
  const followUp = heading.locator('span');
  await expect(heading).toBeVisible();
  await expect(followUp).toHaveText('follow-up');
  expect(await followUp.evaluate((node) => node.getClientRects().length)).toBe(1);
  await assertNoHorizontalOverflow(page);
});

test('follow-up capture context stays inside the same trial machine and continues toward analysis', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'followup_context');

  const trialTruth = page.locator('[data-fv-screen="trial-truth"]');
  await expect(trialTruth).toBeVisible();
  await expect(page.locator('[data-cassette-variant="trial-truth"]')).toBeVisible();
  await expect(page.getByText('FOLLOW-UP SECURED', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Anything different around today’s scan?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'NOTHING DIFFERENT' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ADD CONTEXT' })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'ADD CONTEXT' }).click();
  await expect(page.getByRole('heading', { name: 'What was different?' })).toBeVisible();
  await expect(page.getByLabel('Makeup')).toBeVisible();
  await expect(page.getByLabel('Recent heat or exercise')).toBeVisible();
  await expect(page.getByLabel('Recent cleansing or skincare')).toBeVisible();
  await expect(page.getByLabel('Routine or treatment change')).toBeVisible();
  await page.getByLabel('Recent heat or exercise').check();
  await page.getByRole('button', { name: 'Save capture context' }).click();

  await expect(
    page.getByRole('heading', { name: 'Anything different around today’s scan?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'See result' }).click();
  await expect(trialTruth).toHaveCount(0);
  await expect(
    page.locator('[data-fv-screen="comparing"], [data-fv-screen="oracle-reveal"]'),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
