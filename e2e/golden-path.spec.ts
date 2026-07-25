import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

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

async function completeCaptureContract(page: Page, followup = false) {
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  if (followup) {
    await page.getByRole('radio', { name: 'comparable', exact: true }).check();
    await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  } else {
    await page.getByRole('button', { name: 'Ready to capture' }).click();
  }
}

async function dragHandle(page: Page, handle: Locator) {
  const box = await handle.boundingBox();
  if (!box) throw new Error('Trial handle has no layout box.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 38, box.y + box.height / 2 + 1, { steps: 3 });
  await page.mouse.up();
}

async function assertOnePrimaryAction(page: Page) {
  const visiblePrimary = page.locator('button').filter({ has: page.locator('span') });
  const candidates = await visiblePrimary.evaluateAll((buttons) =>
    buttons.filter((button) => {
      const style = getComputedStyle(button);
      const text = button.textContent?.trim() ?? '';
      return style.display !== 'none' && style.visibility !== 'hidden' && /TAKE|SAVE|KEEP|RETRY|TEST|VIEW YOUR TRIALS/.test(text);
    }).length,
  );
  expect(candidates).toBeLessThanOrEqual(1);
}

async function assertNoInternalJourneyJargon(page: Page) {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(/NEXT VALID ACTION|INSPECT CASSETTE|LIGHTWEIGHT TRACE|EVIDENCE DISPOSITION|COMMIT DISPOSITION|GENERATE EVIDENCE RECORD/i);
}

test('complete mobile Human Butter journey saves exactly one durable result', async ({ page }, testInfo: TestInfo) => {
  test.setTimeout(180_000);
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');

  await page.getByRole('button', { name: 'VIEW YOUR TRIALS' }).click();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await expect(page.getByText('1 active trial')).toHaveCount(0);
  await assertNoInternalJourneyJargon(page);
  await assertOnePrimaryAction(page);
  await page.screenshot({ path: testInfo.outputPath('human-butter-your-trials.png'), fullPage: true });

  const chooseTrialHandle = page.getByRole('button', { name: /Choose a trial starting with Fermented Brightening Essence/i });
  await chooseTrialHandle.click();
  await expect(page.getByRole('region', { name: /Trial selector/i })).toBeVisible();
  await expect(page.getByText('Pull to view trial')).toBeVisible();
  await expect(page.getByText(/INSPECT CASSETTE/i)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('human-butter-trial-selection.png'), fullPage: true });

  await page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i }).click();
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Take baseline scan' }).click();
  await completeCaptureContract(page);
  await chooseCapture(page, 'baseline.jpg');

  await expect(page.getByRole('heading', { name: 'Still observing.' })).toBeVisible();
  await expect(page.getByText('Next useful comparison: July 27')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'What did you notice?' })).toHaveCount(0);
  await expect(page.locator('.statusGrid')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('human-butter-trial-in-progress.png'), fullPage: true });

  const activeHandle = page.getByRole('button', { name: /Open trial summary for Fermented Brightening Essence/i });
  const scrollBeforeHandle = await page.evaluate(() => window.scrollY);
  await dragHandle(page, activeHandle);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeHandle);
  await expect(page.locator('[data-fv-part="trial-summary"]')).toBeVisible();

  const maximumScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  if (maximumScroll > 0) {
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollTo(0, Math.min(document.documentElement.scrollHeight, window.scrollY + 360)));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  }

  await page.getByRole('button', { name: 'Add note' }).click();
  const noteInput = page.getByRole('textbox', { name: 'What did you notice?' });
  await expect(noteInput).toBeFocused();
  await noteInput.fill('Less tight after cleansing');
  await page.screenshot({ path: testInfo.outputPath('human-butter-note-editing.png'), fullPage: true });
  await page.getByRole('button', { name: 'SAVE NOTE' }).click();
  await expect(page.getByText('“Less tight after cleansing”')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit note' })).toBeFocused();

  await page.getByText('Trial details').click();
  await page.getByRole('button', { name: 'Add another product' }).click();
  await expect(page.getByRole('heading', { name: /Hydrating Drops entered this trial/i })).toBeVisible();
  await expect(page.getByText('That makes it harder to know which product caused any change.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-butter-another-product.png'), fullPage: true });
  await page.getByRole('button', { name: 'Keep both and accept a less certain result' }).click();

  await page.getByRole('button', { name: 'TAKE FOLLOW UP SCAN' }).click();
  await completeCaptureContract(page, true);
  await chooseCapture(page, 'followup.jpg');

  await expect(page.getByRole('heading', { name: /Comparing your scans|Your result is ready/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Run simulated comparison/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enter verdict review/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your result is ready.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-butter-result-ready.png'), fullPage: true });

  await page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i }).click();
  await expect(page.locator('[data-fv-screen="result"]')).toBeVisible();
  const resultInstrument = page.getByLabel('Product trial result');
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'sealed');
  await page.screenshot({ path: testInfo.outputPath('human-butter-result-closed.png'), fullPage: true });

  const resultHandle = page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i });
  await dragHandle(page, resultHandle);
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(resultInstrument).toHaveAttribute('data-glass-cleared', 'true');
  await page.screenshot({ path: testInfo.outputPath('human-butter-result-revealed.png'), fullPage: true });

  await expect(page.getByText('THE RESULT IS LESS CERTAIN')).toBeVisible();
  await expect(page.getByRole('button', { name: /Accept recommended next step — RETRY IT ALONE/i })).toBeVisible();
  await page.getByRole('button', { name: /Accept recommended next step — RETRY IT ALONE/i }).click();

  const nextStep = page.locator('[data-fv-part="next-step"]');
  await expect(nextStep).toHaveAttribute('data-fv-selected-placement', 'retry_alone');
  await expect(page.getByRole('heading', { name: 'R3 · Retry alone' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose a different next step' })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('human-butter-recommended-next-step.png'), fullPage: true });

  await page.getByRole('button', { name: 'SAVE RESULT' }).click();
  await expect(page.getByText('Saved to your evidence.').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-butter-saved-resealed.png'), fullPage: true });

  await expect(page.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();
  await expect(page.getByText('Less tight after cleansing', { exact: true })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'R3 · Retry alone' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-butter-open-saved-result.png'), fullPage: true });

  await page.getByRole('button', { name: 'View Past results' }).click();
  const pastResults = page.getByLabel('Past results');
  const savedResultEntries = pastResults.getByRole('button', { name: /Open saved result/i });
  await expect(savedResultEntries).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('human-butter-past-results.png'), fullPage: true });
  await pastResults.getByRole('button', { name: /Open saved result A1–03/i }).click();
  await expect(page.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await page.getByRole('button', { name: 'Past results' }).click();
  await expect(page.getByLabel('Past results').getByRole('button', { name: /Open saved result/i })).toHaveCount(1);

  expect(errors).toEqual([]);
});
