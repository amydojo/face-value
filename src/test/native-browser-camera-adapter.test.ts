import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NativeBrowserCameraAdapter,
  assessNativeFramePixels,
  isVisibleVideoFrame,
  waitForDistinctVideoFrame,
  waitForVisibleVideoFrame,
  type GuidedCaptureStartOptions,
  type NativeCameraEnvironment,
  type NativeFrameAssessment,
} from '../adapters/camera/youcam-camera-kit';

const makeTrack = () => {
  const listeners = new Map<string, EventListener>();
  return {
    stop: vi.fn(),
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.set(name, listener);
    }),
    removeEventListener: vi.fn((name: string) => {
      listeners.delete(name);
    }),
    end: () => listeners.get('ended')?.(new Event('ended')),
  };
};

const makeStream = (track = makeTrack()) =>
  ({
    getTracks: () => [track],
    getVideoTracks: () => [track],
  }) as unknown as MediaStream;

const makeVideo = ({ live = true, sized = true }: { live?: boolean; sized?: boolean } = {}) => {
  const video = document.createElement('video');
  let readyState = live ? 2 : 0;
  let videoWidth = live ? 1280 : 0;
  let videoHeight = live ? 720 : 0;
  Object.defineProperties(video, {
    readyState: { configurable: true, get: () => readyState },
    videoWidth: { configurable: true, get: () => videoWidth },
    videoHeight: { configurable: true, get: () => videoHeight },
    play: { configurable: true, value: vi.fn(() => Promise.resolve()) },
    pause: { configurable: true, value: vi.fn() },
    srcObject: { configurable: true, writable: true, value: null },
    getBoundingClientRect: {
      configurable: true,
      value: () =>
        ({
          width: sized ? 320 : 0,
          height: sized ? 480 : 0,
          top: 0,
          left: 0,
          right: sized ? 320 : 0,
          bottom: sized ? 480 : 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    },
  });
  return {
    video,
    makeLive: () => {
      readyState = 2;
      videoWidth = 1280;
      videoHeight = 720;
      video.dispatchEvent(new Event('loadeddata'));
    },
  };
};

const steadyAssessment = (): NativeFrameAssessment => ({
  lightingValid: true,
  lightingIssue: null,
  stillnessValid: true,
  luma: new Uint8Array([128]),
});

const makeEnvironment = ({
  streams = [makeStream()],
  capture = new Blob(['abstract-frame'], { type: 'image/jpeg' }),
  firstFrameTimeoutMs = 100,
}: {
  streams?: MediaStream[];
  capture?: Blob;
  firstFrameTimeoutMs?: number;
} = {}) => {
  let requestIndex = 0;
  const requestCamera = vi.fn(async () => ({
    ok: true as const,
    stream: streams[Math.min(requestIndex++, streams.length - 1)],
  }));
  const captureFrame = vi.fn(async () => capture);
  const frameReset = vi.fn();
  const createFrameReader = vi.fn(() =>
    Object.assign(() => steadyAssessment(), { reset: frameReset }),
  );
  let frameNumber = 0;
  const waitForDistinctFrame = vi.fn(async () => {
    frameNumber += 1;
    return {
      mediaTime: frameNumber / 30,
      presentedFrames: frameNumber,
      currentTime: frameNumber / 30,
    };
  });
  const now = vi.fn(() => `2026-07-30T12:00:00.${String(frameNumber).padStart(3, '0')}Z`);
  const environment: NativeCameraEnvironment = {
    requestCamera,
    captureFrame,
    createFrameReader,
    waitForDistinctFrame,
    now,
    firstFrameTimeoutMs,
    sampleIntervalMs: 25,
  };
  return { environment, requestCamera, captureFrame, frameReset };
};

const optionsFor = (
  video: HTMLVideoElement,
  overrides: Partial<GuidedCaptureStartOptions> = {},
): GuidedCaptureStartOptions => {
  const mountElement = document.createElement('div');
  mountElement.append(video);
  document.body.append(mountElement);
  return {
    mountElement,
    previewElement: video,
    onQuality: vi.fn(),
    onCapture: vi.fn(),
    onFailure: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('native frame quality', () => {
  it('classifies whole-frame light and motion without retaining source pixels', () => {
    const dark = new Uint8ClampedArray([10, 10, 10, 255, 20, 20, 20, 255]);
    const darkResult = assessNativeFramePixels(dark, null);
    expect(darkResult).toMatchObject({
      lightingValid: false,
      lightingIssue: 'low-light',
      stillnessValid: false,
    });

    const neutral = new Uint8ClampedArray([120, 120, 120, 255, 130, 130, 130, 255]);
    const first = assessNativeFramePixels(neutral, null);
    const second = assessNativeFramePixels(neutral, first.luma);
    expect(second).toMatchObject({
      lightingValid: true,
      lightingIssue: null,
      stillnessValid: true,
    });
    expect(second.luma).not.toBe(first.luma);
  });
});

describe('native preview readiness', () => {
  it('rejects absent, detached, zero-size, and frameless surfaces', () => {
    expect(isVisibleVideoFrame(null)).toBe(false);
    const detached = makeVideo().video;
    expect(isVisibleVideoFrame(detached)).toBe(false);

    const zero = makeVideo({ sized: false }).video;
    document.body.append(zero);
    expect(isVisibleVideoFrame(zero)).toBe(false);

    const waiting = makeVideo({ live: false }).video;
    document.body.append(waiting);
    expect(isVisibleVideoFrame(waiting)).toBe(false);
  });

  it('accepts only a connected, visible video with a current frame', () => {
    const { video } = makeVideo();
    document.body.append(video);
    expect(isVisibleVideoFrame(video)).toBe(true);
    video.style.opacity = '0';
    expect(isVisibleVideoFrame(video)).toBe(false);
  });

  it('times out explicitly instead of treating no render surface as live', async () => {
    const { video } = makeVideo({ live: false });
    document.body.append(video);
    const waiting = waitForVisibleVideoFrame(video, { timeoutMs: 100 });
    const rejected = expect(waiting).rejects.toThrow('did not produce a frame');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });
});

describe('native camera session lifecycle', () => {
  it('publishes a live frame, captures exactly once, and closes tracks exactly once', async () => {
    const track = makeTrack();
    const { environment, captureFrame, frameReset } = makeEnvironment({
      streams: [makeStream(track)],
    });
    const adapter = new NativeBrowserCameraAdapter(environment);
    const { video } = makeVideo();
    const options = optionsFor(video);
    const session = await adapter.start(options);

    expect(options.onStatus).toHaveBeenCalledWith('requesting-permission');
    expect(options.onStatus).toHaveBeenCalledWith('waiting-first-frame');
    expect(options.onStatus).toHaveBeenCalledWith('preview-live');
    expect(options.onQuality).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationMode: 'frame-quality',
        frameReady: true,
        ready: true,
      }),
    );

    session.capture?.();
    session.capture?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(captureFrame).toHaveBeenCalledOnce();
    expect(options.onCapture).toHaveBeenCalledOnce();
    expect(options.onCapture).toHaveBeenCalledWith(
      expect.any(Blob),
      'native-browser-camera-v1',
      expect.objectContaining({
        capturedAt: '2026-07-30T12:00:00.000Z',
        frameId: 'native-1-1-1',
      }),
    );
    expect(track.stop).toHaveBeenCalledOnce();
    expect(frameReset).toHaveBeenCalledOnce();
    session.cancel();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('captures exactly three independently proven decoded frames in one live session', async () => {
    const track = makeTrack();
    let captureNumber = 0;
    const { environment, frameReset } = makeEnvironment({
      streams: [makeStream(track)],
    });
    environment.captureFrame = vi.fn(async () => {
      captureNumber += 1;
      return new Blob([`abstract-frame-${captureNumber}`], { type: 'image/jpeg' });
    });
    const onCapture = vi.fn();
    const options = optionsFor(makeVideo().video, {
      burstGenerationId: 'burst-current-frames',
      onCapture,
      onRejectedAttempt: vi.fn(),
      onBurstComplete: vi.fn(),
    });
    const session = await new NativeBrowserCameraAdapter(environment).start(options);

    session.capture?.();

    await vi.waitFor(() => expect(environment.captureFrame).toHaveBeenCalledTimes(3));
    expect(environment.waitForDistinctFrame).toHaveBeenCalledTimes(3);
    expect(onCapture).toHaveBeenCalledTimes(3);
    const frameIds = onCapture.mock.calls.map((call) => call[2]?.frameId);
    expect(frameIds).toEqual(['native-1-1-1', 'native-1-2-2', 'native-1-3-3']);
    expect(new Set(frameIds).size).toBe(3);
    expect(options.onBurstComplete).toHaveBeenCalledWith({
      attemptedFrameCount: 3,
      acceptedFrameCount: 3,
    });
    expect(options.onRejectedAttempt).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(frameReset).toHaveBeenCalledOnce();
  });

  it('enforces five capture attempts and reapplies quality gates before every frame', async () => {
    const track = makeTrack();
    const { environment } = makeEnvironment({
      streams: [makeStream(track)],
    });
    const rejectedAssessment: NativeFrameAssessment = {
      ...steadyAssessment(),
      stillnessValid: false,
    };
    const attemptAssessments = [
      rejectedAssessment,
      rejectedAssessment,
      rejectedAssessment,
      steadyAssessment(),
      steadyAssessment(),
    ];
    let assessmentCall = 0;
    environment.createFrameReader = vi.fn(() => {
      const read = Object.assign(
        () => {
          assessmentCall += 1;
          return assessmentCall === 1
            ? steadyAssessment()
            : (attemptAssessments[assessmentCall - 2] ?? steadyAssessment());
        },
        { reset: vi.fn() },
      );
      return read;
    });
    const options = optionsFor(makeVideo().video, {
      burstGenerationId: 'burst-attempt-bound',
      onRejectedAttempt: vi.fn(),
      onBurstComplete: vi.fn(),
    });
    const session = await new NativeBrowserCameraAdapter(environment).start(options);

    session.capture?.();

    await vi.waitFor(() => expect(options.onFailure).toHaveBeenCalledWith('burst-exhausted'));
    expect(environment.waitForDistinctFrame).toHaveBeenCalledTimes(5);
    expect(environment.captureFrame).toHaveBeenCalledTimes(2);
    expect(options.onRejectedAttempt).toHaveBeenCalledTimes(3);
    expect(options.onBurstComplete).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('cancels a stale session before opening a fresh retry', async () => {
    const firstTrack = makeTrack();
    const secondTrack = makeTrack();
    const { environment, requestCamera } = makeEnvironment({
      streams: [makeStream(firstTrack), makeStream(secondTrack)],
    });
    const adapter = new NativeBrowserCameraAdapter(environment);
    const firstVideo = makeVideo().video;
    const secondVideo = makeVideo().video;
    const first = optionsFor(firstVideo);
    const second = optionsFor(secondVideo);

    await adapter.start(first);
    const retry = await adapter.start(second);
    expect(requestCamera).toHaveBeenCalledTimes(2);
    expect(firstTrack.stop).toHaveBeenCalledOnce();
    expect(secondTrack.stop).not.toHaveBeenCalled();
    expect(first.onCapture).not.toHaveBeenCalled();
    retry.cancel();
    expect(secondTrack.stop).toHaveBeenCalledOnce();
  });

  it('reports preview-stalled only after the first-frame timeout and tears down once', async () => {
    const track = makeTrack();
    const { environment } = makeEnvironment({
      streams: [makeStream(track)],
      firstFrameTimeoutMs: 100,
    });
    const { video } = makeVideo({ live: false });
    const options = optionsFor(video);
    const start = new NativeBrowserCameraAdapter(environment).start(options);
    await vi.advanceTimersByTimeAsync(99);
    expect(options.onFailure).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await start;
    expect(options.onFailure).toHaveBeenCalledOnce();
    expect(options.onFailure).toHaveBeenCalledWith('preview-stalled');
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('aborts a pending first-frame wait without surfacing a false failure', async () => {
    const track = makeTrack();
    const controller = new AbortController();
    const { environment } = makeEnvironment({
      streams: [makeStream(track)],
      firstFrameTimeoutMs: 20_000,
    });
    const { video } = makeVideo({ live: false });
    const options = optionsFor(video, { signal: controller.signal });
    const start = new NativeBrowserCameraAdapter(environment).start(options);
    await Promise.resolve();
    controller.abort();
    await start;
    expect(options.onFailure).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });
});

describe('decoded-frame currentness', () => {
  it('ignores a repeated callback boundary until a newer decoded frame is presented', async () => {
    const { video } = makeVideo();
    document.body.append(video);
    const callbacks: VideoFrameRequestCallback[] = [];
    Object.defineProperties(video, {
      currentTime: { configurable: true, get: () => 1 },
      requestVideoFrameCallback: {
        configurable: true,
        value: vi.fn((callback: VideoFrameRequestCallback) => {
          callbacks.push(callback);
          return callbacks.length;
        }),
      },
      cancelVideoFrameCallback: {
        configurable: true,
        value: vi.fn(),
      },
    });
    const pending = waitForDistinctVideoFrame(
      video,
      { mediaTime: 1, presentedFrames: 7, currentTime: 1 },
      { timeoutMs: 1_000 },
    );

    callbacks.shift()?.(0, { mediaTime: 1, presentedFrames: 7 } as VideoFrameCallbackMetadata);
    expect(callbacks).toHaveLength(1);
    callbacks.shift()?.(1, { mediaTime: 1, presentedFrames: 8 } as VideoFrameCallbackMetadata);

    await expect(pending).resolves.toEqual({
      mediaTime: 1,
      presentedFrames: 8,
      currentTime: 1,
    });
  });
});
