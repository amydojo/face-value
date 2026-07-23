import { expect, test, type Locator, type Page } from '@playwright/test';

async function keyboardActivate(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Enter');
}

async function settleMotion(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        // Infinite or already-idle animations are not part of the cabinet contract.
      }
    }
    window.scrollTo(0, 0);
  });
}

async function openAndBaseline(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the Evidence Fridge' }).click();
  await page.getByRole('button', { name: 'Browse indexed drawers' }).click();
  await page.getByRole('button', { name: /Open A1–03 drawer/ }).click();
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'baseline.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Use this capture' }).click();
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Introduce C2–01/ }).click();
}

async function followup(page: Page) {
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'followup.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Use this capture' }).click();
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
}

test('Flow A returns the second product to Cooling and generates an Evidence Record', async ({ page }) => {
  await openAndBaseline(page);
  await page.getByRole('button', { name: 'Return C2–01 to Cooling' }).click();
  await followup(page);
  await page.getByRole('button', { name: 'Enter Progress Mode' }).click();
  await page.getByRole('button', { name: /Re-shelve the product/ }).click();
  await page.getByRole('button', { name: 'Seal placement' }).click();
  await expect(page.getByText(/PLACEMENT SEALED/)).toBeVisible();
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORD' })).toBeVisible();
  await expect(page.getByText('FACE EXCLUDED')).toBeVisible();
  await page.getByRole('button', { name: 'View archive' }).click();
  await expect(page.getByRole('heading', { name: /archive keeps what survived observation/i })).toBeVisible();
  await page.getByRole('button', { name: /Evidence Record ER-/i }).click();
  await page.getByRole('button', { name: 'Return to cabinet' }).click();
  await expect(page.getByRole('heading', { name: 'CABINET' })).toBeVisible();
});

test('Flow B retains lower confidence through the record', async ({ page }, testInfo) => {
  await openAndBaseline(page);
  await page.getByRole('button', { name: 'Continue with lower confidence' }).click();
  await followup(page);
  await page.getByRole('button', { name: 'Enter Progress Mode' }).click();
  await expect(page.getByText(/LOWER CONFIDENCE RETAINED/)).toBeVisible();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-overlap-progress-mode.png') });
  await page.getByRole('button', { name: /Re-shelve the product/ }).click();
  await page.getByRole('button', { name: 'Seal placement' }).click();
  await expect(page.getByText(/PLACEMENT SEALED/)).toBeVisible();
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await expect(page.getByText('possible', { exact: true })).toBeVisible();
  await expect(page.getByText('overlap retained', { exact: true })).toBeVisible();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-overlap-evidence-record.png') });
});

test('Flow C camera denial keeps file fallback usable', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://127.0.0.1:4173' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the Evidence Fridge' }).click();
  await page.getByRole('button', { name: 'Browse indexed drawers' }).click();
  await page.getByRole('button', { name: /Open A1–03 drawer/ }).click();
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await page.getByRole('button', { name: 'Request camera access' }).click();
  await expect(page.getByText('CAMERA UNAVAILABLE', { exact: true })).toBeVisible();
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'fallback.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Use this capture' }).click();
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
});

test('Flow D refuses a not-comparable follow-up without a progress conclusion', async ({ page }) => {
  await openAndBaseline(page);
  await page.getByRole('button', { name: 'Return C2–01 to Cooling' }).click();
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'not comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Refuse progress comparison' }).click();
  await expect(page.getByText('No progress conclusion was generated.')).toBeVisible();
  await page.getByRole('button', { name: 'Save as context only' }).click();
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
});

test('Flow E preserves the observation when analysis fails', async ({ page }) => {
  await openAndBaseline(page);
  await page.getByRole('button', { name: 'Return C2–01 to Cooling' }).click();
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'followup.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Use this capture' }).click();
  await page.getByLabel('Analysis fixture').selectOption('failure');
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await expect(page.getByText('Your observation is still saved.')).toBeVisible();
  await expect(page.getByText(/No finding was fabricated/)).toBeVisible();
});

