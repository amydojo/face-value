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
  await expect(page.locator('[data-fv-part="drawer-carousel"], [data-fv-part="drawer-hardware"], .drawerShell')).toHaveCount(0);
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

async function chooseBaselineFile(page: Page, name = 'baseline.jpg') {
  await page.getByLabel('Choose a face photo').setInputFiles({
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Use this capture' }).click();
}

async function openIndexAndSelectSpecimen(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE INDEX' })).toBeVisible();
  await assertNoLegacyHardware(page);

  await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
  await expect(page.getByRole('region', { name: /Evidence cassette selector/i })).toBeVisible();
  await assertNoLegacyHardware(page);

  await page.getByRole('button', { name: /Inspect cassette A1–03/i }).last().click();
  await expect(page.getByRole('heading', { name: /Fermented Brightening Essence/i })).toBeVisible();
  await assertNoLegacyHardware(page);
}

async function assignJobAndCaptureBaseline(page: Page) {
  await openIndexAndSelectSpecimen(page);
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await expect(page.getByText('ASSIGNED EVIDENCE ROLE')).toBeVisible();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await chooseBaselineFile(page);
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
  await assertNoLegacyHardware(page);
}

async function registerInterference(page: Page) {
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }).click();
  await expect(page.getByText('INTERFERENCE REGISTER', { exact: true })).toBeVisible();
  await expect(page.getByText('INTERFERENCE REGISTERED', { exact: true })).toBeVisible();
  await assertNoLegacyHardware(page);
}

async function captureFollowupAndAnalyze(page: Page) {
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseBaselineFile(page, 'followup.jpg');
  await expect(page.getByText(/SIMULATED OPTICAL COMPARISON/i)).toBeVisible();
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await page.getByRole('button', { name: 'Enter verdict review' }).click();
  await expect(page.getByLabel('Evidence cassette instrument')).toBeVisible();
}

