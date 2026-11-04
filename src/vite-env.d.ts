/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAMERA_KIT_MODE?: 'live' | 'fixture';
  readonly VITE_SHOW_DEMO_CONTROLS?: string;
  /** 'true' includes the local optical comparability experiment in a build. */
  readonly VITE_LOCAL_OPTICS_EXPERIMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
