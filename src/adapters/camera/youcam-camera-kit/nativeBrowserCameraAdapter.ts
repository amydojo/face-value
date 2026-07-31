import {
  attachStream,
  captureFrame,
  releaseStream,
  requestCamera,
  type CameraFailureReason,
  type CameraRequestResult,
} from '../browserCamera';
import {
  REDNESS_BURST_MAX_CAPTURE_ATTEMPTS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../../domain/rednessEvidenceBurst';
import type {
  CameraKitAdapter,
  GuidedCaptureFailure,
  GuidedCaptureQuality,
  GuidedCaptureSession,
  GuidedCaptureStartOptions,
} from './types';

const NATIVE_CAPTURE_PROFILE = 'native-browser-camera-v1' as const;
const FIRST_FRAME_TIMEOUT_MS = 20_000;
const CURRENT_FRAME_TIMEOUT_MS = 2_500;
const FRAME_SAMPLE_INTERVAL_MS = 160;
const SAMPLE_WIDTH = 40;
const SAMPLE_HEIGHT = 52;
const LOW_LIGHT_LUMA = 42;
const HIGH_LIGHT_LUMA = 235;
const STILL_FRAME_DIFFERENCE = 16;

export interface NativeFrameAssessment {
  lightingValid: boolean;
  lightingIssue: GuidedCaptureQuality['lightingIssue'];
  stillnessValid: boolean;
  luma: Uint8Array;
}

/**
 * Measures only whole-frame exposure and frame-to-frame movement. It does not
 * infer a face, skin condition, or biometric signal. Pixels are reduced to a
 * tiny luma buffer and replaced on the next sample; they are never persisted.
 */
export function assessNativeFramePixels(
  pixels: Uint8ClampedArray,
  previousLuma: Uint8Array | null,
): NativeFrameAssessment {
  const pixelCount = Math.floor(pixels.length / 4);
  const luma = new Uint8Array(pixelCount);
  let total = 0;
  let difference = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const value = Math.round(
      pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722,
    );
    luma[pixel] = value;
    total += value;
    if (previousLuma?.length === pixelCount) {
      difference += Math.abs(value - previousLuma[pixel]);
    }
  }

  const meanLuma = pixelCount > 0 ? total / pixelCount : 0;
  const meanDifference =
    previousLuma?.length === pixelCount && pixelCount > 0
      ? difference / pixelCount
      : Number.POSITIVE_INFINITY;
  const lightingIssue =
    meanLuma < LOW_LIGHT_LUMA ? 'low-light' : meanLuma > HIGH_LIGHT_LUMA ? 'backlight' : null;

  return {
    lightingValid: lightingIssue === null,
    lightingIssue,
    stillnessValid: meanDifference <= STILL_FRAME_DIFFERENCE,
    luma,
  };
}

export function isVisibleVideoFrame(
  video: HTMLVideoElement | null | undefined,
  styleFor: (element: Element) => CSSStyleDeclaration = (element) => getComputedStyle(element),
): boolean {
  if (!video?.isConnected || video.readyState < 2) return false;
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return false;
  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = styleFor(video);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    (style.opacity === '' || Number(style.opacity) > 0)
  );
}

export function waitForVisibleVideoFrame(
  video: HTMLVideoElement,
  {
    timeoutMs = FIRST_FRAME_TIMEOUT_MS,
    hostWindow = video.ownerDocument.defaultView ?? window,
    styleFor,
    signal,
  }: {
    timeoutMs?: number;
    hostWindow?: Window;
    styleFor?: (element: Element) => CSSStyleDeclaration;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  if (isVisibleVideoFrame(video, styleFor)) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    let pollId = 0;
    let frameCallbackId: number | null = null;

    const cleanup = () => {
      hostWindow.clearTimeout(timeoutId);
      hostWindow.clearInterval(pollId);
      video.removeEventListener('loadedmetadata', check);
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('playing', check);
      video.removeEventListener('resize', check);
      video.removeEventListener('error', fail);
      signal?.removeEventListener('abort', abort);
      if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(frameCallbackId);
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    function check() {
      if (isVisibleVideoFrame(video, styleFor)) finish();
    }

    function fail() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Visible camera preview did not produce a frame.'));
    }

    function abort() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    }

    video.addEventListener('loadedmetadata', check);
    video.addEventListener('loadeddata', check);
    video.addEventListener('canplay', check);
    video.addEventListener('playing', check);
    video.addEventListener('resize', check);
    video.addEventListener('error', fail, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    pollId = hostWindow.setInterval(check, 50);
    timeoutId = hostWindow.setTimeout(fail, timeoutMs);
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameCallbackId = video.requestVideoFrameCallback(check);
    }
  });
}

