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
  const afterReveal = !['sealed', 'opening', 'transmitting'].includes(oracleRevealState);
  const afterCommit = ['committing', 'dispensing', 'collected', 'done'].includes(oracleRevealState);
  const afterCollection = ['collected', 'done'].includes(oracleRevealState);

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

async function loadState(page: Page, state: ReturnType<typeof stateFor>) {
  await page.goto('/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: state,
  });
  await page.reload();
}

async function pauseMachineAt(page: Page, milliseconds: number) {
  await page.locator('[data-oracle-machine]').evaluate((machine, time) => {
    for (const animation of machine.getAnimations({
      subtree: true,
    })) {
      animation.pause();
      animation.currentTime = time;
    }
  }, milliseconds);
}

async function installPausedAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{animation-play-state:paused!important}';
    document.documentElement.append(style);
  });
}

async function screenshotState(page: Page, name: string) {
  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    animations: 'allow',
    fullPage: true,
    maxDiffPixelRatio: 0.012,
  });
}

test('captures the canonical visual states without changing machine geometry', async ({ page }) => {
  await installPausedAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const geometry: Array<{
    state: string;
    chassis: { width: number; height: number };
    display: { width: number; height: number };
    slot: { x: number; width: number };
    reflection: { x: number; y: number; width: number; height: number };
  }> = [];
  const controlLabels = {
    sealed: 'REVEAL',
    opening: 'REVEAL',
    transmitting: 'none',
    verdict_revealed: 'KEEP',
    committing: 'none',
    dispensing: 'none',
    collected: 'none',
  } as const;

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

    const chassis = await page.locator('[data-oracle-chassis]').boundingBox();
    const display = await page.locator('[data-oracle-display-opening]').boundingBox();
    const slot = await page.locator('[data-oracle-slot]').boundingBox();
    const reflection = await page.locator('[data-oracle-glass-reflection]').boundingBox();
    if (!chassis || !display || !slot || !reflection) {
      throw new Error(`Missing oracle geometry for ${phase}`);
    }
    geometry.push({
      state: phase,
      chassis: { width: chassis.width, height: chassis.height },
      display: { width: display.width, height: display.height },
      slot: { x: slot.x, width: slot.width },
      reflection: {
        x: reflection.x - display.x,
        y: reflection.y - display.y,
        width: reflection.width,
        height: reflection.height,
      },
    });
    await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
      'data-machine-material',
      'carbon',
    );
    await expect(page.locator('[data-oracle-machine] [data-amber-state]')).toHaveCount(1);
    const control = page.locator('[data-oracle-handle]');
    await expect(control).toHaveAttribute('data-oracle-control-label', controlLabels[phase]);
    if (!['sealed', 'opening'].includes(phase)) {
      expect(await control.innerText()).not.toContain('REVEAL');
    }
    const reflectionStyle = await page
      .locator('[data-oracle-glass-reflection]')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          opacity: Number.parseFloat(style.opacity),
          background: style.backgroundImage,
        };
      });
    expect(reflectionStyle.opacity).toBeGreaterThanOrEqual(0.05);
    expect(reflectionStyle.opacity).toBeLessThanOrEqual(0.12);
    expect(reflectionStyle.background).not.toMatch(/rgba?\(\s*255\s*,\s*255\s*,\s*255/i);
    expect(reflection.width / display.width).toBeLessThan(1 / 3);
    expect(reflection.height / display.height).toBeLessThan(0.6);
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
    expect(
      Math.abs(sample.reflection.x - baseline.reflection.x),
      `${sample.state} reflection x`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.reflection.y - baseline.reflection.y),
      `${sample.state} reflection y`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.reflection.width - baseline.reflection.width),
      `${sample.state} reflection width`,
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sample.reflection.height - baseline.reflection.height),
      `${sample.state} reflection height`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test('keeps one opaque square paper in a clipped Safari-safe coordinate system', async ({
  page,
}) => {
  await installPausedAnimations(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const machineState = stateFor('dispensing');
  await loadState(page, machineState);
  const paperHandle = await page.locator('[data-oracle-paper]').elementHandle();
  const paperPathHandle = await page.locator('[data-oracle-evidence-path]').elementHandle();
  const initialPaper = await page.locator('[data-oracle-paper]').boundingBox();
  const path = await page.locator('[data-oracle-evidence-path]').boundingBox();
  if (!initialPaper || !path || !paperHandle || !paperPathHandle) {
    throw new Error('Missing persistent evidence path geometry');
  }

  const layerModel = await page.locator('[data-oracle-paper]').evaluate((paper) => {
    const pathElement = paper.parentElement;
    const machine = paper.closest('[data-oracle-machine]');
    const chassis = machine?.querySelector('[data-oracle-chassis]') ?? null;
    const styleFields = (element: Element | null) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        position: style.position,
        zIndex: style.zIndex,
        transform: style.transform,
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter,
        mixBlendMode: style.mixBlendMode,
        isolation: style.isolation,
        overflow: style.overflow,
        clipPath: style.clipPath,
        maskImage: style.maskImage,
        contain: style.contain,
        willChange: style.willChange,
        perspective: style.perspective,
      };
    };
    return {
      paper: styleFields(paper),
      path: styleFields(pathElement),
      machine: styleFields(machine),
      chassis: styleFields(chassis),
    };
  });
  expect(layerModel.paper).toMatchObject({
    opacity: '1',
    filter: 'none',
    backdropFilter: 'none',
    mixBlendMode: 'normal',
    clipPath: 'none',
    maskImage: 'none',
    willChange: 'auto',
  });
  expect(layerModel.path).toMatchObject({
    transform: 'none',
    opacity: '1',
    filter: 'none',
    backdropFilter: 'none',
    overflow: 'hidden',
    clipPath: 'none',
    maskImage: 'none',
    willChange: 'auto',
  });
  expect(layerModel.machine).toMatchObject({
    transform: 'none',
    isolation: 'auto',
    perspective: 'none',
  });
  expect(layerModel.chassis).toMatchObject({
    transform: 'none',
  });

  const lip = await page.locator('[data-oracle-slot-lip]').boundingBox();
  if (!lip) throw new Error('Missing narrow slot lip');
  expect(lip.height).toBeLessThanOrEqual(4.5);
  expect(lip.width).toBeCloseTo(path.width, 0);
  await expect(page.locator('[data-oracle-evidence-path]')).toHaveCount(1);
  await expect(page.locator('[class*="exitOcclusion"]')).toHaveCount(0);

  const samples = [
    { name: 'paper-hidden', time: 0, screenshot: false },
    { name: 'paper-registration', time: 140, screenshot: true },
    { name: 'dispense-midpoint', time: 570, screenshot: true },
    { name: 'paper-final-settle', time: 994, screenshot: false },
  ];

  for (const sample of samples) {
    await pauseMachineAt(page, sample.time);
    const machine = await page.locator('[data-oracle-machine]').boundingBox();
    const paper = await page.locator('[data-oracle-paper]').boundingBox();
    if (!machine || !paper) {
      throw new Error(`Missing paper geometry at ${sample.name}`);
    }
    expect(
      Math.abs(paper.x + paper.width / 2 - (machine.x + machine.width / 2)),
    ).toBeLessThanOrEqual(0.6);
    expect(Math.abs(paper.x - path.x)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(paper.width - initialPaper.width)).toBeLessThanOrEqual(0.6);
    expect(
      await paperHandle.evaluate((node) => node === document.querySelector('[data-oracle-paper]')),
    ).toBe(true);
    expect(
      await paperPathHandle.evaluate(
        (node) => node === document.querySelector('[data-oracle-evidence-path]'),
      ),
    ).toBe(true);
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
      'data-paper-coordinate-system',
      'oracle-machine',
    );
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute('data-paper-rotation', '0');
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute('data-paper-scale', '1');
    const transform = await page.locator('[data-oracle-paper]').evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return {
        rotation: Math.atan2(matrix.b, matrix.a),
        scaleX: Math.hypot(matrix.a, matrix.b),
        scaleY: Math.hypot(matrix.c, matrix.d),
        horizontalTranslation: matrix.e,
      };
    });
    expect(Math.abs(transform.rotation)).toBeLessThan(0.0001);
    expect(transform.scaleX).toBeCloseTo(1, 5);
    expect(transform.scaleY).toBeCloseTo(1, 5);
    expect(Math.abs(transform.horizontalTranslation)).toBeLessThan(0.01);

    const visibleHeight =
      Math.min(paper.y + paper.height, path.y + path.height) - Math.max(paper.y, path.y);
    if (sample.name === 'paper-hidden') {
      expect(visibleHeight).toBeLessThanOrEqual(0.5);
    } else {
      expect(visibleHeight).toBeGreaterThan(0);
    }

    if (sample.name === 'dispense-midpoint') {
      const exposedContentIsPaper = await page
        .locator('[data-oracle-paper]')
        .evaluate((element) => {
          const paperBox = element.getBoundingClientRect();
          const pathBox = element.parentElement!.getBoundingClientRect();
          const visibleTop = Math.max(paperBox.top, pathBox.top);
          const visibleBottom = Math.min(paperBox.bottom, pathBox.bottom);
          const target = document.elementFromPoint(
            paperBox.left + paperBox.width / 2,
            visibleTop + (visibleBottom - visibleTop) * 0.58,
          );
          return Boolean(target && element.contains(target));
        });
      expect(exposedContentIsPaper).toBe(true);
    }

    if (sample.screenshot) {
      await screenshotState(page, `oracle-${sample.name}`);
    }
  }

  await page.locator('[data-oracle-paper]').dispatchEvent('animationend');
  await expect(page.locator('[data-oracle-paper]')).toHaveAttribute('data-paper-position', 'final');
  expect(
    await paperHandle.evaluate((node) => node === document.querySelector('[data-oracle-paper]')),
  ).toBe(true);
});

