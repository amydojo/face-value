import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test as base, type Page } from '@playwright/test';

// REAL MediaPipe Face Landmarker inference on licensed still images, played into the page as
// Chromium's camera (getUserMedia). The model, runtime and pixels are real; the "camera" is a
// looping still image, not a person, and Chromium is not iOS Safari.
//
// Requires: Chromium, ffmpeg, and same-origin assets from `npm run prepare:local-optics`.

const FIXTURES = new URL('./fixtures/local-optics/', import.meta.url).pathname;
const VIDEO_DIR = join(tmpdir(), 'fv-local-optics-inference');
const ASSETS = new URL('../public/local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task', import.meta.url)
  .pathname;

const videos = {
  oneFace: join(VIDEO_DIR, 'one-face.y4m'),
  noFace: join(VIDEO_DIR, 'no-face.y4m'),
  twoFaces: join(VIDEO_DIR, 'two-faces.y4m'),
};

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function makeVideo(target: string, inputs: string[], filter: string) {
  if (existsSync(target)) return;
  mkdirSync(VIDEO_DIR, { recursive: true });
  execFileSync(
    'ffmpeg',
    [
      '-loglevel', 'error', '-y',
      ...inputs.flatMap((input) => ['-loop', '1', '-i', join(FIXTURES, input)]),
      '-filter_complex', filter, '-t', '1', '-r', '15', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', target,
    ],
    { stdio: 'inherit' },
  );
}

const pad = 'scale=480:480,pad=640:480:80:0:color=0x808080';
function prepareVideos() {
  makeVideo(videos.oneFace, ['one-face-nasa-eileen-collins.png'], `[0:v]${pad}`);
  makeVideo(videos.noFace, ['no-face-still-life.jpg'], '[0:v]scale=-2:480,pad=640:480:(ow-iw)/2:0:color=0x808080');
  makeVideo(
    videos.twoFaces,
    ['one-face-nasa-eileen-collins.png', 'one-face-nasa-eileen-collins.png'],
    // Head-and-shoulders crops: the detector is short-range, so faces must be selfie-sized.
    '[0:v]crop=256:256:150:10,scale=320:320[a];[1:v]crop=256:256:150:10,scale=320:320[b];[a][b]hstack,pad=640:480:0:80:color=0x808080',
  );
}

base.skip(({ browserName }) => browserName !== 'chromium', 'Needs Chromium’s file-backed camera device');
base.skip(!existsSync(ASSETS), 'Run `npm run prepare:local-optics` first: the model assets are not prepared');
base.skip(!hasFfmpeg(), 'ffmpeg is needed to turn the image fixtures into camera video');

