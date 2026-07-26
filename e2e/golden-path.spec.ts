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

const persistedSaveReadyTrial = {
  selectedDrawerIndex: 0,
  selectedSpecimenId: 'fermented-essence',
  assignedJob: 'Post-acne pigmentation',
  observation: 'review_due',
  placement: 'retry_alone',
  placementSealed: false,
  comparison: 'partially_comparable',
  confidence: 'possible',
  disturbance: 'overlap_retained',
  baselineCapture: {
    id: 'baseline-reduced-motion',
    kind: 'baseline',
    source: 'file',
    mimeType: 'image/jpeg',
    createdAt: '2026-07-15T19:00:00.000Z',
    orientationRule: 'analysis-unmirrored',
  },
  followupCapture: {
    id: 'followup-reduced-motion',
    kind: 'followup',
    source: 'file',
    mimeType: 'image/jpeg',
    createdAt: '2026-07-27T19:00:00.000Z',
    orientationRule: 'analysis-unmirrored',
  },
  trace: {
    id: 'note-reduced-motion',
    label: 'WHAT YOU NOTICED',
    detail: 'Less tight after cleansing',
    observedAt: '2026-07-20T19:00:00.000Z',
  },
  analysis: {
    captureQuality: 'accepted',
    comparison: 'partially_comparable',
    visibleSignal: 'tone consistency',
    confidence: 'possible',
    finding: 'Visible tone consistency appears slightly improved.',
    nonFinding: 'The trial does not establish which overlapping product caused the change.',
    relevantContext: 'A second active product overlapped the trial window.',
    recommendedAction: 'continue_with_overlap',
    claimBoundary: 'Possible evidence only. Product attribution remains limited.',
    simulated: true,
  },
  record: null,
  archive: [],
};

test('complete mobile Human Butter journey saves and releases exactly one durable result', async ({ page }, testInfo: TestInfo) => {
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
  await page.screenshot({ path: testInfo.outputPath('human-butter-trial-in-progress.png'), fullPage: true });

  const activeHandle = page.getByRole('button', { name: /Open trial summary for Fermented Brightening Essence/i });
  const scrollBeforeHandle = await page.evaluate(() => window.scrollY);
  await dragHandle(page, activeHandle);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeHandle);
  const activeFaceplate = page.locator('[data-evidence-instrument] [data-cassette-part="registered-product-faceplate"]');
  await expect(activeFaceplate).toBeVisible();
  await expect(activeFaceplate).toContainText('SAMPLE REGISTERED');
  await expect(activeFaceplate).toContainText('FERMENTED BRIGHTENING ESSENCE');
  await expect(activeFaceplate).toContainText('JOB · Post-acne pigmentation');

  await page.getByRole('button', { name: 'Add note' }).click();
  const noteInput = page.getByRole('textbox', { name: 'What did you notice?' });
  await expect(noteInput).toBeFocused();
  await noteInput.fill('Less tight after cleansing');
  await page.getByRole('button', { name: 'SAVE NOTE' }).click();
  await expect(page.getByText('“Less tight after cleansing”')).toBeVisible();

  await page.getByText('Trial details').click();
  await page.getByRole('button', { name: 'Add another product' }).click();
  await expect(page.getByRole('heading', { name: /Hydrating Drops entered this trial/i })).toBeVisible();
  await page.getByRole('button', { name: 'Keep both and accept a less certain result' }).click();

  await page.getByRole('button', { name: 'TAKE FOLLOW UP SCAN' }).click();
  await completeCaptureContract(page, true);
  await chooseCapture(page, 'followup.jpg');

  await expect(page.getByRole('heading', { name: 'Your result is ready.' })).toBeVisible();
  await page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i }).click();
  const resultInstrument = page.getByLabel('Product trial result');
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'sealed');
  const resultHandle = page.getByRole('button', { name: /Reveal result for Fermented Brightening Essence/i });
  await dragHandle(page, resultHandle);
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(page.getByText('THE RESULT IS LESS CERTAIN')).toBeVisible();
  await page.getByRole('button', { name: /Accept recommended next step — RETRY IT ALONE/i }).click();

  const nextStep = page.locator('[data-fv-part="next-step"]');
  await expect(nextStep).toHaveAttribute('data-fv-selected-placement', 'retry_alone');
  await expect(page.getByRole('heading', { name: 'R3 · Retry alone' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choose a different next step' })).toBeHidden();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-primary-action-owner', 'machine');
  await page.screenshot({ path: testInfo.outputPath('human-butter-save-ready.png'), fullPage: true });

  const saveResult = page.getByRole('button', { name: 'Save result and release Evidence Record' });
  await saveResult.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  const machine = page.locator('[data-evidence-machine]');
  await expect(machine).toHaveAttribute('data-release-state', 'record-presented', { timeout: 3000 });
  await expect(machine).toHaveAttribute('data-primary-action-owner', 'artifact');
  await expect(page.locator('[data-evidence-record-artifact]')).toHaveCount(1);
  const recordId = await page.locator('[data-evidence-record-artifact]').getAttribute('data-record-id');
  expect(recordId).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('human-butter-record-presented.png'), fullPage: true });

  await page.reload();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented');
  await expect(page.locator('[data-evidence-record-artifact]')).toHaveAttribute('data-record-id', recordId!);
  const collect = page.getByRole('button', { name: /Collect Evidence Record for Fermented Brightening Essence/i });
  await collect.click();

  await expect(page.getByRole('heading', { name: 'Your evidence.' })).toBeVisible();
  await expect(page.locator('[data-artifact-mode="collected"]')).toHaveAttribute('data-record-id', recordId!);
  await expect(page.getByText('R3')).toBeVisible();
  await page.getByRole('button', { name: 'VIEW EVIDENCE DETAIL' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
  await expect(page.getByText(/Try it again without another active product/i)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('human-butter-collected-evidence.png'), fullPage: true });

  await page.getByRole('button', { name: 'Past results' }).click();
  const pastResults = page.getByLabel('Past results');
  const savedResultEntries = pastResults.getByRole('button', { name: /Open saved result/i });
  await expect(savedResultEntries).toHaveCount(1);
  await pastResults.getByRole('button', { name: /Open saved result A1–03/i }).click();
  await expect(page.getByRole('heading', { name: 'Your evidence.' })).toBeVisible();
  await expect(page.locator('[data-artifact-mode="collected"]')).toHaveAttribute('data-record-id', recordId!);

  await page.getByRole('button', { name: 'Your trials' }).click();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await page.getByRole('button', { name: 'Past results' }).click();
  await expect(page.getByLabel('Past results').getByRole('button', { name: /Open saved result/i })).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('reduced motion preserves save, production, presentation, and collection on the production root', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate((persisted) => {
    localStorage.setItem('face-value:structured-demo:v1', JSON.stringify(persisted));
  }, persistedSaveReadyTrial);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'One clear next step.' })).toBeVisible();
  await page.getByRole('button', { name: 'Save result and release Evidence Record' }).click();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented', { timeout: 1500 });
  await page.getByRole('button', { name: /Collect Evidence Record/i }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Your evidence.' })).toBeVisible();
  await expect(page.locator('[data-artifact-mode="collected"]')).toBeVisible();
});
