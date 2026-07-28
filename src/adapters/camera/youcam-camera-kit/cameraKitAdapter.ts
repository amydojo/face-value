import { loadYouCamCameraKit } from './loader';
import {
  normalizeCameraKitCapture,
  CameraKitCaptureError,
} from './normalizeCapture';
import {
  emptyGuidedCaptureQuality,
  normalizeCameraKitQuality,
} from './quality';
import {
  selectCameraKitCaptureProfile,
} from './captureProfile';
import {
  logSafeCameraKitDiagnostic,
  type CameraKitDiagnosticSink,
} from './diagnostics';
import {
  createSafariVideoBridge,
  type SafariVideoBridge,
} from './safariVideoBridge';
import type {
  CameraKitAdapter,
  CameraKitCapturePayload,
  CameraKitDiagnosticStage,
  CameraKitEventName,
  CameraKitListenerIdentifier,
  CameraKitQualityPayload,
  GuidedCaptureFailure,
  GuidedCaptureQuality,
  GuidedCaptureSession,
  GuidedCaptureStartOptions,
  YouCamCameraKitSdk,
} from './types';

type CameraKitLoader = () => Promise<YouCamCameraKitSdk>;

interface CameraKitAdapterEnvironment {
  navigatorObject?: Pick<Navigator, 'userAgent' | 'vendor'>;
  highResolutionProven?: boolean;
  diagnosticSink?: CameraKitDiagnosticSink;
}

const PREVIEW_WATCHDOG_MS = 3_000;
const PREVIEW_POLL_MS = 50;

const failureCode = (payload: unknown): string => {
  if (typeof payload === 'string') return payload.toLowerCase();
  if (payload instanceof Error) {
    return `${payload.name} ${payload.message}`.toLowerCase();
  }
  if (typeof payload !== 'object' || payload === null) return '';
  const record = payload as Record<string, unknown>;
  return [
    record.code,
    record.errorCode,
    record.error_code,
    record.name,
    record.message,
    record.reason,
    record.error instanceof Error
      ? `${record.error.name} ${record.error.message}`
      : record.error,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' ')
    .toLowerCase();
};

export function normalizeCameraKitFailure(
  payload: unknown,
): GuidedCaptureFailure {
  const code = failureCode(payload);
  if (
    code.includes('permission') ||
    code.includes('notallowed') ||
    code.includes('denied access')
  ) {
    return 'permission-denied';
  }
  if (code.includes('resolution')) return 'unsupported-resolution';
  if (
    code.includes('unsupported') ||
    code.includes('browser') ||
    code.includes('getusermedia')
  ) {
    return 'unsupported-browser';
  }
  return 'camera-unavailable';
}

const knownCameraKitRuntimeFailure = (
  payload: unknown,
): GuidedCaptureFailure | null => {
  const code = failureCode(payload);
  if (
    code.includes('error.no.camera') ||
    code.includes('permission') ||
    code.includes('notallowed') ||
    code.includes('denied access')
  ) {
    return code.includes('error.no.camera')
      ? 'camera-unavailable'
      : 'permission-denied';
  }
  if (code.includes('unsupported_resolution')) {
    return 'unsupported-resolution';
  }
  if (code.includes('getusermedia') || code.includes('unsupported browser')) {
    return 'unsupported-browser';
  }
  return null;
};

const boundedDimension = (value: number, fallback: number): number =>
  Math.min(1920, Math.max(300, Math.round(value || fallback)));

export class YouCamCameraKitAdapter implements CameraKitAdapter {
  private activeSessionId = 0;
  private activeCancel: (() => void) | null = null;
  private readonly loadSdk: CameraKitLoader;
  private readonly environment: CameraKitAdapterEnvironment;

  constructor(
    loadSdk: CameraKitLoader = loadYouCamCameraKit,
    environment: CameraKitAdapterEnvironment = {},
  ) {
    this.loadSdk = loadSdk;
    this.environment = environment;
  }

