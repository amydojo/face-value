import {
  attachStream,
  releaseStream,
  requestCamera,
  waitForVideoFrame,
  type CameraRequestResult,
} from '../../adapters/camera/browserCamera';
import type { FaceLandmarkSource } from './landmarkSource';
import {
  faceGeometry,
  measureCapture,
  type CameraReport,
  type CaptureMeasurement,
  type CaptureSample,
  type DetectedFace,
} from './opticsMetrics';

/** Longest side of the in-memory analysis frame. Larger frames add cost, not evidence. */
export const ANALYSIS_LONG_SIDE = 360;
export const CAPTURE_FRAMES = 12;

export interface OpticsCapture {
  measurement: CaptureMeasurement;
  /** Last analysed frame, held only in this tab's memory for the diagnostic view. */
  snapshot: HTMLCanvasElement;
  faces: DetectedFace[];
}

/** One real model reading for the live readout. Never stored; replaced on every sample. */
export interface LiveReading {
  faceCount: number;
  rollDegrees: number | null;
  yawDegrees: number | null;
  pitchDegrees: number | null;
  interocularFraction: number | null;
  outOfFrame: boolean;
}

export interface OpticsSessionDeps {
  requestCamera: () => Promise<CameraRequestResult>;
  attach: (video: HTMLVideoElement, stream: NonNullable<Extract<CameraRequestResult, { ok: true }>['stream']>) => void;
  waitForFrame: (video: HTMLVideoElement) => Promise<void>;
  nextFrame: () => { promise: Promise<number>; cancel: () => void };
  createCanvas: () => HTMLCanvasElement;
  loadLandmarks: () => Promise<FaceLandmarkSource>;
}

type Stream = Extract<CameraRequestResult, { ok: true }>['stream'];

const browserNextFrame = () => {
  let id = 0;
  const promise = new Promise<number>((resolve) => {
    id = requestAnimationFrame(resolve);
  });
  return { promise, cancel: () => cancelAnimationFrame(id) };
};

export function browserOpticsDeps(loadLandmarks: () => Promise<FaceLandmarkSource>): OpticsSessionDeps {
  return {
    requestCamera: () => requestCamera(),
    attach: attachStream,
    waitForFrame: (video) => waitForVideoFrame(video),
    nextFrame: browserNextFrame,
    createCanvas: () => document.createElement('canvas'),
    loadLandmarks,
  };
}

function cameraReport(stream: Stream): CameraReport {
  const track = stream.getVideoTracks()[0];
  const raw = (track?.getSettings?.() ?? {}) as Record<string, unknown>;
  const settings: CameraReport['settings'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'deviceId' || key === 'groupId') continue; // identifiers, not capture conditions
    if (['string', 'number', 'boolean'].includes(typeof value)) settings[key] = value as string | number | boolean;
  }
  return { settings };
}

/**
 * Camera, optional landmark model and frame sampling for the experiment. Every resource it
 * acquires is released by `dispose()`: camera tracks, the model, a pending animation frame and
 * in-memory frames.
 */
export class OpticsSession {
  private stream: Stream | null = null;
  private landmarks: FaceLandmarkSource | null = null;
  private pendingFrame: { cancel: () => void } | null = null;
  private canvases = new Set<HTMLCanvasElement>();
  private lastTimestamp = 0;
  private disposed = false;
  private capturing = false;

  constructor(private readonly deps: OpticsSessionDeps) {}

  get modelName(): string | null {
    return this.landmarks?.name ?? null;
  }

  get cameraActive(): boolean {
    return this.stream !== null;
  }

  async startCamera(video: HTMLVideoElement): Promise<CameraRequestResult> {
    const result = await this.deps.requestCamera();
    if (!result.ok) return result;
    if (this.disposed) {
      releaseStream(result.stream);
      return { ok: false, reason: 'unknown' };
    }
    this.stream = result.stream;
    this.deps.attach(video, result.stream);
    await this.deps.waitForFrame(video);
    return result;
  }

  async loadLandmarks(): Promise<string> {
    if (this.landmarks) return this.landmarks.name;
    const source = await this.deps.loadLandmarks();
    if (this.disposed) {
      source.close();
      throw new Error('Session closed');
    }
    this.landmarks = source;
    return source.name;
  }

  private frame(): Promise<number> {
    const next = this.deps.nextFrame();
    this.pendingFrame = next;
    return next.promise.finally(() => {
      if (this.pendingFrame === next) this.pendingFrame = null;
    });
  }

  private newCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = this.deps.createCanvas();
    canvas.width = width;
    canvas.height = height;
    this.canvases.add(canvas);
    return canvas;
  }

  releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    this.canvases.delete(canvas);
  }

  private timestamp(now: number): number {
    const ts = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = ts;
    return ts;
  }

  /** A single live model reading from the current video frame, or null when not available. */
  liveReading(video: HTMLVideoElement, now: number): LiveReading | null {
    if (this.disposed || this.capturing || !this.stream || !this.landmarks || !video.videoWidth) return null;
    const frame = this.landmarks.detect(video, this.timestamp(now));
    const only = frame.faces.length === 1 ? faceGeometry(frame.faces[0], video.videoWidth, video.videoHeight) : null;
    return {
      faceCount: frame.faces.length,
      rollDegrees: only?.rollDegrees ?? null,
      yawDegrees: only?.yawDegrees ?? null,
      pitchDegrees: only?.pitchDegrees ?? null,
      interocularFraction: only?.interocularFraction ?? null,
      outOfFrame: only ? only.outOfFrameFraction > 0 : false,
    };
  }

  async capture(video: HTMLVideoElement, frames = CAPTURE_FRAMES): Promise<OpticsCapture> {
    if (!this.stream) throw new Error('Camera is not running');
    this.capturing = true;
    try {
      return await this.captureFrames(video, frames);
    } finally {
      this.capturing = false;
    }
  }

  private async captureFrames(video: HTMLVideoElement, frames: number): Promise<OpticsCapture> {
    const stream = this.stream;
    if (!stream) throw new Error('Camera is not running');
    const scale = ANALYSIS_LONG_SIDE / Math.max(video.videoWidth, video.videoHeight);
    const width = Math.max(1, Math.round(video.videoWidth * Math.min(1, scale)));
    const height = Math.max(1, Math.round(video.videoHeight * Math.min(1, scale)));
    const work = this.newCanvas(width, height);
    const context = work.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context unavailable');

    const samples: CaptureSample[] = [];
    try {
      for (let i = 0; i < frames; i += 1) {
        const timestamp = await this.frame();
        if (this.disposed) throw new Error('Session closed');
        // Unmirrored pixels, as the camera delivered them.
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        samples.push({
          pixels: { width, height, data: image.data },
          landmarks: this.landmarks ? this.landmarks.detect(video, this.timestamp(timestamp)) : null,
        });
      }
    } catch (error) {
      this.releaseCanvas(work);
      throw error;
    }
    const measurement = measureCapture(samples, cameraReport(stream));
    const last = samples.at(-1)?.landmarks;
    return { measurement, snapshot: work, faces: last?.faces ?? [] };
  }

  dispose(): void {
    this.disposed = true;
    this.pendingFrame?.cancel();
    this.pendingFrame = null;
    releaseStream(this.stream);
    this.stream = null;
    this.landmarks?.close();
    this.landmarks = null;
    for (const canvas of [...this.canvases]) this.releaseCanvas(canvas);
  }
}
