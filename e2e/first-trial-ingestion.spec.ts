import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type ElementHandle, type Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/adapters/persistence/localObservationStore';

const captureEvidence = process.env.CAPTURE_FIRST_TRIAL_EVIDENCE === 'true';
const evidenceDirectory = resolve('docs/verification/first-trial-identity-lock-v2');

const registrationTiming = {
  preparingCheckpoint: 150,
  aligningStart: 300,
  aligningCheckpoint: 550,
  scanningStart: 800,
  scanningCheckpoint: 1_700,
  processingStart: 2_600,
  processingCheckpoint: 2_800,
  verifiedStart: 3_200,
  verifiedCheckpoint: 3_400,
  readyStart: 3_800,
} as const;

const invariantSpecimenLayers = [
  'cap',
  'collar',
  'shoulder-form',
  'bottle-body',
  'thermal-evidence-label',
] as const;

const requiredSpecimenLayers = [
  'contact-shadow',
  'amber-ground-bounce',
  'shoulder-form',
  'bottle-body',
  'internal-product-fill',
  'base-thickness',
  'center-sheen',
  'warm-chamber-bounce',
  'product-meniscus',
  'base-reflection',
  'left-rim',
  'right-rim',
  'shoulder-highlight',
  'collar',
  'cap-contact-seam',
  'cap',
  'cap-top-plane',
  'evidence-lock-strip',
  'label-corner-lift-shadow',
  'thermal-evidence-label',
] as const;

type RuntimeIssue = {
  kind: 'console' | 'page' | 'response';
  detail: string;
};

function collectRuntimeIssues(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({ kind: 'console', detail: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    issues.push({ kind: 'page', detail: error.message });
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      issues.push({
        kind: 'response',
        detail: `${response.status()} ${response.url()}`,
      });
    }
  });
  return issues;
}

async function openFreshTrial(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('[data-fv-screen="welcome"]')).toBeVisible();
}

async function openDemoState(page: Page, startingPoint: string): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function captureCheckpoint(
  page: Page,
  fileName: string,
  settlePausedClock = false,
): Promise<void> {
  if (!captureEvidence) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  if (settlePausedClock) {
    await page.clock.runFor(16);
  } else {
    await page.evaluate(
      () =>
        new Promise<void>((resolveFrame) => {
          window.requestAnimationFrame(() => resolveFrame());
        }),
    );
  }
  await page.screenshot({
    path: resolve(evidenceDirectory, fileName),
    animations: 'allow',
    fullPage: false,
    scale: 'css',
  });
}

async function expectCurrentNode(handle: ElementHandle, selector: string): Promise<void> {
  expect(
    await handle.evaluate(
      (node, currentSelector) => node === document.querySelector(currentSelector),
      selector,
    ),
  ).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

async function labelMetrics(page: Page) {
  return page.locator('[data-specimen-layer="thermal-evidence-label"]').evaluate((label) => {
    const style = getComputedStyle(label);
    return {
      clientWidth: label.clientWidth,
      scrollWidth: label.scrollWidth,
      clientHeight: label.clientHeight,
      scrollHeight: label.scrollHeight,
      overflowWrap: style.overflowWrap,
    };
  });
}

async function machineDocumentGeometry(page: Page) {
  return page.locator('[data-oracle-machine]').evaluate((machine) => {
    const box = machine.getBoundingClientRect();
    const style = getComputedStyle(machine);
    const rounded = (value: number) => Math.round(value * 100) / 100;
    return {
      x: rounded(box.x),
      viewportY: rounded(box.y),
      documentY: rounded(box.y + window.scrollY),
      width: rounded(box.width),
      height: rounded(box.height),
      transform: style.transform,
      animationName: style.animationName,
    };
  });
}

async function hardwareGeometry(page: Page) {
  return page.locator('[data-oracle-machine]').evaluate((machine) => {
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const machineBox = machine.getBoundingClientRect();
    const bounds = (selector: string) => {
      const element = machine.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing hardware element: ${selector}`);
      const box = element.getBoundingClientRect();
      return {
        x: rounded(box.x - machineBox.x),
        y: rounded(box.y - machineBox.y),
        width: rounded(box.width),
        height: rounded(box.height),
        borderRadius: getComputedStyle(element).borderRadius,
      };
    };
    return {
      machine: {
        width: rounded(machineBox.width),
        height: rounded(machineBox.height),
        borderRadius: getComputedStyle(machine).borderRadius,
      },
      chassis: bounds('[data-oracle-chassis]'),
      displayOpening: bounds('[data-oracle-display-opening]'),
      lowerDeck: bounds('[data-oracle-lower-deck]'),
      amberControl: bounds('[data-oracle-amber-control]'),
      pullHandle: bounds('[data-oracle-handle]'),
      bottomRail: bounds('[data-oracle-bottom-rail]'),
    };
  });
}

async function workflowLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing workflow element: ${selector}`);
      const box = element.getBoundingClientRect();
      return {
        x: rounded(box.x),
        y: rounded(box.y),
        width: rounded(box.width),
        height: rounded(box.height),
        right: rounded(box.right),
        bottom: rounded(box.bottom),
      };
    };
    const back = bounds('[data-first-trial-lead="product_registration"] button');
    const machine = bounds('[data-oracle-machine]');
    const panel = bounds('[data-registration-panel]');
    return {
      back,
      machine,
      panel,
      backToMachine: rounded(machine.y - back.bottom),
      machineToPanel: rounded(panel.y - machine.bottom),
    };
  });
}

