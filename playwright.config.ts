import { defineConfig, devices } from '@playwright/test';

const capturingHomeVerdictEvidence = process.env.CAPTURE_HOME_VERDICT_EVIDENCE === 'true';
const capturingRednessEvidence = process.env.CAPTURE_REDNESS_EVIDENCE === 'true';
const capturingEvidenceRecord = process.env.CAPTURE_EVIDENCE_RECORD === 'true';
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || null;
const vercelAutomationBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() || null;
const externalPreviewHeaders = externalBaseURL
  ? {
      ...(vercelAutomationBypassSecret
        ? { 'x-vercel-protection-bypass': vercelAutomationBypassSecret }
        : {}),
      'x-vercel-skip-toolbar': '1',
    }
  : undefined;
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
const baseURL = externalBaseURL ?? `http://127.0.0.1:${serverPort}`;

// Linux WebKit uses different system-font rasterization than macOS. Keep the
// allowance below the largest observed cross-platform glyph/curve delta while
// preserving strict geometry, state, and layout assertions in the visual test.
const captureRasterAllowance =
  process.platform === 'linux' ? { maxDiffPixelRatio: 0.0125 } : { maxDiffPixelRatio: 0 };

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
  use: {
    baseURL,
    trace: 'retain-on-failure',
    extraHTTPHeaders: externalPreviewHeaders,
  },
  webServer: externalBaseURL
    ? undefined
    : {
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
