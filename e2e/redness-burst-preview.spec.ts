import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  STORAGE_KEY,
  toPersistedDemoData,
} from '../src/adapters/persistence/localObservationStore';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';

const previewVerification = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const captureEvidence = process.env.CAPTURE_REDNESS_BURST_EVIDENCE === 'true';
const vercelShareToken = process.env.VERCEL_SHARE_BYPASS_TOKEN?.trim() || null;
const evidenceDirectory = resolve('docs/verification/redness-evidence-burst-63');
const baselineReady = toPersistedDemoData(
  buildDemoFixtureState('baseline_ready', 'clear_favorable_change'),
);

test.describe('exact-preview redness burst verification', () => {
  test.skip(!previewVerification, 'Runs explicitly against an exact Vercel preview.');

  test.beforeAll(async () => {
    if (captureEvidence) await mkdir(evidenceDirectory, { recursive: true });
  });

  test('captures baseline replacement, follow-up progression, and immutable record continuity', async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await installNativeCameraMock(page, { rejectFirstBurstGate: true });
    const provider = await mockProtectedProvider(page, {
      scores: [93.3356, 92.5, 94.25, 100, 99, 100],
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedBaselineReady(page);

    await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
    await startGuidedCapture(page);
    const captureScreen = page.locator('section[data-preview-state]');
    await expect(captureScreen).toHaveAttribute('data-burst-attempts', '1');
    await expect(page.getByText('Replacing one measurement automatically')).toBeVisible();
    await saveEvidence(captureScreen, 'recoverable-rejection.png');
    await expect(captureScreen).toHaveAttribute('data-burst-captured', '1');
    await expect(page.locator('[data-measurement-indicator]')).toHaveAttribute(
      'data-measurements-accepted',
      '1',
    );
    await saveEvidence(captureScreen, 'baseline-burst-progression.png');
    await finishCaptureContext(page, 'baseline');

    const baselineStorage = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(baselineStorage).toContain('"attemptedFrameCount":4');
    expect(baselineStorage).toContain('"movement above accepted range"');
    expect(baselineStorage).not.toMatch(
      /providerTaskId|ephemeralTaskReference|blob:|data:image|base64|MediaStream/,
    );

    await page.getByRole('button', { name: 'DONE' }).click();
    await advanceDemoTimeline(page);
    await page.getByRole('button', { name: 'Take follow-up scan' }).click();
    await startGuidedCapture(page);
    const followUpScreen = page.locator('section[data-preview-state]');
    await expect(followUpScreen).toHaveAttribute('data-burst-captured', '1');
    await expect(page.getByText('Securing follow-up', { exact: true })).toBeVisible();
    await saveEvidence(followUpScreen, 'follow-up-burst-progression.png');
    await finishCaptureContext(page, 'followup');

    await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
    const snapshotBeforeCollection = await savedEvaluation(page);
    await collectEvidenceRecord(page);
    await page.getByRole('button', { name: 'DONE' }).click();
    await expect(page.getByRole('heading', { name: 'Your trials' })).toBeVisible();
    await page.getByRole('button', { name: /Previous trials, 1 saved result/i }).click();
    await page.getByRole('button', { name: /Open saved result/i }).click();
    await page.getByRole('button', { name: /Full evidence record/i }).click();
    await expect(page.getByText('93.34 · 92.5 · 94.25', { exact: true })).toBeVisible();
    await expect(page.getByText('100 · 99 · 100', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Evidence record' })).toBeVisible();
    await page.getByRole('button', { name: /Full evidence record/i }).click();
    await expect(page.getByText('93.34 · 92.5 · 94.25', { exact: true })).toBeVisible();
    await expect(page.getByText('100 · 99 · 100', { exact: true })).toBeVisible();
    await saveEvidence(page.locator('main'), 'final-immutable-evidence-record.png');

    expect(await savedEvaluation(page)).toEqual(snapshotBeforeCollection);
    expect(provider.successfulAnalyses).toBe(6);
    expect(provider.taskRequests).toBe(6);
    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    expect(await page.evaluate(() => window.__faceValueUnhandledRejections ?? [])).toEqual([]);
  });

  test('captures the selected terminal provider-failure behavior', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await installNativeCameraMock(page);
    const provider = await mockProtectedProvider(page, {
      scores: [93.3356, 92.5],
      failTaskRequests: new Set([3, 4]),
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedBaselineReady(page);

    await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
    await startGuidedCapture(page);
    await expect(page.getByRole('alert')).toContainText('We couldn’t finish this scan.');
    await expect(page.getByRole('heading', { name: 'Measurements not saved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TRY BURST AGAIN' })).toBeVisible();
    const captureScreen = page.locator('section[data-preview-state]');
    await expect(captureScreen).toHaveAttribute('data-burst-accepted', '2');
    await saveEvidence(captureScreen, 'provider-failure.png');

    const persisted = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(JSON.parse(persisted!).longitudinalEvidence.baselineBurst ?? null).toBeNull();
    expect(provider.taskRequests).toBe(4);
    expect(provider.successfulAnalyses).toBe(2);
    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
    expect(await page.evaluate(() => window.__faceValueUnhandledRejections ?? [])).toEqual([]);
  });
});

declare global {
  interface Window {
    __faceValueUnhandledRejections?: string[];
  }
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function saveEvidence(locator: Locator, name: string): Promise<void> {
  if (!captureEvidence) return;
  await locator.screenshot({
    path: resolve(evidenceDirectory, name),
    animations: 'disabled',
  });
}

async function seedBaselineReady(page: Page): Promise<void> {
  const initialUrl = new URL('/?redness-burst-preview-verification=1', 'https://preview.invalid');
  if (vercelShareToken) {
    initialUrl.searchParams.set('_vercel_share', vercelShareToken);
  }
  await page.goto(`${initialUrl.pathname}${initialUrl.search}`);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: baselineReady,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeVisible();
}

async function startGuidedCapture(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Position your face' })).toBeVisible();
  await page.getByRole('button', { name: 'START GUIDED CAPTURE' }).click();
  await expect(page.locator('[data-preview-state="preview-live"]')).toBeVisible();
  await expect(
    page.getByLabel('Capture quality').locator('[data-quality-state="passed"]'),
  ).toHaveCount(2);
  await expect(page.getByLabel('alignment: pending')).toBeVisible();
}

async function finishCaptureContext(page: Page, role: 'baseline' | 'followup'): Promise<void> {
  await expect(page.getByRole('heading', { name: '3 measurements accepted' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Processing measurements' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Anything meaningfully different today?' }),
  ).toBeVisible();
  await expect(page.locator(`[data-fv-screen="${role}-context"]`)).toBeVisible();
  await page.getByRole('button', { name: 'NOTHING DIFFERENT' }).click();
  if (role === 'baseline') {
    await expect(page.getByRole('heading', { name: 'Baseline locked.' })).toBeVisible();
  }
}

async function advanceDemoTimeline(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Expected persisted baseline evidence.');
    const value = JSON.parse(raw) as { demoTimelineAdvanced: boolean };
    value.demoTimelineAdvanced = true;
    localStorage.setItem(key, JSON.stringify(value));
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toBeVisible();
}

async function collectEvidenceRecord(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Reveal sealed result for/i }).click();
  const machine = page.locator('[data-oracle-machine]');
  await expect(machine).toHaveAttribute('data-oracle-state', 'verdict_revealed');
  await page.getByRole('button', { name: 'Keep this result', exact: true }).click();
  const paper = page.locator('[data-oracle-paper]');
  await expect(paper).toHaveAttribute('data-paper-position', 'final');
  await page.getByRole('button', { name: /Evidence record for/i }).click();
  await expect(machine).toHaveAttribute('data-oracle-state', 'collected');
}

async function savedEvaluation(page: Page): Promise<unknown> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as {
      longitudinalEvidence?: { evaluation?: unknown };
      record?: { rednessEvaluation?: unknown } | null;
    };
    return value.record?.rednessEvaluation ?? value.longitudinalEvidence?.evaluation ?? null;
  }, STORAGE_KEY);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function installNativeCameraMock(
  page: Page,
  { rejectFirstBurstGate = false }: { rejectFirstBurstGate?: boolean } = {},
): Promise<void> {
  await page.addInitScript((rejectFirstGate) => {
    const runtime = window as Window & {
      __faceValueRejectNextDistinctGate?: boolean;
      __faceValueDistinctGate?: boolean;
      __faceValueDecodedFrames?: number;
      __faceValueCurrentLuma?: number;
      __faceValuePostRejectionHoldApplied?: boolean;
    };
    const rejectionMarker = 'face-value-preview-rejection-exercised';
    const rejectionAlreadyExercised = sessionStorage.getItem(rejectionMarker) === 'true';
    runtime.__faceValueRejectNextDistinctGate = rejectFirstGate && !rejectionAlreadyExercised;
    runtime.__faceValueDistinctGate = false;
    runtime.__faceValueDecodedFrames = 0;
    runtime.__faceValueCurrentLuma = 120;
    runtime.__faceValuePostRejectionHoldApplied = !rejectFirstGate || rejectionAlreadyExercised;
    window.__faceValueUnhandledRejections = [];
    window.addEventListener('unhandledrejection', (event) => {
      window.__faceValueUnhandledRejections?.push(String(event.reason));
    });

    const track = {
      stop: () => undefined,
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
        getUserMedia: async () => stream,
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
      play: {
        configurable: true,
        value: () => Promise.resolve(),
      },
      pause: {
        configurable: true,
        value: () => undefined,
      },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      videoWidth: { configurable: true, get: () => 1280 },
      videoHeight: { configurable: true, get: () => 720 },
      requestVideoFrameCallback: {
        configurable: true,
        value(callback: VideoFrameRequestCallback) {
          const callbackId = (runtime.__faceValueDecodedFrames ?? 0) + 1;
          const holdRecoverableRejection =
            sessionStorage.getItem(rejectionMarker) === 'true' &&
            !runtime.__faceValuePostRejectionHoldApplied;
          if (holdRecoverableRejection) {
            runtime.__faceValuePostRejectionHoldApplied = true;
          }
          window.setTimeout(
            () => {
              runtime.__faceValueDecodedFrames = callbackId;
              runtime.__faceValueDistinctGate = true;
              callback(window.performance.now(), {
                mediaTime: callbackId / 30,
                presentedFrames: callbackId,
              } as VideoFrameCallbackMetadata);
            },
            holdRecoverableRejection ? 1_800 : 800,
          );
          return callbackId;
        },
      },
      cancelVideoFrameCallback: {
        configurable: true,
        value: () => undefined,
      },
    });

    const pixelsFor = (luma: number) => {
      const pixels = new Uint8ClampedArray(40 * 52 * 4);
      for (let offset = 0; offset < pixels.length; offset += 4) {
        pixels[offset] = luma;
        pixels[offset + 1] = luma;
        pixels[offset + 2] = luma;
        pixels[offset + 3] = 255;
      }
      return pixels;
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: (type: string) =>
        type === '2d'
          ? {
              drawImage: () => undefined,
              getImageData: () => {
                if (runtime.__faceValueDistinctGate && runtime.__faceValueRejectNextDistinctGate) {
                  runtime.__faceValueRejectNextDistinctGate = false;
                  runtime.__faceValueCurrentLuma = 200;
                  sessionStorage.setItem(rejectionMarker, 'true');
                }
                runtime.__faceValueDistinctGate = false;
                return { data: pixelsFor(runtime.__faceValueCurrentLuma ?? 120) };
              },
            }
          : null,
    });
    let captureNumber = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback) => {
        captureNumber += 1;
        const binary = atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        );
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        callback(new Blob([bytes, Uint8Array.of(captureNumber)], { type: 'image/png' }));
      },
    });
  }, rejectFirstBurstGate);
}

