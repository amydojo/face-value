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
  await page.getByRole('button', { name: /USE THIS CAPTURE/i }).click();
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

async function assertNoInternalJourneyJargon(page: Page) {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(/NEXT VALID ACTION|INSPECT CASSETTE|LIGHTWEIGHT TRACE|EVIDENCE DISPOSITION|COMMIT DISPOSITION|GENERATE EVIDENCE RECORD|hd_redness|raw_score|task_id|polling/i);
}

function assertFaceFreeStorage(serialized: string | null) {
  expect(serialized).not.toMatch(/providerTaskId|ephemeralTaskReference|data:image|blob:|YOUCAM_API_KEY|YOUCAM_SPIKE_TOKEN|Authorization: Bearer|https:\/\/[^"\\]*(?:signed|upload)/i);
}

const persistedSaveReadyTrial = {
  selectedDrawerIndex: 0,
  selectedSpecimenId: 'one-thing',
  assignedJob: 'Reduce visible redness',
  observation: 'review_due',
  placement: 'paused',
  placementSealed: false,
  comparison: 'comparable',
  confidence: 'possible',
  disturbance: 'none',
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
  trace: null,
  analysis: {
    captureQuality: 'accepted',
    comparison: 'comparable',
    visibleSignal: 'visible redness',
    confidence: 'possible',
    finding: 'Favorable direction detected',
    nonFinding: 'The redness signal moved from 93.34 to 100.00 across this trial.',
    relevantContext: 'The prototype noise boundary is still being calibrated.',
    recommendedAction: 'wait',
    claimBoundary: 'Possible directional evidence only. This does not establish product efficacy or clinical significance.',
    simulated: false,
    provider: 'youcam',
    baselineRawScore: 93.3356,
    followUpRawScore: 100,
    delta: 6.6644,
    direction: 'favorable',
    limitations: ['Prototype noise boundary has not been calibrated.'],
  },
  record: null,
  archive: [],
  longitudinalEvidence: {
    protocol: {
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      scoreType: 'raw_score',
      captureProtocolVersion: 'face-value-youcam-1',
    },
    baseline: {
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      scoreType: 'raw_score',
      captureProtocolVersion: 'face-value-youcam-1',
      rawScore: 93.3356,
      capturedAt: '2026-07-15T19:00:00.000Z',
      captureQuality: 'accepted',
    },
    followUp: {
      provider: 'youcam',
      apiVersion: '2.1',
      mode: 'hd',
      concern: 'hd_redness',
      region: null,
      scoreType: 'raw_score',
      captureProtocolVersion: 'face-value-youcam-1',
      rawScore: 100,
      capturedAt: '2026-07-27T19:00:00.000Z',
      captureQuality: 'accepted',
    },
    comparison: {
      baselineRawScore: 93.3356,
      followUpRawScore: 100,
      delta: 6.6644,
      direction: 'favorable',
      calibration: 'pending',
      confidence: 'possible',
      limitations: ['Prototype noise boundary has not been calibrated.'],
    },
  },
};

test('complete mobile ONE THING journey releases one face-free matched YouCam result', async ({ page }, testInfo: TestInfo) => {
  const errors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');

  await page.getByRole('button', { name: 'VIEW YOUR TRIALS' }).click();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await assertNoInternalJourneyJargon(page);

  await page.getByRole('button', { name: /Choose a trial starting with 02 \/ ONE THING/i }).click();
  await expect(page.getByRole('button', { name: /View trial for 02 \/ ONE THING/i })).toBeVisible();
  await page.getByRole('button', { name: /View trial for 02 \/ ONE THING/i }).click();
  await expect(page.getByRole('heading', { name: 'What should this product change?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Reduce visible redness', exact: true }).click();
  await page.getByRole('button', { name: 'Take baseline scan' }).click();
  await completeCaptureContract(page);
  await chooseCapture(page, 'baseline.jpg');

  await expect(page.getByRole('heading', { name: 'Still observing.' })).toBeVisible();
  const baselineStorage = await page.evaluate(() => localStorage.getItem('face-value:structured-demo:v1'));
  expect(baselineStorage).toContain('93.3356');
  assertFaceFreeStorage(baselineStorage);
  await page.screenshot({ path: testInfo.outputPath('phase-b-baseline-accepted.png'), fullPage: true });

  await page.getByRole('button', { name: 'TAKE FOLLOW UP SCAN' }).click();
  await completeCaptureContract(page, true);
  await chooseCapture(page, 'followup.jpg');

  await expect(page.getByRole('heading', { name: 'Your result is ready.' })).toBeVisible();
  const matchedStorage = await page.evaluate(() => localStorage.getItem('face-value:structured-demo:v1'));
  expect(matchedStorage).toContain('100');
  expect(matchedStorage).toContain('favorable');
  assertFaceFreeStorage(matchedStorage);
  await page.screenshot({ path: testInfo.outputPath('phase-b-followup-accepted.png'), fullPage: true });

  await page.getByRole('button', { name: /Reveal result for 02 \/ ONE THING/i }).click();
  const resultInstrument = page.getByLabel('Product trial result');
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'sealed');
  const resultHandle = page.getByRole('button', { name: /Reveal result for 02 \/ ONE THING/i });
  await dragHandle(page, resultHandle);
  await expect(resultInstrument).toHaveAttribute('data-cassette-state', 'presented');
  await expect(page.getByRole('heading', { name: 'Favorable direction detected' })).toBeVisible();
  await expect(page.getByText(/93.34 to 100.00/)).toBeVisible();
  await page.getByRole('button', { name: /Accept recommended next step — TEST LONGER/i }).click();
  await page.screenshot({ path: testInfo.outputPath('phase-b-result-reveal.png'), fullPage: true });

  await expect(page.getByRole('heading', { name: 'P1 · Paused' })).toBeVisible();
  const saveResult = page.getByRole('button', { name: 'Save result and release Evidence Record' });
  await saveResult.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  const machine = page.locator('[data-evidence-machine]');
  await expect(machine).toHaveAttribute('data-release-state', 'record-presented', { timeout: 3000 });
  await expect(page.locator('[data-evidence-record-artifact]')).toHaveCount(1);
  const recordId = await page.locator('[data-evidence-record-artifact]').getAttribute('data-record-id');
  expect(recordId).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('phase-b-record-release.png'), fullPage: true });

  await page.reload();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented');
  await expect(page.locator('[data-evidence-record-artifact]')).toHaveAttribute('data-record-id', recordId!);
  await page.getByRole('button', { name: /Collect Evidence Record for 02 \/ ONE THING/i }).click();
  await expect(page.getByRole('heading', { name: 'Your evidence.' })).toBeVisible();
  await page.getByRole('button', { name: 'VIEW EVIDENCE DETAIL' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
  await expect(page.getByText(/YouCam Skin Analysis v2.1/)).toBeVisible();
  await expect(page.getByText(/Prototype noise boundary has not been calibrated/)).toBeVisible();

  await page.getByRole('button', { name: 'Past results' }).click();
  const pastResults = page.getByLabel('Past results');
  await expect(pastResults.getByRole('button', { name: /Open saved result/i })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('phase-b-past-results.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await page.getByRole('button', { name: 'Past results' }).click();
  await expect(page.getByLabel('Past results').getByRole('button', { name: /Open saved result/i })).toHaveCount(1);

  expect(errors).toEqual([]);
});

test('reduced motion preserves Phase B save, release, presentation, and collection', async ({ page }) => {
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
