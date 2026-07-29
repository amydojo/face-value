import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type ElementHandle, type Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/adapters/persistence/localObservationStore';

const captureEvidence = process.env.CAPTURE_FIRST_TRIAL_EVIDENCE === 'true';
const evidenceDirectory = resolve(
  'docs/verification/first-trial-specimen-ingestion-v1',
);

const ingestionTiming = {
  materializingCheckpoint: 80,
  loadingStart: 160,
  loadingCheckpoint: 350,
  lockingStart: 540,
  lockingCheckpoint: 615,
  confirmingStart: 720,
  readyStart: 900,
} as const;

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

async function expectCurrentNode(
  handle: ElementHandle,
  selector: string,
): Promise<void> {
  expect(
    await handle.evaluate(
      (node, currentSelector) => node === document.querySelector(currentSelector),
      selector,
    ),
  ).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
}

async function labelMetrics(page: Page) {
  return page.locator('[data-oracle-specimen] > div').evaluate((label) => {
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
    return {
      documentY: Math.round((box.y + window.scrollY) * 100) / 100,
      width: Math.round(box.width * 100) / 100,
      height: Math.round(box.height * 100) / 100,
      transform: style.transform,
      animationName: style.animationName,
    };
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
  const persistentMachineGeometry = await machineDocumentGeometry(page);

  await expect(page.locator('[data-oracle-machine]')).toHaveCount(1);
  await expect(page.locator('[data-oracle-specimen]')).toHaveCount(1);
  await expect(page.locator('[data-fv-part="screen-header"]')).toHaveCount(1);
  await expect(page.locator('[data-trial-machine-state="empty"]')).toContainText(
    'NO SPECIMEN LOADED',
  );
  await captureCheckpoint(page, '01-empty-first-screen.png');

  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  await expect(page.locator('[data-fv-screen="product-registration"]')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Brand' })).not.toBeFocused();
  await expect(page.locator('[data-trial-machine-state="registration-preview"]')).toContainText(
    'NOT YET LOADED',
  );
  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  expect(await machineDocumentGeometry(page)).toEqual(persistentMachineGeometry);

  await page.getByRole('textbox', { name: 'Brand' }).fill('Clinical Laboratory');
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-brand',
    'Clinical Laboratory',
  );
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-product',
    'UNNAMED PRODUCT',
  );
  await captureCheckpoint(page, '02-registration-brand-only.png');

  const productName =
    'Azelaic Topical Acid Barrier Support Concentrate for Easily Irritated Complexions';
  await page.getByRole('textbox', { name: 'Product name' }).fill(productName);
  await page
    .getByRole('textbox', { name: 'Strength or concentration' })
    .fill('10%');
  await page.getByRole('textbox', { name: 'Volume' }).fill('30 ml');
  await expect(page.locator('[data-oracle-specimen]')).toHaveAttribute(
    'data-specimen-product',
    productName,
  );
  const completeLabelMetrics = await labelMetrics(page);
  expect(completeLabelMetrics.scrollWidth).toBeLessThanOrEqual(
    completeLabelMetrics.clientWidth,
  );
  expect(completeLabelMetrics.scrollHeight).toBeLessThanOrEqual(
    completeLabelMetrics.clientHeight,
  );
  expect(completeLabelMetrics.overflowWrap).toBe('anywhere');
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureCheckpoint(page, '03-registration-complete-identity.png');

  await page.clock.install({ time: new Date('2026-07-28T18:00:00.000Z') });
  await page.clock.pauseAt(new Date('2026-07-28T18:00:00.000Z'));
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();

  await expect(page.locator('[data-fv-screen="baseline-ready"]')).toHaveAttribute(
    'data-ingestion-phase',
    'materializing',
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
  expect(await machineDocumentGeometry(page)).toEqual(persistentMachineGeometry);

  await page.clock.runFor(ingestionTiming.materializingCheckpoint);
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'materializing',
  );
  await captureCheckpoint(page, '04-materializing.png', true);

  await page.clock.runFor(
    ingestionTiming.loadingCheckpoint -
      ingestionTiming.materializingCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'loading',
  );
  await expect(page.locator('[data-registration-panel]')).toHaveCount(0);
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await captureCheckpoint(page, '05-loading-halfway.png', true);

  await page.clock.runFor(
    ingestionTiming.lockingCheckpoint - ingestionTiming.loadingCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'locking',
  );
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await captureCheckpoint(page, '06-identity-locking.png', true);

  await page.clock.runFor(
    ingestionTiming.confirmingStart - ingestionTiming.lockingCheckpoint,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'confirming',
  );
  await expect(page.locator('[data-baseline-action]')).toBeDisabled();
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'CONFIRMING',
  );

  await page.clock.runFor(
    ingestionTiming.readyStart - ingestionTiming.confirmingStart,
  );
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'ready',
  );
  await expect(page.locator('[data-trial-machine-state="baseline-ready"]')).toContainText(
    'READY TO SCAN',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();
  await expect(page.locator('[aria-live="polite"]')).toContainText(
    'Specimen loaded. Ready to take the baseline scan.',
  );
  await expect(page.getByText('Your product is ready.')).toHaveCount(0);
  await expect(page.getByText('PRODUCT REGISTERED')).toHaveCount(0);
  await expectCurrentNode(machine, '[data-oracle-machine]');
  await expectCurrentNode(specimen, '[data-oracle-specimen]');
  await expectNoHorizontalOverflow(page);
  await page.clock.resume();
  await page.waitForTimeout(80);
  await captureCheckpoint(page, '07-baseline-ready.png');

  await page.evaluate(() => {
    const action = document.querySelector<HTMLButtonElement>('[data-baseline-action]');
    if (!action) throw new Error('Missing baseline action.');
    action.click();
    action.click();
  });
  await expect(page.getByRole('heading', { name: 'Center your face' })).toBeVisible();
  await expect(page.locator('[data-oracle-machine]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await captureCheckpoint(page, '08-baseline-camera-entry.png');

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
    await page.getByRole('textbox', { name: 'Brand' }).fill('A Very Long Clinical Brand Name');
    await page
      .getByRole('textbox', { name: 'Product name' })
      .fill(
        'A Deliberately Long Product Name That Must Stay Within The Canonical Specimen Label',
      );
    const volume = page.getByRole('textbox', { name: 'Volume' });
    await volume.focus();
    await expect(volume).toBeFocused();
    await expect(volume).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const metrics = await labelMetrics(page);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
  }

  expect(runtimeIssues).toEqual([]);
});

test('reduced motion commits once and resolves without travel or locking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFreshTrial(page);
  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  await page.getByRole('textbox', { name: 'Brand' }).fill('Face Value Lab');
  await page.getByRole('textbox', { name: 'Product name' }).fill('Redness Trial');

  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-ingestion-phase',
    'materializing',
  );
  await expect
    .poll(() =>
      page.locator('[data-oracle-machine]').getAttribute('data-ingestion-phase'),
    )
    .toBe('ready');
  await expect(page.locator('[data-oracle-machine]')).not.toHaveAttribute(
    'data-ingestion-phase',
    'loading',
  );
  await expect(page.locator('[data-oracle-machine]')).not.toHaveAttribute(
    'data-ingestion-phase',
    'locking',
  );
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();
});