export interface DecodedVideoFrameProof {
  mediaTime: number;
  presentedFrames: number | null;
  currentTime: number;
}

const frameProofAdvanced = (
  current: DecodedVideoFrameProof,
  previous: DecodedVideoFrameProof | null,
): boolean => {
  if (!previous) return true;
  if (
    current.presentedFrames !== null &&
    previous.presentedFrames !== null &&
    current.presentedFrames > previous.presentedFrames
  ) {
    return true;
  }
  return current.mediaTime > previous.mediaTime || current.currentTime > previous.currentTime;
};

/**
 * Resolves only after the video element presents a decoded frame that is newer
 * than the prior accepted boundary. The timeout is a failure bound, never
 * evidence that a frame is current.
 */
export function waitForDistinctVideoFrame(
  video: HTMLVideoElement,
  previous: DecodedVideoFrameProof | null,
  {
    timeoutMs = CURRENT_FRAME_TIMEOUT_MS,
    hostWindow = video.ownerDocument.defaultView ?? window,
    signal,
  }: {
    timeoutMs?: number;
    hostWindow?: Window;
    signal?: AbortSignal;
  } = {},
): Promise<DecodedVideoFrameProof> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

  return new Promise<DecodedVideoFrameProof>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    let animationFrameId = 0;
    let videoFrameId: number | null = null;
    const fallbackStartTime = previous?.currentTime ?? video.currentTime;

    const cleanup = () => {
      hostWindow.clearTimeout(timeoutId);
      if (animationFrameId) hostWindow.cancelAnimationFrame(animationFrameId);
      if (videoFrameId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(videoFrameId);
      }
      signal?.removeEventListener('abort', abort);
    };

    const finish = (proof: DecodedVideoFrameProof) => {
      if (settled || !frameProofAdvanced(proof, previous)) return false;
      settled = true;
      cleanup();
      resolve(proof);
      return true;
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('A distinct decoded video frame was not presented.'));
    };

    function abort() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    }

    if (typeof video.requestVideoFrameCallback === 'function') {
      const requestNext = () => {
        videoFrameId = video.requestVideoFrameCallback((_now, metadata) => {
          const proof: DecodedVideoFrameProof = {
            mediaTime: Number(metadata.mediaTime),
            presentedFrames: Number.isFinite(metadata.presentedFrames)
              ? metadata.presentedFrames
              : null,
            currentTime: video.currentTime,
          };
          if (!finish(proof) && !settled) requestNext();
        });
      };
      requestNext();
    } else {
      const checkCurrentTime = () => {
        const currentTime = video.currentTime;
        if (
          currentTime > fallbackStartTime &&
          finish({
            mediaTime: currentTime,
            presentedFrames: null,
            currentTime,
          })
        ) {
          return;
        }
        animationFrameId = hostWindow.requestAnimationFrame(checkCurrentTime);
      };
      animationFrameId = hostWindow.requestAnimationFrame(checkCurrentTime);
    }

    signal?.addEventListener('abort', abort, { once: true });
    timeoutId = hostWindow.setTimeout(fail, timeoutMs);
  });
}

export type FrameReader = ((video: HTMLVideoElement) => NativeFrameAssessment | null) & {
  reset?: () => void;
};

function createFrameReader(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): FrameReader {
  const canvas = createCanvas();
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let previousLuma: Uint8Array | null = null;

  const read: FrameReader = (video) => {
    if (!context || !isVisibleVideoFrame(video)) return null;
    try {
      context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const assessment = assessNativeFramePixels(
        context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data,
        previousLuma,
      );
      previousLuma = assessment.luma;
      return assessment;
    } catch {
      return null;
    }
  };
  read.reset = () => {
    previousLuma?.fill(0);
    previousLuma = null;
    canvas.width = 0;
    canvas.height = 0;
  };
  return read;
}

const mapCameraFailure = (reason: CameraFailureReason): GuidedCaptureFailure => {
  if (reason === 'denied') return 'permission-denied';
  if (reason === 'unsupported') return 'unsupported-browser';
  if (reason === 'overconstrained') return 'unsupported-resolution';
  return 'camera-unavailable';
};

