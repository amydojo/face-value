import { expect, test, type Page, type TestInfo } from '@playwright/test';

const photo = { name: 'frame.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };
async function capture(page: Page) {
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(8);
  for (let index = 0; index < 8; index += 1) await checkboxes.nth(index).check();
  await expect(page.getByRole('button', { name: 'READY TO CAPTURE' })).toBeEnabled();
  await page.getByRole('button', { name: 'READY TO CAPTURE' }).click();
  await page.locator('input[type=file]').setInputFiles(photo);
}
async function verdict(page: Page) {
  await page.getByRole('button', { name: /START A PRODUCT TRIAL/i }).click();
  await page.getByRole('button', { name: /REGISTER PRODUCT/i }).click();
  await page.getByLabel('Visible Tone Consistency').check();
  await page.getByRole('button', { name: /ASSIGN THIS JOB/i }).click();
  await page.getByRole('button', { name: /Start baseline scan/i }).click();
  await capture(page);
  await page.getByRole('button', { name: /BEGIN TRIAL/i }).click();
  await expect(page.getByRole('button', { name: /Start follow-up scan/i })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: /Start follow-up scan/i }).click();
  await capture(page);
  await expect(page.getByRole('button', { name: /Release Evidence Record/i })).toBeVisible({ timeout: 3000 });
}

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('release failure preserves evidence and one retry completes', async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await page.goto('/?releaseFailure=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await verdict(page);
  await page.getByRole('button', { name: /Release Evidence Record/i }).click();
  await expect(page.locator('[data-fv-screen="release-error"]')).toBeVisible({ timeout: 1500 });
  await expect(page.getByText(/Evidence preserved/i)).toBeVisible();
  await shot(page, testInfo, '15-release-error');
  await page.getByRole('button', { name: /Retry Evidence Record release/i }).click();
  await expect(page.getByRole('button', { name: /Collect Evidence Record/i })).toBeVisible({ timeout: 2000 });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('face-value:evidence-machine:v2') ?? '{}'));
  expect(state.trial.baselineScan).toBeTruthy();
  expect(state.trial.followUpScan).toBeTruthy();
  expect(state.trial.evidenceRecord.id).toContain('ER-014');
});

test('processing failure retries without losing the trial', async ({ page }: { page: Page }) => {
  await page.goto('/?processingFailure=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await verdict(page).catch(() => undefined);
  await expect(page.locator('[data-fv-screen="processing-error"]')).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: /Retry evidence processing/i }).click();
  await expect(page.getByRole('button', { name: /Release Evidence Record/i })).toBeVisible({ timeout: 3000 });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('face-value:evidence-machine:v2') ?? '{}'));
  expect(state.trial.product.name).toBe('HYDRATING DROPS');
  expect(state.trial.assignedJob).toBe('Visible Tone Consistency');
  expect(state.trial.baselineScan).toBeTruthy();
  expect(state.trial.followUpScan).toBeTruthy();
});

test('reduced motion preserves production, presentation, and collection meaning', async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await verdict(page);
  await page.getByRole('button', { name: /Release Evidence Record/i }).click();
  await expect(page.getByRole('button', { name: /Collect Evidence Record/i })).toBeVisible({ timeout: 900 });
  await shot(page, testInfo, '16-reduced-motion-presented');
  await page.getByRole('button', { name: /Collect Evidence Record/i }).press('Enter');
  await expect(page.locator('[data-fv-screen="record-collected"]')).toBeVisible({ timeout: 900 });
});

test('machine stays usable with browser chrome reducing available height', async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await verdict(page);
  await expect(page.getByRole('button', { name: /Release Evidence Record/i })).toBeInViewport();
  await shot(page, testInfo, '17-short-viewport-verdict');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
