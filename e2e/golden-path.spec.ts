import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const forbiddenVisibleCopy = /Evidence Fridge|\bfridge\b|\bcabinet\b|\bdrawer\b|cooling shelf|return to cooling|re-shelve/i;

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function keyboardActivate(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Enter');
}

async function assertNoLegacyHardware(page: Page) {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(forbiddenVisibleCopy);
  expect(visibleText).not.toContain('9:41');
  await expect(page.locator('[data-fv-part="status-bar"]')).toHaveCount(0);
  await expect(page.locator('[data-fv-part="drawer-carousel"], [data-fv-part="drawer-hardware"], .drawerShell')).toHaveCount(0);
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

async function chooseCapture(page: Page, name = 'baseline.jpg') {
  await page.getByLabel('Choose a face photo').setInputFiles({
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Use this capture' }).click();
}

async function selectSpecimen(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE INDEX' })).toBeVisible();
  await assertNoLegacyHardware(page);
  await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
  await expect(page.getByRole('region', { name: /Evidence cassette selector/i })).toBeVisible();
  await page.getByRole('button', { name: /Open evidence cassette A1–03/i }).click();
  await expect(page.getByRole('heading', { name: /Fermented Brightening Essence/i })).toBeVisible();
}

async function createObservation(page: Page) {
  await selectSpecimen(page);
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await chooseCapture(page);
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
}

async function createVerdict(page: Page, overlap = false) {
  await createObservation(page);
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }).click();
  if (overlap) {
    await page.getByRole('button', { name: 'Continue with lower confidence' }).click();
  } else {
    await page.getByRole('button', { name: /Remove C2–01 from this window/i }).click();
  }
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseCapture(page, 'followup.jpg');
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await page.getByRole('button', { name: 'Enter verdict review' }).click();
  await expect(page.locator('[data-fv-screen="verdict"]')).toBeVisible();
}

async function commitAndRecord(page: Page, placement: 'established' | 'retry_alone') {
  await page.getByRole('button', { name: /Classify evidence disposition/i }).click();
  const disposition = page.locator('[data-fv-part="evidence-disposition"]');
  await expect(disposition).toHaveAttribute('data-fv-selected-placement', placement);
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await expect(page.getByRole('button', { name: 'Generate Evidence Record' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORD' })).toBeVisible();
}

test('complete production journey uses one cassette grammar and produces a durable record', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await createVerdict(page);

  const instrument = page.getByLabel('Evidence cassette instrument');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');
  await page.getByRole('button', { name: /Open evidence cassette A1–03/ }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await page.getByRole('button', { name: /Close evidence cassette A1–03/ }).click();
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');

  await commitAndRecord(page, 'established');
  await expect(page.getByRole('definition').filter({ hasText: 'S4 · Established routine' })).toBeVisible();
  await expect(page.getByText('FACE EXCLUDED')).toBeVisible();
  await page.getByRole('button', { name: 'View archive' }).click();
  await expect(page.getByLabel('Archived evidence records').getByRole('button')).toHaveCount(1);
  await assertNoLegacyHardware(page);
  await assertNoOverflow(page);
  expect(errors).toEqual([]);
});

test('overlap retains lower confidence and maps to retry alone', async ({ page }) => {
  await createVerdict(page, true);
  await expect(page.getByText('LOWER CONFIDENCE RETAINED')).toBeVisible();
  await commitAndRecord(page, 'retry_alone');
  await expect(page.getByRole('definition').filter({ hasText: 'possible' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'overlap retained' })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'R3 · Retry alone' })).toBeVisible();
});

test('camera denial preserves cassette context and file fallback', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://127.0.0.1:4173' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
      },
    });
  });
  await selectSpecimen(page);
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await page.getByRole('button', { name: 'Request camera access' }).click();
  await expect(page.getByText('CAMERA UNAVAILABLE', { exact: true })).toBeVisible();
  await chooseCapture(page, 'fallback.jpg');
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
});

test('keyboard-only activation reaches verdict, classification, and archive', async ({ page }) => {
  await page.goto('/');
  await keyboardActivate(page, page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }));
  await keyboardActivate(page, page.getByRole('button', { name: /Open evidence cassette A1–03/i }));
  const job = page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true });
  await job.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Complete Capture Contract' }));
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await keyboardActivate(page, page.getByRole('button', { name: 'Ready to capture' }));
  await chooseCapture(page);
  await keyboardActivate(page, page.getByRole('button', { name: 'Add Trace' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }));
  await keyboardActivate(page, page.getByRole('button', { name: /Remove C2–01 from this window/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Record a comparable follow-up' }));
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await keyboardActivate(page, page.getByRole('button', { name: 'Continue to follow-up' }));
  await chooseCapture(page, 'followup.jpg');
  await keyboardActivate(page, page.getByRole('button', { name: 'Run simulated comparison' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Enter verdict review' }));
  await page.getByRole('button', { name: /Open evidence cassette A1–03/ }).press('Space');
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute('data-cassette-state', 'presented');
  await keyboardActivate(page, page.getByRole('button', { name: /Close evidence cassette A1–03/ }));
  await keyboardActivate(page, page.getByRole('button', { name: /Classify evidence disposition/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Commit evidence disposition' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Generate Evidence Record' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'View archive' }));
  await expect(page.getByRole('heading', { name: /Every cassette leaves a durable record/i })).toBeVisible();
});

test('supported mobile viewports preserve controls, fit, and page scroll', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const open = page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i });
    const box = await open.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    await open.click();
    await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
    await expect(page.getByRole('button', { name: /Open evidence cassette A1–03/ })).toHaveCSS('touch-action', 'none');
    const scrollState = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const before = window.scrollY;
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(240, maximum));
      return { before, after: window.scrollY, maximum, root: rootStyle.overflowY, body: bodyStyle.overflowY };
    });
    expect(scrollState.root).not.toBe('hidden');
    expect(scrollState.body).not.toBe('hidden');
    if (scrollState.maximum > 0) expect(scrollState.after).toBeGreaterThan(scrollState.before);
    await assertNoOverflow(page);
  }
});

test('captures critical V7 mobile evidence', async ({ page }, testInfo: TestInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 402, height: 874 });
  await createVerdict(page);
  await page.screenshot({ path: testInfo.outputPath('v7-verdict-sealed.png'), fullPage: true });
  await page.getByRole('button', { name: /Open evidence cassette A1–03/ }).click();
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute('data-cassette-state', 'presented');
  await page.screenshot({ path: testInfo.outputPath('v7-verdict-presented.png'), fullPage: true });
  await page.getByRole('button', { name: /Close evidence cassette A1–03/ }).click();
  await page.getByRole('button', { name: /Classify evidence disposition/i }).click();
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await page.screenshot({ path: testInfo.outputPath('v7-classified-resealed.png'), fullPage: true });
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await page.screenshot({ path: testInfo.outputPath('v7-evidence-record.png'), fullPage: true });
});
