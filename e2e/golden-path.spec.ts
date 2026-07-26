import { expect, test, type Page, type TestInfo } from '@playwright/test';

const photo = { name: 'skin-frame.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function confirmConditions(page: Page) {
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'READY TO CAPTURE' }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
}

async function reachVerdict(page: Page, testInfo?: TestInfo) {
  await page.getByRole('button', { name: /START A PRODUCT TRIAL/i }).click();
  await expect(page.locator('[data-fv-screen="registration"]')).toBeVisible();
  await page.getByLabel('HYDRATING DROPS').check();
  await page.getByRole('button', { name: /REGISTER PRODUCT/i }).click();
  await expect(page.locator('[data-fv-screen="job-selection"]')).toBeVisible();
  if (testInfo) await screenshot(page, testInfo, '01-awaiting-job');

  await page.getByLabel('Visible Tone Consistency').check();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-primary-owner', 'page');
  await expect(page.locator('[data-evidence-machine]')).toContainText('JOB SELECTED');
  await page.getByRole('button', { name: /ASSIGN THIS JOB/i }).click();
  await expect(page.locator('[data-fv-screen="baseline-required"]')).toBeVisible();
  if (testInfo) await screenshot(page, testInfo, '02-baseline-ready');

  await page.getByRole('button', { name: /Start baseline scan/i }).click();
  await confirmConditions(page);
  await expect(page.locator('[data-fv-screen="baseline-recorded"]')).toBeVisible();
  if (testInfo) await screenshot(page, testInfo, '03-baseline-recorded');
  await page.getByRole('button', { name: /BEGIN TRIAL/i }).click();

  await expect(page.locator('[data-fv-screen="follow-up-required"]')).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: /Start follow-up scan/i }).click();
  await confirmConditions(page);
  await expect(page.locator('[data-fv-screen="processing"]')).toBeVisible();
  if (testInfo) await screenshot(page, testInfo, '04-processing');
  await expect(page.locator('[data-fv-screen="verdict-ready"]')).toBeVisible({ timeout: 3000 });
  if (testInfo) await screenshot(page, testInfo, '05-verdict-ready');
}

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('complete Evidence Machine journey dispenses, collects, details, and files one object', async ({ page }: { page: Page }, testInfo: TestInfo) => {
  await reachVerdict(page, testInfo);

  const releaseButton = page.getByRole('button', { name: /Release Evidence Record/i });
  await releaseButton.click();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'actuator-pressed');
  await screenshot(page, testInfo, '06-actuator-pressed');

  await page.waitForTimeout(120);
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-door-state', 'released');
  await screenshot(page, testInfo, '07-latch-releasing');

  await page.waitForTimeout(120);
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-dispense-step', 'edge');
  await screenshot(page, testInfo, '08-artifact-edge');

  await page.waitForTimeout(130);
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-dispense-step', 'feed-40');
  await screenshot(page, testInfo, '09-dispense-40');

  await page.waitForTimeout(230);
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-dispense-step', 'alignment');
  await screenshot(page, testInfo, '10-alignment-pause');

  await page.waitForTimeout(120);
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-dispense-step', 'feed-70');
  await screenshot(page, testInfo, '11-dispense-70');

  await expect(page.locator('[data-fv-screen="record-presented"]')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: /Collect Evidence Record/i })).toBeVisible();
  await screenshot(page, testInfo, '12-record-presented');
  await page.getByRole('button', { name: /Collect Evidence Record/i }).click();

  await expect(page.locator('[data-fv-screen="record-collected"]')).toBeVisible({ timeout: 1500 });
  await expect(page.getByText('EVIDENCE RECORD 014')).toBeVisible();
  await screenshot(page, testInfo, '13-collected-artifact');

  await page.getByRole('button', { name: /VIEW EVIDENCE DETAIL/i }).click();
  await expect(page.locator('[data-fv-screen="evidence-detail"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OBSERVED' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NOT ESTABLISHED' })).toBeVisible();
  await screenshot(page, testInfo, '14-detail-open');
  await page.getByRole('button', { name: /Your evidence/i }).click();

  await page.getByLabel('S4 · Established routine').check();
  await expect(page.locator('main')).toHaveAttribute('data-app-phase', 'complete');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('face-value:evidence-machine:v2') ?? '{}'));
  expect(persisted.archive).toHaveLength(1);
  expect(persisted.trial.evidenceRecord.productName).toBe('HYDRATING DROPS');
  expect(persisted.trial.evidenceRecord.finding.summary).toBe('SLIGHTLY IMPROVED');
});

test('rapid double press creates one record and one presentation', async ({ page }: { page: Page }) => {
  await reachVerdict(page);
  const release = page.getByRole('button', { name: /Release Evidence Record/i });
  await release.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(page.locator('[data-fv-screen="record-presented"]')).toBeVisible({ timeout: 2000 });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('face-value:evidence-machine:v2') ?? '{}'));
  expect(state.trial.evidenceRecord.id).toContain('ER-014');
  expect(state.archive).toHaveLength(0);
  await expect(page.locator('[data-record-id]')).toHaveCount(1);
});

test('refresh while partially presented restores the same collectible object', async ({ page }: { page: Page }) => {
  await reachVerdict(page);
  await page.getByRole('button', { name: /Release Evidence Record/i }).click();
  await expect(page.locator('[data-fv-screen="record-presented"]')).toBeVisible({ timeout: 2000 });
  const recordId = await page.locator('[data-record-id]').getAttribute('data-record-id');
  await page.reload();
  await expect(page.locator('[data-fv-screen="record-presented"]')).toBeVisible();
  await expect(page.locator(`[data-record-id="${recordId}"]`)).toBeVisible();
  await expect(page.getByRole('button', { name: /Collect Evidence Record/i })).toBeVisible();
});

test('back navigation returns from archive to the durable collected artifact', async ({ page }: { page: Page }) => {
  await reachVerdict(page);
  await page.getByRole('button', { name: /Release Evidence Record/i }).click();
  await expect(page.getByRole('button', { name: /Collect Evidence Record/i })).toBeVisible({ timeout: 2000 });
  await page.getByRole('button', { name: /Collect Evidence Record/i }).click();
  await expect(page.locator('[data-fv-screen="record-collected"]')).toBeVisible({ timeout: 1200 });
  await page.getByRole('button', { name: 'Past evidence' }).click();
  await expect(page.locator('[data-fv-screen="archive"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-fv-screen="record-collected"]')).toBeVisible();
  await expect(page.getByText('EVIDENCE RECORD 014')).toBeVisible();
});
