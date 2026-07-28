import {
  expect,
  test,
  type Page,
} from '@playwright/test';
import {
  persistedSealedTrial,
  STORAGE_KEY,
} from './phase-b5-fixtures';

const committedAt = '2026-07-15T12:30:00.000Z';

const evidenceRecord = {
  id: 'ER-202607151230',
  specimenId: persistedSealedTrial.registeredProduct.id,
  accession: persistedSealedTrial.registeredProduct.accession,
  product: persistedSealedTrial.registeredProduct.productName,
  job: persistedSealedTrial.assignedJob,
  observationWindow:
    '2026-07-01T12:00:00.000Z to 2026-07-15T12:00:00.000Z',
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

function stateFor(
  oracleRevealState:
    | 'sealed'
    | 'opening'
    | 'transmitting'
    | 'verdict_revealed'
    | 'committing'
    | 'dispensing'
    | 'collected'
    | 'done',
  overrides: Record<string, unknown> = {},
) {
  const afterReveal = !['sealed', 'opening', 'transmitting'].includes(
    oracleRevealState,
  );
  const afterCommit = [
    'committing',
    'dispensing',
    'collected',
    'done',
  ].includes(oracleRevealState);
  const afterCollection = ['collected', 'done'].includes(
    oracleRevealState,
  );

  return {
    ...persistedSealedTrial,
    placement: 'paused',
    resultRevealed: afterReveal,
    placementSealed: afterCollection,
    oracleRevealState,
    oracleEvidenceDispensed: false,
    oracleCollectionStarted: false,
    oracleCommittedAt: afterCommit ? committedAt : null,
    record: afterCollection ? evidenceRecord : null,
    archive: afterCollection ? [evidenceRecord] : [],
    ...overrides,
  };
}

async function loadState(
  page: Page,
  state: ReturnType<typeof stateFor>,
) {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) =>
      localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: state },
  );
  await page.reload();
}

async function pauseMachineAt(page: Page, milliseconds: number) {
  await page.locator('[data-oracle-machine]').evaluate(
    (machine, time) => {
      for (const animation of machine.getAnimations({
        subtree: true,
      })) {
        animation.pause();
        animation.currentTime = time;
      }
    },
    milliseconds,
  );
}

async function installPausedAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent =
      '*,*::before,*::after{animation-play-state:paused!important}';
    document.documentElement.append(style);
  });
}

async function screenshotState(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'allow',
    fullPage: true,
    maxDiffPixelRatio: 0.012,
  });
}

test('captures the canonical visual states without changing machine geometry', async ({
  page,
}) => {
  await installPausedAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const geometry: Array<{
    state: string;
    chassis: { width: number; height: number };
    display: { width: number; height: number };
    slot: { x: number; width: number };
  }> = [];

  for (const phase of [
    'sealed',
    'opening',
    'transmitting',
    'verdict_revealed',
    'committing',
    'dispensing',
    'collected',
  ] as const) {
    await loadState(
      page,
      stateFor(phase, {
        oracleEvidenceDispensed: phase === 'dispensing',
      }),
    );
    if (phase === 'opening') await pauseMachineAt(page, 80);
    if (phase === 'transmitting') await pauseMachineAt(page, 500);
    if (phase === 'committing') await pauseMachineAt(page, 130);

    const chassis = await page
      .locator('[data-oracle-chassis]')
      .boundingBox();
    const display = await page
      .locator('[data-oracle-display-opening]')
      .boundingBox();
    const slot = await page.locator('[data-oracle-slot]').boundingBox();
    if (!chassis || !display || !slot) {
      throw new Error(`Missing oracle geometry for ${phase}`);
    }
    geometry.push({
      state: phase,
      chassis: { width: chassis.width, height: chassis.height },
      display: { width: display.width, height: display.height },
      slot: { x: slot.x, width: slot.width },
    });
    await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
      'data-machine-material',
      'carbon',
    );
    await expect(
      page.locator('[data-oracle-machine] [data-amber-state]'),
    ).toHaveCount(1);
    await screenshotState(page, `oracle-${phase}`);
  }

  const baseline = geometry[0];
  for (const sample of geometry.slice(1)) {
    expect(
      Math.abs(sample.chassis.width - baseline.chassis.width),
      `${sample.state} chassis width`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.chassis.height - baseline.chassis.height),
      `${sample.state} chassis height`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.display.width - baseline.display.width),
      `${sample.state} display width`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.display.height - baseline.display.height),
      `${sample.state} display height`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.slot.x - baseline.slot.x),
      `${sample.state} slot alignment`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.slot.width - baseline.slot.width),
      `${sample.state} slot width`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test('captures registration and midpoint with one square paper coordinate system', async ({
  page,
}) => {
  await installPausedAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const machineState = stateFor('dispensing');

  for (const sample of [
    { name: 'paper-registration', time: 140 },
    { name: 'dispense-midpoint', time: 570 },
  ]) {
    await loadState(page, machineState);
    await pauseMachineAt(page, sample.time);
    const machine = await page
      .locator('[data-oracle-machine]')
      .boundingBox();
    const paper = await page.locator('[data-oracle-paper]').boundingBox();
    if (!machine || !paper) {
      throw new Error(`Missing paper geometry at ${sample.name}`);
    }
    expect(
      Math.abs(
        paper.x + paper.width / 2 - (machine.x + machine.width / 2),
      ),
    ).toBeLessThanOrEqual(0.6);
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
      'data-paper-coordinate-system',
      'oracle-machine',
    );
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
      'data-paper-rotation',
      '0',
    );
    const rotation = await page.locator('[data-oracle-paper]').evaluate(
      (element) => {
        const matrix = new DOMMatrix(
          getComputedStyle(element).transform,
        );
        return Math.atan2(matrix.b, matrix.a);
      },
    );
    expect(Math.abs(rotation)).toBeLessThan(0.0001);
    await screenshotState(page, `oracle-${sample.name}`);
  }
});