test('keeps the same paper node from commit through completed feed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, stateFor('committing'));
  const paper = await page.locator('[data-oracle-paper]').elementHandle();
  if (!paper) throw new Error('Paper did not mount for commit');

  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'dispensing',
    { timeout: 3_000 },
  );
  expect(
    await paper.evaluate((node) => node === document.querySelector('[data-oracle-paper]')),
  ).toBe(true);
  await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
    'data-paper-position',
    'final',
    { timeout: 3_000 },
  );
  expect(
    await paper.evaluate((node) => node === document.querySelector('[data-oracle-paper]')),
  ).toBe(true);
});

test('captures a clean reduced-motion feed midpoint', async ({ page }) => {
  await installPausedAnimations(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await loadState(page, stateFor('dispensing'));
  await pauseMachineAt(page, 0.55);

  await expect(page.locator('[data-oracle-paper]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-oracle-evidence-path]')).toHaveCSS('overflow', 'hidden');
  const exposedContentIsPaper = await page.locator('[data-oracle-paper]').evaluate((element) => {
    const paper = element.getBoundingClientRect();
    const path = element.parentElement!.getBoundingClientRect();
    const visibleTop = Math.max(paper.top, path.top);
    const visibleBottom = Math.min(paper.bottom, path.bottom);
    const target = document.elementFromPoint(
      paper.left + paper.width / 2,
      visibleTop + (visibleBottom - visibleTop) * 0.58,
    );
    return Boolean(target && element.contains(target));
  });
  expect(exposedContentIsPaper).toBe(true);
  await screenshotState(page, 'oracle-dispense-midpoint-reduced');
});

test('collection leaves an empty slot, detail is escapable, and Done restores home continuity', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await loadState(page, stateFor('collected'));

  await expect(page.locator('[data-oracle-paper]')).toHaveCount(0);
  await expect(page.locator('[data-oracle-handle]')).toHaveAttribute(
    'data-oracle-control-label',
    'none',
  );
  await expect(
    page.locator('[data-fv-part="screen-header"] [data-oracle-trial-identity]'),
  ).toHaveText('FV–014');
  await expect(page.getByRole('button', { name: 'DONE' })).toBeFocused();
  await screenshotState(page, 'oracle-collected-empty-slot');

  const view = page.getByRole('button', { name: 'VIEW EVIDENCE' });
  await view.click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
  await expect(
    page.locator('[data-evidence-detail]').locator('[data-oracle-trial-identity]'),
  ).toHaveText('FV–014');
  await screenshotState(page, 'oracle-evidence-detail');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toHaveCount(0);
  await expect(view).toBeFocused();

  await page.getByRole('button', { name: 'DONE' }).click();
  await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
  await expect(page.locator('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
    'data-cassette-state',
    'partially-revealed',
  );
  await expect(
    page.locator('[data-latest-verdict-record]').locator('[data-oracle-trial-identity]'),
  ).toHaveText('FV–014');
  await expect(page.getByRole('button', { name: 'START A NEW TRIAL' })).toBeVisible();
  await screenshotState(page, 'home-latest-verdict-partial');
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
  await expect(page.locator('[data-oracle-operation-status]')).toHaveCSS('visibility', 'hidden');
  const statusBox = await page.locator('[data-oracle-operation-status]').boundingBox();
  expect(statusBox?.height).toBeGreaterThan(0);
});

test('responsive and reduced-motion flows preserve order without overflow', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 390, height: 650 },
    { width: 1024, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadState(page, stateFor('sealed'));
    const machineNode = await page.locator('[data-oracle-machine]').elementHandle();
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
    await expect(page.locator('[data-oracle-handle]')).toHaveAttribute(
      'data-oracle-control-label',
      'KEEP',
    );
    await expect(page.locator('[data-firmware-state="resolved"]')).toContainText('TRIAL 014');
    expect(
      await machineNode?.evaluate(
        (node) => node === document.querySelector('[data-oracle-machine]'),
      ),
    ).toBe(true);
    await page.locator('[data-oracle-keep-action="text"]').click();
    await expect(page.locator('[data-oracle-paper]')).toHaveAttribute(
      'data-paper-position',
      'final',
      { timeout: 3_000 },
    );
    await expect(page.locator('[data-oracle-paper]')).toContainText('FV–014');
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
    await expect(page.locator('[data-oracle-handle]')).toHaveAttribute(
      'data-oracle-control-label',
      'none',
    );
    await expect(page.getByRole('button', { name: 'DONE' })).toBeVisible();
    const persisted = await page.evaluate((key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }, STORAGE_KEY);
    expect(persisted?.record?.accession).toBe('FV–014');
    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
    await expect(page.locator('[data-cassette-variant="latest-verdict"]')).toHaveAttribute(
      'data-cassette-state',
      'partially-revealed',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});
