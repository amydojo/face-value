import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  STORAGE_KEY,
  toPersistedDemoData,
} from '../src/adapters/persistence/localObservationStore';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';

const captureEvidence = process.env.CAPTURE_FACE_VALUE_CAPTURE_EVIDENCE === 'true';
const evidenceDirectory = resolve('docs/verification/face-value-specimen-acquisition');
const baselineReady = toPersistedDemoData(
  buildDemoFixtureState('baseline_ready', 'clear_favorable_change'),
);

type FixtureScenario =
  | 'success'
  | 'signal-flicker'
  | 'lose-lock'
  | 'lose-scan'
  | 'permission-denied'
  | 'camera-unavailable';

async function openCapture(
  page: Page,
  {
    scenario = 'success',
    slowQuality = false,
  }: {
    scenario?: FixtureScenario;
    slowQuality?: boolean;
  } = {},
): Promise<void> {
  const query = new URLSearchParams({
    'camera-scenario': scenario,
    ...(slowQuality ? { 'camera-quality-proof': '1' } : {}),
  });
  await page.goto(`/?${query}`);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: baselineReady,
  });
  await page.reload();
  await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
  await expect(page.getByRole('heading', { name: 'Position your face' })).toBeVisible();
}

async function startCapture(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
}

async function saveEvidence(
  locator: Locator,
  name: string,
  animations: 'allow' | 'disabled' = 'disabled',
): Promise<void> {
  if (!captureEvidence) return;
  await locator.screenshot({
    path: resolve(evidenceDirectory, name),
    animations,
  });
}

async function pauseAnimationAt(locator: Locator, currentTime: number): Promise<void> {
  await locator.evaluate((element, time) => {
    const animations = element.getAnimations();
    if (animations.length === 0) {
      throw new Error('Expected a CSS animation to verify');
    }
    for (const animation of animations) {
      animation.currentTime = time;
      animation.pause();
    }
  }, currentTime);
}

async function advanceVisualClock(page: Page, milliseconds: number) {
  await page.clock.fastForward(milliseconds);
  // React schedules the next machine deadline from a passive effect. Give
  // that effect a task boundary, then advance through any newly due deadline.
  for (let index = 0; index < 4; index += 1) {
    await page.waitForTimeout(1);
    await page.clock.fastForward(1);
  }
}

interface CaptureObservation {
  phase: string;
  primary: string;
  secondary: string;
  frameFrozen: boolean;
}

async function observeCaptureSequence(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('[data-capture-sequence]');
    if (!target) throw new Error('Missing capture sequence');
    const observations: CaptureObservation[] = [];
    const record = () => {
      const instruction = target.querySelector<HTMLElement>('[data-capture-instruction]');
      observations.push({
        phase: target.dataset.capturePhase ?? 'missing',
        primary: instruction?.querySelector('h1')?.textContent?.trim() ?? '',
        secondary: instruction?.querySelector('p')?.textContent?.trim() ?? '',
        frameFrozen: target.querySelector('[data-frame-frozen="true"]') !== null,
      });
    };
    record();
    new MutationObserver(record).observe(target, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    (
      window as Window & {
        __faceValueCaptureObservations?: CaptureObservation[];
      }
    ).__faceValueCaptureObservations = observations;
  });
}

async function captureObservations(page: Page): Promise<CaptureObservation[]> {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __faceValueCaptureObservations?: CaptureObservation[];
        }
      ).__faceValueCaptureObservations ?? [],
  );
}

async function captureGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      chassis: box('[data-capture-sequence]'),
      feed: box('[data-capture-camera-feed]'),
      guide: box('[data-face-acquisition-guide]'),
      rail: box('[data-capture-quality-rail]'),
      context: box('[data-capture-context-bar]'),
    };
  });
}

function expectCanonicalGeometry(geometry: Awaited<ReturnType<typeof captureGeometry>>) {
  expect(geometry.chassis.width).toBeCloseTo(390, 0);
  expect(geometry.chassis.height).toBeCloseTo(780, 0);
  expect(geometry.feed.left - geometry.chassis.left).toBeLessThanOrEqual(1);
  expect(geometry.feed.top - geometry.chassis.top).toBeLessThanOrEqual(1);
  expect(geometry.chassis.right - geometry.feed.right).toBeLessThanOrEqual(1);
  expect(geometry.chassis.bottom - geometry.feed.bottom).toBeLessThanOrEqual(1);
  expect(geometry.guide.width).toBeCloseTo(330, 0);
  expect(geometry.guide.height).toBeCloseTo(450, 0);
  expect(geometry.guide.left - geometry.chassis.left).toBeCloseTo(30, 0);
  expect(geometry.guide.top - geometry.chassis.top).toBeCloseTo(132, 0);
  expect(geometry.rail.width).toBeCloseTo(358, 0);
  expect(geometry.rail.height).toBeCloseTo(48, 0);
  expect(geometry.rail.left - geometry.chassis.left).toBeCloseTo(16, 0);
  expect(geometry.chassis.bottom - geometry.rail.bottom).toBeCloseTo(16, 0);
  expect(geometry.context.width).toBeCloseTo(350, 0);
  expect(geometry.context.height).toBeCloseTo(36, 0);
  expect(geometry.context.left - geometry.chassis.left).toBeCloseTo(20, 0);
  expect(geometry.context.top - geometry.chassis.top).toBeCloseTo(16, 0);
}

