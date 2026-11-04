import { expect, test } from '@playwright/test';

// REAL browser camera API with Chromium's synthetic camera device: getUserMedia, video frames,
// canvas pixels and track lifecycle are real; the picture is Chromium's test pattern, not a face,
// and the landmark model is unreachable here. This is not iPhone or Safari evidence.

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

test.skip(({ browserName }) => browserName !== 'chromium', 'Needs Chromium’s synthetic camera device');

test('local optics measures what it can and refuses what it cannot', async ({ page, context }) => {
  await context.grantPermissions(['camera']);
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    (window as unknown as { __opticsTracks: MediaStreamTrack[] }).__opticsTracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  const requests: { url: string; method: string }[] = [];
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
  // The landmark model is hosted by third parties; make its absence explicit and deterministic.
  await page.route(/cdn\.jsdelivr\.net|storage\.googleapis\.com/, (route) => route.abort());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/experiments/local-optics');
  await expect(page.getByRole('heading', { name: 'Local capture comparability' })).toBeVisible();
  const storageBefore = await page.evaluate(() => JSON.stringify({ ...localStorage }));

  await page.getByRole('button', { name: 'Start camera' }).click();
  const status = page.locator('[data-local-optics-status]');
  await expect(status).toContainText('Camera: on');

  await page.getByRole('button', { name: 'Load face landmarks' }).click();
  await expect(status).toContainText('Landmarks: unavailable');
  // It failed at the network (third-party model host refused), not before trying.
  await expect.poll(() => requests.some((r) => r.url.includes('cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'))).toBe(true);

  await page.getByRole('button', { name: 'Capture baseline' }).click();
  const baseline = page.locator('[data-local-optics-capture="baseline"]');
  await expect(baseline.locator('[data-local-optics-frames]')).toContainText('12 frames · 360×');
  await expect(baseline.locator('[data-local-optics-rejections]')).toContainText('landmark_model_unavailable');
  await expect(baseline).toContainText(/Whole-frame brightness \d+\.\d/);

  await page.getByRole('button', { name: 'Capture comparison' }).click();
  const comparison = page.locator('[data-local-optics-comparison]');
  await expect(comparison).toHaveAttribute('data-local-optics-comparison', 'not_comparable');
  await expect(comparison.getByRole('row', { name: /^Roll/ })).toContainText('Not measured');
  await expect(comparison.getByRole('row', { name: /^Whole-frame brightness/ })).toContainText('Shown only');
  await expect(comparison.locator('tr[data-status="within_experimental_tolerance"]')).toHaveCount(0);
  await expect(baseline.locator('[data-local-optics-frames]')).toContainText('faces per frame not measured');
  await expect(comparison).toContainText('Colour cast (no neutral reference target in frame)');
  await page.screenshot({ path: test.info().outputPath('local-optics-390x844.png'), fullPage: true });

  // Nothing was stored, and nothing but same-origin assets and the refused model was requested.
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(storageBefore);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  const origin = new URL(page.url()).origin;
  const offOrigin = requests.filter((r) => !r.url.startsWith(origin));
  expect(offOrigin.every((r) => /cdn\.jsdelivr\.net|storage\.googleapis\.com/.test(r.url) && r.method === 'GET')).toBe(true);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);

  // Leaving the page releases the camera.
  const live = () =>
    page.evaluate(() =>
      (window as unknown as { __opticsTracks: MediaStreamTrack[] }).__opticsTracks.map((t) => t.readyState),
    );
  expect(await live()).toContain('live');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect.poll(live).toEqual(expect.not.arrayContaining(['live']));
  await expect(status).toContainText('Camera: off');
});
