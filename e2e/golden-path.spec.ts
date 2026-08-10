import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { STORAGE_KEY } from './phase-b5-fixtures';

type GoldenPathCase = {
  name: string;
  viewport: { width: number; height: number };
  reducedMotion: boolean;
  captureEvidence: boolean;
};

const cases: GoldenPathCase[] = [
  {
    name: '390 × 844',
    viewport: { width: 390, height: 844 },
    reducedMotion: false,
    captureEvidence: true,
  },
  {
    name: '430 × 932',
    viewport: { width: 430, height: 932 },
    reducedMotion: false,
    captureEvidence: false,
  },
  {
    name: 'reduced browser height',
    viewport: { width: 390, height: 650 },
    reducedMotion: false,
    captureEvidence: false,
  },
  {
    name: 'prefers-reduced-motion',
    viewport: { width: 390, height: 844 },
    reducedMotion: true,
    captureEvidence: false,
  },
];

function collectRuntimeErrors(page: Page, analysisAcceptances: string[] = []): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
    if (
      message.type() === 'info' &&
      message.text().includes('[face-value-analysis]') &&
      message.text().includes('normalized')
    ) {
      analysisAcceptances.push(message.text());
    }
  });
  return errors;
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertNoInternalJourneyJargon(page: Page): Promise<void> {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(
    /upload slot|provider task|signed URL|normalization|reducer|hd_redness|raw_score|polling|YouCam/i,
  );
}

function assertFaceFreeStorage(serialized: string | null): void {
  expect(serialized).toBeTruthy();
  expect(serialized).not.toMatch(
    /providerTaskId|ephemeralTaskReference|data:image|blob:|YOUCAM_API_KEY|YOUCAM_SPIKE_TOKEN|Authorization: Bearer|MediaStream|CameraKit instance|signed provider|temporary mask/i,
  );
}

async function expectGuidedQualityReady(page: Page): Promise<void> {
  const quality = page.getByLabel('Capture quality');
  await expect(quality.locator('[data-quality-state="passed"]')).toHaveCount(3, {
    timeout: 2_000,
  });
}

