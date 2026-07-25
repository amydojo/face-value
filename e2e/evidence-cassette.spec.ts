import { expect, test, type Page, type TestInfo } from '@playwright/test';

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function chooseCapture(page: Page, name: string) {
  await page.getByLabel('Choose a face photo').setInputFiles({
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Use this capture' }).click();
}

async function openIndexAndSelectCassette(page: Page, testInfo?: TestInfo) {
  await page.goto('/');
  await page.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE INDEX' })).toBeVisible();
  await expect(page.getByText('9:41')).toHaveCount(0);
  await expect(page.locator('[data-fv-part="status-bar"]')).toHaveCount(0);
  if (testInfo) await page.screenshot({ path: testInfo.outputPath('cassette-index.png'), fullPage: true });

  await page.getByRole('button', { name: 'Browse evidence cassettes', exact: true }).click();
  const indexHandle = page.getByRole('button', { name: 'Open evidence cassette A1–03' });
  await expect(indexHandle).toHaveCSS('touch-action', 'none');
  await indexHandle.click();
  await expect(page.getByRole('heading', { name: /Fermented Brightening Essence/i })).toBeVisible();
}

async function createActiveObservation(page: Page, testInfo?: TestInfo) {
  await openIndexAndSelectCassette(page, testInfo);
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete Capture Contract' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await chooseCapture(page, 'baseline.jpg');
  await expect(page.getByText('Evidence is still settling.')).toBeVisible();
  if (testInfo) await page.screenshot({ path: testInfo.outputPath('cassette-active.png'), fullPage: true });
}

async function reachVerdict(page: Page, scenario: 'likely_change' | 'no_change' = 'likely_change') {
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseCapture(page, 'followup.jpg');
  await page.getByLabel('Analysis fixture').selectOption(scenario);
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await page.getByRole('button', { name: 'Enter verdict review' }).click();
  await expect(page.locator('[data-fv-screen="verdict"]')).toBeVisible();
}

async function dragHandle(page: Page, name: RegExp) {
  const handle = page.getByRole('button', { name });
  const box = await handle.boundingBox();
  if (!box) throw new Error('Cassette handle has no layout box.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 38, box.y + box.height / 2 + 1, { steps: 3 });
  await page.mouse.up();
  return handle;
}

test('complete production journey integrates Evidence Cassette V7 and emits one record', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await createActiveObservation(page, testInfo);

  const activeHandle = page.getByRole('button', { name: 'Open active observation for A1–03' });
  const activeHandleBox = await activeHandle.boundingBox();
  if (!activeHandleBox) throw new Error('Active cassette handle has no layout box.');

  const scrollBeforeHandle = await page.evaluate(() => window.scrollY);
  await page.mouse.move(activeHandleBox.x + activeHandleBox.width / 2, activeHandleBox.y + activeHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(activeHandleBox.x + activeHandleBox.width / 2 + 38, activeHandleBox.y + activeHandleBox.height / 2 + 1, { steps: 3 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeHandle);
  await expect(page.locator('[data-fv-part="cassette-observation-summary"]')).toBeVisible();

  await page.mouse.move(390, 820);
  await page.mouse.wheel(0, 460);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBeforeHandle);

  await reachVerdict(page);
  await expect(page.getByText('FERMENTED BRIGHTENING ESSENCE', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Post-acne pigmentation', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Classify evidence disposition.*KEEP IT/i })).toBeVisible();

  const instrument = page.getByLabel('Evidence cassette instrument');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');
  await page.screenshot({ path: testInfo.outputPath('cassette-verdict-closed.png'), fullPage: true });

  const verdictScroll = await page.evaluate(() => window.scrollY);
  await dragHandle(page, /Open evidence cassette A1–03/);
  expect(await page.evaluate(() => window.scrollY)).toBe(verdictScroll);
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(instrument).toHaveAttribute('data-glass-cleared', 'true');
  await expect(instrument).toHaveAttribute('data-identity-visible', 'true');

  const specimenIdentity = instrument.locator('[data-fv-part="specimen-identity"]').first();
  await expect(specimenIdentity).toHaveCSS('filter', 'none');
  await expect(specimenIdentity).toHaveCSS('opacity', '1');
  const glass = instrument.locator('[data-fv-part="smart-glass"]');
  const glassFilter = await glass.evaluate((node) => {
    const style = getComputedStyle(node);
    return style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
  });
  expect(glassFilter === 'none' || glassFilter === '').toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cassette-verdict-presented.png'), fullPage: true });

  const closeHandle = page.getByRole('button', { name: /Close evidence cassette A1–03/ });
  await closeHandle.focus();
  await page.keyboard.press('Escape');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');
  await closeHandle.press('Space').catch(() => undefined);

  await page.getByRole('button', { name: /Classify evidence disposition.*KEEP IT/i }).click();
  const disposition = page.locator('[data-fv-part="evidence-disposition"]');
  await expect(disposition).toHaveAttribute('data-fv-selected-placement', 'established');
  await page.getByRole('button', { name: 'Commit evidence disposition' }).click();
  await expect(page.getByRole('button', { name: 'Generate Evidence Record' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open classified evidence record A1–03' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cassette-classified-resealed.png'), fullPage: true });

  await page.getByRole('button', { name: 'Generate Evidence Record' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORD' })).toBeVisible();
  await expect(page.getByText('S4 · Established routine')).toBeVisible();
  await expect(page.getByText('FACE EXCLUDED')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('cassette-evidence-record.png'), fullPage: true });

  await page.getByRole('button', { name: 'View archive' }).click();
  const archive = page.getByLabel('Archived evidence records');
  await expect(archive.getByRole('button')).toHaveCount(1);
  await archive.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORD' })).toBeVisible();
  await page.getByRole('button', { name: 'View archive' }).click();
  await expect(page.getByLabel('Archived evidence records').getByRole('button')).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('no-change and retained-overlap verdicts select paused and retry-alone', async ({ page }) => {
  test.setTimeout(180_000);
  await createActiveObservation(page);
  await reachVerdict(page, 'no_change');
  await expect(page.getByRole('button', { name: /TEST LONGER/i })).toBeVisible();
  await page.getByRole('button', { name: /TEST LONGER/i }).click();
  await expect(page.locator('[data-fv-part="evidence-disposition"]')).toHaveAttribute('data-fv-selected-placement', 'paused');

  await page.evaluate(() => localStorage.clear());
  await createActiveObservation(page);
  await page.getByRole('button', { name: 'Add Trace' }).click();
  await page.getByRole('button', { name: /Register C2–01 Hydrating Drops/i }).click();
  await page.getByRole('button', { name: 'Continue with lower confidence' }).click();
  await page.getByRole('button', { name: 'Record a comparable follow-up' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseCapture(page, 'overlap-followup.jpg');
  await page.getByRole('button', { name: 'Run simulated comparison' }).click();
  await page.getByRole('button', { name: 'Enter verdict review' }).click();
  await expect(page.getByText('LOWER CONFIDENCE RETAINED')).toBeVisible();
  await page.getByRole('button', { name: /RETRY IT ALONE/i }).click();
  await expect(page.locator('[data-fv-part="evidence-disposition"]')).toHaveAttribute('data-fv-selected-placement', 'retry_alone');
});

test('reduced motion reaches the same crisp presented state through the real app', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createActiveObservation(page);
  await reachVerdict(page);
  const instrument = page.getByLabel('Evidence cassette instrument');
  await page.getByRole('button', { name: /Open evidence cassette A1–03/ }).press('Enter');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(instrument.locator('[data-fv-part="specimen-identity"]').first()).toHaveCSS('filter', 'none');
});
