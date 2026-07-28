import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

const committedAt = '2026-07-15T12:30:00.000Z';
const evidenceRecord = {
  id: 'ER-202607151230',
  specimenId: persistedSealedTrial.registeredProduct.id,
  accession: persistedSealedTrial.registeredProduct.accession,
  product: persistedSealedTrial.registeredProduct.productName,
  job: persistedSealedTrial.assignedJob,
  observationWindow: '2026-07-01T12:00:00.000Z to 2026-07-15T12:00:00.000Z',
  comparison: 'comparable',
  finding: persistedSealedTrial.analysis.finding,
  nonFinding: persistedSealedTrial.analysis.nonFinding,
  confidence: 'possible',
  disturbance: 'none',
  finalPlacement: 'paused',
  recommendedAction: 'wait',
  claimBoundary: persistedSealedTrial.analysis.claimBoundary,
  createdAt: committedAt,
  includesFaceImage: false,
  baselineCapture: persistedSealedTrial.baselineCapture,
  followupCapture: persistedSealedTrial.followupCapture,
  evidenceSource: 'YouCam Skin Analysis v2.1',
  comparisonDirection: 'favorable',
  limitations: persistedSealedTrial.analysis.limitations,
  baselineRawScore: 93.3356,
  followUpRawScore: 100,
  productBrand: 'Naturium',
  productStrength: '10%',
  productVolume: '30 ml',
  baselineContext: persistedSealedTrial.baselineContext,
  followUpContext: persistedSealedTrial.followUpContext,
  demoOriginated: false,
};

const olderEvidenceRecord = {
  ...evidenceRecord,
  id: 'ER-202606301200',
  product: 'Niacinamide Serum',
  productBrand: 'Experiment',
  finding: 'The result stayed within the expected range.',
  createdAt: '2026-06-30T12:00:00.000Z',
};

function completedState(records = [evidenceRecord]) {
  return {
    ...persistedSealedTrial,
    stage: 'cabinet',
    observation: 'complete',
    placement: 'paused',
    placementSealed: true,
    resultRevealed: true,
    oracleRevealState: 'done',
    oracleEvidenceDispensed: true,
    oracleCollectionStarted: true,
    oracleCommittedAt: records[0]?.createdAt ?? null,
    record: records[0] ?? null,
    archive: records,
  };
}

function revealState(phase: 'sealed' | 'transmitting' | 'collected') {
  const collected = phase === 'collected';
  return {
    ...persistedSealedTrial,
    stage: 'analysis',
    placement: 'paused',
    placementSealed: collected,
    resultRevealed: phase !== 'sealed' && phase !== 'transmitting',
    oracleRevealState: phase,
    oracleEvidenceDispensed: collected,
    oracleCollectionStarted: collected,
    oracleCommittedAt: collected ? committedAt : null,
    record: collected ? evidenceRecord : null,
    archive: collected ? [evidenceRecord] : [],
  };
}

