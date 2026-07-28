import {
  expect,
  test,
  type Page,
  type TestInfo,
} from '@playwright/test';
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

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
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
  await expect(quality.locator('[data-accepted="true"]')).toHaveCount(3, {
    timeout: 800,
  });
  await expect(
    page.locator('p[aria-hidden="true"]', { hasText: 'Hold still…' }),
  ).toBeVisible();
}

async function takeGuidedCapture(
  page: Page,
  kind: 'baseline' | 'followup',
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Center your face' }),
  ).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /shutter|take photo|use this capture/i }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Choose a face photo')).toBeAttached();
  await expect(
    page.locator('[data-camera-kit-fixture="active"]'),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'START GUIDED CAPTURE' })
    .click();
  await expect(
    page.locator('[data-camera-kit-fixture="active"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-preview-state="preview-live"]'),
  ).toBeVisible();
  await expectGuidedQualityReady(page);
  await expect(
    page.getByRole('heading', {
      name: 'Anything meaningfully different today?',
    }),
  ).toBeVisible({ timeout: 2_000 });
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
  test(`complete Phase B.5 golden path — ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page);
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
    await expect(
      page.getByRole('button', { name: 'START A PRODUCT TRIAL' }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoInternalJourneyJargon(page);

    await page
      .getByRole('button', { name: 'START A PRODUCT TRIAL' })
      .click();
    await page.getByLabel('Brand').fill('Naturium');
    await page.getByLabel('Product name').fill('Azelaic Topical Acid');
    await page.getByLabel('Strength or concentration').fill('10%');
    await page.getByLabel('Volume').fill('30 ml');
    await expect(page.getByRole('radio')).toHaveCount(1);
    await expect(page.getByRole('radio')).toBeChecked();
    await page.getByRole('button', { name: 'REGISTER PRODUCT' }).click();

    await expect(
      page.getByRole('heading', { name: 'Your product is ready.' }),
    ).toBeVisible();
    await expect(page.getByText('Naturium', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Azelaic Topical Acid', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('SPECIMEN 01')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page
      .getByRole('button', { name: 'TAKE GUIDED BASELINE' })
      .click();
    await takeGuidedCapture(page, 'baseline');
    await expect(
      page.getByRole('heading', { name: 'Baseline locked.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /take follow-up|continue|compare/i }),
    ).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(
      page,
      testInfo,
      scenario.captureEvidence,
      'phase-b5-baseline-locked',
    );

    const baselineStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(baselineStorage).toContain('Naturium');
    expect(baselineStorage).toContain('93.3356');
    expect(baselineStorage).toContain('youcam-redness-v1');
    expect(baselineStorage).toContain(
      '"cameraProfileId":"youcam-camera-kit-hd-1080p"',
    );
    assertFaceFreeStorage(baselineStorage);

    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(
      page.getByRole('heading', { name: 'Your trials' }),
    ).toBeVisible();
    await expect(page.getByText(/DAY 1 OF 14/)).toBeVisible();
    await expect(page.getByText(/FOLLOW-UP IN 14 DAYS/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'TAKE FOLLOW-UP' }),
    ).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your trials' }),
    ).toBeVisible();
    await expect(page.getByText('Naturium', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Azelaic Topical Acid', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'TAKE FOLLOW-UP' }),
    ).toHaveCount(0);

    await expect(
      page.getByRole('button', { name: 'ADVANCE DEMO TIMELINE' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'ADVANCE DEMO TIMELINE' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Let’s see what changed.' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'DEMO TIMELINE ADVANCED · BASELINE DATE UNCHANGED',
      ),
    ).toBeVisible();

    const advancedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(advancedStorage).toContain('"demoTimelineAdvanced":true');
    expect(advancedStorage).toContain(
      JSON.parse(baselineStorage!).baselineLockedAt,
    );
    assertFaceFreeStorage(advancedStorage);

    await page.getByRole('button', { name: 'TAKE FOLLOW-UP' }).click();
    await takeGuidedCapture(page, 'followup');
    await expect(
      page.getByRole('heading', {
        name: 'Comparing against your baseline…',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your result is ready.' }),
    ).toBeVisible({ timeout: 1_500 });
    const comparedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    const comparedData = JSON.parse(comparedStorage!) as {
      baselineCapture: { cameraProfileId?: string };
      followupCapture: { cameraProfileId?: string };
    };
    expect(comparedData.followupCapture.cameraProfileId).toBe(
      comparedData.baselineCapture.cameraProfileId,
    );

    const forbiddenResultText = [
      'A small favorable shift showed up.',
      'Visible redness moved in the intended direction.',
      'normal scan variation',
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
    await saveScreenshot(
      page,
      testInfo,
      scenario.captureEvidence,
      'phase-b5-result-sealed',
    );

    const reveal = page.getByRole('button', {
      name: /Reveal sealed result for Azelaic Topical Acid/i,
    });
    await reveal.press('Enter');
    await expect(machine).toHaveAttribute(
      'data-oracle-state',
      'verdict_revealed',
      // WebKit may defer animation events on a constrained CI runner.
      // This changes only the assertion budget; product motion still uses the
      // centralized oracle timing contract (1 ms in reduced-motion mode).
      { timeout: scenario.reducedMotion ? 3_000 : 15_000 },
    );
    expect(
      await machineNode?.evaluate(
        (original) =>
          original === document.querySelector('[data-oracle-machine]'),
      ),
    ).toBe(true);
    await expect(
      page.locator('[data-firmware-state="resolved"]'),
    ).toContainText('A small favorable shift showed up.');
    await expect(
      page.getByLabel('Oracle recommendation').locator(':scope > p'),
    ).toBeVisible();
    await expect(page.locator('[data-firmware-state="resolved"]')).toContainText(
      'TEST LONGER',
    );
    await expect(
      page.locator('[data-oracle-keep-action="text"]'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: 'Keep this result',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/P1 · Test longer/i)).toBeHidden();
    await assertNoHorizontalOverflow(page);
    await saveScreenshot(
      page,
      testInfo,
      scenario.captureEvidence,
      'phase-b5-one-reveal',
    );

    await page.getByRole('button', { name: 'SEE WHY' }).click();
    await expect(
      page.getByText(
        'This prototype cannot yet tell whether the shift is larger than normal scan variation.',
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
    await expect(machine).toHaveAttribute(
      'data-oracle-state',
      'dispensing',
      { timeout: scenario.reducedMotion ? 1_000 : 2_000 },
    );
    await expect(
      page.getByRole('button', {
        name: 'Keep this result',
        exact: true,
      }),
    ).toHaveCount(0);
    const paper = page.locator('[data-oracle-paper]');
    await expect(
      paper,
    ).toHaveAttribute('data-paper-position', 'final', {
      timeout: scenario.reducedMotion ? 1_000 : 2_000,
    });
    await expect(paper).toHaveAttribute(
      'data-paper-coordinate-system',
      'oracle-machine',
    );
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
    await saveScreenshot(
      page,
      testInfo,
      scenario.captureEvidence,
      'phase-b5-evidence-dispensed',
    );

    await page.reload();
    await expect(machine).toHaveAttribute(
      'data-oracle-state',
      'dispensing',
    );
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
    await expect(
      page.getByRole('button', { name: 'DONE' }),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).click();
    await expect(
      page.getByRole('heading', { name: 'EVIDENCE DETAIL' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Demo timeline was advanced explicitly; the original baseline timestamp was not changed/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/YouCam Skin Analysis v2.1/i),
    ).toBeVisible();

    const savedStorage = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    const savedData = JSON.parse(savedStorage!) as {
      archive: Array<{ id: string; demoOriginated?: boolean }>;
      record: { id: string; demoOriginated?: boolean };
    };
    expect(savedData.archive).toHaveLength(1);
    expect(savedData.archive[0].id).toBe(recordId);
    expect(savedData.record.id).toBe(recordId);
    expect(savedData.record.demoOriginated).toBe(true);
    assertFaceFreeStorage(savedStorage);

    await page.getByRole('button', { name: 'VIEW EVIDENCE' }).click();
    await expect(
      page.getByRole('heading', { name: 'EVIDENCE DETAIL' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(
      page.getByRole('heading', { name: 'Your trials' }),
    ).toBeVisible();
    await expect(page.getByText('LATEST EVIDENCE')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'START ANOTHER TRIAL' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Past results' }).click();
    const archive = page.getByLabel('Past results');
    const savedRecord = archive.getByRole('button', {
      name: /Open saved result/i,
    });
    await expect(savedRecord).toHaveCount(1);
    const savedRecordText = await savedRecord.innerText();
    expect(savedRecordText).toMatch(
      /[A-Z][a-z]{2} \d{1,2}, 2026 · \d{1,2}:\d{2} [AP]M–\d{1,2}:\d{2} [AP]M/,
    );
    expect(savedRecordText).not.toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Past results' }),
    ).toBeVisible();
    await expect(
      page
        .getByLabel('Past results')
        .getByRole('button', { name: /Open saved result/i }),
    ).toHaveCount(1);
    const restoredArchive = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(restoredArchive).toContain(recordId);
    assertFaceFreeStorage(restoredArchive);

    await expect(page).toHaveURL(/\/$/);
    await assertNoHorizontalOverflow(page);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.body).touchAction,
      ),
    ).not.toBe('none');
    expect(runtimeErrors).toEqual([]);
  });
}
