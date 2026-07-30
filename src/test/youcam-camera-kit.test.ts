import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMERA_KIT_SCRIPT_MARKER,
  CameraKitCaptureError,
  FixtureCameraKitAdapter,
  YouCamCameraKitAdapter,
  loadYouCamCameraKit,
  normalizeCameraKitCapture,
  normalizeCameraKitFailure,
  normalizeCameraKitQuality,
  resetCameraKitLoaderForTests,
  selectCameraKitCaptureProfile,
  type CameraKitDiagnostic,
  type CameraKitEventName,
  type CameraKitInitOptions,
  type CameraKitListenerIdentifier,
  type CameraKitWindow,
  type GuidedCaptureStartOptions,
  type YouCamCameraKitSdk,
  createSafariVideoBridge,
} from '../adapters/camera/youcam-camera-kit';

type Listener = (payload: unknown) => void;

class FakeCameraKitSdk implements YouCamCameraKitSdk {
  initCount = 0;
  openCount = 0;
  closeCount = 0;
  addCount = 0;
  removeCount = 0;
  options: CameraKitInitOptions | null = null;
  loaded = false;
  readonly removed = new Set<number>();
  readonly listeners = new Map<
    number,
    {
      eventName: CameraKitEventName;
      listener: Listener;
    }
  >();
  readonly historicalListeners: Array<{
    eventName: CameraKitEventName;
    listener: Listener;
  }> = [];

  init(options: CameraKitInitOptions): void {
    this.initCount += 1;
    this.options = options;
  }

  openCameraKit(): void {
    this.openCount += 1;
  }

  close(): void {
    this.closeCount += 1;
    this.loaded = false;
  }

  addEventListener(eventName: CameraKitEventName, listener: Listener): CameraKitListenerIdentifier {
    const id = ++this.addCount;
    this.listeners.set(id, { eventName, listener });
    this.historicalListeners.push({ eventName, listener });
    return id;
  }

  removeEventListener(identifier: CameraKitListenerIdentifier): void {
    const id = Number(identifier);
    this.removeCount += 1;
    this.removed.add(id);
    this.listeners.delete(id);
  }

