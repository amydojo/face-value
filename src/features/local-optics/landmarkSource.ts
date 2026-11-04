import type { LandmarkFrame } from './opticsMetrics';

/**
 * Browser-local face landmarks. The model runs in this tab (WebAssembly / WebGL); video frames
 * are handed to it in memory and never leave the device. Loading the model downloads code and
 * weights only.
 */
export interface FaceLandmarkSource {
  readonly name: string;
  detect(video: HTMLVideoElement, timestampMs: number): LandmarkFrame;
  close(): void;
}

export const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.14';

export interface LandmarkerAssets {
  module: string;
  wasmBase: string;
  model: string;
}

/**
 * Pinned third-party asset locations. Set VITE_LOCAL_OPTICS_ASSET_BASE to a same-origin folder
 * holding vision_bundle.mjs, wasm/ and face_landmarker.task to avoid third-party hosts entirely.
 */
export function landmarkerAssets(base = import.meta.env.VITE_LOCAL_OPTICS_ASSET_BASE): LandmarkerAssets {
  if (base) {
    const root = base.endsWith('/') ? base : `${base}/`;
    return { module: `${root}vision_bundle.mjs`, wasmBase: `${root}wasm`, model: `${root}face_landmarker.task` };
  }
  const pkg = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}`;
  return {
    module: `${pkg}/vision_bundle.mjs`,
    wasmBase: `${pkg}/wasm`,
    model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  };
}

// The subset of the @mediapipe/tasks-vision API this experiment uses.
interface MediaPipeVision {
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
    facialTransformationMatrixes?: { data: number[] }[];
  };
  close(): void;
}

export type ModuleImporter = (url: string) => Promise<unknown>;
const importFromUrl: ModuleImporter = (url) => import(/* @vite-ignore */ url);

export async function loadMediaPipeLandmarker(
  assets: LandmarkerAssets = landmarkerAssets(),
  importer: ModuleImporter = importFromUrl,
): Promise<FaceLandmarkSource> {
  const vision = (await importer(assets.module)) as MediaPipeVision;
  const fileset = await vision.FilesetResolver.forVisionTasks(assets.wasmBase);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: assets.model, delegate },
    runningMode: 'VIDEO',
    numFaces: 2, // two, so a second face is detected and rejected rather than ignored
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  });
  let landmarker: MediaPipeLandmarker;
  let delegate: 'GPU' | 'CPU' = 'GPU';
  try {
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    delegate = 'CPU';
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
  return {
    name: `MediaPipe Face Landmarker (tasks-vision ${MEDIAPIPE_TASKS_VISION_VERSION}, ${delegate})`,
    detect(video, timestampMs) {
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
      landmarker.close();
    },
  };
}
