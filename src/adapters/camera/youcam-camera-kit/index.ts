import { FixtureCameraKitAdapter } from './fixtureCameraKitAdapter';
import { NativeBrowserCameraAdapter } from './nativeBrowserCameraAdapter';
import { YouCamCameraKitAdapter } from './cameraKitAdapter';
import type { CameraKitAdapter } from './types';

export * from './cameraKitAdapter';
export * from './captureProfile';
export * from './diagnostics';
export * from './fixtureCameraKitAdapter';
export * from './loader';
export * from './normalizeCapture';
export * from './nativeBrowserCameraAdapter';
export * from './quality';
export * from './safariVideoBridge';
export * from './types';

export function createCameraKitAdapter(): CameraKitAdapter {
  const forceLive = import.meta.env.VITE_CAMERA_KIT_MODE === 'live';
  const useCameraKitDiagnostic =
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('camera-kit-diagnostics') === '1';
  const useNativeContractHarness =
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('native-camera-contract') === '1';
  const useFixture =
    !useCameraKitDiagnostic &&
    !useNativeContractHarness &&
    (import.meta.env.VITE_CAMERA_KIT_MODE === 'fixture' ||
      (!forceLive && (import.meta.env.DEV || import.meta.env.MODE === 'test')));
  const stallFirstSession =
    useFixture &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('camera-stall') === '1';
  const slowQualityProgression =
    useFixture &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('camera-quality-proof') === '1';
  const requestedScenario =
    useFixture && typeof location !== 'undefined'
      ? new URLSearchParams(location.search).get('camera-scenario')
      : null;
  const scenario =
    requestedScenario === 'signal-flicker' ||
    requestedScenario === 'lose-lock' ||
    requestedScenario === 'lose-scan' ||
    requestedScenario === 'permission-denied' ||
    requestedScenario === 'camera-unavailable'
      ? requestedScenario
      : 'success';
  if (useFixture) {
    return new FixtureCameraKitAdapter({
      stallFirstSession,
      qualityStepMs: slowQualityProgression ? 600 : 60,
      scenario,
    });
  }

  // The vendor's documented renderer is retained only as a privacy-safe
  // development contract harness. Production uses a first-party <video>
  // preview and captures that exact visible frame.
  return useCameraKitDiagnostic
    ? new YouCamCameraKitAdapter()
    : new NativeBrowserCameraAdapter();
}

export const createGuidedCaptureAdapter = createCameraKitAdapter;