async function loadState(
  page: Page,
  state: ReturnType<typeof completedState> | ReturnType<typeof revealState>,
) {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: state,
  });
  await page.reload();
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function captureEvidence(page: Page, name: string) {
  if (process.env.CAPTURE_HOME_VERDICT_EVIDENCE !== 'true') return;
  const directory = resolve(process.cwd(), 'docs', 'verification', 'home-verdict-49');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${name}.png`),
    fullPage: true,
  });
}

test('home keeps one hierarchy and the exact verdict across home, detail, and history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));

  await expect(page.getByText('NO TRIAL IN PROGRESS')).toBeVisible();
  const cassette = page.locator('[data-cassette-variant="latest-verdict"]');
  await expect(cassette).toHaveAttribute('data-cassette-state', 'partially-revealed');
  await expect(cassette).toHaveAttribute('data-machine-instance', 'face-value-oracle');
  await expect(cassette).toContainText('LATEST VERDICT');
  await expect(cassette).toContainText('Naturium · Azelaic Topical Acid');
  await expect(cassette).toContainText('A small favorable shift showed up.');
  await expect(cassette).toContainText('POSSIBLE');
  await expect(cassette).toContainText('TEST LONGER');
  await expect(cassette.getByText(/VIEW TRIAL/)).toBeVisible();

  const viewTrial = page.getByRole('button', {
    name: 'View trial FV–014 for Naturium · Azelaic Topical Acid',
  });
  await expect(viewTrial).toBeVisible();
  expect((await viewTrial.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await viewTrial.click();

  const savedResult = page.locator('[data-fv-screen="saved-result"]');
  await expect(page.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();
  await expect(savedResult).toContainText('FV–014');
  await expect(savedResult).toContainText('Naturium · Azelaic Topical Acid');
  await expect(savedResult).toContainText('A small favorable shift showed up.');
  await expect(savedResult).toContainText('TEST LONGER');

  await page.getByRole('button', { name: '←' }).click();
  await expect(cassette).toBeVisible();

  const previousTrials = page.getByRole('button', {
    name: 'Previous trials, 2 saved results',
  });
  expect((await previousTrials.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  for (let index = 0; index < 4; index += 1) {
    if (await previousTrials.evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(previousTrials).toBeFocused();
  expect(
    await previousTrials.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe('none');
  await previousTrials.click();

  await expect(page.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
  const savedRecords = page
    .getByLabel('Previous trials')
    .getByRole('button', { name: /Open saved result/i });
  await expect(savedRecords).toHaveCount(2);
  await expect(savedRecords.first()).toContainText('FV–014');
  await expect(savedRecords.first()).toContainText('Naturium · Azelaic Topical Acid');
  await expect(savedRecords.first()).toContainText('A small favorable shift showed up.');
  await expect(savedRecords.first()).toContainText('TEST LONGER');
  await savedRecords.first().click();
  await expect(savedResult).toContainText('FV–014');
  await expect(savedResult).toContainText('Naturium · Azelaic Topical Acid');
  await noHorizontalOverflow(page);
});

test('empty history keeps the status compact and Start a New Trial preserves registration', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loadState(page, completedState([]));

  await expect(page.getByText('NO TRIAL IN PROGRESS')).toBeVisible();
  await expect(page.locator('[data-latest-verdict-cassette]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Previous trials, 0 saved results' }),
  ).toBeVisible();
  const start = page.getByRole('button', { name: 'START A NEW TRIAL' });
  expect((await start.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await start.click();
  await expect(page.getByRole('heading', { name: 'What are you putting on trial?' })).toBeVisible();
});

test('mobile widths, long verdict content, focus, and reduced motion remain stable', async ({
  page,
}) => {
  const longRecord = {
    ...evidenceRecord,
    productBrand: 'Clinical Laboratory',
    product: 'Azelaic Topical Acid Barrier Support Concentrate',
  };

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await loadState(page, completedState([longRecord, olderEvidenceRecord]));
    const cassette = page.locator('[data-cassette-variant="latest-verdict"]');
    const cassetteBox = await cassette.boundingBox();
    expect(cassetteBox?.width).toBeLessThanOrEqual(viewport.width);
    await expect(cassette).toContainText(
      'Clinical Laboratory · Azelaic Topical Acid Barrier Support Concentrate',
    );
    await page
      .getByRole('button', { name: 'Previous trials, 2 saved results' })
      .scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);

    if (viewport.width === 320) {
      await expect(page).toHaveScreenshot('home-latest-verdict-320.png', {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.012,
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await expect(page.locator('[data-oracle-glass-reflection]')).toHaveCSS('animation-name', 'none');
  await expect(page).toHaveScreenshot('home-latest-verdict-reduced-motion.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.012,
  });
});

test('recorded result preserves the approved action spacing and factual copy', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(page, revealState('collected'));

  await expect(page.getByText('EVIDENCE RECORDED', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence recorded.' })).toBeVisible();
  await expect(page.getByText('Your result is saved.')).toBeVisible();
  const summary = page.locator('[data-result-summary]');
  await expect(summary).toContainText('FV–014');
  await expect(summary).toContainText('Naturium · Azelaic Topical Acid');
  await expect(summary).toContainText('A small favorable shift showed up.');
  await expect(summary).toContainText('TEST LONGER');

  const nextStep = summary.locator(':scope > span');
  const done = page.getByRole('button', { name: 'DONE' });
  const viewEvidence = page.getByRole('button', { name: 'VIEW EVIDENCE' });
  const [nextBox, doneBox, viewBox] = await Promise.all([
    nextStep.boundingBox(),
    done.boundingBox(),
    viewEvidence.boundingBox(),
  ]);
  if (!nextBox || !doneBox || !viewBox) throw new Error('Missing recorded-result action geometry.');
  const resultToDone = doneBox.y - (nextBox.y + nextBox.height);
  const doneToView = viewBox.y - (doneBox.y + doneBox.height);
  expect(resultToDone).toBeGreaterThanOrEqual(24);
  expect(resultToDone).toBeLessThanOrEqual(28);
  expect(doneToView).toBeGreaterThanOrEqual(10);
  expect(doneToView).toBeLessThanOrEqual(12);
  await noHorizontalOverflow(page);
});

test('ready and revealing states use direct result copy without mechanism narration', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, revealState('sealed'));
  await expect(page.getByText('VERDICT READY')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
  await expect(page.getByText('Preparing your evidence record.')).toHaveCount(0);

  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused!important}',
  });
  await loadState(page, revealState('transmitting'));
  await expect(page.getByText('REVEALING RESULT')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Preparing your evidence record.' }),
  ).toBeVisible();
});

test('captures final mobile verification evidence', async ({ page }) => {
  test.skip(
    process.env.CAPTURE_HOME_VERDICT_EVIDENCE !== 'true',
    'Run with CAPTURE_HOME_VERDICT_EVIDENCE=true for PR evidence.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await captureEvidence(page, '01-home-latest-verdict-390');

  await page.setViewportSize({ width: 320, height: 700 });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await captureEvidence(page, '02-home-narrow-320');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, revealState('sealed'));
  await captureEvidence(page, '03-verdict-ready');

  await page.addStyleTag({
    content: '*,*::before,*::after{animation-play-state:paused!important}',
  });
  await loadState(page, revealState('transmitting'));
  await captureEvidence(page, '04-revealing-result');

  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(page, revealState('collected'));
  await captureEvidence(page, '05-evidence-recorded-done-spacing');

  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await page.getByRole('button', { name: 'Previous trials, 2 saved results' }).click();
  await captureEvidence(page, '06-previous-trials');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await captureEvidence(page, '07-home-reduced-motion');
});
