import { expect, test, type Page } from '@playwright/test';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

const ORACLE_REVEAL_TIMEOUT_MS = 5_000;
const REDUCED_MOTION_TIMEOUT_MS = 3_000;

async function openPersistedSealedResult(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state: persistedSealedTrial },
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
}

test('reveal handle owns pointer drag without taking page scroll ownership', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPersistedSealedResult(page);
  const handle = page.getByRole('button', {
    name: /Reveal sealed result for Azelaic Topical Acid/i,
  });
  await expect(handle).toHaveCSS('touch-action', 'none');
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).touchAction),
  ).not.toBe('none');

  const box = await handle.boundingBox();
  if (!box) throw new Error('Reveal handle has no layout box.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 38, box.y + box.height / 2 + 1, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'verdict_revealed',
    { timeout: ORACLE_REVEAL_TIMEOUT_MS },
  );
  await expect(page.locator('[data-firmware-state="resolved"]')).toContainText(
    'A small favorable shift showed up.',
  );
  await expect(page).toHaveURL(/\/$/);
});

test('pointer cancellation and lost capture leave the next activation usable', async ({ page }) => {
  await openPersistedSealedResult(page);
  const handle = page.getByRole('button', {
    name: /Reveal sealed result for Azelaic Topical Acid/i,
  });
  await handle.dispatchEvent('pointerdown', {
    pointerId: 7,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  await handle.dispatchEvent('pointercancel', {
    pointerId: 7,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  await expect(handle).toBeVisible();
  await handle.dispatchEvent('pointerdown', {
    pointerId: 8,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  await handle.dispatchEvent('lostpointercapture', { pointerId: 8 });
  await handle.press('Enter');
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'verdict_revealed',
    { timeout: ORACLE_REVEAL_TIMEOUT_MS },
  );
});

test('Escape is deterministic and cannot bypass the sealed or revealed state', async ({ page }) => {
  await openPersistedSealedResult(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
  await page
    .getByRole('button', {
      name: /Reveal sealed result for Azelaic Topical Acid/i,
    })
    .press('Space');
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'verdict_revealed',
    { timeout: ORACLE_REVEAL_TIMEOUT_MS },
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-firmware-state="resolved"]')).toContainText(
    'A small favorable shift showed up.',
  );
  await expect(page.getByRole('button', { name: 'Save result', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep this result', exact: true })).toHaveCount(0);
});

test('reduced motion preserves reveal, atomic release, presentation, and collection', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPersistedSealedResult(page);
  await page
    .getByRole('button', {
      name: /Reveal sealed result for Azelaic Topical Acid/i,
    })
    .press('Enter');
  const machine = page.locator('[data-oracle-machine]');
  await expect(machine).toHaveAttribute('data-oracle-state', 'verdict_revealed', {
    timeout: REDUCED_MOTION_TIMEOUT_MS,
  });

  const saveResult = page.getByRole('button', {
    name: 'Save result',
    exact: true,
  });
  await saveResult.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(machine).toHaveAttribute('data-oracle-state', 'dispensing', {
    timeout: REDUCED_MOTION_TIMEOUT_MS,
  });
  await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
    'data-paper-position',
    'final',
    { timeout: REDUCED_MOTION_TIMEOUT_MS },
  );
  await page
    .getByRole('button', {
      name: /Evidence record for Naturium · Azelaic Topical Acid/i,
    })
    .press('Enter');
  await expect(machine).toHaveAttribute('data-oracle-state', 'collected');
  await expect(page.getByRole('button', { name: 'DONE' })).toBeVisible();
});

test('canceling guided capture releases the fixture and ignores stale completion', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'LOAD PRODUCT' }).click();
  await page.getByLabel('Brand').fill('Experiment');
  await page.getByLabel('Product name').fill('Quiet Serum');
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('READY TO SCAN')).toBeVisible();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
  await page.waitForTimeout(1_100);
  await expect(page.getByText('READY TO SCAN')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('a stalled preview restarts from a fresh tap and Back releases it', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  await page.goto('/?camera-stall=1');
  await page.getByRole('button', { name: 'LOAD PRODUCT' }).click();
  await page.getByLabel('Brand').fill('Experiment');
  await page.getByLabel('Product name').fill('Quiet Serum');
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();

  const restart = page.getByRole('button', { name: 'RESTART CAMERA' });
  await expect(restart).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Preview stalled' })).toBeVisible();
  await expect(page.getByText('Try opening the camera again')).toBeVisible();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);

  await restart.click();
  await expect(page.locator('[data-preview-state="preview-live"]')).toBeVisible();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('READY TO SCAN')).toBeVisible();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
  await page.waitForTimeout(1_100);
  await expect(page.getByText('READY TO SCAN')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('preview-live gates one instruction and the canonical quality rail', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  await page.goto('/?camera-quality-proof=1');
  await page.getByRole('button', { name: 'LOAD PRODUCT' }).click();
  await page.getByLabel('Brand').fill('Experiment');
  await page.getByLabel('Product name').fill('Quiet Serum');
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();

  await expect(page.locator('[data-preview-state="preview-live"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Move slightly closer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Move toward softer light' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hold still' })).toBeVisible();
  const quality = page.getByLabel('Capture quality');
  await expect(quality.locator('[data-quality-state="passed"]')).toHaveCount(3);
  await expect(page.getByText(/Good|Perfect|Success/)).toHaveCount(0);

  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
  await page.waitForTimeout(900);
  await expect(page.getByText('READY TO SCAN')).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