async function specimenGeometry(page: Page) {
  return page.locator('[data-oracle-specimen]').evaluate((specimen, requestedLayers) => {
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const root = specimen.getBoundingClientRect();
    const relativeBounds = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        x: rounded(box.x - root.x),
        y: rounded(box.y - root.y),
        width: rounded(box.width),
        height: rounded(box.height),
      };
    };
    const layers = Object.fromEntries(
      requestedLayers.map((name) => {
        const element = specimen.querySelector(`[data-specimen-layer="${name}"]`);
        if (!element) throw new Error(`Missing invariant specimen layer: ${name}`);
        return [name, relativeBounds(element)];
      }),
    );
    const strip = specimen.querySelector('[data-specimen-layer="evidence-lock-strip"]');
    if (!strip) throw new Error('Missing evidence lock strip.');
    return {
      root: {
        width: rounded(root.width),
        height: rounded(root.height),
        aspectRatio: rounded(root.width / root.height),
        computedAspectRatio: getComputedStyle(specimen).aspectRatio,
      },
      layers,
      lockStrip: relativeBounds(strip),
    };
  }, invariantSpecimenLayers);
}

async function expectNoRunningSpecimenAnimation(page: Page) {
  await expect
    .poll(
      () =>
        page.locator('[data-oracle-specimen]').evaluate((specimen) =>
          specimen
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === 'running')
            .map((animation) => {
              const target =
                animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
              return {
                type: animation.id || animation.constructor.name,
                target:
                  target instanceof HTMLElement
                    ? target.getAttribute('data-specimen-layer') ||
                      target.getAttribute('data-label-group') ||
                      target.className
                    : null,
                keyframes:
                  animation.effect instanceof KeyframeEffect
                    ? animation.effect.getKeyframes().map(({ opacity, transform }) => ({
                        opacity,
                        transform,
                      }))
                    : [],
              };
            }),
        ),
      { timeout: 1_000 },
    )
    .toEqual([]);
}