async function mockProtectedProvider(
  page: Page,
  {
    scores,
    failTaskRequests = new Set<number>(),
  }: {
    scores: number[];
    failTaskRequests?: Set<number>;
  },
): Promise<{ readonly taskRequests: number; readonly successfulAnalyses: number }> {
  let uploadSlot = 0;
  let taskRequests = 0;
  let successfulAnalyses = 0;
  const taskScores = new Map<string, number>();

  await page.route('**/api/youcam/upload-slot', async (route) => {
    uploadSlot += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fileId: `preview-file-${uploadSlot}`,
        upload: {
          method: 'PUT',
          url: `/api/redness-burst-preview-upload/${uploadSlot}`,
          headers: { 'content-type': 'image/png' },
        },
      }),
    });
  });
  await page.route('**/api/redness-burst-preview-upload/**', async (route) => {
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/youcam/task**', async (route) => {
    if (route.request().method() === 'POST') {
      taskRequests += 1;
      if (failTaskRequests.has(taskRequests)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"malformed_provider_response":',
        });
        return;
      }
      const taskId = `preview-task-${taskRequests}`;
      const score = scores[successfulAnalyses];
      taskScores.set(taskId, score);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ taskId, pollingIntervalMs: 1 }),
      });
      return;
    }

    const taskId = new URL(route.request().url()).searchParams.get('taskId') ?? '';
    const rawScore = taskScores.get(taskId);
    if (!Number.isFinite(rawScore)) {
      await route.fulfill({ status: 500, body: '{}' });
      return;
    }
    successfulAnalyses += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        taskId,
        concern: 'hd_redness',
        rawScore,
      }),
    });
  });

  return {
    get taskRequests() {
      return taskRequests;
    },
    get successfulAnalyses() {
      return successfulAnalyses;
    },
  };
}
