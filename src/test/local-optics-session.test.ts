import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { landmarkerAssets, loadMediaPipeLandmarker } from '../features/local-optics/landmarkSource';
import assets from '../features/local-optics/local-optics-assets.json';
import type { LandmarkFrame } from '../features/local-optics/opticsMetrics';
import { OpticsSession, type OpticsSessionDeps } from '../features/local-optics/opticsSession';

// Resource handling with fake browser objects (SIMULATED): camera tracks, the landmark model,
// animation frames and in-memory canvases must all be released.

function fakes(options: { landmarks?: boolean } = {}) {
  const track = { stop: vi.fn(), getSettings: () => ({ width: 640, height: 480, deviceId: 'secret-id', exposureMode: 'continuous' }) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const canvases: { width: number; height: number }[] = [];
  const pending: { resolve: (t: number) => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const source = {
    name: 'fake landmarks',
    detect: vi.fn<(video: HTMLVideoElement, timestampMs: number) => LandmarkFrame>(() => ({ faces: [] })),
    close: vi.fn(),
  };
  let clock = 0;
  const deps: OpticsSessionDeps = {
    requestCamera: vi.fn(async () => ({ ok: true as const, stream: stream as never })),
    attach: vi.fn(),
    waitForFrame: vi.fn(async () => undefined),
    nextFrame: () => {
      let resolve!: (t: number) => void;
      const promise = new Promise<number>((r) => {
        resolve = r;
      });
      const entry = { resolve, cancel: vi.fn() };
      pending.push(entry);
      return { promise, cancel: entry.cancel };
    },
    createCanvas: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
          getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(128) }),
        }),
      };
      canvases.push(canvas);
      return canvas as unknown as HTMLCanvasElement;
    },
    loadLandmarks: vi.fn(async () => (options.landmarks === false ? Promise.reject(new Error('blocked')) : source)),
  };
  const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
  /** Delivers animation frames until the given capture settles. */
  const run = async <T,>(capture: Promise<T>): Promise<T> => {
    let settled = false;
    const done = capture.finally(() => {
      settled = true;
    });
    for (let i = 0; i < 500 && !settled; i += 1) {
      const next = pending.shift();
      if (next) {
        clock += 33;
        next.resolve(clock);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return done;
  };
  return { deps, track, source, canvases, pending, video, run };
}

describe('optics session resources', () => {
  it('captures at a bounded size and releases camera, model and frames on dispose', async () => {
    const f = fakes();
    const session = new OpticsSession(f.deps);
    await session.startCamera(f.video);
    await session.loadLandmarks();
    const result = await f.run(session.capture(f.video, 6));
    expect(result.measurement.frameSize).toEqual({ width: 360, height: 203 });
    expect(result.measurement.frameCount).toBe(6);
    expect(f.source.detect).toHaveBeenCalledTimes(6);
    // Device identifiers are not kept with the measurement.
    expect(result.measurement.camera.settings).toEqual({ width: 640, height: 480, exposureMode: 'continuous' });

    session.dispose();
    expect(f.track.stop).toHaveBeenCalledTimes(1);
    expect(f.source.close).toHaveBeenCalledTimes(1);
    expect(f.canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true);
    expect(session.cameraActive).toBe(false);
  });

  it('landmark timestamps strictly increase across captures', async () => {
    const f = fakes();
    const session = new OpticsSession(f.deps);
    await session.startCamera(f.video);
    await session.loadLandmarks();
    for (let k = 0; k < 2; k += 1) {
      await f.run(session.capture(f.video, 5));
    }
    const stamps = f.source.detect.mock.calls.map((call) => call[1]);
    expect(stamps.every((t, i) => i === 0 || t > stamps[i - 1])).toBe(true);
    session.dispose();
  });

  it('dispose during a capture cancels the pending frame and stops the camera', async () => {
    const f = fakes();
    const session = new OpticsSession(f.deps);
    await session.startCamera(f.video);
    const capturing = session.capture(f.video, 6);
    await Promise.resolve();
    expect(f.pending).toHaveLength(1);
    const pendingCancel = f.pending[0].cancel;
    session.dispose();
    expect(pendingCancel).toHaveBeenCalled();
    expect(f.track.stop).toHaveBeenCalled();
    f.pending[0].resolve(1);
    await expect(capturing).rejects.toThrow('Session closed');
    expect(f.canvases.every((c) => c.width === 0)).toBe(true);
  });

  it('a camera granted after dispose is stopped immediately', async () => {
    const f = fakes();
    const session = new OpticsSession(f.deps);
    session.dispose();
    const result = await session.startCamera(f.video);
    expect(result.ok).toBe(false);
    expect(f.track.stop).toHaveBeenCalled();
    expect(f.deps.attach).not.toHaveBeenCalled();
  });

  it('a model that finishes loading after dispose is closed', async () => {
    const f = fakes();
    const session = new OpticsSession(f.deps);
    const loading = session.loadLandmarks();
    session.dispose();
    await expect(loading).rejects.toThrow('Session closed');
    expect(f.source.close).toHaveBeenCalled();
  });

  it('without a model, captures run and landmarks stay null', async () => {
    const f = fakes({ landmarks: false });
    const session = new OpticsSession(f.deps);
    await session.startCamera(f.video);
    await expect(session.loadLandmarks()).rejects.toThrow('blocked');
    const result = await f.run(session.capture(f.video, 6));
    expect(result.measurement.rejections).toContain('landmark_model_unavailable');
    expect(result.measurement.frameLuma.provenance).toBe('measured');
    session.dispose();
  });
});

describe('landmark model loading (fake runtime)', () => {
  const MODEL = new Uint8Array([1, 2, 3]).buffer;

  function runtime(options: { gpuFails?: boolean } = {}) {
    const created: Record<string, unknown>[] = [];
    const close = vi.fn();
    const vision = {
      FilesetResolver: { forVisionTasks: vi.fn<(base: string) => Promise<string>>(async () => 'fileset') },
      FaceLandmarker: {
        createFromOptions: vi.fn(async (_fileset: unknown, opts: Record<string, unknown>) => {
          created.push(opts);
          if (options.gpuFails && (opts.baseOptions as { delegate: string }).delegate === 'GPU') {
            throw new Error('no webgl');
          }
          return {
            detectForVideo: () => ({
              faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0, visibility: 1 }]],
              facialTransformationMatrixes: [{ rows: 4, columns: 4, data: new Float32Array(16).fill(1) }],
            }),
            close,
          };
        }),
      },
    };
    return { vision, created, close };
  }

  const deps = (vision: unknown, digest = assets.model.sha256) => ({
    importVision: vi.fn(async () => vision as never),
    fetchBytes: vi.fn(async () => MODEL),
    digestHex: vi.fn(async () => digest),
  });

  it('uses only same-origin paths pinned by the manifest', () => {
    const paths = landmarkerAssets();
    expect(paths).toEqual({
      wasmBase: '/local-optics-assets/mediapipe-tasks-vision-0.10.35/wasm',
      model: '/local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task',
      modelSha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
    });
    expect(JSON.stringify(paths)).not.toMatch(/https?:/);
  });

  it('verifies the model, asks for two faces and the matrix, falls back to CPU, and maps results', async () => {
    const r = runtime({ gpuFails: true });
    const d = deps(r.vision);
    const source = await loadMediaPipeLandmarker(landmarkerAssets(), d);
    expect(d.fetchBytes).toHaveBeenCalledWith('/local-optics-assets/mediapipe-tasks-vision-0.10.35/face_landmarker.task');
    expect(r.vision.FilesetResolver.forVisionTasks).toHaveBeenCalledWith('/local-optics-assets/mediapipe-tasks-vision-0.10.35/wasm');
    expect(r.created.map((o) => (o.baseOptions as { delegate: string }).delegate)).toEqual(['GPU', 'CPU']);
    expect(r.created[0]).toMatchObject({ numFaces: 2, outputFacialTransformationMatrixes: true, runningMode: 'VIDEO' });
    expect((r.created[0].baseOptions as { modelAssetBuffer: Uint8Array }).modelAssetBuffer).toEqual(new Uint8Array([1, 2, 3]));
    expect(source.name).toMatch(/0\.10\.35, CPU, same-origin/);
    const frame = source.detect({} as HTMLVideoElement, 1);
    expect(frame.faces[0].points[0]).toEqual({ x: 0.5, y: 0.5, z: 0 });
    expect(frame.faces[0].matrix).toHaveLength(16);
    source.close();
    source.close();
    expect(r.close).toHaveBeenCalledTimes(1);
    expect(() => source.detect({} as HTMLVideoElement, 2)).toThrow('Landmarker closed');
  });

  it('refuses a model whose hash does not match, before loading the runtime', async () => {
    const r = runtime();
    const d = deps(r.vision, 'f'.repeat(64));
    await expect(loadMediaPipeLandmarker(landmarkerAssets(), d)).rejects.toThrow('Model integrity check failed');
    expect(d.importVision).not.toHaveBeenCalled();
  });

  it('reports a missing model without loading the runtime', async () => {
    const r = runtime();
    const d = { ...deps(r.vision), fetchBytes: vi.fn(async () => Promise.reject(new Error('Model not available at /x (404)'))) };
    await expect(loadMediaPipeLandmarker(landmarkerAssets(), d)).rejects.toThrow('Model not available');
    expect(d.importVision).not.toHaveBeenCalled();
  });
});

describe('pinned runtime has no usage-metrics channel', () => {
  it('the installed @mediapipe/tasks-vision matches the manifest and contains no Google metrics endpoint', () => {
    const dir = resolve(process.cwd(), 'node_modules/@mediapipe/tasks-vision');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe(assets.runtime.version);
    for (const file of ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_nosimd_internal.js']) {
      const source = readFileSync(join(dir, file), 'utf8');
      expect(source).not.toContain('odml.pa.googleapis.com');
      expect(source).not.toMatch(/googleapis\.com\/v\d+\/log/);
    }
  });
});