  async start(
    options: GuidedCaptureStartOptions,
  ): Promise<GuidedCaptureSession> {
    this.activeCancel?.();
    this.activeCancel = null;
    const sessionId = ++this.activeSessionId;
    const profile = selectCameraKitCaptureProfile({
      frozenCaptureProfileId: options.frozenCaptureProfileId,
      navigatorObject: this.environment.navigatorObject,
      highResolutionProven:
        this.environment.highResolutionProven,
    });
    const stableForMs = profile.countingDuration;
    const previewWatchdogMs = Math.max(
      100,
      options.previewWatchdogMs ?? PREVIEW_WATCHDOG_MS,
    );
    const publishDiagnostic = (stage: CameraKitDiagnosticStage) => {
      const diagnostic = logSafeCameraKitDiagnostic(stage, profile.id);
      this.environment.diagnosticSink?.(diagnostic);
      options.onDiagnostic?.(diagnostic);
    };

    options.onStatus?.('loading');

    let sdk: YouCamCameraKitSdk;
    try {
      sdk = await this.loadSdk();
      publishDiagnostic('sdk-loaded');
    } catch (error) {
      if (!options.signal?.aborted && this.activeSessionId === sessionId) {
        options.onFailure('sdk-unavailable');
      }
      throw error;
    }

    let closed = false;
    let accepted = false;
    let cameraOpened = false;
    let previewLive = false;
    let resolutionAccepted = false;
    let firstQualityFrameSeen = false;
    let cameraClosedDiagnosticSent = false;
    let latestPayload: CameraKitQualityPayload = {};
    let quality: GuidedCaptureQuality = emptyGuidedCaptureQuality();
    let readySince: number | null = null;
    let pendingCapture: Blob | null = null;
    let stableTimer = 0;
    let previewPollTimer = 0;
    let previewWatchdogTimer = 0;
    let runtimeGuardRemovalTimer = 0;
    let runtimeGuardAttached = false;
    let videoBridge: SafariVideoBridge | null = null;
    const listenerIds: CameraKitListenerIdentifier[] = [];
    const hostWindow =
      options.mountElement.ownerDocument.defaultView ?? window;

    const isActive = () =>
      !closed &&
      !options.signal?.aborted &&
      this.activeSessionId === sessionId;

    const clearStableTimer = () => {
      hostWindow.clearTimeout(stableTimer);
      stableTimer = 0;
    };

    const clearPreviewTimers = () => {
      hostWindow.clearTimeout(previewPollTimer);
      hostWindow.clearTimeout(previewWatchdogTimer);
      previewPollTimer = 0;
      previewWatchdogTimer = 0;
    };

    const removeListeners = () => {
      listenerIds.splice(0).forEach((identifier) => {
        if (identifier === null || identifier === undefined) return;
        try {
          sdk.removeEventListener(identifier);
        } catch {
          // The SDK may already have removed listeners while closing.
        }
      });
    };

    const removeRuntimeGuard = () => {
      hostWindow.clearTimeout(runtimeGuardRemovalTimer);
      runtimeGuardRemovalTimer = 0;
      if (!runtimeGuardAttached) return;
      runtimeGuardAttached = false;
      hostWindow.removeEventListener('error', handleRuntimeError, true);
      hostWindow.removeEventListener(
        'unhandledrejection',
        handleRuntimeRejection,
        true,
      );
    };

    const closeOpenedCamera = () => {
      let sdkOwnsCamera = cameraOpened;
      try {
        sdkOwnsCamera ||= sdk.isLoaded();
      } catch {
        // A partially initialized SDK does not yet own a camera to close.
      }
      if (!sdkOwnsCamera) return;

      try {
        sdk.close();
      } catch {
        // Camera Kit can report an already-closed camera during teardown.
      }
    };

    const releaseVideoBridge = () => {
      videoBridge?.stopOwnedTracks();
      videoBridge?.disconnect();
      videoBridge = null;
    };

    const teardown = (deferRuntimeGuardRemoval: boolean) => {
      if (closed) return;
      closed = true;
      clearStableTimer();
      clearPreviewTimers();
      pendingCapture = null;
      removeListeners();
      options.signal?.removeEventListener('abort', close);
      closeOpenedCamera();
      releaseVideoBridge();
      if (!cameraClosedDiagnosticSent) {
        cameraClosedDiagnosticSent = true;
        publishDiagnostic('camera-closed');
      }
      if (deferRuntimeGuardRemoval) {
        runtimeGuardRemovalTimer = hostWindow.setTimeout(
          removeRuntimeGuard,
          0,
        );
      } else {
        removeRuntimeGuard();
      }
      if (this.activeCancel === close) this.activeCancel = null;
      if (this.activeSessionId === sessionId) this.activeSessionId += 1;
      options.onStatus?.('closed');
    };

    const close = () => teardown(true);

    const fail = (failure: GuidedCaptureFailure) => {
      if (!isActive() || accepted) return;
      options.onFailure(failure);
      teardown(true);
    };

    function handleRuntimeError(event: ErrorEvent) {
      const failure = knownCameraKitRuntimeFailure(
        event.error ?? event.message,
      );
      if (!failure) return;
      event.preventDefault();
      if (isActive()) fail(failure);
    }

    function handleRuntimeRejection(event: PromiseRejectionEvent) {
      const failure = knownCameraKitRuntimeFailure(event.reason);
      if (!failure) return;
      event.preventDefault();
      if (isActive()) fail(failure);
    }

    const emitQuality = () => {
      if (!previewLive) return;
      quality = normalizeCameraKitQuality(
        latestPayload,
        resolutionAccepted,
      );
      if (quality.ready) {
        readySince ??= hostWindow.performance.now();
      } else {
        readySince = null;
        pendingCapture = null;
        clearStableTimer();
      }
      options.onQuality(quality);
      if (quality.ready && pendingCapture) acceptCapture();
    };

    const acceptCapture = () => {
      if (
        !isActive() ||
        accepted ||
        !previewLive ||
        !pendingCapture ||
        !quality.ready
      ) {
        return;
      }
      const elapsed =
        readySince === null
          ? 0
          : hostWindow.performance.now() - readySince;
      if (elapsed < stableForMs) {
        clearStableTimer();
        stableTimer = hostWindow.setTimeout(
          acceptCapture,
          Math.ceil(stableForMs - elapsed),
        );
        return;
      }

      const image = pendingCapture;
      pendingCapture = null;
      accepted = true;
      teardown(true);
      options.onStatus?.('captured');
      options.onCapture(image, profile.id);
    };

    const previewIsDrawn = (): boolean => {
      try {
        if (!sdk.isLoaded() || !videoBridge) return false;
        return !videoBridge.hasVideo() || videoBridge.hasLiveVideo();
      } catch {
        return false;
      }
    };

    const observePreviewReadiness = () => {
      if (!isActive() || previewLive || !cameraOpened) return;
      if (previewIsDrawn()) {
        previewLive = true;
        resolutionAccepted = true;
        clearPreviewTimers();
        emitQuality();
        publishDiagnostic('preview-live');
        options.onStatus?.('preview-live');
        return;
      }
      previewPollTimer = hostWindow.setTimeout(
        observePreviewReadiness,
        PREVIEW_POLL_MS,
      );
    };

    const beginPreviewReadiness = () => {
      clearPreviewTimers();
      previewWatchdogTimer = hostWindow.setTimeout(() => {
        if (!isActive() || previewLive || !cameraOpened) return;
        publishDiagnostic('preview-stalled');
        teardown(true);
        options.onStatus?.('preview-stalled');
        options.onFailure('preview-stalled');
      }, previewWatchdogMs);
      observePreviewReadiness();
    };

    const listen = (
      eventName: CameraKitEventName,
      listener: (payload: unknown) => void,
    ) => {
      listenerIds.push(
        sdk.addEventListener(eventName, (payload) => {
          if (isActive()) listener(payload);
        }),
      );
    };

    try {
      listen('loaded', () => {
        // SDK loading is diagnostic-only; it does not prove live frames.
      });
      listen('cameraOpened', () => {
        if (cameraOpened) return;
        cameraOpened = true;
        publishDiagnostic('camera-opened');
        options.onStatus?.('camera-opening');
        beginPreviewReadiness();
      });
      listen('cameraFailed', (payload) => {
        fail(normalizeCameraKitFailure(payload));
      });
      listen('unsupportedResolution', () => {
        resolutionAccepted = false;
        fail('unsupported-resolution');
      });
      listen('faceQualityChanged', (payload) => {
        latestPayload =
          typeof payload === 'object' && payload !== null
            ? (payload as CameraKitQualityPayload)
            : {};
        if (!firstQualityFrameSeen) {
          firstQualityFrameSeen = true;
          publishDiagnostic('first-quality-frame');
        }
        emitQuality();
      });
      listen('faceDetectionCaptured', (payload) => {
        publishDiagnostic('capture-event');
        if (!previewLive) return;
        try {
          pendingCapture = normalizeCameraKitCapture(
            (payload ?? {}) as CameraKitCapturePayload,
          );
          acceptCapture();
        } catch (error) {
          fail(
            error instanceof CameraKitCaptureError
              ? 'invalid-capture'
              : 'camera-unavailable',
          );
        }
      });

      options.signal?.addEventListener('abort', close, { once: true });
      if (options.signal?.aborted) {
        close();
        return { captureProfileId: profile.id, cancel: close };
      }

      hostWindow.addEventListener('error', handleRuntimeError, true);
      hostWindow.addEventListener(
        'unhandledrejection',
        handleRuntimeRejection,
        true,
      );
      runtimeGuardAttached = true;

      const rect = options.mountElement.getBoundingClientRect();
      options.mountElement.id = 'YMK-module';
      videoBridge = createSafariVideoBridge(options.mountElement);
      this.activeCancel = close;
      sdk.init({
        faceDetectionMode: profile.faceDetectionMode,
        imageFormat: profile.imageFormat,
        language: 'enu',
        qualityLevel: profile.qualityLevel,
        videoQuality: profile.videoQuality,
        countingDuration: stableForMs,
        hideFlipCameraButton: profile.hideFlipCameraButton,
        disableCameraResolutionCheck:
          profile.disableCameraResolutionCheck,
        width: boundedDimension(rect.width, 390),
        height: boundedDimension(rect.height, 520),
      });
      sdk.openCameraKit();
    } catch (error) {
      fail('sdk-unavailable');
      throw error;
    }

    return { captureProfileId: profile.id, cancel: close };
  }
}