async function captureComparisonSheet(page: Page) {
  const references = [
    ['03-registration-preview-complete.png', 'REGISTRATION PREVIEW'],
    ['08-baseline-ready.png', 'BASELINE READY'],
    ['09-trial-pending.png', 'TRIAL PENDING'],
    ['10-follow-up-ready.png', 'FOLLOW-UP READY'],
    ['11-latest-verdict-home.png', 'LATEST VERDICT'],
  ] as const;
  const cards = await Promise.all(
    references.map(async ([fileName, label]) => ({
      label,
      source: `data:image/png;base64,${(
        await readFile(resolve(evidenceDirectory, fileName))
      ).toString('base64')}`,
    })),
  );

  await page.setViewportSize({ width: 860, height: 1680 });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            color: #eee9df;
            background: #040404;
            font: 600 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
            letter-spacing: .08em;
          }
          h1 { margin: 0 0 20px; font-size: 18px; }
          main { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          figure { min-width: 0; margin: 0; }
          figcaption { min-height: 32px; padding: 0 2px 8px; color: #aaa49a; }
          img { width: 100%; height: auto; display: block; border: 1px solid #302c26; }
        </style>
      </head>
      <body>
        <h1>FACE VALUE · SHARED ORACLE MATERIAL SYSTEM</h1>
        <main>
          ${cards
            .map(
              ({ label, source }) =>
                `<figure><figcaption>${label}</figcaption><img src="${source}" alt="" /></figure>`,
            )
            .join('')}
        </main>
      </body>
    </html>
  `);
  await page.screenshot({
    path: resolve(evidenceDirectory, '12-machine-material-comparison.png'),
    fullPage: true,
    scale: 'css',
  });
}

test.beforeAll(async () => {
  if (captureEvidence) {
    await mkdir(evidenceDirectory, { recursive: true });
  }
});

test('one Oracle instrument accepts, loads, and releases one specimen to baseline', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshTrial(page);

  const machine = await page.locator('[data-oracle-machine]').elementHandle();
  const specimen = await page.locator('[data-oracle-specimen]').elementHandle();
  if (!machine || !specimen) throw new Error('Expected the first-trial Oracle machine.');
  const welcomeMachineGeometry = await machineDocumentGeometry(page);

  await expect(page.locator('[data-oracle-machine]')).toHaveCount(1);
  await expect(page.locator('[data-oracle-specimen]')).toHaveCount(1);
  await expect(page.locator('[data-label-scan-beam]')).toHaveCount(1);
  await expect(page.locator('[data-fv-part="screen-header"]')).toHaveCount(1);
  for (const layer of requiredSpecimenLayers) {
    await expect(page.locator(`[data-specimen-layer="${layer}"]`)).toHaveCount(1);
  }
  const emptySpecimenGeometry = await specimenGeometry(page);
  expect(emptySpecimenGeometry.root.computedAspectRatio).toBe('104 / 136');
  expect(emptySpecimenGeometry.root.aspectRatio).toBeCloseTo(104 / 136, 2);
  await expect(page.locator('[data-trial-machine-state="empty"]')).toContainText(
    'NO SPECIMEN LOADED',
  );
  await captureCheckpoint(page, '01-empty-first-screen.png');

  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  await expect(page.locator('[data-fv-screen="product-registration"]')).toBeVisible();
  await expect(page.getByLabel('Brand')).toHaveCount(1);
  await expect(page.getByLabel('Brand')).toHaveAttribute('name', 'brand');
  await expect(page.getByRole('textbox', { name: 'Brand' })).not.toBeFocused();
  await expect(page.locator('[data-trial-machine-state="registration-preview"]')).toContainText(
    'NOT YET LOADED',
  );
  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  const workflowMachineGeometry = await machineDocumentGeometry(page);
  expect(workflowMachineGeometry.documentY).toBeLessThan(welcomeMachineGeometry.documentY - 60);
  const registrationLayout = await workflowLayoutMetrics(page);
  expect(registrationLayout.backToMachine).toBeGreaterThanOrEqual(28);
  expect(registrationLayout.backToMachine).toBeLessThanOrEqual(36);
  expect(registrationLayout.machineToPanel).toBeGreaterThanOrEqual(32);
  expect(registrationLayout.machineToPanel).toBeLessThanOrEqual(48);
  await captureCheckpoint(page, '02-registration-preview-blank.png');

  await page.getByRole('textbox', { name: 'Brand' }).fill('Clinical Laboratory');
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-brand',
    'Clinical Laboratory',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-product',
    'UNNAMED PRODUCT',
  );

  const productName =
    'Azelaic Topical Acid Barrier Support Concentrate for Easily Irritated Complexions';
  await page.getByRole('textbox', { name: 'Product name' }).fill(productName);
  await page.getByRole('textbox', { name: 'Strength or concentration' }).fill('10%');
  await page.getByRole('textbox', { name: 'Volume' }).fill('30 ml');
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-product',
    productName,
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-display-product',
    'AZELAIC',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-display-strength',
    '10%',
  );
  await expect(page.locator('[data-label-content]')).toContainText('10%');
  await expect(page.locator('[data-label-content]')).not.toContainText('TOPICAL');
  await expect(page.locator('[data-label-content]')).not.toContainText('BASE');
  await expect(page.locator('[data-label-content]')).not.toContainText('30 ML');
  const completeLabelMetrics = await labelMetrics(page);
  expect(completeLabelMetrics.scrollWidth).toBeLessThanOrEqual(completeLabelMetrics.clientWidth);
  expect(completeLabelMetrics.scrollHeight).toBeLessThanOrEqual(completeLabelMetrics.clientHeight);
  expect(completeLabelMetrics.overflowWrap).toBe('anywhere');
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCheckpoint(page, '03-registration-preview-complete.png');
  const registrationSpecimenGeometry = await specimenGeometry(page);

  await page.clock.install({ time: new Date('2026-07-28T18:00:00.000Z') });
  await page.clock.pauseAt(new Date('2026-07-28T18:00:00.000Z'));
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();

  await expect(page.locator('[data-fv-screen="baseline-ready"]')).toHaveAttribute(
    'data-registration-phase',
    'preparing',
  );
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await expect(page.locator('[data-registration-panel]')).toHaveAttribute(
    'data-registration-panel-state',
    'exiting',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-brand',
    'Clinical Laboratory',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-product',
    productName,
  );
  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);

  await page.clock.runFor(registrationTiming.preparingCheckpoint);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'preparing',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  expect(
    await page.locator('[data-label-scan-beam]').evaluate((beam) => getComputedStyle(beam).opacity),
  ).toBe('0');
  expect(
    await page
      .locator('[data-oracle-specimen]')
      .evaluate((specimen) => new DOMMatrixReadOnly(getComputedStyle(specimen).transform).m42),
  ).toBeCloseTo(0, 1);
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);
  await captureCheckpoint(page, '04-preparing.png', true);

  await page.clock.runFor(
    registrationTiming.aligningCheckpoint - registrationTiming.preparingCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'aligning',
  );
  await expect(page.locator('[data-registration-panel]')).toHaveCount(0);
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'loading',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'ALIGNING SPECIMEN',
  );
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);
  const aligningSpecimenGeometry = await specimenGeometry(page);
  await captureCheckpoint(page, '05-aligning.png', true);

  await page.clock.runFor(
    registrationTiming.scanningCheckpoint - registrationTiming.aligningCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'scanning',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'locking',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'active',
  );
  expect(
    await page
      .locator('[data-label-scan-beam]')
      .evaluate((beam) => new DOMMatrixReadOnly(getComputedStyle(beam).transform).m42),
  ).toBeGreaterThan(-14);
  const scanProgress = Number(
    await page.locator('[data-oracle-specimen]').getAttribute('data-scan-progress'),
  );
  expect(scanProgress).toBeGreaterThan(0);
  expect(scanProgress).toBeLessThan(1);
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);
  const scanningSpecimenGeometry = await specimenGeometry(page);
  await captureCheckpoint(page, '06-scanning.png', true);

  await page.clock.runFor(
    registrationTiming.processingCheckpoint - registrationTiming.scanningCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'processing',
  );
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'VERIFYING SPECIMEN',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'locked',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);
  const processingSpecimenGeometry = await specimenGeometry(page);
  await captureCheckpoint(page, '07-processing.png', true);

  await page.clock.runFor(
    registrationTiming.verifiedCheckpoint - registrationTiming.processingCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'verified',
  );
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'SPECIMEN VERIFIED',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeDisabled();
  const verifiedSpecimenGeometry = await specimenGeometry(page);
  await captureCheckpoint(page, '08-verified.png', true);

  await page.clock.runFor(registrationTiming.readyStart - registrationTiming.verifiedCheckpoint);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'ready',
  );
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'READY TO SCAN',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Ready to take guided baseline.');
  await expect(page.getByText('Your product is ready.')).toHaveCount(0);
  await expect(page.getByText('PRODUCT REGISTERED')).toHaveCount(0);
  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  expect(await machineDocumentGeometry(page)).toEqual(workflowMachineGeometry);
  const readySpecimenGeometry = await specimenGeometry(page);
  expect(aligningSpecimenGeometry.root).toEqual(scanningSpecimenGeometry.root);
  expect(scanningSpecimenGeometry.root).toEqual(processingSpecimenGeometry.root);
  expect(processingSpecimenGeometry.root).toEqual(verifiedSpecimenGeometry.root);
  expect(verifiedSpecimenGeometry.root).toEqual(readySpecimenGeometry.root);
  expect(aligningSpecimenGeometry.layers).toEqual(scanningSpecimenGeometry.layers);
  expect(scanningSpecimenGeometry.layers).toEqual(processingSpecimenGeometry.layers);
  expect(processingSpecimenGeometry.layers).toEqual(verifiedSpecimenGeometry.layers);
  expect(verifiedSpecimenGeometry.layers).toEqual(readySpecimenGeometry.layers);
  expect(aligningSpecimenGeometry.lockStrip.width).toBe(readySpecimenGeometry.lockStrip.width);
  expect(aligningSpecimenGeometry.lockStrip.height).toBe(readySpecimenGeometry.lockStrip.height);
  expect(registrationSpecimenGeometry.root).toEqual(readySpecimenGeometry.root);
  await expectNoHorizontalOverflow(page);
  await page.clock.resume();
  await page.waitForTimeout(80);
  await expectNoRunningSpecimenAnimation(page);
  await captureCheckpoint(page, '08-baseline-ready.png');

  if (captureEvidence) {
    await writeFile(
      resolve(evidenceDirectory, 'geometry-measurements.json'),
      `${JSON.stringify(
        {
          viewport: { width: 390, height: 844 },
          welcomeMachine: welcomeMachineGeometry,
          workflowMachine: workflowMachineGeometry,
          workflowLayout: registrationLayout,
          stableMachinePhases: [
            'registration-preview',
            'preparing',
            'aligning',
            'scanning',
            'processing',
            'verified',
            'ready',
          ],
          hardware: await hardwareGeometry(page),
          specimen: {
            registrationPreview: registrationSpecimenGeometry,
            aligning: aligningSpecimenGeometry,
            scanning: scanningSpecimenGeometry,
            processing: processingSpecimenGeometry,
            verified: verifiedSpecimenGeometry,
            ready: readySpecimenGeometry,
          },
        },
        null,
        2,
      )}\n`,
    );
  }

  await page.evaluate(() => {
    const action = document.querySelector<HTMLButtonElement>('[data-baseline-action]');
    if (!action) throw new Error('Missing baseline action.');
    action.click();
    action.click();
  });
  await expect(page.getByRole('heading', { name: 'Position your face' })).toBeVisible();
  await expect(page.locator('[data-oracle-machine]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await captureCheckpoint(page, '13-baseline-camera-entry.png');

  expect(runtimeIssues).toEqual([]);
});

test('captures real-time WebKit ingestion paint checkpoints', async ({ page }) => {
  test.skip(!captureEvidence, 'Real-time paint evidence runs only in capture mode.');

  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshTrial(page);
  const machine = await page.locator('[data-oracle-machine]').elementHandle();
  const specimen = await page.locator('[data-oracle-specimen]').elementHandle();
  if (!machine || !specimen) throw new Error('Expected the first-trial Oracle machine.');

  await page.waitForTimeout(80);
  await captureCheckpoint(page, '01-empty-first-screen.png');
  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  await captureCheckpoint(page, '02-registration-preview-blank.png');
  await page.getByRole('textbox', { name: 'Brand' }).fill('Clinical Laboratory');
  await page
    .getByRole('textbox', { name: 'Product name' })
    .fill('Azelaic Topical Acid Barrier Support Concentrate for Easily Irritated Complexions');
  await page.getByRole('textbox', { name: 'Strength or concentration' }).fill('10%');
  await page.getByRole('textbox', { name: 'Volume' }).fill('30 ml');
  await captureCheckpoint(page, '03-registration-preview-complete.png');

  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'preparing',
  );
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '04-preparing.png');

  const waitForPhase = async (phase: string) => {
    await page.waitForFunction(
      (expectedPhase) =>
        document.querySelector('[data-oracle-machine]')?.getAttribute('data-registration-phase') ===
        expectedPhase,
      phase,
      { timeout: 5_000 },
    );
  };

  await waitForPhase('aligning');
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '05-aligning.png');
  await waitForPhase('scanning');
  await page.waitForTimeout(700);
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'active',
  );
  await captureCheckpoint(page, '06-scanning.png');
  await waitForPhase('processing');
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '07-processing.png');
  await waitForPhase('verified');
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '08-verified.png');
  await waitForPhase('ready');
  await page.waitForTimeout(160);
  await captureCheckpoint(page, '09-baseline-ready.png');

  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  await expectNoRunningSpecimenAnimation(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeIssues).toEqual([]);
});

test('all supported widths keep registration usable and horizontally contained', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await openFreshTrial(page);
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
    const workflowLayout = await workflowLayoutMetrics(page);
    expect(workflowLayout.backToMachine).toBeGreaterThanOrEqual(28);
    expect(workflowLayout.backToMachine).toBeLessThanOrEqual(36);
    expect(workflowLayout.machineToPanel).toBeGreaterThanOrEqual(32);
    expect(workflowLayout.machineToPanel).toBeLessThanOrEqual(48);
    await page.getByRole('textbox', { name: 'Brand' }).fill('A Very Long Clinical Brand Name');
    await page
      .getByRole('textbox', { name: 'Product name' })
      .fill('A Deliberately Long Product Name That Must Stay Within The Canonical Specimen Label');
    const volume = page.getByRole('textbox', { name: 'Volume' });
    await volume.focus();
    await expect(volume).toBeFocused();
    await expect(volume).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const metrics = await labelMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
    await captureCheckpoint(page, `viewport-registration-${viewport.width}x${viewport.height}.png`);
  }

  expect(runtimeIssues).toEqual([]);
});

test('reduced motion preserves the shortened semantic ceremony without specimen travel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFreshTrial(page);
  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  await page.getByRole('textbox', { name: 'Brand' }).fill('Face Value Lab');
  await page.getByRole('textbox', { name: 'Product name' }).fill('Redness Trial');

  await page.clock.install({ time: new Date('2026-07-28T18:00:00.000Z') });
  await page.clock.pauseAt(new Date('2026-07-28T18:00:00.000Z'));
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'preparing',
  );
  await page.clock.runFor(150);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'aligning',
  );
  expect(
    await page
      .locator('[data-oracle-specimen]')
      .evaluate((specimen) => new DOMMatrixReadOnly(getComputedStyle(specimen).transform).m42),
  ).toBeCloseTo(0, 1);
  await page.clock.runFor(150);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'scanning',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute('data-scan-state', 'wash');
  await page.clock.runFor(450);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'processing',
  );
  await page.clock.runFor(250);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'verified',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeDisabled();
  await page.clock.runFor(350);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-registration-phase',
    'ready',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();
  await expectNoRunningSpecimenAnimation(page);
});

test('locked specimen family shares one still hardware material system', async ({ page }) => {
  test.skip(!captureEvidence, 'Screenshot matrix is generated only in evidence-capture mode.');

  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await openDemoState(page, 'trial_pending');
  await expect(page.locator('[data-trial-machine-state="pending"]')).toBeVisible();
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'locked',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  await expectNoRunningSpecimenAnimation(page);
  await expectNoHorizontalOverflow(page);
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '09-trial-pending.png');

  await openDemoState(page, 'followup_ready');
  await expect(page.locator('[data-trial-machine-state="followup-ready"]')).toBeVisible();
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'locked',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  await expectNoRunningSpecimenAnimation(page);
  await expectNoHorizontalOverflow(page);
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '10-follow-up-ready.png');

  await openDemoState(page, 'home_saved_result');
  await expect(page.locator('[data-cassette-variant="latest-verdict"]')).toBeVisible();
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-identity-lock-state',
    'locked',
  );
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'inactive',
  );
  await expectNoHorizontalOverflow(page);
  await page.waitForTimeout(100);
  await captureCheckpoint(page, '11-latest-verdict-home.png');

  expect(runtimeIssues).toEqual([]);
  await captureComparisonSheet(page);
});