async function commitDispositionAndOpenArchive(page: Page) {
  await page.getByRole('button', { name: /Classify evidence disposition/i }).click();
  await expect(page.getByRole('heading', { name: /Give the evidence a place/i })).toBeVisible();
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await expect(page.getByRole('button', { name: 'Generate Evidence Record' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORD' })).toBeVisible();
  await expect(page.getByText('FACE EXCLUDED')).toBeVisible();
  await page.getByRole('button', { name: 'View archive' }).click();
  await expect(page.getByRole('heading', { name: /Every cassette leaves a durable record/i })).toBeVisible();
}

test('complete production journey uses one cassette grammar and produces a durable record', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await assignJobAndCaptureBaseline(page);
  await registerInterference(page);
  await page.getByRole('button', { name: /Remove C2–01 from this window/i }).click();
  await captureFollowupAndAnalyze(page);

  const verdictInstrument = page.getByLabel('Evidence cassette instrument');
  await expect(verdictInstrument).toHaveAttribute('data-cassette-state', 'sealed');
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await expect(verdictInstrument).toHaveAttribute('data-cassette-state', 'presented');
  await page.getByRole('button', { name: 'Close evidence cassette' }).click();
  await expect(verdictInstrument).toHaveAttribute('data-cassette-state', 'sealed');

  await commitDispositionAndOpenArchive(page);
  await page.getByRole('button', { name: /Evidence Record ER-/i }).click();
  await page.getByRole('button', { name: 'Return to Evidence Index' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE INDEX' })).toBeVisible();
  await assertNoLegacyHardware(page);
  await assertNoOverflow(page);
  expect(errors).toEqual([]);
});

test('overlap branch retains lower confidence through verdict, classification, and record', async ({ page }) => {
  await assignJobAndCaptureBaseline(page);
  await registerInterference(page);
  await page.getByRole('button', { name: 'Continue with lower confidence' }).click();
  await captureFollowupAndAnalyze(page);
  await expect(page.getByText(/LOWER CONFIDENCE RETAINED/)).toBeVisible();
  await commitDispositionAndOpenArchive(page);
  await page.getByRole('button', { name: /Evidence Record ER-/i }).click();
  await expect(page.getByText('possible', { exact: true })).toBeVisible();
  await expect(page.getByText('overlap retained', { exact: true })).toBeVisible();
  await assertNoLegacyHardware(page);
});

test('camera denial preserves the cassette context and file fallback', async ({ page, context }) => {
  await context.grantPermissions([], { origin: 'http://127.0.0.1:4173' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
      },
    });
  });
  await openIndexAndSelectSpecimen(page);
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await expect(page.getByLabel(/Cassette A1–03/i)).toBeVisible();
  await page.getByRole('button', { name: 'Request camera access' }).click();
  await expect(page.getByText('CAMERA UNAVAILABLE', { exact: true })).toBeVisible();
  await chooseBaselineFile(page, 'fallback.jpg');
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
});

test('keyboard-only navigation reaches index, selector, capture, verdict, classification, and archive', async ({ page }) => {
  await page.goto('/');
  await keyboardActivate(page, page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('CASSETTE 02 / 03')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await keyboardActivate(page, page.getByRole('button', { name: /Inspect cassette A1–03/i }).last());

  const job = page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true });
  await job.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Complete Capture Contract' }));
  for (const checkbox of await page.getByRole('checkbox').all()) {
    await checkbox.focus();
    await page.keyboard.press('Space');
  }
  await keyboardActivate(page, page.getByRole('button', { name: 'Ready to capture' }));
  await chooseBaselineFile(page);
  await keyboardActivate(page, page.getByRole('button', { name: 'Add Trace' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }));
  await keyboardActivate(page, page.getByRole('button', { name: /Remove C2–01 from this window/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Record a comparable follow-up' }));
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  const comparable = page.getByRole('radio', { name: 'comparable', exact: true });
  await comparable.focus();
  await page.keyboard.press('Space');
  await keyboardActivate(page, page.getByRole('button', { name: 'Continue to follow-up' }));
  await chooseBaselineFile(page, 'followup.jpg');
  await keyboardActivate(page, page.getByRole('button', { name: 'Run simulated comparison' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Enter verdict review' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Open evidence cassette' }));
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute('data-cassette-state', 'presented');
  await keyboardActivate(page, page.getByRole('button', { name: 'Close evidence cassette' }));
  await keyboardActivate(page, page.getByRole('button', { name: /Classify evidence disposition/i }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Commit evidence disposition' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'Generate Evidence Record' }));
  await keyboardActivate(page, page.getByRole('button', { name: 'View archive' }));
  await expect(page.getByRole('heading', { name: /Every cassette leaves a durable record/i })).toBeVisible();
});

test('all supported mobile viewports preserve one scaled assembly, controls, and page scroll', async ({ page }) => {
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
    await assertNoOverflow(page);
    await open.click();
    await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
    await assertNoOverflow(page);
    await expect(page.locator('[data-cassette-selector] > div').first()).toHaveCSS('touch-action', 'pan-y');
    const scrollState = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const before = window.scrollY;
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (maximum > 0) window.scrollTo(0, Math.min(240, maximum));
      return {
        before,
        after: window.scrollY,
        maximum,
        rootOverflowY: rootStyle.overflowY,
        bodyOverflowY: bodyStyle.overflowY,
      };
    });
    expect(scrollState.rootOverflowY).not.toBe('hidden');
    expect(scrollState.bodyOverflowY).not.toBe('hidden');
    if (scrollState.maximum > 0) expect(scrollState.after).toBeGreaterThan(scrollState.before);
  }
});

test('reduced motion preserves selection, presentation, and classification semantics', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await assignJobAndCaptureBaseline(page);
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }).click();
  await page.getByRole('button', { name: /Remove C2–01 from this window/i }).click();
  await captureFollowupAndAnalyze(page);
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute('data-cassette-state', 'presented');
  await page.getByRole('button', { name: 'Close evidence cassette' }).click();
  await page.getByRole('button', { name: /Classify evidence disposition/i }).click();
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await expect(page.getByRole('button', { name: 'Generate Evidence Record' })).toBeVisible();
});

test('captures app-wide cassette migration evidence at canonical and critical viewports', async ({ page }, testInfo: TestInfo) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-entry.png'), fullPage: true });
  await page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-index.png'), fullPage: true });
  await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-browser.png'), fullPage: true });
  await page.getByRole('button', { name: /Inspect cassette A1–03/i }).last().click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-specimen.png'), fullPage: true });
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-job.png'), fullPage: true });
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await chooseBaselineFile(page);
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-observation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-disturbance.png'), fullPage: true });
  await page.getByRole('button', { name: /Remove C2–01 from this window/i }).click();
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseBaselineFile(page, 'followup.jpg');
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-analysis.png'), fullPage: true });
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await page.getByRole('button', { name: 'Enter verdict review' }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-verdict-sealed.png'), fullPage: true });
  await page.getByRole('button', { name: 'Open evidence cassette' }).click();
  await expect(page.getByLabel('Evidence cassette instrument')).toHaveAttribute('data-cassette-state', 'presented');
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-verdict-presented.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close evidence cassette' }).click();
  await page.getByRole('button', { name: /Classify evidence disposition/i }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-placement.png'), fullPage: true });
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-record.png'), fullPage: true });
  await page.getByRole('button', { name: 'View archive' }).click();
  await page.screenshot({ path: testInfo.outputPath('cassette-402x874-archive.png'), fullPage: true });

  for (const viewport of [{ width: 375, height: 812 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }).click();
    await page.screenshot({
      path: testInfo.outputPath(`cassette-${viewport.width}x${viewport.height}-index.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`cassette-${viewport.width}x${viewport.height}-browser.png`),
      fullPage: true,
    });
  }
});
