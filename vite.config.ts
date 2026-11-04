import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Local Optics on an iPhone: Safari grants the camera only over HTTPS. Opt in with a certificate
// the phone trusts (for example from mkcert); nothing changes when these are unset.
const httpsCert = process.env.FV_DEV_HTTPS_CERT;
const httpsKey = process.env.FV_DEV_HTTPS_KEY;
const https = httpsCert && httpsKey ? { cert: readFileSync(httpsCert), key: readFileSync(httpsKey) } : undefined;

export default defineConfig({
  plugins: [react()],
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
