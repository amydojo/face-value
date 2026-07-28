/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAMERA_KIT_MODE?: 'live' | 'fixture';
  readonly VITE_SHOW_DEMO_CONTROLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
