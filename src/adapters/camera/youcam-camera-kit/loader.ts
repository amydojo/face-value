import type { CameraKitWindow, YouCamCameraKitSdk } from './types';

export const CAMERA_KIT_SDK_SRC =
  'https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js';
export const CAMERA_KIT_SCRIPT_MARKER = 'data-face-value-camera-kit';

let sdkPromise: Promise<YouCamCameraKitSdk> | null = null;

export function loadYouCamCameraKit({
  windowObject = window as CameraKitWindow,
  documentObject = document,
  timeoutMs = 15_000,
}: {
  windowObject?: CameraKitWindow;
  documentObject?: Document;
  timeoutMs?: number;
} = {}): Promise<YouCamCameraKitSdk> {
  if (windowObject.YMK) return Promise.resolve(windowObject.YMK);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<YouCamCameraKitSdk>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    const previousInit = windowObject.YMKAsyncInit;

    const cleanup = () => {
      windowObject.clearTimeout(timeoutId);
    };

    const finish = () => {
      if (settled) return;
      if (!windowObject.YMK) {
        settled = true;
        cleanup();
        reject(new Error('Camera Kit loaded without exposing its documented SDK.'));
        return;
      }
      settled = true;
      cleanup();
      resolve(windowObject.YMK);
    };

    windowObject.YMKAsyncInit = () => {
      try {
        previousInit?.();
      } finally {
        finish();
      }
    };

    const existing = documentObject.querySelector<HTMLScriptElement>(
      `script[${CAMERA_KIT_SCRIPT_MARKER}]`,
    );
    const script = existing ?? documentObject.createElement('script');
    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Camera Kit could not be loaded.'));
      },
      { once: true },
    );

    if (!existing) {
      script.src = CAMERA_KIT_SDK_SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute(CAMERA_KIT_SCRIPT_MARKER, 'v2.5');
      documentObject.head.append(script);
    }

    timeoutId = windowObject.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Camera Kit loading timed out.'));
    }, timeoutMs);
  });

  return sdkPromise;
}

export function resetCameraKitLoaderForTests(): void {
  if (import.meta.env.MODE !== 'test') return;
  sdkPromise = null;
}
