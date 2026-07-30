import type {
  CameraKitInitOptions,
  CameraKitWindow,
  YouCamCameraKitSdk,
} from './types';

export const CAMERA_KIT_SDK_SRC =
  'https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js';
export const CAMERA_KIT_SCRIPT_MARKER = 'data-face-value-camera-kit';

let sdkPromise: Promise<YouCamCameraKitSdk> | null = null;
const hardenedSdks = new WeakSet<object>();

const DIMENSION_DEBUG_ALERT = /^\s*width\s*:\s*\d+\s*,\s*height\s*:\s*\d+\s*$/i;

/**
 * Camera Kit 2.5 exposes a development-only resolution alert on physical
 * iPhone Safari. Suppress only that exact message while the SDK opens. Every
 * other alert continues through untouched.
 */
function suppressDimensionDebugAlert(openCameraKit: () => void): void {
  if (typeof window === 'undefined' || typeof window.alert !== 'function') {
    openCameraKit();
    return;
  }

  const originalAlert = window.alert;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (window.alert === guardedAlert) window.alert = originalAlert;
  };
  const guardedAlert = (message?: unknown) => {
    if (DIMENSION_DEBUG_ALERT.test(String(message ?? ''))) return;
    originalAlert.call(window, String(message ?? ''));
  };

  window.alert = guardedAlert;
  window.setTimeout(restore, 5_000);
  try {
    openCameraKit();
  } catch (error) {
    restore();
    throw error;
  }
}

/**
 * Keep the adapter contract stable, but send only the previously proven SDK
 * options and isolate the vendor's iPhone-only debug behavior at the external
 * boundary.
 */
function hardenCameraKitSdk(sdk: YouCamCameraKitSdk): YouCamCameraKitSdk {
  if (hardenedSdks.has(sdk as object)) return sdk;

  const originalInit = sdk.init.bind(sdk);
  const originalOpenCameraKit = sdk.openCameraKit.bind(sdk);

  sdk.init = (options: CameraKitInitOptions) => {
    const documentedOptions = {
      ...options,
    } as Partial<CameraKitInitOptions> & Record<string, unknown>;
    delete documentedOptions.moduleMode;
    delete documentedOptions.qualityOverrides;
    originalInit(documentedOptions as CameraKitInitOptions);
  };

  sdk.openCameraKit = () => {
    suppressDimensionDebugAlert(originalOpenCameraKit);
  };

  hardenedSdks.add(sdk as object);
  return sdk;
}

export function loadYouCamCameraKit({
  windowObject = window as CameraKitWindow,
  documentObject = document,
  timeoutMs = 15_000,
}: {
  windowObject?: CameraKitWindow;
  documentObject?: Document;
  timeoutMs?: number;
} = {}): Promise<YouCamCameraKitSdk> {
  if (windowObject.YMK) return Promise.resolve(hardenCameraKitSdk(windowObject.YMK));
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
      resolve(hardenCameraKitSdk(windowObject.YMK));
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