test('collection leaves an empty slot, detail is escapable, and Done restores home continuity', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) =>
    runtimeErrors.push(`page: ${error.message}`),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(page, stateFor('collected'));

  await expect(page.locator('[data-oracle-paper]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'DONE' })).toBeFocused();
  await screenshotState(page, 'oracle-collected-empty-slot');

  const view = page.getByRole('button', { name: 'VIEW EVIDENCE' });
  await view.click();
  await expect(
    page.getByRole('heading', { name: 'EVIDENCE DETAIL' }),
  ).toBeVisible();
  await screenshotState(page, 'oracle-evidence-detail');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'EVIDENCE DETAIL' }),
  ).toHaveCount(0);
  await expect(view).toBeFocused();

  await page.getByRole('button', { name: 'DONE' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your trials' }),
  ).toBeVisible();
  await expect(page.getByText('LATEST EVIDENCE')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'START ANOTHER TRIAL' }),
  ).toBeVisible();
  await screenshotState(page, 'oracle-home-latest-evidence');
  expect(runtimeErrors).toEqual([]);
});

test('collection removal reserves space without overlaying obsolete instructions', async ({
  page,
}) => {
  await installPausedAnimations(page);
  await loadState(
    page,
    stateFor('dispensing', {
      oracleEvidenceDispensed: true,
      oracleCollectionStarted: true,
    }),
  );

  await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
    'data-paper-position',
    'collecting',
  );
  await expect(
    page.locator('[data-oracle-operation-status]'),
  ).toHaveCSS('visibility', 'hidden');
  const statusBox = await page
    .locator('[data-oracle-operation-status]')
    .boundingBox();
  expect(statusBox?.height).toBeGreaterThan(0);
});

test('responsive and reduced-motion flows preserve order without overflow', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 390, height: 650 },
    { width: 1024, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadState(page, stateFor('sealed'));
    const machineNode = await page
      .locator('[data-oracle-machine]')
      .elementHandle();
    await page
      .getByRole('button', {
        name: /Reveal sealed result for Azelaic Topical Acid/i,
      })
      .press('Space');
    await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
      'data-oracle-state',
      'verdict_revealed',
      // The reduced-motion animations are 1 ms; the wider budget accounts
      // only for WebKit delivering chained animation events under CI load.
      { timeout: 3_000 },
    );
    expect(
      await machineNode?.evaluate(
        (node) =>
          node === document.querySelector('[data-oracle-machine]'),
      ),
    ).toBe(true);
    await page.locator('[data-oracle-keep-action="text"]').click();
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
      'data-paper-position',
      'final',
      { timeout: 3_000 },
    );
    await page
      .getByRole('button', {
        name: /Evidence record for Naturium · Azelaic Topical Acid/i,
      })
      .click();
    await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
      'data-oracle-state',
      'collected',
      { timeout: 3_000 },
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});
