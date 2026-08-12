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
  | 'burst-rejection'
  | 'permission-denied'
  | 'camera-unavailable';

interface CaptureStatusObservation {
  heading: string | null;
  secondary: string | null;
  measurement: string | null;
  tertiary: string | null;
  at: number;
}

type CaptureStatusWindow = Window & {
  __faceValueCaptureStatusObserver?: MutationObserver;
  __faceValueCaptureStatusHistory?: CaptureStatusObservation[];
  __faceValueZeroProgressSeen?: boolean;
};

async function expectBaselineReadyForGuidedCapture(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Baseline scan' })).toBeVisible();
  await expect(page.getByText('Camera access comes next.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Position your face' })).toHaveCount(0);
}

async function openCapture(
  page: Page,
  {
    scenario = 'success',
    slowQuality = false,
    nativeCamera = false,
    providerFailureFrame,
    providerTerminalFailureFrame,
    providerDelayMs,
    providerDelayFrame,
  }: {
    scenario?: FixtureScenario;
    slowQuality?: boolean;
    nativeCamera?: boolean;
    providerFailureFrame?: 2 | 3;
    providerTerminalFailureFrame?: 2 | 3;
    providerDelayMs?: number;
    providerDelayFrame?: 1 | 2 | 3;
  } = {},
): Promise<void> {
  const query = new URLSearchParams({
    'camera-scenario': scenario,
    ...(slowQuality ? { 'camera-quality-proof': '1' } : {}),
    ...(nativeCamera ? { 'native-camera-contract': '1' } : {}),
    ...(providerFailureFrame ? { 'provider-failure-frame': String(providerFailureFrame) } : {}),
    ...(providerTerminalFailureFrame
      ? { 'provider-terminal-failure-frame': String(providerTerminalFailureFrame) }
      : {}),
    ...(providerDelayMs ? { 'provider-delay-ms': String(providerDelayMs) } : {}),
    ...(providerDelayFrame ? { 'provider-delay-frame': String(providerDelayFrame) } : {}),
  });
  await page.goto('/favicon.svg');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: STORAGE_KEY,
    value: baselineReady,
  });
  await page.goto(`/?${query}`);
  await page.getByRole('button', { name: 'TAKE GUIDED BASELINE' }).click();
  await expectBaselineReadyForGuidedCapture(page);
}

async function observeCaptureStatuses(page: Page): Promise<void> {
  await page.evaluate(() => {
    const runtime = window as CaptureStatusWindow;
    runtime.__faceValueCaptureStatusObserver?.disconnect();
    runtime.__faceValueCaptureStatusHistory = [];
    runtime.__faceValueZeroProgressSeen = false;
    const record = () => {
      const sequence = document.querySelector('[data-capture-sequence]');
      if (!sequence) return;
      const heading =
        sequence.querySelector('[data-capture-instruction] h1')?.textContent?.trim() ?? null;
      const secondary =
        sequence.querySelector('[data-capture-instruction] p')?.textContent?.trim() ?? null;
      const measurement =
        sequence.querySelector('[data-analysis-measurement-label]')?.textContent?.trim() ?? null;
      const tertiary =
        sequence.querySelector('[data-analysis-tertiary-status]')?.textContent?.trim() ?? null;
      const accessibleProgress =
        sequence.querySelector('[data-measurement-indicator]')?.getAttribute('aria-label') ?? '';
      if (/0 of 3/i.test(`${sequence.textContent ?? ''} ${accessibleProgress}`)) {
        runtime.__faceValueZeroProgressSeen = true;
      }
      const previous = runtime.__faceValueCaptureStatusHistory?.at(-1);
      if (
        previous?.heading === heading &&
        previous.secondary === secondary &&
        previous.measurement === measurement &&
        previous.tertiary === tertiary
      ) {
        return;
      }
      runtime.__faceValueCaptureStatusHistory?.push({
        heading,
        secondary,
        measurement,
        tertiary,
        at: performance.now(),
      });
    };
    record();
    runtime.__faceValueCaptureStatusObserver = new MutationObserver(record);
    runtime.__faceValueCaptureStatusObserver.observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
  });
}

async function captureStatusHistory(page: Page): Promise<{
  observations: CaptureStatusObservation[];
  zeroProgressSeen: boolean;
}> {
  return page.evaluate(() => {
    const runtime = window as CaptureStatusWindow;
    runtime.__faceValueCaptureStatusObserver?.disconnect();
    return {
      observations: runtime.__faceValueCaptureStatusHistory ?? [],
      zeroProgressSeen: runtime.__faceValueZeroProgressSeen ?? false,
    };
  });
}

async function installNativeCameraMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const contractWindow = window as Window & {
      __faceValueAlertMessages?: string[];
      __faceValueTrackStops?: number;
      __faceValueDecodedFrameEvents?: number;
      __faceValueCapturedFrames?: number;
    };
    contractWindow.__faceValueAlertMessages = [];
    contractWindow.__faceValueTrackStops = 0;
    contractWindow.__faceValueDecodedFrameEvents = 0;
    contractWindow.__faceValueCapturedFrames = 0;
    window.alert = (message?: unknown) => {
      contractWindow.__faceValueAlertMessages?.push(String(message ?? ''));
    };

    const track = {
      stop: () => {
        contractWindow.__faceValueTrackStops = (contractWindow.__faceValueTrackStops ?? 0) + 1;
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
      requestVideoFrameCallback: {
        configurable: true,
        value(callback: VideoFrameRequestCallback) {
          const callbackId = (contractWindow.__faceValueDecodedFrameEvents ?? 0) + 1;
          window.setTimeout(() => {
            contractWindow.__faceValueDecodedFrameEvents = callbackId;
            callback(window.performance.now(), {
              mediaTime: callbackId / 30,
              presentedFrames: callbackId,
            } as VideoFrameCallbackMetadata);
          }, 0);
          return callbackId;
        },
      },
      cancelVideoFrameCallback: {
        configurable: true,
        value: () => undefined,
      },
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
        contractWindow.__faceValueCapturedFrames =
          (contractWindow.__faceValueCapturedFrames ?? 0) + 1;
        const binary = atob(
          'iVBOR