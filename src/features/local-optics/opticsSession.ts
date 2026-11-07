import {
  attachStream,
  releaseStream,
  requestCamera,
  waitForVideoFrame,
  type CameraRequestResult,
} from '../../adapters/camera/browserCamera';
import type { Observation } from './guidance';
import type { FaceLandmarkSource } from './landmarkSource';
import {
  faceGeometry,
  measureCapture,
  regionLight,
  shadingAsymmetry,
  type CameraReport,
  type CaptureMeasurement,
  type CaptureSample,
  type DetectedFace,
  type Point3,
} from './opticsMetrics';

/** Longest side of the in-memory analysis frame. Larger frames add cost, not evidence. */
export const ANALYSIS_LONG_SIDE = 360;
/** Longest side of the live light sample: enough for a mean and a clipped share, nothing more. */
export const LIVE_LIGHT_LONG_SIDE = 160;
export const CAPTURE_FRAMES = 12;

export interface OpticsCapture {
  measurement: CaptureMeasurement;
  /** Last analysed frame, held only in this tab's memory for the diagnostic view until released. */
  snapshot: HTMLCanvasElement;
  /** True once the snapshot's pixels have been released; only the numbers remain. */
  released?: boolean;
  faces: DetectedFace[];
  /** Mean time between analysed frames in this burst, ms. The motion gate is per analysed frame. */
  frameIntervalMs: number | null;
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
  /** Previous live landmarks, only to measure speed; replaced every reading, cleared on stop. */
  private previousLive: { t: number; points: Point3[]; width: number; height: number } | null = null;
  private lightCanvas: HTMLCanvasElement | null = null;
  /** Smoothed cost of one live reading (model + light sample), ms. */
  private readingMs: number | null = null;
  private lastBurstIntervalMs: number | null = null;

  constructor(private readonly deps: OpticsSessionDeps) {}

  get modelName(): string | null {
    return this.landmarks?.name ?? null;
  }

  get modelInit() {
    return this.landmarks?.init ?? null;
  }

  get cameraActive(): boolean {
    return this.stream !== null;
  }

  /**
   * Expected time between analysed frames in a burst: the last burst's measured interval, or an
   * estimate from the live reading cost rounded up to display frames. measureCapture's motion gate
   * is per analysed frame, so the same hand movement measures larger on a slower device.
   */
  get frameIntervalMs(): number {
    if (this.lastBurstIntervalMs !== null) return this.lastBurstIntervalMs;
    const display = 1000 / 60;
    return Math.max(display, Math.ceil(((this.readingMs ?? 0) + 1) / display) * display);
  }

