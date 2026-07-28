import { expect, test, type Page } from '@playwright/test';
import {
  DEMO_JOURNEY_STORAGE_KEY,
  DEMO_PREVIEW_SESSION_KEY,
} from '../src/adapters/persistence/demoJourneyStore';
import { STORAGE_KEY, persistedSealedTrial } from './phase-b5-fixtures';

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openPreview(
  page: Page,
  startingPoint: string,
  resultFixture = 'clear_favorable_change',
): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('combobox', { name: /Result fixture/ }).selectOption(resultFixture);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Synthetic demo state')).toContainText('SYNTHETIC DEMO DATA');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    {
      key: STORAGE_KEY,
      value: persistedSealedTrial,
    },
  );
});

test('flagged development exposes one accessible Demo Lab without mobile overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');

  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Preview state/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Load demo journey/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Starting point/ })).toHaveValue(
    'followup_ready',
  );
  await expect(page.getByRole('combobox', { name: /Result fixture/ })).toHaveValue(
    'clear_favorable_change',
  );
  await expect(page.getByRole('button', { name: 'RUN REAL-CAMERA JOURNEY' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CLEAR DEMO DATA' })).toBeDisabled();

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('preview state is one-shot and leaves ordinary trial persistence unchanged', async ({
  page,
}) => {
  await page.goto('/demo');
  const ordinaryBefore = await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, STORAGE_KEY);

  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('home_saved_result');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();

  await expect(page.getByLabel('Synthetic demo state')).toContainText('PREVIEW · RESETS ON RELOAD');
  await expect(page.locator('[data-latest-verdict-record]')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), DEMO_PREVIEW_SESSION_KEY))
    .toBeNull();

  await page.reload();
  await expect(page.getByLabel('Synthetic demo state')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
});

test('persistent journey survives reload and keeps Home, Previous Trials, and saved result aligned', async ({
  page,
}) => {
  await page.goto('/demo');
  await page.getByRole('radio', { name: /Load demo journey/ }).check();
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('home_saved_result');
  await page.getByRole('combobox', { name: /Result fixture/ }).selectOption('product_overlap');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Replace isolated demo journey data?',
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole('button', { name: 'CONFIRM AND LOAD' }).click();

  await expect(page).toHaveURL(/\?fv-demo-journey=1$/);
  await expect(page.getByLabel('Synthetic demo state')).toContainText('LOADED DEMO JOURNEY');
  const latestRecord = page.locator('[data-latest-verdict-record]');
  await expect(latestRecord).toBeVisible();
  const recordId = await latestRecord.getAttribute('data-record-id');
  const finding = await latestRecord.locator('[data-evidence-finding]').innerText();
  const identity = await latestRecord.locator('[data-oracle-trial-identity]').innerText();

  await page.reload();
  await expect(page.getByLabel('Synthetic demo state')).toContainText('LOADED DEMO JOURNEY');
  await expect(page.locator(`[data-record-id="${recordId}"]`)).toBeVisible();

  await page
    .getByRole('button', {
      name: /Previous trials, 1 saved result/,
    })
    .click();
  const archivedRecord = page.locator(`[data-archive-record][data-record-id="${recordId}"]`);
  await expect(archivedRecord).toContainText(identity);
  expect((await archivedRecord.innerText()).toLowerCase()).toContain(finding.toLowerCase());
  await archivedRecord.click();

  await expect(page.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();
  await expect(page.getByLabel(`Saved result ${recordId}`)).toContainText(identity);
  expect((await page.getByLabel(`Saved result ${recordId}`).innerText()).toLowerCase()).toContain(
    finding.toLowerCase(),
  );

  const serializedDemo = await page.evaluate(
    (key) => localStorage.getItem(key),
    DEMO_JOURNEY_STORAGE_KEY,
  );
  expect(serializedDemo).toContain('"origin":"face-value-demo-lab"');
  expect(serializedDemo).toContain('"demoOriginated":true');
  expect(serializedDemo).not.toMatch(/data:image|blob:|base64|imageBytes|objectURL|MediaStream/);
  await assertNoHorizontalOverflow(page);
});

test('core synthetic starting points open real production screens', async ({ page }) => {
  await openPreview(page, 'followup_ready');
  await expect(page.locator('[data-fv-screen="followup-ready"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TAKE FOLLOW-UP' })).toBeVisible();

  await openPreview(page, 'comparison_processing');
  await expect(
    page.getByRole('heading', {
      name: 'Comparing against your baseline…',
    }),
  ).toBeVisible();
  await page.waitForTimeout(750);
  await expect(
    page.getByRole('heading', {
      name: 'Comparing against your baseline…',
    }),
  ).toBeVisible();

  await openPreview(page, 'verdict_ready');
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'sealed',
  );

  await openPreview(page, 'evidence_recorded');
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORDED' })).toBeVisible();

  await openPreview(page, 'saved_result');
  await expect(page.locator('[data-fv-screen="saved-result"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'View previous trials' })).toBeVisible();
});

test('real-camera utility opens the ordinary journey without synthetic state', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'RUN REAL-CAMERA JOURNEY' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Synthetic demo state')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
});

test('clear demo data removes only the isolated demo envelope', async ({ page }) => {
  await page.goto('/demo');
  const ordinaryBefore = await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, STORAGE_KEY);
  await page.getByRole('radio', { name: /Load demo journey/ }).check();
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('previous_trials');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await page.getByRole('button', { name: 'CONFIRM AND LOAD' }).click();
  await expect(page.getByLabel('Synthetic demo state')).toBeVisible();

  await page.getByRole('link', { name: 'LAB' }).click();
  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  const ordinaryBeforeClear = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.getByRole('button', { name: 'CLEAR DEMO DATA' }).click();

  expect(
    await page.evaluate((key) => localStorage.getItem(key), DEMO_JOURNEY_STORAGE_KEY),
  ).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    ordinaryBeforeClear,
  );
  expect(ordinaryBeforeClear).toBe(ordinaryBefore);
  await expect(page.getByRole('status')).toContainText('Ordinary saved trials were not changed.');
});
