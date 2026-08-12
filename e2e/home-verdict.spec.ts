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

const neutralEvidenceRecord = {
  ...evidenceRecord,
  finding: 'No favorable shift showed up yet.',
  nonFinding: 'The follow-up remained close to the baseline.',
  comparisonDirection: 'unchanged',
  followUpRawScore: 93.3356,
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

function revealState(
  phase: 'sealed' | 'transmitting' | 'committing' | 'dispensing' | 'collected',
  overrides: Record<string, unknown> = {},
) {
  const committed = ['committing', 'dispensing', 'collected'].includes(phase);
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
    oracleCommittedAt: committed ? committedAt : null,
    record: collected ? evidenceRecord : null,
    archive: collected ? [evidenceRecord] : [],
    ...overrides,
  };
}

async function loadState(
  page: Page,
  state: ReturnType<typeof completedState> | ReturnType<typeof revealState>,
) {
  await page.goto('/favicon.svg');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: state,
  });
  await page.goto('/');
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

async function installPausedAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{animation-play-state:paused!important}';
    document.documentElement.append(style);
  });
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
  const latestSpecimen = cassette.locator('[data-oracle-specimen]');
  await expect(latestSpecimen).toHaveCSS('opacity', '1');
  await expect(latestSpecimen).toHaveCSS('z-index', '7');
  await expect(latestSpecimen).toHaveAttribute('data-specimen-brand', 'Naturium');
  await expect(latestSpecimen).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
  await expect(latestSpecimen).toHaveAttribute('data-specimen-strength', '10%');
  await expect(latestSpecimen).toHaveAttribute('data-specimen-volume', '30 ml');
  await expect(latestSpecimen).toHaveAttribute('data-specimen-accession', 'SPECIMEN 01');
  await expect(cassette.getByText(/VIEW TRIAL/)).toBeVisible();
  const latestPaper = cassette.locator('[data-latest-verdict-record]');
  await expect(latestPaper).toContainText('RESULT');
  await expect(latestPaper).not.toContainText('COMPARABLE');
  await expect(latestPaper.locator('[data-latest-paper-action]')).toContainText('VIEW TRIAL');
  await latestPaper.focus();
  await expect(latestPaper).toBeFocused();
  expect(await latestPaper.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );

  const viewTrial = page.getByRole('button', {
    name: 'View trial FV–014 for Naturium · Azelaic Topical Acid',
  });
  await expect(viewTrial).toBeVisible();
  expect((await viewTrial.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await viewTrial.click();

  const savedResult = page.locator('[data-fv-screen="saved-result"]');
  await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
  await expect(page.locator('[data-oracle-trial-identity]')).toHaveText('FV–014');
  await expect(savedResult).toContainText('Naturium · Azelaic Topical Acid');
  await expect(savedResult).toContainText('A small favorable shift showed up.');
  await expect(savedResult).toContainText('Favorable direction');
  await expect(savedResult.getByRole('button', { name: 'Open evidence record' })).toBeVisible();
  await expect(savedResult).toHaveAttribute('data-specimen-brand', 'Naturium');
  await expect(savedResult).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
  await expect(savedResult).toHaveAttribute('data-specimen-strength', '10%');
  await expect(savedResult).toHaveAttribute('data-specimen-volume', '30 ml');

  await page.getByRole('button', { name: 'Back to previous view' }).click();
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
  await expect(savedRecords.nth(0)).toHaveAttribute('data-record-id', evidenceRecord.id);
  await expect(savedRecords.nth(1)).toHaveAttribute('data-record-id', olderEvidenceRecord.id);
  await expect(savedRecords.first()).toContainText('FV–014');
  await expect(savedRecords.first()).toContainText('Naturium · Azelaic Topical Acid');
  await expect(savedRecords.first()).toContainText('A small favorable shift showed up.');
  await expect(savedRecords.first()).toContainText(
    'Visible redness moved in the intended direction.',
  );
  await expect(savedRecords.first()).toContainText('POSSIBLE');
  await expect(savedRecords.first()).toContainText('TEST LONGER');
  await expect(savedRecords.first()).toHaveAttribute('data-specimen-brand', 'Naturium');
  await expect(savedRecords.first()).toHaveAttribute(
    'data-specimen-product',
    'Azelaic Topical Acid',
  );
  await expect(savedRecords.first()).toHaveAttribute('data-specimen-strength', '10%');
  await expect(savedRecords.first()).toHaveAttribute('data-specimen-volume', '30 ml');
  await expect(savedRecords.first()).toContainText('→');
  expect((await savedRecords.first().boundingBox())?.height).toBeGreaterThanOrEqual(44);
  for (let index = 0; index < 4; index += 1) {
    if (await savedRecords.first().evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press('Tab');
  }
  await expect(savedRecords.first()).toBeFocused();
  expect(
    await savedRecords.first().evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe('none');
  await savedRecords.first().click();
  await expect(page.locator('[data-oracle-trial-identity]')).toHaveText('FV–014');
  await expect(savedResult).toContainText('Naturium · Azelaic Topical Acid');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
  await expect(savedResult).toHaveAttribute('data-specimen-brand', 'Naturium');
  await expect(savedResult).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
  await expect(savedResult).toHaveAttribute('data-specimen-strength', '10%');
  await expect(savedResult).toHaveAttribute('data-specimen-volume', '30 ml');
  await noHorizontalOverflow(page);
});

test('home paper leads with RESULT and preserves neutral unchanged-comparison copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, completedState([neutralEvidenceRecord]));

  const cassette = page.locator('[data-cassette-variant="latest-verdict"]');
  const latestPaper = cassette.locator('[data-latest-verdict-record]');
  await expect(latestPaper).toContainText('RESULT');
  await expect(latestPaper).not.toContainText('COMPARABLE');
  await expect(cassette).toContainText('No favorable shift showed up yet.');
  await expect(cassette).not.toContainText('No directional shift showed up yet.');
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
  await expect(page.getByRole('heading', { name: 'Give the specimen an identity.' })).toBeVisible();
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

test('previous-trials case files remain compact, ordered, and overflow-safe', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
    await page.getByRole('button', { name: 'Previous trials, 2 saved results' }).click();

    const archive = page.getByLabel('Previous trials');
    const cards = archive.getByRole('button', { name: /Open saved result/i });
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAttribute('data-record-id', evidenceRecord.id);
    await expect(cards.nth(1)).toHaveAttribute('data-record-id', olderEvidenceRecord.id);
    await expect(cards.first()).toContainText('Naturium · Azelaic Topical Acid');
    await expect(cards.first()).toContainText('A small favorable shift showed up.');
    await expect(cards.first()).toContainText('Visible redness moved in the intended direction.');
    await expect(cards.first()).toContainText('TEST LONGER');
    await expect(cards.first()).toContainText('POSSIBLE');
    expect((await cards.first().boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await noHorizontalOverflow(page);
  }
});

test('saving and collectible states use one concise status at mobile widths', async ({ page }) => {
  await installPausedAnimations(page);

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await loadState(page, revealState('committing'));

    await expect(page.getByText('SAVING RESULT')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saving your result.' })).toBeVisible();
    const savingFirmware = page.locator('[data-firmware-state="resolved"]');
    await expect(savingFirmware).toContainText('RECORD STATUS');
    await expect(savingFirmware).toContainText('SAVING');
    await expect(savingFirmware).not.toContainText('EVIDENCE RECORD');
    await expect(savingFirmware).not.toContainText('IN PROGRESS');
    await expect(savingFirmware.getByText('STATUS', { exact: true })).toHaveCount(0);
    await expect(savingFirmware.getByText('RECORDING', { exact: true })).toHaveCount(0);
    await expect(page.getByText('RESULT READY')).toHaveCount(0);
    await noHorizontalOverflow(page);

    await loadState(page, revealState('dispensing'));
    await expect(page.getByText('RESULT READY')).toHaveCount(0);
    await expect(page.getByText('EVIDENCE READY')).toHaveCount(0);
    await noHorizontalOverflow(page);

    await loadState(
      page,
      revealState('dispensing', {
        oracleEvidenceDispensed: true,
      }),
    );
    await expect(page.getByText('RESULT READY')).toBeVisible();
    await expect(page.getByText('Take your evidence record.')).toBeVisible();
    await expect(page.getByText('EVIDENCE READY')).toHaveCount(0);
    const paper = page.getByRole('button', {
      name: /Evidence record for Naturium · Azelaic Topical Acid/i,
    });
    await expect(paper).toBeEnabled();
    await expect(paper).toHaveAttribute('data-paper-position', 'final');
    await noHorizontalOverflow(page);
  }
});

test('recorded result preserves the approved action spacing and factual copy', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await loadState(page, revealState('collected'));
    const completionHeading = page.getByRole('heading', { name: 'EVIDENCE RECORDED' });
    await expect(completionHeading).toBeVisible();
    expect(
      await completionHeading.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeLessThanOrEqual(12);
    await expect(page.getByText('Evidence recorded.', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Your result is saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'DONE' })).toBeFocused();
    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
  }

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

  const latestPaper = page.locator('[data-latest-verdict-record]');
  await latestPaper.focus();
  await expect(latestPaper).toBeFocused();
  await captureEvidence(page, '10-home-paper-focused-390');

  await page.getByRole('button', { name: 'Previous trials, 2 saved results' }).click();
  await expect(page.getByText('Demo controls')).toHaveCount(0);
  await captureEvidence(page, '06-previous-trials');

  await page.setViewportSize({ width: 320, height: 700 });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await captureEvidence(page, '02-home-narrow-320');

  await page.getByRole('button', { name: 'Previous trials, 2 saved results' }).click();
  await expect(page.getByText('Demo controls')).toHaveCount(0);
  await noHorizontalOverflow(page);
  await captureEvidence(page, '11-previous-trials-narrow-320');

  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(page, revealState('collected'));
  await captureEvidence(page, '05-evidence-recorded-done-spacing');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadState(page, completedState([evidenceRecord, olderEvidenceRecord]));
  await captureEvidence(page, '07-home-reduced-motion');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installPausedAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, revealState('committing'));
  await captureEvidence(page, '08-saving-result-390');

  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(
    page,
    revealState('dispensing', {
      oracleEvidenceDispensed: true,
    }),
  );
  await captureEvidence(page, '09-result-ready-430');
});