  emit(eventName: CameraKitEventName, payload: unknown = {}): void {
    for (const entry of this.listeners.values()) {
      if (entry.eventName === eventName) entry.listener(payload);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

const validCapture = () => ({
  images: [
    {
      image: new Blob(['face-value'], { type: 'image/jpeg' }),
      width: 1920,
      height: 1080,
    },
  ],
});

const mountElement = (): HTMLDivElement => {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
};

const startOptions = (
  overrides: Partial<GuidedCaptureStartOptions> = {},
): GuidedCaptureStartOptions => ({
  mountElement: mountElement(),
  stableForMs: 800,
  onQuality: vi.fn(),
  onCapture: vi.fn(),
  onFailure: vi.fn(),
  onStatus: vi.fn(),
  ...overrides,
});

const appendSdkVideo = async (
  mount: HTMLElement,
  {
    live = false,
    play = vi.fn(() => Promise.resolve()),
    trackStop = vi.fn(),
  }: {
    live?: boolean;
    play?: ReturnType<typeof vi.fn>;
    trackStop?: ReturnType<typeof vi.fn>;
  } = {},
) => {
  const video = document.createElement('video');
  let readyState = live ? 2 : 0;
  let videoWidth = live ? 1920 : 0;
  let videoHeight = live ? 1080 : 0;
  Object.defineProperties(video, {
    readyState: {
      configurable: true,
      get: () => readyState,
    },
    videoWidth: {
      configurable: true,
      get: () => videoWidth,
    },
    videoHeight: {
      configurable: true,
      get: () => videoHeight,
    },
    play: {
      configurable: true,
      value: play,
    },
    srcObject: {
      configurable: true,
      writable: true,
      value: { getTracks: () => [{ stop: trackStop }] },
    },
    getBoundingClientRect: {
      configurable: true,
      value: () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          right: 320,
          bottom: 480,
          left: 0,
          width: 320,
          height: 480,
          toJSON: () => ({}),
        }) as DOMRect,
    },
  });
  mount.append(video);
  await Promise.resolve();
  return {
    video,
    play,
    trackStop,
    makeLive: () => {
      readyState = 2;
      videoWidth = 1920;
      videoHeight = 1080;
    },
  };
};

const makePreviewLive = async (sdk: FakeCameraKitSdk, options: GuidedCaptureStartOptions) => {
  const video = await appendSdkVideo(options.mountElement, { live: true });
  sdk.loaded = true;
  sdk.emit('cameraOpened');
  await vi.advanceTimersByTimeAsync(0);
  return video;
};

beforeEach(() => {
  vi.useFakeTimers();
  resetCameraKitLoaderForTests();
});

afterEach(() => {
  vi.useRealTimers();
  resetCameraKitLoaderForTests();
  delete (window as CameraKitWindow).YMK;
  delete (window as CameraKitWindow).YMKAsyncInit;
  document.body.innerHTML = '';
});

describe('Camera Kit loader and normalization', () => {
  it('injects and resolves the official external SDK exactly once', async () => {
    const sdk = new FakeCameraKitSdk();
    const documentObject = document.implementation.createHTMLDocument('camera-kit-test');
    const windowObject = window as CameraKitWindow;

    const first = loadYouCamCameraKit({
      windowObject,
      documentObject,
    });
    const second = loadYouCamCameraKit({
      windowObject,
      documentObject,
    });

    expect(first).toBe(second);
    expect(documentObject.querySelectorAll(`script[${CAMERA_KIT_SCRIPT_MARKER}]`)).toHaveLength(1);
    windowObject.YMK = sdk;
    windowObject.YMKAsyncInit?.();
    await expect(first).resolves.toBe(sdk);
    await expect(second).resolves.toBe(sdk);
  });

  it('normalizes provider quality into vendor-independent Face Value signals', () => {
    expect(normalizeCameraKitQuality({}, true)).toMatchObject({
      ready: false,
      quality: {
        facePresent: false,
      },
    });
    expect(
      normalizeCameraKitQuality(
        {
          hasFace: true,
          position: 'too_small',
          frontal: 'good',
          lighting: 'good',
        },
        true,
      ),
    ).toMatchObject({
      ready: false,
      distanceIssue: 'too-far',
      quality: { facePresent: true, distanceValid: false },
    });
    expect(
      normalizeCameraKitQuality(
        {
          hasFace: true,
          position: 'outofboundary',
          frontal: 'good',
          lighting: 'good',
        },
        true,
      ),
    ).toMatchObject({
      ready: false,
      distanceIssue: null,
      alignmentIssue: null,
      quality: {
        distanceValid: true,
        alignmentValid: false,
      },
    });
    expect(
      normalizeCameraKitQuality(
        {
          hasFace: true,
          position: 'good',
          frontal: 'not_good',
          lighting: 'good',
        },
        true,
      ),
    ).toMatchObject({
      ready: false,
      angleIssue: 'face-camera',
      quality: { angleValid: false },
    });
    expect(
      normalizeCameraKitQuality(
        {
          hasFace: true,
          position: 'good',
          frontal: 'good',
          lighting: 'not_good',
        },
        true,
      ),
    ).toMatchObject({
      ready: false,
      lightingIssue: 'uneven-light',
      quality: { lightingValid: false },
    });
    expect(
      normalizeCameraKitQuality(
        {
          hasFace: true,
          position: 'good',
          frontal: 'good',
          lighting: 'good',
        },
        true,
      ),
    ).toMatchObject({
      ready: true,
      quality: {
        facePresent: true,
        distanceValid: true,
        alignmentValid: true,
        angleValid: true,
        lightingValid: true,
        stillnessValid: true,
      },
    });
  });

  it('accepts only a bounded standard Blob and rejects string or low-resolution output', () => {
    const blob = normalizeCameraKitCapture(validCapture());
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
    expect(() =>
      normalizeCameraKitCapture({
        images: [
          {
            image: 'base64-provider-value',
            width: 1920,
            height: 1080,
          },
        ],
      }),
    ).toThrow(CameraKitCaptureError);
    expect(() =>
      normalizeCameraKitCapture({
        images: [
          {
            image: new Blob(['face'], { type: 'image/jpeg' }),
            width: 640,
            height: 960,
          },
        ],
      }),
    ).toThrow(/analysis-compatible resolution/);
  });

  it('maps calm fallback categories without exposing provider fields', () => {
    expect(normalizeCameraKitFailure({ errorCode: 'NotAllowedError' })).toBe('permission-denied');
    expect(normalizeCameraKitFailure('unsupported_resolution')).toBe('unsupported-resolution');
    expect(normalizeCameraKitFailure('unsupported_browser')).toBe('unsupported-browser');
    expect(normalizeCameraKitFailure('vendor_unknown')).toBe('camera-unavailable');
  });
});

describe('Camera Kit capture profile', () => {
  it('uses documented standard skincare on iPhone without the HD resolution alert path', async () => {
    const profile = selectCameraKitCaptureProfile({
      navigatorObject: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1',
        vendor: 'Apple Computer, Inc.',
      },
      highResolutionProven: true,
    });
    expect(profile).toMatchObject({
      faceDetectionMode: 'skincare',
      videoQuality: '720p',
      imageFormat: 'blob',
      qualityLevel: 'moderate',
      countingDuration: 2_400,
      hideFlipCameraButton: true,
      disableCameraResolutionCheck: false,
    });

    const sdk = new FakeCameraKitSdk();
    const adapter = new YouCamCameraKitAdapter(async () => sdk, {
      navigatorObject: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1',
        vendor: 'Apple Computer, Inc.',
      },
      highResolutionProven: true,
    });
    const session = await adapter.start(startOptions());
    expect(session.captureProfileId).toBe('youcam-camera-kit-standard-720p');
    expect(sdk.options).toMatchObject({
      faceDetectionMode: profile.faceDetectionMode,
      videoQuality: profile.videoQuality,
      imageFormat: profile.imageFormat,
      qualityLevel: profile.qualityLevel,
      countingDuration: 800,
      hideFlipCameraButton: profile.hideFlipCameraButton,
      disableCameraResolutionCheck: profile.disableCameraResolutionCheck,
    });
    expect(sdk.options).not.toHaveProperty('qualityOverrides');
    expect(sdk.options).not.toHaveProperty('moduleMode');
    session.cancel();
  });

