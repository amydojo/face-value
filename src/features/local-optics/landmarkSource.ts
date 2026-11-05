import assets from './local-optics-assets.json';
import type { LandmarkFrame } from './opticsMetrics';

/**
 * Browser-local face landmarks. The model runs in this tab (WebAssembly, optionally WebGL);
 * video frames are handed to it in memory and never leave the device. The runtime and model are
 * same-origin static files (see scripts/prepare-local-optics-assets.mjs), loaded only when the
 * person asks.
 */
export interface LandmarkerInitReport {
  delegate: 'GPU' | 'CPU';
  requestedDelegate: 'auto' | 'CPU';
  /** Why the GPU delegate failed, when the CPU fallback was used. */
  gpuFailure: string | null;
  initMs: number;
}

export interface FaceLandmarkSource {
  readonly name: string;
  readonly init?: LandmarkerInitReport;
  detect(video: HTMLVideoElement, timestampMs: number): LandmarkFrame;
  close(): void;
}

export const MEDIAPIPE_TASKS_VISION_VERSION = assets.runtime.version;
export const LOCAL_OPTICS_MODEL = assets.model;

export interface LandmarkerAssets {
  wasmBase: string;
  model: string;
  modelSha256: string;
}

export const landmarkerAssets = (): LandmarkerAssets => ({
  wasmBase: `${assets.publicBase}/wasm`,
  model: `${assets.publicBase}/${assets.model.name}`,
  modelSha256: assets.model.sha256,
});

// The subset of the @mediapipe/tasks-vision API this experiment uses.
export interface MediaPipeVision {
  FilesetResolver: { forVisionTasks(wasmBase: string): Promise<unknown> };
  FaceLandmarker: {
    createFromOptions(fileset: unknown, options: Record<string, unknown>): Promise<MediaPipeLandmarker>;
  };
}
interface MediaPipeLandmarker {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number,
  ): {
    faceLandmarks: { x: number; y: number; z: number }[][];
    facialTransformationMatrixes?: { data: ArrayLike<number> }[];
  };
  close(): void;
}

export interface LandmarkerLoaderDeps {
  importVision: () => Promise<MediaPipeVision>;
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
  digestHex: (bytes: ArrayBuffer) => Promise<string>;
  now?: () => number;
}

const browserLoaderDeps: LandmarkerLoaderDeps = {
  importVision: () => import('@mediapipe/tasks-vision') as unknown as Promise<MediaPipeVision>,
  fetchBytes: async (url) => {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Model not available at ${url} (${response.status})`);
    return response.arrayBuffer();
  },
  digestHex: async (bytes) => {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  },
};

export async function loadMediaPipeLandmarker(
  paths: LandmarkerAssets = landmarkerAssets(),
  deps: LandmarkerLoaderDeps = browserLoaderDeps,
  requestedDelegate: 'auto' | 'CPU' = 'auto',
): Promise<FaceLandmarkSource> {
  const now = deps.now ?? (() => performance.now());
  const started = now();
  // Fetch and verify the model before any runtime work, so a wrong file never reaches inference.
  const modelBytes = await deps.fetchBytes(paths.model);
  const digest = await deps.digestHex(modelBytes);
  if (digest !== paths.modelSha256) {
    throw new Error(`Model integrity check failed (sha256 ${digest.slice(0, 12)}…)`);
  }
  const vision = await deps.importVision();
  const fileset = await vision.FilesetResolver.forVisionTasks(paths.wasmBase);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetBuffer: new Uint8Array(modelBytes), delegate },
    runningMode: 'VIDEO',
    numFaces: 2, // two, so a second face is detected and rejected rather than ignored
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  });
  let landmarker: MediaPipeLandmarker;
  let delegate: 'GPU' | 'CPU' = requestedDelegate === 'CPU' ? 'CPU' : 'GPU';
  let gpuFailure: string | null = null;
  if (delegate === 'GPU') {
    try {
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (error) {
      gpuFailure = error instanceof Error ? error.message : String(error);
      delegate = 'CPU';
      landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('CPU'));
    }
  } else {
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
  const init: LandmarkerInitReport = { delegate, requestedDelegate, gpuFailure, initMs: Math.round(now() - started) };
  let closed = false;
  return {
    name: `MediaPipe Face Landmarker (tasks-vision ${MEDIAPIPE_TASKS_VISION_VERSION}, ${delegate}, same-origin)`,
    init,
    detect(video, timestampMs) {
      if (closed) throw new Error('Landmarker closed');
      const result = landmarker.detectForVideo(video, timestampMs);
      return {
        faces: result.faceLandmarks.map((points, i) => ({
          points: points.map(({ x, y, z }) => ({ x, y, z })),
          matrix: result.facialTransformationMatrixes?.[i]?.data
            ? Array.from(result.facialTransformationMatrixes[i].data)
            : null,
        })),
      };
    },
    close() {
      if (closed) return;
      closed = true;
      landmarker.close();
    },
  };
}