export interface NativeCameraEnvironment {
  requestCamera(): Promise<CameraRequestResult>;
  captureFrame(video: HTMLVideoElement): Promise<Blob>;
  createFrameReader(): FrameReader;
  waitForDistinctFrame(
    video: HTMLVideoElement,
    previous: DecodedVideoFrameProof | null,
    signal: AbortSignal,
  ): Promise<DecodedVideoFrameProof>;
  now(): string;
  firstFrameTimeoutMs: number;
  sampleIntervalMs: number;
}

const defaultEnvironment: NativeCameraEnvironment = {
  requestCamera: () => requestCamera(),
  captureFrame: (video) => captureFrame(video),
  createFrameReader,
  waitForDistinctFrame: (video, previous, signal) =>
    waitForDistinctVideoFrame(video, previous, { signal }),
  now: () => new Date().toISOString(),
  firstFrameTimeoutMs: FIRST_FRAME_TIMEOUT_MS,
  sampleIntervalMs: FRAME_SAMPLE_INTERVAL_MS,
};

export class NativeBrowserCameraAdapter implements CameraKitAdapter {
  private activeGeneration = 0;
  private activeCancel: (() => void) | null = null;

  constructor(private readonly environment: NativeCameraEnvironment = defaultEnvironment) {}

  async start(options: GuidedCaptureStartOptions): Promise<GuidedCaptureSession> {
    this.activeCancel?.();
    const generation = ++this.activeGeneration;
    const video =
      options.previewElement ??
      options.mountElement.querySelector<HTMLVideoElement>('[data-native-camera-preview]');
    const hostWindow = options.mountElement.ownerDocument.defaultView ?? window;
    let stream: MediaStream | null = null;
    let sampleTimer = 0;
    let closed = false;
    let previewLive = false;
    let captureStarted = false;
    let acceptedFrameCount = 0;
    let attemptedFrameCount = 0;
    let lastFrameProof: DecodedVideoFrameProof | null = null;
    let endedTrack: MediaStreamTrack | null = null;
    const sessionAbort = new AbortController();
    const readFrame = this.environment.createFrameReader();

    const isActive = () =>
      !closed && !options.signal?.aborted && this.activeGeneration === generation;

    const cleanupVideo = () => {
      if (!video) return;
      try {
        video.pause();
      } catch {
        // A preview can already be detached during route teardown.
      }
      try {
        video.srcObject = null;
      } catch {
        // Safari may already have released the element's media source.
      }
    };

    const close = () => {
      if (closed) return;
      closed = true;
      hostWindow.clearInterval(sampleTimer);
      sampleTimer = 0;
      endedTrack?.removeEventListener('ended', handleTrackEnded);
      endedTrack = null;
      sessionAbort.abort();
      readFrame.reset?.();
      cleanupVideo();
      releaseStream(stream);
      stream = null;
      options.signal?.removeEventListener('abort', close);
      if (this.activeCancel === close) this.activeCancel = null;
      options.onStatus?.('closed');
    };

    const fail = (failure: GuidedCaptureFailure) => {
      if (!isActive()) return;
      options.onFailure(failure);
      close();
    };

    function handleTrackEnded() {
      if (previewLive && acceptedFrameCount < REDNESS_BURST_REQUIRED_MEASUREMENTS) {
        fail('preview-stalled');
      }
    }

    const capture = () => {
      if (!isActive() || !video || !previewLive || captureStarted) return;
      captureStarted = true;
      hostWindow.clearInterval(sampleTimer);
      sampleTimer = 0;
      const burstEnabled = Boolean(options.burstGenerationId);
      const requiredMeasurements = burstEnabled ? REDNESS_BURST_REQUIRED_MEASUREMENTS : 1;
      const maximumAttempts = burstEnabled ? REDNESS_BURST_MAX_CAPTURE_ATTEMPTS : 1;

      const rejectedAttempt = (frameId: string, attemptedAt: string, reasons: string[]) => {
        options.onRejectedAttempt?.({ frameId, attemptedAt, reasons });
      };

      void (async () => {
        while (
          isActive() &&
          acceptedFrameCount < requiredMeasurements &&
          attemptedFrameCount < maximumAttempts
        ) {
          attemptedFrameCount += 1;
          const attemptedAt = this.environment.now();
          let proof: DecodedVideoFrameProof;

          try {
            proof = await this.environment.waitForDistinctFrame(
              video,
              lastFrameProof,
              sessionAbort.signal,
            );
          } catch (error) {
            if (!isActive() || (error instanceof DOMException && error.name === 'AbortError')) {
              return;
            }
            const frameId = `native-${generation}-${attemptedFrameCount}-not-current`;
            rejectedAttempt(frameId, attemptedAt, ['preview not current']);
            continue;
          }

          lastFrameProof = proof;
          const proofToken =
            proof.presentedFrames ?? Math.max(0, Math.round(proof.mediaTime * 1_000_000));
          const frameId = `native-${generation}-${attemptedFrameCount}-${proofToken}`;
          const assessment = readFrame(video);
          if (!assessment) {
            rejectedAttempt(frameId, attemptedAt, ['preview not current']);
            continue;
          }

          const qualityReasons = [
            ...(assessment.lightingValid ? [] : ['lighting outside accepted range']),
            ...(assessment.stillnessValid ? [] : ['movement above accepted range']),
          ];
          if (qualityReasons.length > 0) {
            rejectedAttempt(frameId, attemptedAt, qualityReasons);
            continue;
          }

          let image: Blob;
          try {
            image = await this.environment.captureFrame(video);
          } catch {
            rejectedAttempt(frameId, attemptedAt, ['capture failed']);
            continue;
          }
          if (!isActive()) return;

          acceptedFrameCount += 1;
          options.onCapture(image, NATIVE_CAPTURE_PROFILE, {
            frameId,
            capturedAt: attemptedAt,
          });
        }

        if (!isActive()) return;
        if (acceptedFrameCount === requiredMeasurements) {
          options.onStatus?.('captured');
          options.onBurstComplete?.({
            attemptedFrameCount,
            acceptedFrameCount,
          });
          close();
          return;
        }
        fail(burstEnabled ? 'burst-exhausted' : 'invalid-capture');
      })();
    };

    const session: GuidedCaptureSession = {
      captureProfileId: NATIVE_CAPTURE_PROFILE,
      capture,
      cancel: close,
    };

    this.activeCancel = close;
    options.signal?.addEventListener('abort', close, { once: true });
    options.onStatus?.('loading');

    if (!video) {
      fail('camera-unavailable');
      return session;
    }

    options.onStatus?.('requesting-permission');
    let result: CameraRequestResult;
    try {
      result = await this.environment.requestCamera();
    } catch {
      fail('camera-unavailable');
      return session;
    }
    if (!isActive()) {
      if (result.ok) releaseStream(result.stream);
      return session;
    }
    if (!result.ok) {
      fail(mapCameraFailure(result.reason));
      return session;
    }

    stream = result.stream;
    endedTrack = stream.getVideoTracks()[0] ?? stream.getTracks()[0] ?? null;
    endedTrack?.addEventListener('ended', handleTrackEnded);
    options.onStatus?.('camera-opening');
    attachStream(video, stream);
    options.onStatus?.('waiting-first-frame');

    try {
      await waitForVisibleVideoFrame(video, {
        timeoutMs: this.environment.firstFrameTimeoutMs,
        hostWindow,
        signal: sessionAbort.signal,
      });
    } catch (error) {
      if (!isActive() || (error instanceof DOMException && error.name === 'AbortError')) {
        return session;
      }
      fail('preview-stalled');
      return session;
    }
    if (!isActive()) return session;

    previewLive = true;
    options.onStatus?.('preview-live');
    const publishFrameQuality = () => {
      if (!isActive() || !previewLive || !video) return;
      const assessment = readFrame(video);
      if (!assessment) return;
      options.onQuality({
        verificationMode: 'frame-quality',
        frameReady: true,
        quality: {
          facePresent: false,
          distanceValid: false,
          alignmentValid: false,
          angleValid: false,
          lightingValid: assessment.lightingValid,
          stillnessValid: assessment.stillnessValid,
        },
        lightingIssue: assessment.lightingIssue,
        distanceIssue: null,
        alignmentIssue: null,
        angleIssue: null,
        faceBounds: null,
        registeredRegions: [],
        ready: assessment.lightingValid && assessment.stillnessValid,
      });
    };
    publishFrameQuality();
    sampleTimer = hostWindow.setInterval(publishFrameQuality, this.environment.sampleIntervalMs);

    return session;
  }
}