/** A page in a dedicated Chromium whose camera plays `video`. */
const test = base.extend<{ cameraVideo: string; page: Page }>({
  cameraVideo: ['', { option: true }],
  page: async ({ playwright, launchOptions, baseURL, cameraVideo }, provide) => {
    const browser = await playwright.chromium.launch({
      ...launchOptions,
      args: [
        ...(launchOptions.args ?? []),
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${cameraVideo}`,
      ],
    });
    const context = await browser.newContext({ baseURL, permissions: ['camera'] });
    await provide(await context.newPage());
    await browser.close();
  },
});

async function open(page: Page, requests: { url: string; method: string }[]) {
  await page.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = tracks;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/experiments/local-optics');
  await expect(page.getByText(/EXPERIMENTAL · UNVALIDATED/)).toBeVisible();
}

async function startAndLoad(page: Page) {
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('[data-local-optics-status]')).toContainText('Camera: on');
  await page.getByRole('button', { name: 'Load face landmarks' }).click();
  await expect(page.locator('[data-local-optics-status]')).toContainText(
    /Landmarks: MediaPipe Face Landmarker \(tasks-vision 0\.10\.35, (GPU|CPU), same-origin\)/,
    { timeout: 60_000 },
  );
}

const liveTracks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === 'live').length);

base.beforeAll(prepareVideos);

test.describe('one face', () => {
  test.use({ cameraVideo: videos.oneFace });

  test('real model: live and captured measurements, same-origin only, clean shutdown and re-initialisation', async ({ page }) => {
    const requests: { url: string; method: string }[] = [];
    await open(page, requests);
    await startAndLoad(page);
    // React StrictMode (dev) mounted, unmounted and remounted the route: exactly one live camera track.
    expect(await liveTracks(page)).toBe(1);

    const live = page.locator('[data-local-optics-live]');
    await expect(live).toContainText(/Live · faces 1 · roll -?\d+\.\d° · yaw -?\d+\.\d° · size 0\.\d{3}/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Capture baseline' }).click();
    await page.getByRole('button', { name: 'Capture comparison' }).click();
    const baseline = page.locator('[data-local-optics-capture="baseline"]');
    await expect(baseline.locator('[data-local-optics-frames]')).toContainText('faces per frame 1–1', { timeout: 30_000 });
    const comparison = page.locator('[data-local-optics-comparison]');
    await expect(comparison).toBeVisible({ timeout: 30_000 });
    for (const property of ['Roll', 'Apparent size', 'Horizontal position', 'Face brightness']) {
      await expect(comparison.getByRole('row', { name: new RegExp(`^${property} (measured|model)`) })).toHaveAttribute(
        'data-status',
        /within_experimental_tolerance|outside_experimental_tolerance/,
      );
    }
    await expect(comparison.getByRole('row', { name: /^Yaw/ })).toContainText('model estimate');
    await page.screenshot({ path: test.info().outputPath('one-face-390x844.png'), fullPage: true });

    // Every request went to this origin; the model and runtime came from the prepared assets.
    const origin = new URL(page.url()).origin;
    expect(requests.filter((r) => !r.url.startsWith(origin))).toEqual([]);
    expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
    expect(requests.some((r) => r.url.endsWith('/local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task'))).toBe(true);
    expect(requests.some((r) => /vision_wasm_(nosimd_)?internal\.wasm$/.test(r.url))).toBe(true);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);

    // Leaving the page stops the camera and drops the model; the next session initialises again.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect.poll(() => liveTracks(page)).toBe(0);
    await expect(page.locator('[data-local-optics-status]')).toContainText('Camera: off · Landmarks: not loaded');
    await startAndLoad(page);
    await expect(live).toContainText('Live · faces 1', { timeout: 15_000 });
    expect(await liveTracks(page)).toBe(1);
  });

  test('model initialisation failure is reported and nothing is inferred', async ({ page }) => {
    const requests: { url: string; method: string }[] = [];
    await page.route('**/face_landmarker.task', (route) =>
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(1024, 7) }),
    );
    await open(page, requests);
    await page.getByRole('button', { name: 'Start camera' }).click();
    await page.getByRole('button', { name: 'Load face landmarks' }).click();
    await expect(page.locator('[data-local-optics-status]')).toContainText('Landmarks: unavailable (Model integrity check failed');
    // A refused model never reaches the runtime: no WebAssembly was requested.
    expect(requests.some((r) => r.url.endsWith('.wasm'))).toBe(false);
    await page.getByRole('button', { name: 'Capture baseline' }).click();
    await expect(page.locator('[data-local-optics-capture="baseline"] [data-local-optics-rejections]')).toContainText(
      'landmark_model_unavailable',
    );
    await page.unroute('**/face_landmarker.task');
    await page.route('**/face_landmarker.task', (route) => route.fulfill({ status: 404, body: '' }));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.getByRole('button', { name: 'Load face landmarks' }).click();
    await expect(page.locator('[data-local-optics-status]')).toContainText('Model not available at');
  });
});

test.describe('device behaviour', () => {
  test.use({ cameraVideo: videos.oneFace });

  test('backgrounding stops the camera, CPU can be forced, and the export is numbers only', async ({ page }) => {
    const requests: { url: string; method: string }[] = [];
    await open(page, requests);
    await page.goto('/experiments/local-optics?delegate=cpu');
    await startAndLoad(page);
    const diagnostics = page.locator('[data-local-optics-diagnostics]');
    await expect(diagnostics.locator('[data-diagnostic="Delegate in use"] dd')).toHaveText('CPU');
    await expect(diagnostics.locator('[data-diagnostic="Secure context (HTTPS)"] dd')).toHaveText('yes');
    await expect(diagnostics.locator('[data-diagnostic="Frame"] dd')).toContainText('640×480 landscape');
    await expect(diagnostics.locator('[data-diagnostic="Model initialisation"] dd')).toHaveText(/^\d+ ms$/);
    await expect(page.locator('[data-local-optics-live]')).toContainText('Live · faces 1', { timeout: 15_000 });

    // App switch: the page becomes hidden. The camera stops; the model stays loaded.
    const modelFetches = () => requests.filter((r) => r.url.endsWith('/face_landmarker.task')).length;
    const fetchedBefore = modelFetches();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => liveTracks(page)).toBe(0);
    await expect(diagnostics.locator('[data-diagnostic="Background pauses"] dd')).toHaveText('1');
    await expect(page.locator('[data-local-optics-status]')).toContainText('Camera: paused');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: 'Restart camera' }).click();
    await expect(page.locator('[data-local-optics-live]')).toContainText('Live · faces 1', { timeout: 15_000 });
    expect(modelFetches()).toBe(fetchedBefore);
    expect(await liveTracks(page)).toBe(1);

    // Numbers-only export, built only on request.
    await page.getByRole('button', { name: 'Capture baseline' }).click();
    await page.getByRole('button', { name: 'Capture comparison' }).click();
    await expect(page.locator('[data-local-optics-comparison]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Pair label' }).fill('A01 repeat');
    await page.getByRole('button', { name: 'Add pair to log' }).click();
    const json = await page.getByRole('textbox', { name: 'Numeric log JSON' }).inputValue();
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({ exportVersion: 'fv-local-optics-export-0.1', delegate: 'CPU', pairs: [{ label: 'A01 repeat' }] });
    expect(parsed.pairs[0].captures.baseline.faceCounts.every((n: number) => n === 1)).toBe(true);
    expect(json).not.toMatch(/data:|blob:|deviceId|groupId|"points"/);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);

    const origin = new URL(page.url()).origin;
    expect(requests.filter((r) => !r.url.startsWith(origin))).toEqual([]);
    expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
  });
});

test.describe('no face', () => {
  test.use({ cameraVideo: videos.noFace });

  test('real model reports zero faces and the capture is rejected', async ({ page }) => {
    await open(page, []);
    await startAndLoad(page);
    await expect(page.locator('[data-local-optics-live]')).toContainText(/^Live · faces 0$/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Capture baseline' }).click();
    const baseline = page.locator('[data-local-optics-capture="baseline"]');
    await expect(baseline.locator('[data-local-optics-frames]')).toContainText('faces per frame 0–0', { timeout: 30_000 });
    await expect(baseline.locator('[data-local-optics-rejections]')).toContainText('no_face');
  });
});

test.describe('multiple faces', () => {
  test.use({ cameraVideo: videos.twoFaces });

  test('real model reports two faces and the capture is rejected', async ({ page }) => {
    await open(page, []);
    await startAndLoad(page);
    await expect(page.locator('[data-local-optics-live]')).toContainText(/^Live · faces 2$/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Capture baseline' }).click();
    await expect(page.locator('[data-local-optics-capture="baseline"] [data-local-optics-rejections]')).toContainText(
      'multiple_faces',
      { timeout: 30_000 },
    );
  });
});
