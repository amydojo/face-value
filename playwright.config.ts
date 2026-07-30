import { defineConfig, devices } from '@playwright/test';

const capturingHomeVerdictEvidence =
  process.env.CAPTURE_HOME_VERDICT_EVIDENCE === 'true';
const capturingRednessEvidence =
  process.env.CAPTURE_REDNESS_EVIDENCE === 'true';
const capturingEvidenceRecord =
  process.env.CAPTURE_EVIDENCE_RECORD === 'true';
const requestedPort = Number(process.env.PLAYWRIGHT_PORT);
const serverPort =
  Number.isInteger(requestedPort) && requestedPort > 0
    ? requestedPort
    : capturingHomeVerdictEvidence
      ? 4174
      : capturingRednessEvidence
        ? 4175
        : capturingEvidenceRecord
          ? 4176
          : 4173;
const baseURL = `http://127.0.0.1:${serverPort}`;

// Linux WebKit uses different system-font and SVG-edge rasterization than macOS.
// Bound the accepted area and color distance independently so geometry, state,
// and authored milestones remain strict while platform antialiasing is ignored.
const captureRasterAllowance =
  process.platform === 'linux'
    ? { maxDiffPixelRatio: 0.0125, threshold: 0.3 }
    : { maxDiffPixelRatio: 0, threshold: 0.2 };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // The suite validates animation milestones and pixel geometry in WebKit.
  // A single CI browser keeps OS-level animation-event scheduling stable.
  workers: process.env.CI ? 1 : undefined,
  timeout: 90_000,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { toHaveScreenshot: captureRasterAllowance },
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `${
      capturingHomeVerdictEvidence || capturingEvidenceRecord
        ? ''
        : 'VITE_SHOW_DEMO_CONTROLS=true '
    }VITE_CAMERA_KIT_MODE=fixture npm run dev -- --host 127.0.0.1 --port ${serverPort}`,
    url: baseURL,
    reuseExistingServer:
      !process.env.CI &&
      !capturingHomeVerdictEvidence &&
      !capturingRednessEvidence &&
      !capturingEvidenceRecord &&
      !process.env.PLAYWRIGHT_PORT,
  },
  projects: [{ name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }],
});