  /**
   * Starts the camera. `onEnded` fires if the browser ends the track itself (iOS does this when
   * another app takes the camera or the page is interrupted).
   */
  async startCamera(video: HTMLVideoElement, onEnded?: () => void): Promise<CameraRequestResult> {
    const result = await this.deps.requestCamera();
    if (!result.ok) return result;
    if (this.disposed) {
      releaseStream(result.stream);
      return { ok: false, reason: 'unknown' };
    }
    this.stream = result.stream;
    const stream = result.stream;
    for (const track of stream.getVideoTracks()) {
      track.addEventListener?.('ended', () => {
        if (this.stream !== stream) return;
        this.stopCamera();
        onEnded?.();
      });
    }
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

  /** The next animation frame; rejects if the frame is cancelled, so a capture never hangs. */
  private frame(): Promise<number> {
    const next = this.deps.nextFrame();
    let stop!: (error: Error) => void;
    const cancelled = new Promise<never>((_, reject) => {
      stop = reject;
    });
    const pending = {
      cancel: () => {
        next.cancel();
        stop(new Error('Capture stopped'));
      },
    };
    this.pendingFrame = pending;
    return Promise.race([next.promise, cancelled]).finally(() => {
      if (this.pendingFrame === pending) this.pendingFrame = null;
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

  /**
   * One live reading for the guide: face count, framing and pose, landmark speed since the
   * previous reading, and coarse light on the face from a small in-memory sample. Nothing is kept
   * except the previous reading's landmarks, which the next reading replaces.
   */
  liveObservation(video: HTMLVideoElement, now: number): Observation | null {
    if (this.disposed || this.capturing || !this.stream || !this.landmarks || !video.videoWidth) return null;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const t = this.timestamp(now);
    const started = globalThis.performance?.now() ?? 0;
    const frame = this.landmarks.detect(video, t);
    const base: Observation = {
      t,
      frame: { width, height },
      faceCount: frame.faces.length,
      face: null,
      speed: null,
      light: null,
      frameIntervalMs: this.frameIntervalMs,
    };
    if (frame.faces.length !== 1) {
      this.previousLive = null;
      this.noteReadingCost(started);
      return base;
    }
    const face = frame.faces[0];
    const g = faceGeometry(face, width, height);

    let speed: number | null = null;
    const prev = this.previousLive;
    const iod = g.interocularFraction * width;
    if (prev && prev.width === width && prev.height === height && prev.points.length === face.points.length && iod > 0 && t > prev.t) {
      let sum = 0;
      for (let i = 0; i < face.points.length; i += 1) {
        const dx = (face.points[i].x - prev.points[i].x) * width;
        const dy = (face.points[i].y - prev.points[i].y) * height;
        sum += dx * dx + dy * dy;
      }
      speed = Math.sqrt(sum / face.points.length) / iod / ((t - prev.t) / 1000);
    }
    this.previousLive = { t, points: face.points, width, height };

    return {
      ...base,
      face: {
        centerX: g.centerX,
        centerY: g.centerY,
        interocular: g.interocularFraction,
        roll: g.rollDegrees,
        yaw: g.yawDegrees,
        pitch: g.pitchDegrees,
        edgeMargin: g.edgeMargin,
        outOfFrame: g.outOfFrameFraction > 0,
      },
      speed,
      light: this.sampleLight(video, g.box),
      frameIntervalMs: this.noteReadingCost(started),
    };
  }

  private noteReadingCost(started: number): number {
    const cost = (globalThis.performance?.now() ?? started) - started;
    this.readingMs = this.readingMs === null ? cost : this.readingMs * 0.7 + cost * 0.3;
    return this.frameIntervalMs;
  }

  private sampleLight(video: HTMLVideoElement, box: ReturnType<typeof faceGeometry>['box']): Observation['light'] {
    const scale = Math.min(1, LIVE_LIGHT_LONG_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    if (!this.lightCanvas) this.lightCanvas = this.newCanvas(width, height);
    const canvas = this.lightCanvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const pixels = { width, height, data: context.getImageData(0, 0, width, height).data };
    const light = regionLight(pixels, box);
    if (!light) return null;
    return { faceLuma: light.meanLuma, clipped: light.clippedHighlightFraction, shading: shadingAsymmetry(pixels, box) };
  }

  /**
   * Captures `frames` consecutive frames and measures them. `onFrame` reports progress. Rejects if
   * the camera stops, the session closes, or the frame size changes mid-burst (rotation).
   */
  async capture(video: HTMLVideoElement, frames = CAPTURE_FRAMES, onFrame?: (done: number, total: number) => void): Promise<OpticsCapture> {
    if (!this.stream) throw new Error('Camera is not running');
    if (this.capturing) throw new Error('A capture is already running');
    this.capturing = true;
    try {
      return await this.captureFrames(video, frames, onFrame);
    } finally {
      this.capturing = false;
    }
  }

  private async captureFrames(
    video: HTMLVideoElement,
    frames: number,
    onFrame?: (done: number, total: number) => void,
  ): Promise<OpticsCapture> {
    const stream = this.stream;
    if (!stream) throw new Error('Camera is not running');
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = ANALYSIS_LONG_SIDE / Math.max(video.videoWidth, video.videoHeight);
    const width = Math.max(1, Math.round(video.videoWidth * Math.min(1, scale)));
    const height = Math.max(1, Math.round(video.videoHeight * Math.min(1, scale)));
    const work = this.newCanvas(width, height);
    const context = work.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D context unavailable');

    const samples: CaptureSample[] = [];
    const times: number[] = [];
    try {
      for (let i = 0; i < frames; i += 1) {
        const timestamp = await this.frame();
        times.push(timestamp);
        if (this.disposed) throw new Error('Session closed');
        if (this.stream !== stream) throw new Error('Capture stopped');
        if (video.videoWidth !== sourceWidth || video.videoHeight !== sourceHeight) {
          throw new Error('Camera orientation changed');
        }
        // Unmirrored pixels, as the camera delivered them.
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        samples.push({
          pixels: { width, height, data: image.data },
          landmarks: this.landmarks ? this.landmarks.detect(video, this.timestamp(timestamp)) : null,
        });
        onFrame?.(i + 1, frames);
      }
    } catch (error) {
      this.releaseCanvas(work);
      throw error;
    }
    const measurement = measureCapture(samples, cameraReport(stream));
    const last = samples.at(-1)?.landmarks;
    const frameIntervalMs = times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : null;
    if (frameIntervalMs !== null) this.lastBurstIntervalMs = frameIntervalMs;
    return { measurement, snapshot: work, faces: last?.faces ?? [], frameIntervalMs };
  }

  /** Releases the camera but keeps the landmark model, e.g. while the page is in the background. */
  stopCamera(): void {
    this.pendingFrame?.cancel();
    this.pendingFrame = null;
    releaseStream(this.stream);
    this.stream = null;
    this.previousLive = null;
    this.releaseCanvas(this.lightCanvas);
    this.lightCanvas = null;
  }

  get busy(): boolean {
    return this.capturing;
  }

  /** Camera settings as the browser reports them for the running track (no device identifiers). */
  cameraSettings(): CameraReport['settings'] | null {
    return this.stream ? cameraReport(this.stream).settings : null;
  }

  dispose(): void {
    this.disposed = true;
    this.pendingFrame?.cancel();
    this.pendingFrame = null;
    releaseStream(this.stream);
    this.stream = null;
    this.landmarks?.close();
    this.landmarks = null;
    this.previousLive = null;
    this.lightCanvas = null;
    for (const canvas of [...this.canvases]) this.releaseCanvas(canvas);
  }
}
