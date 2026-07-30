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
    nativeCamera = false,
  }: {
    scenario?: FixtureScenario;
    slowQuality?: boolean;
    nativeCamera?: boolean;
  } = {},
): Promise<void> {
  const query = new URLSearchParams({
    'camera-scenario': scenario,
    ...(slowQuality ? { 'camera-quality-proof': '1' } : {}),
    ...(nativeCamera ? { 'native-camera-contract': '1' } : {}),
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

async function installNativeCameraMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const contractWindow = window as Window & {
      __faceValueAlertMessages?: string[];
      __faceValueTrackStops?: number;
    };
    contractWindow.__faceValueAlertMessages = [];
    contractWindow.__faceValueTrackStops = 0;
    window.alert = (message?: unknown) => {
      contractWindow.__faceValueAlertMessages?.push(String(message ?? ''));
    };

    const track = {
      stop: () => {
        contractWindow.__faceValueTrackStops =
          (contractWindow.__faceValueTrackStops ?? 0) + 1;
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          await new Promise((resolvePromise) => window.setTimeout(resolvePromise, 80));
          return stream;
        },
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __mockStream?: unknown }).__mockStream ?? null;
      },
      set(value) {
        (this as HTMLMediaElement & { __mockStream?: unknown }).__mockStream = value;
      },
    });
    Object.defineProperties(HTMLMediaElement.prototype, {
      readyState: { configurable: true, get: () => 2 },
      play: { configurable: true, value: () => Promise.resolve() },
      pause: { configurable: true, value: () => undefined },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoWidth: { configurable: true, get: () => 1280 },
      videoHeight: { configurable: true, get: () => 720 },
    });

    const pixels = new Uint8ClampedArray(40 * 52 * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 128;
      pixels[index + 1] = 128;
      pixels[index + 2] = 128;
      pixels[index + 3] = 255;
    }
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: (type: string) =>
        type === '2d'
          ? {
              drawImage: () => undefined,
              getImageData: () => ({ data: pixels }),
            }
          : null,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback) => {
        const binary = atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        );
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        callback(new Blob([bytes], { type: 'image/png' }));
      },
    });
  });
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

async function setStaticVisualStyle(
  locator: Locator,
  style: Record<string, string>,
): Promise<void> {
  await locator.evaluate((element, frozenStyle) => {
    Object.assign((element as SVGElement | HTMLElement).style, frozenStyle);
    void element.getBoundingClientRect();
  }, style);
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
      route: box('[data-capture-route-bar]'),
    };
  });
}

async function pinVisualViewportHeight(page: Page, height: number): Promise<void> {
  await page.evaluate((visibleHeight) => {
    if (!window.visualViewport) throw new Error('Visual Viewport API is unavailable');
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      get: () => visibleHeight,
    });
    window.visualViewport.dispatchEvent(new Event('resize'));
  }, height);
  await expect
    .poll(() =>
      page
        .locator('section[data-preview-state]')
        .evaluate((element) =>
          Number.parseFloat(
            getComputedStyle(element).getPropertyValue('--fv-visible-viewport-height'),
          ),
        ),
    )
    .toBe(height);
}

function expectResponsiveCaptureGeometry(
  geometry: Awaited<ReturnType<typeof captureGeometry>>,
  viewportWidth: number,
  { compactGuide = false }: { compactGuide?: boolean } = {},
) {
  const scale = geometry.chassis.width / 390;
  expect(geometry.chassis.width).toBeGreaterThanOrEqual(viewportWidth * 0.92);
  expect(geometry.chassis.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(geometry.chassis.height).toBeGreaterThan(0);
  expect(geometry.feed.left - geometry.chassis.left).toBeLessThanOrEqual(1);
  expect(geometry.feed.top - geometry.chassis.top).toBeLessThanOrEqual(1);
  expect(geometry.chassis.right - geometry.feed.right).toBeLessThanOrEqual(1);
  expect(geometry.chassis.bottom - geometry.feed.bottom).toBeLessThanOrEqual(1);
  if (compactGuide) {
    expect(geometry.guide.width).toBeLessThan(330 * scale);
    expect(geometry.guide.height / geometry.guide.width).toBeCloseTo(450 / 330, 2);
    expect(
      geometry.guide.left - geometry.chassis.left + geometry.guide.width / 2,
    ).toBeCloseTo(geometry.chassis.width / 2, 0);
    expect(geometry.guide.bottom).toBeLessThan(geometry.rail.top - 8);
  } else {
    expect(geometry.guide.width).toBeCloseTo(330 * scale, 0);
    expect(geometry.guide.height).toBeCloseTo(450 * scale, 0);
    expect(geometry.guide.left - geometry.chassis.left).toBeCloseTo(30 * scale, 0);
    expect(geometry.guide.top - geometry.chassis.top).toBeCloseTo(132 * scale, 0);
  }
  expect(geometry.rail.width).toBeCloseTo(358 * scale, 0);
  expect(geometry.rail.height).toBeCloseTo(48 * scale, 0);
  expect(geometry.rail.left - geometry.chassis.left).toBeCloseTo(16 * scale, 0);
  expect(geometry.chassis.bottom - geometry.rail.bottom).toBeCloseTo(16 * scale, 0);
  expect(geometry.context.width).toBeCloseTo(350 * scale, 0);
  expect(geometry.context.height).toBeCloseTo(36 * scale, 0);
  expect(geometry.context.left - geometry.chassis.left).toBeCloseTo(20 * scale, 0);
  expect(geometry.context.top - geometry.chassis.top).toBeCloseTo(16 * scale, 0);
}

function guideGeometry(geometry: Awaited<ReturnType<typeof captureGeometry>>) {
  return {
    left: geometry.guide.left,
    top: geometry.guide.top,
    width: geometry.guide.width,
    height: geometry.guide.height,
  };
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
  expectResponsiveCaptureGeometry(initialGeometry, 390);
  expect(await page.locator('[data-face-acquisition-guide]').count()).toBe(1);

  await startCapture(page);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'aligning');
  const activeGeometry = await captureGeometry(page);
  expectResponsiveCaptureGeometry(activeGeometry, 390);
  expect(guideGeometry(activeGeometry)).toEqual(guideGeometry(initialGeometry));
  await expect(chassis).toHaveAttribute('data-capture-phase', 'locking');
  expect(await captureGeometry(page)).toEqual(activeGeometry);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await expect(page.locator('[data-capture-scan-band]')).toBeVisible();
  expect(await captureGeometry(page)).toEqual(activeGeometry);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured', {
    timeout: 4_000,
  });
  await expect(page.getByRole('heading', { name: 'Baseline secured' })).toBeVisible();
  await expect(page.getByText('Processing specimen')).toBeVisible();
  await expect(page.locator('[data-frame-frozen="true"]')).toBeVisible();
  expect(await captureGeometry(page)).toEqual(activeGeometry);
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