  it('does not re-enter hdskincare when a legacy profile is frozen', () => {
    expect(
      selectCameraKitCaptureProfile({
        navigatorObject: {
          userAgent: 'Mozilla/5.0 Chrome/128',
          vendor: 'Google Inc.',
        },
        highResolutionProven: true,
      }).videoQuality,
    ).toBe('720p');
    expect(
      selectCameraKitCaptureProfile({
        frozenCaptureProfileId: 'youcam-camera-kit-hd-1080p',
        navigatorObject: {
          userAgent: 'Mozilla/5.0 Chrome/128',
          vendor: 'Google Inc.',
        },
        highResolutionProven: true,
      }).videoQuality,
    ).toBe('720p');
  });
});

describe('Camera Kit preview and Safari bridge', () => {
  it('attaches listeners once but does not equate cameraOpened with a live preview', async () => {
    const sdk = new FakeCameraKitSdk();
    const options = startOptions();
    const adapter = new YouCamCameraKitAdapter(async () => sdk);
    const session = await adapter.start(options);

    expect(sdk.initCount).toBe(1);
    expect(sdk.openCount).toBe(1);
    expect(sdk.addCount).toBe(6);
    expect(sdk.options).toMatchObject({
      faceDetectionMode: 'skincare',
      imageFormat: 'blob',
      qualityLevel: 'moderate',
      videoQuality: '720p',
      countingDuration: 800,
      hideFlipCameraButton: true,
      disableCameraResolutionCheck: false,
    });
    expect(sdk.options).not.toHaveProperty('moduleMode');

    sdk.emit('cameraOpened');
    sdk.emit('faceQualityChanged', {
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(options.onStatus).toHaveBeenCalledWith('camera-opening');
    expect(options.onStatus).not.toHaveBeenCalledWith('preview-live');
    expect(options.onQuality).not.toHaveBeenCalled();

    const video = await appendSdkVideo(options.mountElement);
    sdk.loaded = true;
    await vi.advanceTimersByTimeAsync(50);
    expect(options.onStatus).not.toHaveBeenCalledWith('preview-live');
    video.makeLive();
    await vi.advanceTimersByTimeAsync(50);
    expect(video.video.isConnected).toBe(true);
    expect(options.onStatus).toHaveBeenCalledWith('preview-live');
    expect(options.onQuality).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ready: true,
        quality: expect.objectContaining({
          facePresent: true,
          stillnessValid: true,
        }),
      }),
    );

    session.cancel();
    expect(sdk.closeCount).toBe(1);
    expect(sdk.removeCount).toBe(6);
  });

  it('requires a connected, visible, non-zero renderer and supports the documented iframe surface', () => {
    const mount = mountElement();
    const bridge = createSafariVideoBridge(mount);
    expect(bridge.hasLiveRenderSurface(true)).toBe(false);

    const zeroCanvas = document.createElement('canvas');
    mount.append(zeroCanvas);
    expect(bridge.hasLiveRenderSurface(true)).toBe(false);

    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 320, height: 480 }) as DOMRect,
    });
    mount.append(iframe);
    expect(bridge.getRenderSurface()).toMatchObject({
      type: 'iframe',
      width: 320,
      height: 480,
    });
    expect(bridge.hasLiveRenderSurface(false)).toBe(false);
    expect(bridge.hasLiveRenderSurface(true)).toBe(true);
  });

  it('waits 20 seconds before turning a black preview into one recoverable stalled state', async () => {
    const sdk = new FakeCameraKitSdk();
    const diagnostics: CameraKitDiagnostic[] = [];
    const options = startOptions({
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      previewWatchdogMs: 20_000,
    });
    await new YouCamCameraKitAdapter(async () => sdk).start(options);
    const { trackStop } = await appendSdkVideo(options.mountElement);

    sdk.emit('cameraOpened');
    await vi.advanceTimersByTimeAsync(19_999);
    expect(options.onFailure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(options.onFailure).toHaveBeenCalledOnce();
    expect(options.onFailure).toHaveBeenCalledWith('preview-stalled');
    expect(options.onStatus).toHaveBeenCalledWith('preview-stalled');
    expect(sdk.closeCount).toBe(1);
    expect(sdk.removeCount).toBe(6);
    expect(trackStop).not.toHaveBeenCalled();
    expect(diagnostics.map(({ stage }) => stage)).toEqual(
      expect.arrayContaining(['sdk-loaded', 'camera-opened', 'preview-stalled', 'camera-closed']),
    );
    expect(Object.keys(diagnostics[0]).sort()).toEqual(['captureProfileId', 'stage']);
  });
});

