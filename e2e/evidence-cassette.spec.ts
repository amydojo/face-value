import { expect, test, type Page } from '@playwright/test';

async function chooseCapture(page: Page, name: string) {
  await page.getByLabel('Choose a face photo').setInputFiles({
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Use this capture' }).click();
}

async function openTrialSelection(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'VIEW YOUR TRIALS' }).click();
  await page.getByRole('button', { name: /Choose a trial starting with Fermented Brightening Essence/i }).click();
  await expect(page.getByRole('region', { name: /Trial selector/i })).toBeVisible();
}

async function createObservation(page: Page) {
  await openTrialSelection(page);
  await page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i }).click();
  await page.getByRole('radio', { name: 'Post-acne pigmentation', exact: true }).click();
  await page.getByRole('button', { name: 'Take baseline scan' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Ready to capture' }).click();
  await chooseCapture(page, 'baseline.jpg');
  await expect(page.getByRole('heading', { name: 'Still observing.' })).toBeVisible();
}

async function reachResult(page: Page, scenario: 'likely_change' | 'no_change' = 'likely_change') {
  await createObservation(page);
  await page.getByText('Trial details').click();
  await page.getByLabel('Analysis fixture').selectOption(scenario);
  await page.getByRole('button', { name: 'TAKE FOLLOW UP SCAN' }).click();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('radio', { name: 'comparable', exact: true }).check();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  await chooseCapture(page, 'followup.jpg');
  await expect(page.getByRole('heading', { name: 'Your result is ready.' })).toBeVisible();
  await page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i }).click();
  await expect(page.locator('[data-fv-screen="result"]')).toBeVisible();
}

test('every visible trial handle supports tap, keyboard, cancellation, and scoped drag ownership', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await openTrialSelection(page);

  const handle = page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i });
  await expect(handle).toHaveCSS('touch-action', 'none');
  await expect(page.locator('[data-fv-screen="trial-selection"]')).not.toHaveCSS('touch-action', 'none');

  await handle.dispatchEvent('pointerdown', { pointerId: 7, button: 0, clientX: 10, clientY: 10 });
  await handle.dispatchEvent('pointercancel', { pointerId: 7, button: 0, clientX: 10, clientY: 10 });
  await expect(page.getByRole('region', { name: /Trial selector/i })).toBeVisible();
  await handle.click();
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();

  await page.keyboard.press('Escape');
  const keyboardHandle = page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i });
  await keyboardHandle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i }).press('Space');
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();
});

test('lost pointer capture recovers and the next deliberate activation still works', async ({ page }) => {
  await openTrialSelection(page);
  const handle = page.getByRole('button', { name: /View trial for Fermented Brightening Essence/i });
  await handle.dispatchEvent('pointerdown', { pointerId: 9, button: 0, clientX: 10, clientY: 10 });
  await handle.dispatchEvent('lostpointercapture', { pointerId: 9 });
  await expect(page.getByRole('region', { name: /Trial selector/i })).toBeVisible();
  await handle.click();
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();
});

test('reduced motion preserves result, record production, collection, and archive', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reachResult(page);

  const instrument = page.getByLabel('Product trial result');
  await page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i }).press('Enter');
  await expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(instrument.locator('[data-fv-part="specimen-identity"]').first()).toHaveCSS('filter', 'none');

  await page.getByRole('button', { name: /Accept recommended next step — KEEP IT/i }).click();
  await expect(page.locator('[data-fv-part="next-step"]')).toHaveAttribute('data-fv-selected-placement', 'established');
  await page.getByRole('button', { name: 'Save result and release Evidence Record' }).click();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented', { timeout: 1500 });
  await page.getByRole('button', { name: /Collect Evidence Record/i }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Your evidence.' })).toBeVisible();
  await page.getByRole('button', { name: 'Past results' }).click();
  await expect(page.getByLabel('Past results').getByRole('button', { name: /Open saved result/i })).toHaveCount(1);
});

test('no-change result maps directly to paused while the full taxonomy stays hidden', async ({ page }) => {
  test.setTimeout(120_000);
  await reachResult(page, 'no_change');
  await page.getByRole('button', { name: /Accept recommended next step — TEST LONGER/i }).click();
  const nextStep = page.locator('[data-fv-part="next-step"]');
  await expect(nextStep).toHaveAttribute('data-fv-selected-placement', 'paused');
  await expect(page.getByRole('heading', { name: 'P1 · Paused' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose a different next step' })).toBeHidden();
  await page.getByRole('button', { name: 'Choose a different next step' }).click();
  await expect(page.getByRole('group', { name: 'Choose a different next step' })).toBeVisible();
});
