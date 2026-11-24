import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// Dedicated real-model/fake-camera suite. Not iPhone or clinical evidence.
export default defineConfig({
  ...base,
  testIgnore: [], // This is the dedicated Chromium/FFmpeg job, not the WebKit suite.
  testMatch: /(?:local-optics(?:-[^.]+)?|living-trial)\.spec\.ts$/,
  projects: [{ name: 'optics-chromium', use: { ...devices['Desktop Chrome'] } }],
});
