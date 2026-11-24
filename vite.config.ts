import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Local Optics on an iPhone: Safari grants the camera only over HTTPS. Opt in with a certificate
// the phone trusts (for example from mkcert); nothing changes when these are unset.
const httpsCert = process.env.FV_DEV_HTTPS_CERT;
const httpsKey = process.env.FV_DEV_HTTPS_KEY;
const https = httpsCert && httpsKey ? { cert: readFileSync(httpsCert), key: readFileSync(httpsKey) } : undefined;

// Vite copies public/ even when a lazy route is compiled away. Prevent previously prepared
// model/WASM files from leaking into a standard build in a reused workspace.
function isolateOpticsAssets(): Plugin {
  let generatedPath: string | null = null;
  return {
    name: 'face-value-optics-asset-isolation',
    apply: 'build',
    configResolved(config) {
      generatedPath = config.env.VITE_LOCAL_OPTICS_EXPERIMENT === 'true' ? null : resolve(config.root, config.build.outDir, 'local-optics-assets');
    },
    closeBundle() {
      if (generatedPath) rmSync(generatedPath, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), isolateOpticsAssets()],
  ...(process.env.VITE_FV07_RESEARCH === 'true' ? {
    build: { rollupOptions: { input: resolve(process.cwd(), 'research/fv07/lab.html') } },
  } : {}),
  server: { host: '127.0.0.1', port: 4173, ...(https ? { https } : {}) },
  preview: { host: '127.0.0.1', port: 4173 },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: { reporter: ['text', 'json-summary'] },
  },
});