test('native browser camera contract renders the real preview surface and owns capture timing', async ({
  page,
}) => {
  await installNativeCameraMock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page, { nativeCamera: true });
  expect(await page.locator('[data-capture-synthetic-feed]').count()).toBe(0);
  await startCapture(page);
  await expect(page.getByRole('heading', { name: 'Opening camera' })).toBeVisible();
  await expect(page.locator('section[data-preview-status="preview-live"]')).toBeVisible();
  expectResponsiveCaptureGeometry(await captureGeometry(page), 390);
  const preview = page.locator('[data-native-camera-preview]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS('object-position', '50% 42%');
  expect(
    await preview.evaluate((video: HTMLVideoElement) => {
      const rect = video.getBoundingClientRect();
      return (
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    }),
  ).toBe(true);
  await expect(page.getByLabel('Choose a face photo')).toHaveCount(0);
  await expect(page.locator('[data-capture-sequence]')).toHaveAttribute(
    'data-capture-phase',
    'captured',
    { timeout: 5_000 },
  );
  await expect(page.locator('[data-frame-frozen="true"] img')).toBeVisible();
  await expect(page.locator('[data-frame-frozen="true"] img')).toHaveCSS(
    'object-position',
    '50% 42%',
  );
  const contract = await page.evaluate(() => ({
    alerts:
      (
        window as Window & {
          __faceValueAlertMessages?: string[];
        }
      ).__faceValueAlertMessages ?? [],
    trackStops:
      (
        window as Window & {
          __faceValueTrackStops?: number;
        }
      ).__faceValueTrackStops ?? 0,
  }));
  expect(contract.alerts).toEqual([]);
  expect(contract.trackStops).toBe(1);
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
  test(`fills the active chamber in mobile WebKit at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openCapture(page);
    expectResponsiveCaptureGeometry(await captureGeometry(page), viewport.width);
    await startCapture(page);
    await expect(page.locator('[data-capture-sequence]')).toHaveAttribute(
      'data-capture-phase',
      'aligning',
    );
    const active = await captureGeometry(page);
    expectResponsiveCaptureGeometry(active, viewport.width);
    const visible = await page.evaluate(() => {
      const route = document.querySelector('[data-capture-route-bar]')!.getBoundingClientRect();
      const rail = document.querySelector('[data-capture-quality-rail]')!.getBoundingClientRect();
      const screen = document.querySelector<HTMLElement>('section[data-preview-state]')!;
      return {
        routeTop: route.top,
        chassisTop: document
          .querySelector<HTMLElement>('[data-capture-sequence]')!
          .getBoundingClientRect().top,
        railBottom: rail.bottom,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
        scrollY: window.scrollY,
        screenScrollTop: screen.scrollTop,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });
    expect(visible.routeTop).toBeGreaterThanOrEqual(0);
    expect(visible.chassisTop).toBeGreaterThan(visible.routeTop);
    expect(visible.railBottom).toBeLessThanOrEqual(visible.viewportHeight + 1);
    expect(visible.scrollY).toBe(0);
    expect(visible.screenScrollTop).toBe(0);
    expect(visible.bodyOverflow).toBe('hidden');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('visual viewport contraction preserves width and guide geometry without clipping or scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page);
  await startCapture(page);
  await expect(page.locator('[data-capture-sequence]')).toHaveAttribute(
    'data-capture-phase',
    'aligning',
  );
  const expanded = await captureGeometry(page);
  await pinVisualViewportHeight(page, 660);
  await page.waitForTimeout(220);
  const contracted = await captureGeometry(page);
  expectResponsiveCaptureGeometry(contracted, 390, { compactGuide: true });
  expect(contracted.chassis.width).toBeCloseTo(expanded.chassis.width, 0);
  expect(contracted.chassis.top).toBeCloseTo(expanded.chassis.top, 0);
  expect(contracted.guide.width).toBeLessThan(expanded.guide.width);
  expect(contracted.route.top).toBeGreaterThanOrEqual(0);
  expect(contracted.rail.bottom).toBeLessThanOrEqual(660);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await page.locator('section[data-preview-state]').evaluate((element) => element.scrollTop),
  ).toBe(0);

  await pinVisualViewportHeight(page, 844);
  await expect
    .poll(async () => guideGeometry(await captureGeometry(page)), {
      message: 'guide returns to its exact expanded geometry after Safari chrome restores',
    })
    .toEqual(guideGeometry(expanded));
  const restored = await captureGeometry(page);
  expect(restored.chassis).toEqual(expanded.chassis);
});

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
  await pinVisualViewportHeight(page, 844);
  const chassis = page.locator('[data-capture-sequence]');
  const captureScreen = page.locator('section[data-preview-state]');
  await expect.soft(captureScreen).toHaveScreenshot('capture-searching.png', {
    animations: 'disabled',
  });
  await saveEvidence(captureScreen, 'searching.png');

  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 105);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 150);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'aligning');
  await expect.soft(captureScreen).toHaveScreenshot('capture-aligning.png', {
    animations: 'disabled',
  });
  await saveEvidence(captureScreen, 'aligning.png');

  await advanceVisualClock(page, 350);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 350);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 500);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'locking');
  await expect(page.locator('[data-capture-guide-segments]')).toHaveCSS('opacity', '0.96');
  await expect(page.locator('[data-capture-guide-connectors]')).toHaveCount(1);
  await expect(page.locator('[data-guide-connector]')).toHaveCount(4);
  await expect(page.locator('[data-capture-guide-anchor]')).toHaveCount(4);
  await expect(page.locator('[data-face-acquisition-guide] ellipse')).toHaveCount(0);
  // Seeking a CSS animation timeline makes Linux WebKit's screenshot
  // compositor intermittently omit unrelated layers. Freeze the authored
  // milestone as ordinary styles so the snapshot measures the product, not
  // the runner's animation compositor.
  await setStaticVisualStyle(page.locator('[data-capture-guide-connectors]'), {
    animation: 'none',
    opacity: '1',
    strokeDashoffset: '12',
  });
  await expect.soft(captureScreen).toHaveScreenshot('capture-locking.png', {
    animations: 'disabled',
    maxDiffPixels: 64,
  });
  await saveEvidence(captureScreen, 'locking.png');

  await advanceVisualClock(page, 730);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  // The damped bottle-scanner easing reaches the visual midpoint before the
  // temporal midpoint; pause where the amber leading edge crosses the face field.
  await setStaticVisualStyle(page.locator('[data-capture-scan-optic]'), {
    animation: 'none',
    opacity: '1',
    transform: 'translate3d(0, 147%, 0)',
  });
  await setStaticVisualStyle(page.locator('[data-capture-scan-atmosphere]'), {
    animation: 'none',
    opacity: '1',
  });
  await expect.soft(captureScreen).toHaveScreenshot('capture-scanning.png', {
    animations: 'disabled',
    maxDiffPixels: 24,
  });
  await saveEvidence(captureScreen, 'scanning.png');

  await advanceVisualClock(page, 900);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'captured');
  await expect.soft(captureScreen).toHaveScreenshot('capture-captured.png', {
    animations: 'disabled',
  });
  await saveEvidence(captureScreen, 'captured.png');

  await openCapture(page, { scenario: 'permission-denied' });
  await pinVisualViewportHeight(page, 844);
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 50);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'error');
  await advanceVisualClock(page, 16);
  await expect(page.locator('[data-face-acquisition-guide]')).toHaveCount(0);
  await expect(page.locator('[data-capture-quality-rail]')).toHaveCount(0);
  await expect(page.getByLabel('Choose a face photo')).toBeFocused();
  await expect.soft(captureScreen).toHaveScreenshot('capture-permission-error.png', {
    animations: 'disabled',
  });
  await saveEvidence(captureScreen, 'permission-denied.png');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCapture(page);
  await pinVisualViewportHeight(page, 844);
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await advanceVisualClock(page, 225);
  await advanceVisualClock(page, 250);
  await advanceVisualClock(page, 500);
  await advanceVisualClock(page, 730);
  await expect(chassis).toHaveAttribute('data-capture-phase', 'scanning');
  await expect.soft(captureScreen).toHaveScreenshot('capture-reduced-motion.png', {
    animations: 'disabled',
  });
  await saveEvidence(captureScreen, 'reduced-motion.png');
});
