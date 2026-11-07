import { existsSync } from 'node:fs';
import { expect, test as base, type Page } from '@playwright/test';
import { hasFfmpeg } from './local-optics-videos';

// Shared harness for the guided-capture e2e specs: a dedicated Chromium whose camera plays a
// generated video (Chromium's file-backed fake camera), plus helpers that read the in-memory scan
// log the page exposes for testing. Real model, real pixels; the camera is a video, not a person,
// and Chromium is not iOS Safari.

export const MODEL = new URL('../public/local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task', import.meta.url)
  .pathname;
export const modelPrepared = () => existsSync(MODEL);

export interface Burst {
  trigger: 'auto' | 'manual';
  accepted: boolean;
  rejections: string[];
  aligned: boolean;
  landmarkMotion: number | null;
  frameIntervalMs: number | null;
}

export interface Scan {
  mode: 'baseline' | 'follow_up';
  outcome: string;
  trigger: 'auto' | 'manual' | null;
  cameraReadyMs: number | null;
  guideReadyMs: number | null;
  firstFaceMs: number | null;
  firstAlignedMs: number | null;
  acceptedMs: number | null;
  endedMs: number | null;
  corrections: number;
  instructions: string[];
  bursts: Burst[];
  interruptions: number;
  helpShown: boolean;
  comparison: string | null;
}

export function skipUnlessRealModel() {
  base.skip(({ browserName }) => browserName !== 'chromium', 'Needs Chromium’s file-backed camera device');
  base.skip(!modelPrepared(), 'Run `npm run prepare:local-optics` first: the model assets are not prepared');
  base.skip(!hasFfmpeg(), 'ffmpeg is needed to build the camera videos');
}

const requestLog = new WeakMap<Page, { url: string; method: string }[]>();
/** Every request the page made, in order. */
export const requestsOf = (page: Page) => requestLog.get(page) ?? [];

/** A page in a dedicated Chromium whose camera plays `cameraVideo`, tracking every camera track. */
export const test = base.extend<{ cameraVideo: string; page: Page }>({
  cameraVideo: ['', { option: true }],
  page: async ({ playwright, launchOptions, baseURL, cameraVideo }, provide) => {
    const browser = await playwright.chromium.launch({
      ...launchOptions,
      args: [
        ...(launchOptions.args ?? []),
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        ...(cameraVideo ? [`--use-file-for-fake-video-capture=${cameraVideo}`] : []),
      ],
    });
    const context = await browser.newContext({ baseURL, permissions: ['camera'], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
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
    const requests: { url: string; method: string }[] = [];
    requestLog.set(page, requests);
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
    await provide(page);
    await browser.close();
  },
});

export { expect };

export const root = (page: Page) => page.locator('[data-local-optics]');
export const instruction = (page: Page) => page.locator('[data-instruction]');

export async function open(page: Page, query = '') {
  await page.goto(`/experiments/local-optics${query}`);
  await expect(page.getByRole('button', { name: 'Start scan' })).toBeVisible();
}

export async function scans(page: Page): Promise<Scan[]> {
  return JSON.parse((await root(page).getAttribute('data-scan-log')) ?? '[]');
}

export const liveTracks = (page: Page) =>
  page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.filter((t) => t.readyState === 'live').length);

export async function phase(page: Page) {
  return root(page).getAttribute('data-phase');
}

export async function waitForPhase(page: Page, kind: string, timeout = 60_000) {
  await expect(root(page)).toHaveAttribute('data-phase', kind, { timeout });
}

/** The panel's primary action for the next scan, whatever the previous result was. */
export async function startNext(page: Page) {
  for (const name of ['Start scan', 'Scan follow-up', 'Scan again', 'Try again', 'Resume scan']) {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.isVisible()) {
      await button.click();
      return;
    }
  }
  throw new Error('No start action visible');
}

/** Waits until the guide has a live reading (camera and model running). */
export async function waitForGuide(page: Page, timeout = 60_000) {
  await expect(instruction(page)).not.toHaveAttribute('data-instruction', /preparing/, { timeout });
  await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout });
}

export async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/** Same-origin GETs only: no uploads, no third-party hosts. */
export function expectSameOriginGets(page: Page) {
  const requests = requestsOf(page);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((r) => !r.url.startsWith(origin))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
}