describe('Camera Kit auto-capture gate and teardown', () => {
  it('rejects capture before preview-live, then accepts one stable Blob exactly once', async () => {
    const sdk = new FakeCameraKitSdk();
    const onCapture = vi.fn();
    const onQuality = vi.fn();
    const options = startOptions({ onCapture, onQuality });
    await new YouCamCameraKitAdapter(async () => sdk).start(options);

    sdk.emit('faceQualityChanged', {
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
    sdk.emit('faceDetectionCaptured', validCapture());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onCapture).not.toHaveBeenCalled();

    await makePreviewLive(sdk, options);
    expect(onQuality).toHaveBeenLastCalledWith(expect.objectContaining({ ready: true }));
    sdk.emit('faceDetectionCaptured', validCapture());
    await vi.advanceTimersByTimeAsync(799);
    expect(onCapture).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onCapture).toHaveBeenCalledOnce();
    expect(onCapture.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(onCapture.mock.calls[0][1]).toBe('youcam-camera-kit-standard-720p');

    sdk.emit('faceDetectionCaptured', validCapture());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onCapture).toHaveBeenCalledOnce();
    expect(sdk.removeCount).toBe(6);
    expect(sdk.closeCount).toBe(1);
  });

  it('fails recoverably when stable quality never produces a capture event', async () => {
    const sdk = new FakeCameraKitSdk();
    const onFailure = vi.fn();
    const options = startOptions({ onFailure });
    await new YouCamCameraKitAdapter(async () => sdk).start(options);
    sdk.emit('faceQualityChanged', {
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
    await makePreviewLive(sdk, options);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(onFailure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onFailure).toHaveBeenCalledWith('invalid-capture');
    expect(sdk.closeCount).toBe(1);
  });

  it('cleans up on cancel and ignores every event from an old session', async () => {
    const sdk = new FakeCameraKitSdk();
    const firstCapture = vi.fn();
    const secondCapture = vi.fn();
    const adapter = new YouCamCameraKitAdapter(async () => sdk);
    const firstOptions = startOptions({ onCapture: firstCapture });
    await adapter.start(firstOptions);
    const staleQuality = sdk.historicalListeners.find(
      (entry) => entry.eventName === 'faceQualityChanged',
    )?.listener;
    const staleCapture = sdk.historicalListeners.find(
      (entry) => entry.eventName === 'faceDetectionCaptured',
    )?.listener;

    const secondOptions = startOptions({ onCapture: secondCapture });
    const secondSession = await adapter.start(secondOptions);
    staleQuality?.({
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
    staleCapture?.(validCapture());
    await vi.advanceTimersByTimeAsync(1_000);
    expect(firstCapture).not.toHaveBeenCalled();

    await makePreviewLive(sdk, secondOptions);
    sdk.emit('faceQualityChanged', {
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    });
    sdk.emit('faceDetectionCaptured', validCapture());
    secondSession.cancel();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(secondCapture).not.toHaveBeenCalled();
    expect(sdk.closeCount).toBe(1);
    expect(sdk.listeners.size).toBe(0);
  });

  it('falls back once and closes only cameras that reached the opened state', async () => {
    const sdk = new FakeCameraKitSdk();
    const permissionFailure = vi.fn();
    const adapter = new YouCamCameraKitAdapter(async () => sdk);
    await adapter.start(startOptions({ onFailure: permissionFailure }));
    sdk.emit('cameraFailed', { code: 'permission_denied' });
    expect(permissionFailure).toHaveBeenCalledOnce();
    expect(permissionFailure).toHaveBeenCalledWith('permission-denied');
    expect(sdk.closeCount).toBe(0);
    expect(sdk.removeCount).toBe(6);

    const resolutionSdk = new FakeCameraKitSdk();
    const resolutionFailure = vi.fn();
    await new YouCamCameraKitAdapter(async () => resolutionSdk).start(
      startOptions({ onFailure: resolutionFailure }),
    );
    resolutionSdk.emit('cameraOpened');
    resolutionSdk.emit('unsupportedResolution');
    expect(resolutionFailure).toHaveBeenCalledWith('unsupported-resolution');
    expect(resolutionSdk.closeCount).toBe(1);

    const unavailable = vi.fn();
    await expect(
      new YouCamCameraKitAdapter(async () => {
        throw new Error('network');
      }).start(startOptions({ onFailure: unavailable })),
    ).rejects.toThrow('network');
    expect(unavailable).toHaveBeenCalledWith('sdk-unavailable');
  });

  it('does not intercept unrelated browser alerts or global errors', async () => {
    const sdk = new FakeCameraKitSdk();
    const session = await new YouCamCameraKitAdapter(async () => sdk).start(startOptions());
    const originalAlert = window.alert;
    const alertSpy = vi.fn();
    window.alert = alertSpy;
    window.alert('unrelated application alert');
    expect(alertSpy).toHaveBeenCalledWith('unrelated application alert');
    expect(window.alert).toBe(alertSpy);
    window.alert = originalAlert;
    session.cancel();
  });
});

describe('deterministic fixture adapter', () => {
  it('auto-captures once, clears timers, and closes its fixture surface', async () => {
    const adapter = new FixtureCameraKitAdapter();
    const options = startOptions({
      stableForMs: 40,
      onCapture: vi.fn(),
    });
    await adapter.start(options);
    await vi.advanceTimersByTimeAsync(500);

    expect(options.onCapture).toHaveBeenCalledOnce();
    expect(adapter.captureCount).toBe(1);
    expect(options.mountElement.dataset.cameraKitFixture).toBeUndefined();
    await vi.advanceTimersByTimeAsync(500);
    expect(options.onCapture).toHaveBeenCalledOnce();
  });

  it('creates a fresh session after the first preview stalls', async () => {
    const adapter = new FixtureCameraKitAdapter({
      stallFirstSession: true,
    });
    const first = startOptions();
    await adapter.start(first);
    await vi.advanceTimersByTimeAsync(100);
    expect(first.onFailure).toHaveBeenCalledWith('preview-stalled');

    const second = startOptions({ stableForMs: 40 });
    await adapter.start(second);
    await vi.advanceTimersByTimeAsync(500);
    expect(adapter.sessionStartCount).toBe(2);
    expect(second.onCapture).toHaveBeenCalledOnce();
  });
});
