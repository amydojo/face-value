import { FixtureCameraKitAdapter } from './fixtureCameraKitAdapter';
import { YouCamCameraKitAdapter } from './cameraKitAdapter';
import type { CameraKitAdapter } from './types';

export * from './cameraKitAdapter';
export * from './captureProfile';
export * from './diagnostics';
export * from './fixtureCameraKitAdapter';
export * from './loader';
export * from './normalizeCapture';
export * from './quality';
export * from './safariVideoBridge';
export * from './types';

export function createCameraKitAdapter(): CameraKitAdapter {
  const forceLive = import.meta.env.VITE_CAMERA_KIT_MODE === 'live';
  const useFixture =
    import.meta.env.VITE_CAMERA_KIT_MODE === 'fixture' ||
    (!forceLive && (import.meta.env.DEV || import.meta.env.MODE === 'test'));
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
  return useFixture
    ? new FixtureCameraKitAdapter({
        stallFirstSession,
        qualityStepMs: slowQualityProgression ? 600 : 60,
        scenario,
      })
    : new YouCamCameraKitAdapter();
}
