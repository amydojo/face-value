/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAMERA_KIT_MODE?: 'live' | 'fixture';
  readonly VITE_SHOW_DEMO_CONTROLS?: string;
  /** 'true' includes the local optical comparability experiment in a build. */
  readonly VITE_LOCAL_OPTICS_EXPERIMENT?: string;
  /** Same-origin folder with vision_bundle.mjs, wasm/ and face_landmarker.task. */
  readonly VITE_LOCAL_OPTICS_ASSET_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
