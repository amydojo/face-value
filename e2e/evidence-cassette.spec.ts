import { expect, test, type Page, type TestInfo } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function openCassette(page: Page) {
  const instrument = page.getByLabel('Evidence cassette instrument');
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  return instrument;
}

async function captureOpeningStates(page: Page, testInfo: TestInfo, prefix: string) {
  const instrument = page.getByLabel('Evidence cassette instrument');
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-sealed.png`), fullPage: true });
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'released');
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-released.png`), fullPage: true });
  await expect(instrument).toHaveAttribute('data-cassette-state', 'tilting');
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-micro-tilted.png`), fullPage: true });
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-presented.png`), fullPage: true });
}

test('direct verdict route opens, presents, explains, and reseals without runtime errors', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/verdict');

  const instrument = page.getByLabel('Evidence cassette instrument');
  await expect(instrument).toBeVisible();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');
  await expect(page.getByText('Earning its place.')).toBeVisible();

  const handle = page.getByRole('button', { name: 'Open evidence cassette' });
  await handle.click();
  await handle.dispatchEvent('click');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(instrument).toHaveAttribute('data-glass-cleared', 'true');
  await expect(page.getByRole('button', { name: 'Edit product trial details' })).toBeVisible();

  await page.getByRole('button', { name: 'Close evidence cassette' }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');

  await page.getByRole('button', { name: 'WHY THIS VERDICT' }).click();
  await expect(page.getByText(/longitudinal visual evidence/i)).toBeVisible();
  const primaryAction = page.getByRole('button', { name: /Keep it/i });
  await expect(primaryAction).toBeVisible();
  await primaryAction.click();
  await expect(page.getByRole('button', { name: 'Open the Evidence Fridge' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('tap, drag, and keyboard share one deterministic transition model', async ({ page }) => {
  await page.goto('/verdict');
  const instrument = page.getByLabel('Evidence cassette instrument');
  const handle = page.getByRole('button', { name: 'Open evidence cassette' });
  const box = await handle.boundingBox();
  if (!box) throw new Error('Evidence cassette handle has no layout box.');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 14, box.y + box.height / 2 + 1);
  await page.mouse.up();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2 + 1, { steps: 2 });
  await page.mouse.up();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');

  await page.getByRole('button', { name: 'Close evidence cassette' }).focus();
  await page.keyboard.press('Enter');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');

  await handle.focus();
  await page.keyboard.press('Space');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
});

test('reduced motion reaches the same semantic state without 3D tilt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/verdict');
  const instrument = await openCassette(page);
  const cassetteTransform = await page.locator('[class*="cassetteModule"]').evaluate((node) =>
    getComputedStyle(node).transform,
  );
  expect(cassetteTransform).not.toContain('matrix3d');
  await page.getByRole('button', { name: 'Close evidence cassette' }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');
});

test('supported mobile viewports preserve geometry, actions, and horizontal fit', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/verdict');
    const handle = page.getByRole('button', { name: 'Open evidence cassette' });
    const handleBox = await handle.boundingBox();
    expect(handleBox?.width).toBeGreaterThanOrEqual(60);
    expect(handleBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await openCassette(page);
    await expect(page.getByRole('button', { name: /Keep it/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WHY THIS VERDICT' })).toBeVisible();
  }
});

test('route changes and resize during motion leave no orphaned interaction state', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/verdict');
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute(
    'data-cassette-state',
    'presented',
  );

  await page.reload();
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open the Evidence Fridge' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('captures required V7 visual evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/verdict');
  await captureOpeningStates(page, testInfo, 'evidence-cassette-402x874');

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/verdict');
    await page.screenshot({
      path: testInfo.outputPath(`evidence-cassette-${viewport.width}x${viewport.height}-sealed.png`),
      fullPage: true,
    });
    await openCassette(page);
    await page.screenshot({
      path: testInfo.outputPath(`evidence-cassette-${viewport.width}x${viewport.height}-presented.png`),
      fullPage: true,
    });
  }
});