async function takeGuidedCapture(page: Page, kind: 'baseline' | 'followup'): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Position your face' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /shutter|take photo|use this capture/i }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Choose a face photo')).toBeAttached();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toBeVisible();
  await expect(page.locator('[data-preview-state="preview-live"]')).toBeVisible();
  await expectGuidedQualityReady(page);
  const captureScreen = page.locator('section[data-preview-state]');
  await expect(captureScreen).toHaveAttribute('data-burst-captured', '3');
  await expect(page.getByRole('heading', { name: 'Scan complete' })).toBeVisible();
  await expect(page.locator('[data-measurement-indicator]')).toHaveAttribute(
    'data-measurements-accepted',
    '3',
  );
  if (kind === 'followup') {
    await expect(page.locator('[data-fv-screen="trial-truth"]')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('radio', { name: 'YES' }).check();
    await page.getByRole('button', { name: 'Continue to skin response' }).click();
    await page.getByRole('radio', { name: 'NONE' }).check();
    await page.getByRole('button', { name: 'Continue to visible redness' }).click();
    await page.getByRole('radio', { name: 'LESS' }).check();
    await page.getByRole('button', { name: 'Continue to capture check' }).click();
    await expect(
      page.getByRole('heading', { name: 'Anything different around today’s scan?' }),
    ).toBeVisible();
    await expect(page.locator('[data-fv-screen="followup-context"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'NOTHING DIFFERENT' }).click();
    await page.getByRole('button', { name: 'See result' }).click();
    return;
  }
  await expect(
    page.getByRole('heading', {
      name: 'Anything meaningfully different today?',
    }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`[data-fv-screen="${kind}-context"]`)).toBeVisible();
  await page.getByRole('button', { name: 'NOTHING DIFFERENT' }).click();
}

async function saveScreenshot(
  page: Page,
  testInfo: TestInfo,
  enabled: boolean,
  name: string,
): Promise<void> {
  if (!enabled) return;
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

for (const scenario of cases) {
  test(`complete Phase B.5 golden path — ${scenario.name}`, async ({ page }, testInfo) => {
    const analysisAcceptances: string[] = [];
    const runtimeErrors = collectRuntimeErrors(page, analysisAcceptances);
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({
      reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
    });
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', {
        name: 'Is your skincare actually doing anything?',
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOAD A PRODUCT' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoInternalJourneyJargon(page);

    await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
    await page.getByLabel('Brand').fill('Naturium');
    await page.getByLabel('Product name').fill('Azelaic Topical Acid');
    await page.getByLabel('Strength or concentration').fill('10%');
    await page.getByLabel('Volume').fill('30 ml');
    await expect(page.getByRole('radio')).toHaveCount(1);
    await expect(page.getByRole('radio')).toBeChecked();
    await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();

    await expect(page.getByText('READY TO SCAN')).toBeVisible();
    const specimen = page.locator('[data-oracle-specimen]');
    await expect(specimen).toHaveAttribute('data-specimen-brand', 'Naturium');
    await expect(specimen).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
    await expect(specimen).toHaveAttribute('data-display-brand', 'NATURIUM');
    await expect(specimen.getByText('NATURIUM', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AZELAIC', { exact: true })).toBeVisible();
    await expect(specimen.getByText('10%', { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
    await takeGuidedCapture(page, 'baseline');
    expect(analysisAcceptances).toHaveLength(3);
    expect(analysisAcceptances.every((entry) => entry.includes('baseline'))).toBe(true);
    await expect(page.getByRole('heading', { name: 'Baseline locked.' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /take follow-up|continue|compare/i }),
    ).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, testInfo, scenario.captureEvidence, 'phase-b5-baseline-locked');

    const baselineStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(baselineStorage).toContain('Naturium');
    expect(baselineStorage).toContain('93.3356');
    expect(baselineStorage).toContain('92.5');
    expect(baselineStorage).toContain('94.25');
    expect(baselineStorage).toContain('youcam-redness-v1');
    expect(baselineStorage).toContain('"cameraProfileId":"youcam-camera-kit-standard-720p"');
    assertFaceFreeStorage(baselineStorage);

    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
    await expect(page.getByText('DAY 01 OF 14')).toBeVisible();
    await expect(page.getByText('IN 14 DAYS')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
    await expect(specimen).toHaveAttribute('data-specimen-brand', 'Naturium');
    await expect(specimen).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
    await expect(specimen).toHaveAttribute('data-display-brand', 'NATURIUM');
    await expect(specimen.getByText('NATURIUM', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AZELAIC', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toHaveCount(0);

    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error('Expected a persisted baseline trial.');
      const persisted = JSON.parse(raw) as {
        demoTimelineAdvanced: boolean;
      };
      persisted.demoTimelineAdvanced = true;
      localStorage.setItem(key, JSON.stringify(persisted));
    }, STORAGE_KEY);
    await page.reload();
    await expect(page.getByText('FOLLOW-UP READY').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toBeVisible();
    await expect(page.getByText('READY', { exact: true })).toBeVisible();

    const advancedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(advancedStorage).toContain('"demoTimelineAdvanced":true');
    expect(advancedStorage).toContain(JSON.parse(baselineStorage!).baselineLockedAt);
    assertFaceFreeStorage(advancedStorage);

    await page.getByRole('button', { name: 'Take follow-up scan' }).click();
    await takeGuidedCapture(page, 'followup');
    expect(analysisAcceptances).toHaveLength(6);
    expect(analysisAcceptances.slice(3).every((entry) => entry.includes('followup'))).toBe(true);
    await expect(
      page.getByRole('heading', {
        name: 'Comparing against your baseline…',
      }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible({
      timeout: 1_500,
    });
    const comparedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    const comparedData = JSON.parse(comparedStorage!) as {
      baselineCapture: { cameraProfileId?: string };
      followupCapture: { cameraProfileId?: string };
      analysis: {
        rednessEvaluation: {
          frameworkVersion: string;
          schemaVersion: string;
          engineVersion: string;
          assignedJob: string;
          baseline: {
            sessionCount: number;
            acceptedRawScores: number[];
            rejectedFrameCount: number;
          };
          endpoint: {
            sessionCount: number;
            acceptedRawScores: number[];
            rejectedFrameCount: number;
          };
          directionAgreement: {
            status: string;
            assessedEndpointFrameCount: number;
          };
          rawScoreDelta: number;
          threshold: {
            source: string;
            version: string;
            configHash: string;
            provisional: boolean;
          };
          measurementQuality: string;
          evidenceQuality: string;
          interpretation: { recommendedAction: string };
          privacy: { includesFaceImage: boolean };
        };
      };
      longitudinalEvidence: { evaluation: unknown };
    };
    expect(comparedData.followupCapture.cameraProfileId).toBe(
      comparedData.baselineCapture.cameraProfileId,
    );
    const evaluation = comparedData.analysis.rednessEvaluation;
    expect(evaluation).toMatchObject({
      frameworkVersion: 'redness-v1',
      schemaVersion: 'redness-evidence-v1',
      engineVersion: 'face-value-redness-engine-v1.0.0',
      assignedJob: 'calm_visible_redness',
      baseline: {
        sessionCount: 1,
        acceptedRawScores: [93.3356, 92.5, 94.25],
        rejectedFrameCount: 0,
      },
      endpoint: {
        sessionCount: 1,
        acceptedRawScores: [100, 99, 100],
        rejectedFrameCount: 0,
      },
      directionAgreement: {
        status: 'agreeing',
        assessedEndpointFrameCount: 3,
      },
      threshold: {
        source: 'provisional_fixture',
        version: 'redness-provisional-v1',
        provisional: true,
      },
      measurementQuality: 'limited',
      evidenceQuality: 'possible',
      interpretation: { recommendedAction: 'test_longer' },
      privacy: { includesFaceImage: false },
    });
    expect(evaluation.rawScoreDelta).toBeCloseTo(6.6644, 8);
    expect(evaluation.threshold.configHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(comparedData.longitudinalEvidence.evaluation).toEqual(evaluation);
    expect(comparedStorage).not.toMatch(/ui_score|uiScore/);

    const forbiddenResultText = [
      'Visible redness moved in a favorable direction.',
      'The direction looks encouraging',
      'The trial window is not complete',
      'TEST LONGER',
      '93.34',
      '100.00',
    ];
    const oracleScene = page.locator('[data-fv-screen="oracle-reveal"]');
    const machine = page.locator('[data-oracle-machine]');
    const machineNode = await machine.elementHandle();
    const sealedHtml = await oracleScene.innerHTML();
    const sealedAria = await oracleScene.ariaSnapshot();
    for (const forbidden of forbiddenResultText) {
      expect(sealedHtml).not.toContain(forbidden);
      expect(sealedAria).not.toContain(forbidden);
    }
    await saveScreenshot(page, testInfo, scenario.captureEvidence, 'phase-b5-result-sealed');

    const reveal = page.getByRole('button', {
      name: /Reveal sealed result for Azelaic Topical Acid/i,
    });
    await reveal.press('Enter');
    await expect(machine).toHaveAttribute(
      'data-oracle-state',
      'verdict_revealed',
      { timeout: scenario.reducedMotion ? 3_000 : 15_000 },
    );
    expect(
      await machineNode?.evaluate(
        (original) => original === document.querySelector('[data-oracle-machine]'),
      ),
    ).toBe(true);
    await expect(page.locator('[data-firmware-state="resolved"]')).toContainText(
      'Visible redness moved in a favorable direction.',
    );
    await expect(page.getByLabel('Result recommendation').locator(':scope > p')).toBeVisible();
    await expect(page.locator('[data-firmware-state="resolved"]')).toContainText('TEST LONGER');
    await expect(page.locator('[data-oracle-keep-action="text"]')).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Keep this result',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/P1 · Test longer/i)).toBeHidden();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(page, testInfo, scenario.captureEvidence, 'phase-b5-one-reveal');

    await page.getByRole('button', { name: 'SEE WHY' }).click();
    await expect(
      page
        .locator('#oracle-why')
        .getByText(
          'The trial window is not complete. Keep the predeclared schedule before judging this product job.',
        ),
    ).toBeVisible();

    const amber = page.getByRole('button', {
      name: 'Keep this result',
      exact: true,
    });
    await amber.evaluate((element) => {
      (element as HTMLButtonElement).click();
      (element as HTMLButtonElement).click();
    });
    await expect(machine).toHaveAttribute('data-oracle-state', 'dispensing', {
      timeout: scenario.reducedMotion ? 1_000 : 2_000,
    });
    await expect(
      page.getByRole('button', {
        name: 'Keep this result',
        exact: true,
      }),
    ).toHaveCount(0);
    const paper = page.locator('[data-oracle-paper]');
    await expect(paper).toHaveAttribute('data-paper-position', 'final', {
      timeout: scenario.reducedMotion ? 1_000 : 2_000,
    });
    await expect(paper).toHaveAttribute('data-paper-coordinate-system', 'oracle-machine');
    await expect(paper).toHaveAttribute('data-paper-rotation', '0');
    const recordId = await paper.getAttribute('data-record-id');
    expect(recordId).toBeTruthy();

    const uncollectedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    const uncollectedData = JSON.parse(uncollectedStorage!) as {
      archive: Array<{ id: string; demoOriginated?: boolean }>;
      record: { id: string; demoOriginated?: boolean } | null;
    };
    expect(uncollectedData.archive).toHaveLength(0);
    expect(uncollectedData.record).toBeNull();
    assertFaceFreeStorage(uncollectedStorage);
    await saveScreenshot(page, testInfo, scenario.captureEvidence, 'phase-b5-evidence-dispensed');

    await page.reload();
    await expect(machine).toHaveAttribute('data-oracle-state', 'dispensing');
    await expect(paper).toHaveAttribute('data-record-id', recordId!);

    await page
      .getByRole('button', {
        name: /Evidence record for Naturium · Azelaic Topical Acid/i,
      })
      .press('Enter');
    await expect(machine).toHaveAttribute('data-oracle-state', 'collected', {
      timeout: 3_000,
    });
    await expect(page.locator('[data-oracle-paper]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'DONE' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'DONE' })).toHaveCount(1);
    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).click();
    await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
    const evidenceDetail = page.locator('[data-evidence-detail]');
    await expect(
      page.getByText(/Demo timing was advanced explicitly; capture timestamps remain unchanged/i),
    ).toBeVisible();
    await expect(
      evidenceDetail.getByText('Production thresholds require repeat-scan calibration.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      evidenceDetail.getByText(/provisional_fixture · redness-provisional-v1/i),
    ).toBeVisible();

    const savedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    const savedData = JSON.parse(savedStorage!) as {
      archive: Array<{
        id: string;
        demoOriginated?: boolean;
        rednessEvaluation: unknown;
      }>;
      record: {
        id: string;
        demoOriginated?: boolean;
        rednessEvaluation: unknown;
      };
    };
    expect(savedData.archive).toHaveLength(1);
    expect(savedData.archive[0].id).toBe(recordId);
    expect(savedData.record.id).toBe(recordId);
    expect(savedData.record.demoOriginated).toBe(true);
    expect(savedData.record.rednessEvaluation).toEqual(evaluation);
    expect(savedData.archive[0].rednessEvaluation).toEqual(evaluation);
    assertFaceFreeStorage(savedStorage);

    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).click();
    await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toHaveCount(0);
    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
    await expect(page.locator('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
      'data-cassette-state',
      'partially-revealed',
    );
    await expect(page.locator('[data-latest-verdict-record] [data-evidence-finding]')).toHaveText(
      'Visible redness moved in a favorable direction.',
    );
    await expect(page.getByRole('button', { name: 'START A NEW TRIAL' })).toBeVisible();

    await page.getByRole('button', { name: /Previous trials, 1 saved result/i }).click();
    const archive = page.getByLabel('Previous trials');
    const savedRecord = archive.getByRole('button', {
      name: /Open saved result/i,
    });
    await expect(savedRecord).toHaveCount(1);
    const savedRecordText = await savedRecord.innerText();
    expect(savedRecordText).toMatch(/\d{2}\s[A-Z]{3}\s2026/);
    expect(savedRecordText).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Previous trials' })).toBeVisible();
    await expect(
      page.getByLabel('Previous trials').getByRole('button', { name: /Open saved result/i }),
    ).toHaveCount(1);
    await page
      .getByLabel('Previous trials')
      .getByRole('button', { name: /Open saved result/i })
      .click();
    await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
    await expect(page.getByText('Visible redness moved in a favorable direction.')).not.toHaveCount(
      0,
    );
    await expect(page.getByText('redness-provisional-v1')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open evidence record' }).click();
    const evidenceDialog = page.getByRole('dialog', { name: 'Evidence record' });
    await expect(evidenceDialog).toBeVisible();
    await evidenceDialog.getByRole('button', { name: 'Technical record' }).click();
    await expect(page.getByRole('heading', { name: 'Technical record' })).toBeVisible();

    await page.getByRole('button', { name: /Open Provider details/ }).click();
    await expect(page.locator('[data-technical-field="baseline-median"]')).toContainText('93.34');
    await expect(page.locator('[data-technical-field="follow-up-median"]')).toContainText('100');
    await expect(page.locator('[data-technical-field="accepted-frames"]')).toContainText(
      '3/3 ↔ 3/3',
    );

    await page.getByRole('button', { name: 'Back to previous inspection layer' }).click();
    await page.getByRole('button', { name: /Open Evaluation details/ }).click();
    await expect(page.locator('[data-technical-field="direction-agreement"]')).toContainText(
      'Agreeing',
    );
    await expect(page.locator('[data-technical-field="measurement-quality"]')).toContainText(
      'Limited',
    );
    await expect(page.locator('[data-technical-field="evidence-quality"]')).toContainText('Early');
    await expect(page.locator('[data-technical-field="recommended-action"]')).toContainText(
      'Test longer',
    );

    const restoredArchive = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(restoredArchive).toContain(recordId);
    expect(restoredArchive).toContain('redness-provisional-v1');
    assertFaceFreeStorage(restoredArchive);

    await expect(page).toHaveURL(/\/$/);
    await assertNoHorizontalOverflow(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).not.toBe('none');
    expect(runtimeErrors).toEqual([]);
  });
}