test('responsive extremes avoid horizontal overflow and preserve 44px actions', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 812 },
    { width: 375, height: 812 },
    { width: 393, height: 852 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const open = page.getByRole('button', { name: 'Open the Evidence Fridge' });
    const box = await open.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test('reduced motion keeps state changes immediate and legible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open the Evidence Fridge' }).click();
  await page.getByRole('button', { name: 'Browse indexed drawers' }).click();
  const drawer = page.getByRole('region', { name: /Drawer hardware state: selected/i });
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
  await expect(page.getByText('DRAWER 01 / 03')).toBeVisible();
});

test('Flow I supports keyboard-only cabinet, drawer, progress, placement, archive, and return navigation', async ({ page }) => {
  await page.goto('/');
  await keyboardActivate(page, page.getByRole('button', { name: 'Open the Evidence Fridge' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Browse indexed drawers' }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('DRAWER 02 / 03')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await keyboardActivate(page, page.getByRole('button', { name: /Open A1–03 drawer/ }));
  const job = page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true });
  await job.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Complete Capture Contract' }));
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await checkbox.focus();
    await page.keyboard.press('Space');
  }
  await keyboardActivate(page, page.getByRole('button', { name: 'Ready to capture' }));
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'baseline.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await keyboardActivate(page, page.getByRole('button', { name: 'Use this capture' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Add Trace' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Introduce C2–01/ }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Return C2–01 to Cooling' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Record a comparable follow-up' }));
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await checkbox.focus();
    await page.keyboard.press('Space');
  }
  const comparable = page.getByRole('radio', { name: 'comparable', exact: true });
  await comparable.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Continue to follow-up' }));
  await page.getByLabel('Choose a face photo').setInputFiles({ name: 'followup.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture') });
  await keyboardActivate(page, page.getByRole('button', { name: 'Use this capture' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Run simulated comparison' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Enter Progress Mode' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Re-shelve the product/ }));
  const paused = page.getByRole('radio', { name: /P1 PAUSED/i });
  await paused.focus();
  await page.keyboard.press('Space');
  const established = page.getByRole('radio', { name: /S4 ESTABLISHED/i });
  await established.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Seal placement' }));
  await expect(page.getByText(/PLACEMENT SEALED/)).toBeVisible();
  await keyboardActivate(page, page.getByRole('button', { name: 'Generate Evidence Record' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'View archive' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Evidence Record ER-/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Return to cabinet' }));
  await expect(page.getByRole('heading', { name: 'CABINET' })).toBeVisible();
});

test('captures the canonical implementation states for parity review', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/?holdPlacementMotion=1');
  await page.getByRole('button', { name: 'Open the Evidence Fridge' }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-cabinet.png') });
  await page.getByRole('button', { name: 'Browse indexed drawers' }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-drawer-browser.png') });

  await page.getByRole('button', { name: /Open A1–03 drawer/ }).click();
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-drawer-open.png') });
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await page.getByLabel('Choose a face photo').setInputFiles({
    name: 'baseline.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Use this capture' }).click();
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Introduce C2–01/ }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-two-products-active.png') });

  await page.getByRole('button', { name: 'Return C2–01 to Cooling' }).click();
  await followup(page);
  await page.getByRole('button', { name: 'Enter Progress Mode' }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-progress-mode.png') });
  await page.getByRole('button', { name: /Re-shelve the product/ }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-reshelving.png') });
  await page.getByRole('button', { name: 'Seal placement' }).click();
  await expect(page.getByRole('button', { name: 'Complete placement transfer' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('visual-drawer-moving.png') });
  await page.getByRole('button', { name: 'Complete placement transfer' }).click();
  await expect(page.getByText(/PLACEMENT SEALED/)).toBeVisible();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-placement-sealed.png') });
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await settleMotion(page);
  await page.screenshot({ path: testInfo.outputPath('visual-evidence-record.png') });
});