test.beforeAll(async () => {
  if (captureEvidence) {
    await mkdir(evidenceDirectory, { recursive: true });
  }
});

test('successful acquisition preserves geometry and the selected frame into processing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page);
  const chassis = page.locator('[data-capture-sequence]');
  const initialGeometry = await captureGeometry(page);
  expectCanonicalGeometry(initialGeometry);
  expect(await page.locator('[data-face-acquisition-guide]').count()).toBe(1);

  await startCapture(page);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'aligning');
  expect(await captureGeometry(page)).toEqual(initialGeometry);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'locking');
  expect(await captureGeometry(page)).toEqual(initialGeometry);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await expect(page.locator('[data-capture-scan-band]')).toBeVisible();
  expect(await captureGeometry(page)).toEqual(initialGeometry);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured', {
    timeout: 4_000,
  });
  await expect(page.getByRole('heading', { name: 'Baseline secured' })).toBeVisible();
  await expect(page.getByText('Processing specimen')).toBeVisible();
  await expect(page.locator('[data-frame-frozen="true"]')).toBeVisible();
  expect(await captureGeometry(page)).toEqual(initialGeometry);
  await expect(page.locator('[data-face-acquisition-guide]')).toHaveCount(1);
  await expect(page.getByText(/Good|Perfect|Passed|Success/)).toHaveCount(0);

  const persisted = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  expect(persisted).not.toMatch(/blob:|data:image|base64|MediaStream/);
  await expect(
    page.getByRole('heading', {
      name: 'Anything meaningfully different today?',
    }),
  ).toBeVisible({ timeout: 2_000 });
});

test('one invalid frame does not destabilize the ritual', async ({ page }) => {
  await openCapture(page, { scenario: 'signal-flicker' });
  await page.evaluate(() => {
    const phases: string[] = [];
    const target = document.querySelector('[data-capture-sequence]');
    if (!target) throw new Error('Missing capture sequence');
    const record = () => phases.push(target.getAttribute('data-capture-phase') ?? 'missing');
    record();
    new MutationObserver(record).observe(target, {
      attributes: true,
      attributeFilter: ['data-capture-phase'],
    });
    (window as Window & { __faceValueCapturePhases?: string[] }).__faceValueCapturePhases = phases;
  });
  await startCapture(page);
  await expect(page.locator('[data-capture-sequence]')).toHaveAttribute(
    'data-capture-phase',
    'captured',
    { timeout: 5_000 },
  );
  const phases = await page.evaluate(
    () =>
      (window as Window & { __faceValueCapturePhases?: string[] }).__faceValueCapturePhases ?? [],
  );
  const firstAligning = phases.indexOf('aligning');
  expect(firstAligning).toBeGreaterThanOrEqual(0);
  expect(phases.slice(firstAligning + 1)).not.toContain('searching');
});

test('face loss during Locking returns calmly to Aligning', async ({ page }) => {
  await openCapture(page, { scenario: 'lose-lock' });
  await observeCaptureSequence(page);
  await startCapture(page);
  await expect(page.locator('[data-capture-sequence]')).toHaveAttribute(
    'data-capture-phase',
    'captured',
    { timeout: 7_000 },
  );
  const observations = await captureObservations(page);
  const lockingIndex = observations.findIndex(({ phase }) => phase === 'locking');
  const aligningAfterLock = observations.findIndex(
    ({ phase }, index) => index > lockingIndex && phase === 'aligning',
  );
  expect(lockingIndex).toBeGreaterThanOrEqual(0);
  expect(aligningAfterLock).toBeGreaterThan(lockingIndex);
  expect(
    observations.some(
      ({ phase, primary, secondary }) =>
        phase === 'aligning' &&
        primary === 'Frame lost' &&
        secondary === 'Return to the guide',
    ),
  ).toBe(true);
});

