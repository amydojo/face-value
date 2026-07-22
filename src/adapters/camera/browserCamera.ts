import type { CaptureMetadata } from '../../domain/model';

export type CameraFailureReason =
  | 'unsupported'
  | 'denied'
  | 'no_camera'
  | 'overconstrained'
  | 'unknown';

export type CameraRequestResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: CameraFailureReason };

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

function defaultMediaDevices(): Pick<MediaDevices, 'getUserMedia'> | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
}

export function hasCameraSupport(
  mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined = defaultMediaDevices(),
): mediaDevices is Pick<MediaDevices, 'getUserMedia'> {
  return typeof mediaDevices?.getUserMedia === 'function';
}

export function normalizeCameraError(error: unknown): CameraFailureReason {
  const name =
    typeof error === 'object' && error !== null
      ? String((error as { name?: string }).name ?? '')
      : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no_camera';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'overconstrained';
  }
  return 'unknown';
}

export async function requestCamera(
  mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined = defaultMediaDevices(),
): Promise<CameraRequestResult> {
  if (!hasCameraSupport(mediaDevices)) return { ok: false, reason: 'unsupported' };

  try {
    return {
      ok: true,
      stream: await mediaDevices.getUserMedia(CAMERA_CONSTRAINTS),
    };
  } catch (firstError) {
    const firstReason = normalizeCameraError(firstError);

    if (firstReason === 'overconstrained') {
      try {
        return {
          ok: true,
          stream: await mediaDevices.getUserMedia({ video: true, audio: false }),
        };
      } catch (fallbackError) {
        return { ok: false, reason: normalizeCameraError(fallbackError) };
      }
    }

    return { ok: false, reason: firstReason };
  }
}

export function attachStream(video: HTMLVideoElement, stream: MediaStream): void {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => undefined);
}

export function waitForVideoFrame(
  video: HTMLVideoElement,
  timeoutMs = 4_000,
): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', checkReady);
      video.removeEventListener('canplay', checkReady);
      video.removeEventListener('resize', checkReady);
      video.removeEventListener('error', fail);
    };

    const checkReady = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      cleanup();
      resolve();
    };

    const fail = () => {
      cleanup();
      reject(new Error('Video frame is not ready'));
    };

    video.addEventListener('loadedmetadata', checkReady);
    video.addEventListener('canplay', checkReady);
    video.addEventListener('resize', checkReady);
    video.addEventListener('error', fail, { once: true });
    timeoutId = window.setTimeout(fail, timeoutMs);
  });
}

export function releaseStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export interface CanvasFactory {
  (): HTMLCanvasElement;
}

export async function captureFrame(
  video: HTMLVideoElement,
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Video frame is not ready');
  }

  const canvas = createCanvas();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');

  // Preview mirroring is CSS-only. Evidence pixels are always captured unmirrored.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.92,
    );
  });
}

export function metadataForCapture(
  kind: CaptureMetadata['kind'],
  source: CaptureMetadata['source'],
  mimeType: string,
  now = new Date().toISOString(),
): CaptureMetadata {
  const normalizedMime = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ].includes(mimeType)
    ? (mimeType as CaptureMetadata['mimeType'])
    : 'image/unknown';

  return {
    id: `${kind}-${now}`,
    kind,
    source,
    mimeType: normalizedMime,
    createdAt: now,
    orientationRule: 'analysis-unmirrored',
  };
}

export class ObjectUrlRegistry {
  private readonly urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  revoke(url: string): void {
    if (!this.urls.has(url)) return;
    URL.revokeObjectURL(url);
    this.urls.delete(url);
  }

  revokeAll(): void {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
}
