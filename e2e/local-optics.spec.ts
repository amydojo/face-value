import { expect, test, type Page } from '@playwright/test';

// REAL browser camera API with Chromium's synthetic camera device (a test pattern, not a face),
// and the landmark model withheld. Covers the failure paths of the guided capture: no model,
// camera permission denied, and the privacy and accessibility basics. Not iPhone or Safari evidence.

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test.skip(({ browserName }) => browserName !== 'chromium', 'Needs Chromium’s synthetic camera device');

async function trackCamera(page: Page) {
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    const w = window as unknown as { __tracks: MediaStreamTrack[]; __deny: boolean };
    w.__tracks = tracks;
    w.__deny = false;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (w.__deny) throw new DOMException('Permission denied', 'NotAllowedError');
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
}

const liveTracks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === 'live').length);

test('without the model the guide fails clearly, releases the camera and stores nothing', async ({ page, context }) => {
  await context.grantPermissions(['camera']);
  await trackCamera(page);
  const requests: { url: string; method: string }[] = [];
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.route('**/face_landmarker.task', (route) => route.fulfill({ status: 404, body: '' }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/experiments/local-optics');
  await expect(page.getByRole('heading', { name: 'Face scan' })).toBeVisible();
  await expect(page.getByText('Experimental · unvalidated', { exact: true })).toBeVisible();
  // One primary action, nothing technical on the default screen.
  await expect(page.locator('[data-local-optics] > section button')).toHaveText(['Lab', 'Start scan']);
  await expect(page.locator('[data-local-optics] > section')).not.toContainText(/landmark|MediaPipe|sha|tolerance/i);
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));

  await page.getByRole('button', { name: 'Start scan' }).click();
  await expect(page.locator('[data-failure="model"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'The face guide couldn’t load' })).toBeVisible();
  await expect.poll(() => liveTracks(page)).toBe(0);
  await page.screenshot({ path: test.info().outputPath('model-unavailable-390x844.png') });

  // The Lab says why; nothing is ever uploaded or stored.
  await page.getByRole('button', { name: 'Lab' }).click();
  await page.getByText('Diagnostics and details').click();
  await expect(page.locator('[data-local-optics-model]')).toContainText(
    'unavailable (Model not available at /local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task (404))',
  );
  await expect(page.locator('[data-diagnostic="Camera permission"] dd')).toHaveText('granted');

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Start scan' })).toBeVisible();
  const log = JSON.parse((await page.locator('[data-local-optics]').getAttribute('data-scan-log'))!);
  expect(log).toEqual([expect.objectContaining({ outcome: 'failed', bursts: [] })]);

  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(storageBefore);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((r) => !r.url.startsWith(origin))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
});

test('camera permission denied: a plain explanation, and “Try again” recovers once allowed', async ({ page }) => {
  await trackCamera(page);
  await page.route('**/face_landmarker.task', (route) => route.fulfill({ status: 404, body: '' }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/experiments/local-optics');
  await page.evaluate(() => {
    (window as unknown as { __deny: boolean }).__deny = true;
  });
  await page.getByRole('button', { name: 'Start scan' }).click();
  await expect(page.locator('[data-failure="denied"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Camera access is off' })).toBeVisible();
  await expect(page.getByText(/Website Settings, then Camera/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await page.screenshot({ path: test.info().outputPath('denied-320x568.png') });

  await page.evaluate(() => {
    (window as unknown as { __deny: boolean }).__deny = false;
  });
  await page.getByRole('button', { name: 'Try again' }).click();
  // The camera opens; the (withheld) model then fails on its own terms.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.length)).toBe(1);
  await expect(page.locator('[data-failure="model"]')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => liveTracks(page)).toBe(0);
});

test('reduced motion: no transitions or entrance animations in the capture chamber', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Hold the model download open so the chamber stays on screen while it is inspected.
  await page.route('**/face_landmarker.task', () => undefined);
  await page.goto('/experiments/local-optics');
  await page.getByRole('button', { name: 'Start scan' }).click();
  const fill = page.locator('[data-shutter] circle').nth(1);
  await expect(fill).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('[data-rail="light"]')).toHaveCSS('transition-duration', '0s');
});