test('face loss during Scanning cancels the first scan and does not commit it', async ({
  page,
}) => {
  await openCapture(page, { scenario: 'lose-scan' });
  await observeCaptureSequence(page);
  await startCapture(page);
  const chassis = page.locator('[data-capture-sequence]');
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured', {
    timeout: 7_000,
  });
  const observations = await captureObservations(page);
  const firstScan = observations.findIndex(({ phase }) => phase === 'scanning');
  const aligningAfterScan = observations.findIndex(
    ({ phase }, index) => index > firstScan && phase === 'aligning',
  );
  const secondScan = observations.findIndex(
    ({ phase }, index) => index > aligningAfterScan && phase === 'scanning',
  );
  expect(firstScan).toBeGreaterThanOrEqual(0);
  expect(aligningAfterScan).toBeGreaterThan(firstScan);
  expect(secondScan).toBeGreaterThan(aligningAfterScan);
  expect(
    observations.some(
      ({ phase, primary, secondary, frameFrozen }) =>
        phase === 'aligning' &&
        primary === 'Frame lost' &&
        secondary === 'Return to the guide' &&
        !frameFrozen,
    ),
  ).toBe(true);
});

test('photo fallback retains the existing validation and analysis route', async ({ page }) => {
  await openCapture(page);
  await page.getByLabel('Choose a face photo').setInputFiles({
    name: 'abstract-fixture.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('synthetic capture fixture'),
  });
  await expect(
    page.getByRole('heading', {
      name: 'Anything meaningfully different today?',
    }),
  ).toBeVisible();
  await expect(page.locator('[data-camera-kit-fixture="active"]')).toHaveCount(0);
});

test('permission denial is calm, recoverable, and keeps photo fallback available', async ({
  page,
}) => {
  await openCapture(page, { scenario: 'permission-denied' });
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await expect(page.getByRole('heading', { name: 'Camera access is needed' })).toBeVisible();
  await expect(page.getByText('Enable camera access or choose a photo instead')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TRY CAMERA AGAIN' })).toBeVisible();
  await expect(page.getByLabel('Choose a face photo')).toBeAttached();
});

test('reduced motion uses the illumination state and still completes capture', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCapture(page);
  await startCapture(page);
  const chassis = page.locator('[data-capture-sequence]');
  await expect(chassis).toHaveAttribute('data-reduced-motion', 'true');
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await expect(page.locator('[data-capture-scan-band]')).toBeVisible();
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured', {
    timeout: 4_000,
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 402, height: 874 },
  { width: 430, height: 932 },
]) {
  test(`keeps canonical proportions in mobile WebKit at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openCapture(page);
    expectCanonicalGeometry(await captureGeometry(page));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('visual regression: all canonical phases, permission error, and reduced motion', async ({
  page,
}) => {
  const visualClock = new Date('2026-07-29T12:00:00.000Z');
  await page.clock.install({
    time: visualClock,
  });
  await page.clock.pauseAt(visualClock);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page, { slowQuality: true });
  const chassis = page.locator('[data-capture-sequence]');
  await expect(chassis).toHaveScreenshot('capture-searching.png', {
    animations: 'disabled',
  });
  await saveEvidence(chassis, 'searching.png');

  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 105);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 150);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'aligning');
  await expect(chassis).toHaveScreenshot('capture-aligning.png', {
    animations: 'disabled',
  });
  await saveEvidence(chassis, 'aligning.png');

  await advanceVisualClock(page, 350);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 350);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 500);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'locking');
  await pauseAnimationAt(page.locator('[data-capture-guide-oval]'), 280);
  await pauseAnimationAt(page.locator('[data-capture-lock-trace]'), 350);
  await expect(chassis).toHaveScreenshot('capture-locking.png', {
    animations: 'allow',
    maxDiffPixels: 64,
  });
  await saveEvidence(chassis, 'locking.png', 'allow');

  await advanceVisualClock(page, 730);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await pauseAnimationAt(page.locator('[data-capture-scan-optic]'), 450);
  await expect(chassis).toHaveScreenshot('capture-scanning.png', {
    animations: 'allow',
    maxDiffPixels: 24,
  });
  await saveEvidence(chassis, 'scanning.png', 'allow');

  await advanceVisualClock(page, 900);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured');
  await expect(chassis).toHaveScreenshot('capture-captured.png', {
    animations: 'disabled',
  });
  await saveEvidence(chassis, 'captured.png');

  await openCapture(page, { scenario: 'permission-denied' });
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 50);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'error');
  await expect(chassis).toHaveScreenshot('capture-permission-error.png', {
    animations: 'disabled',
  });
  await saveEvidence(chassis, 'permission-denied.png');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCapture(page);
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 225);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 500);
  await advanceVisualClock(page, 730);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await expect(chassis).toHaveScreenshot('capture-reduced-motion.png', {
    animations: 'disabled',
  });
  await saveEvidence(chassis, 'reduced-motion.png');
});
