import { loadYouCamCameraKit } from './loader';
import { normalizeCameraKitCapture, CameraKitCaptureError } from './normalizeCapture';
import { emptyGuidedCaptureQuality, normalizeCameraKitQuality } from './quality';
import { selectCameraKitCaptureProfile } from './captureProfile';
import { logSafeCameraKitDiagnostic, type CameraKitDiagnosticSink } from './diagnostics';
import { createSafariVideoBridge, type SafariVideoBridge } from './safariVideoBridge';
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

const PREVIEW_WATCHDOG_MS = 20_000;
const PREVIEW_POLL_MS = 50;
const CAPTURE_EVENT_GRACE_MS = 1_200;

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
    record.error instanceof Error ? `${record.error.name} ${record.error.message}` : record.error,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' ')
    .toLowerCase();
};

export function normalizeCameraKitFailure(payload: unknown): GuidedCaptureFailure {
  const code = failureCode(payload);
  if (
    code.includes('permission') ||
    code.includes('notallowed') ||
    code.includes('denied access')
  ) {
    return 'permission-denied';
  }
  if (code.includes('resolution')) return 'unsupported-resolution';
  if (code.includes('unsupported') || code.includes('browser') || code.includes('getusermedia')) {
    return 'unsupported-browser';
  }
  return 'camera-unavailable';
}

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

  async start(options: GuidedCaptureStartOptions): Promise<GuidedCaptureSession> {
    this.activeCancel?.();
    this.activeCancel = null;
    const sessionId = ++this.activeSessionId;
    const profile = selectCameraKitCaptureProfile({
      frozenCaptureProfileId: options.frozenCaptureProfileId,
      navigatorObject: this.environment.navigatorObject,
      highResolutionProven: this.environment.highResolutionProven,
    });
    const stableForMs = Math.max(500, options.stableForMs ?? profile.countingDuration);
    const previewWatchdogMs = Math.max(100, options.previewWatchdogMs ?? PREVIEW_WATCHDOG_MS);
    const publishDiagnostic = (
      stage: CameraKitDiagnosticStage,
      surface?: ReturnType<SafariVideoBridge['getRenderSurface']>,
    ) => {
      const diagnostic = logSafeCameraKitDiagnostic(stage, profile.id, surface);
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
    let captureWatchdogTimer = 0;
    let previewPollTimer = 0;
    let previewWatchdogTimer = 0;
    let videoBridge: SafariVideoBridge | null = null;
    const listenerIds: CameraKitListenerIdentifier[] = [];
    const hostWindow = options.mountElement.ownerDocument.defaultView ?? window;

    const isActive = () =>
      !closed && !options.signal?.aborted && this.activeSessionId === sessionId;

    const clearStableTimer = () => {
      hostWindow.clearTimeout(stableTimer);
      stableTimer = 0;
    };

    const clearCaptureWatchdog = () => {
      hostWindow.clearTimeout(captureWatchdogTimer);
      captureWatchdogTimer = 0;
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
      videoBridge?.disconnect();
      videoBridge = null;
    };

    const teardown = () => {
      if (closed) return;
      closed = true;
      clearStableTimer();
      clearCaptureWatchdog();
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
      if (this.activeCancel === close) this.activeCancel = null;
      if (this.activeSessionId === sessionId) this.activeSessionId += 1;
      options.onStatus?.('closed');
    };

    const close = () => teardown();

    const fail = (failure: GuidedCaptureFailure) => {
      if (!isActive() || accepted) return;
      options.onFailure(failure);
      teardown();
    };

    const emitQuality = () => {
      if (!previewLive) return;
      quality = normalizeCameraKitQuality(latestPayload, resolutionAccepted);
      if (quality.ready) {
        if (readySince === null) {
          readySince = hostWindow.performance.now();
          clearCaptureWatchdog();
          captureWatchdogTimer = hostWindow.setTimeout(() => {
            if (isActive() && quality.ready && !accepted) {
              fail('invalid-capture');
            }
          }, stableForMs + CAPTURE_EVENT_GRACE_MS);
        }
      } else {
        readySince = null;
        pendingCapture = null;
        clearStableTimer();
        clearCaptureWatchdog();
      }
      options.onQuality(quality);
      if (quality.ready && pendingCapture) acceptCapture();
    };

    const acceptCapture = () => {
      if (!isActive() || accepted || !previewLive || !pendingCapture || !quality.ready) {
        return;
      }
      const elapsed = readySince === null ? 0 : hostWindow.performance.now() - readySince;
      if (elapsed < stableForMs) {
        clearStableTimer();
        stableTimer = hostWindow.setTimeout(acceptCapture, Math.ceil(stableForMs - elapsed));
        return;
      }

      const image = pendingCapture;
      pendingCapture = null;
      accepted = true;
      teardown();
      options.onStatus?.('captured');
      options.onCapture(image, profile.id);
    };

    const previewIsDrawn = (): boolean => {
      try {
        if (!videoBridge) return false;
        return videoBridge.hasLiveRenderSurface(sdk.isLoaded());
      } catch {
        return false;
      }
    };

    const observePreviewReadiness = () => {
      if (!isActive() || previewLive || !cameraOpened) return;
      if (previewIsDrawn()) {
        const surface = videoBridge?.getRenderSurface();
        previewLive = true;
        resolutionAccepted = true;
        clearPreviewTimers();
        emitQuality();
        if (surface) publishDiagnostic('render-surface-observed', surface);
        publishDiagnostic('preview-live', surface);
        options.onStatus?.('preview-live');
        return;
      }
      previewPollTimer = hostWindow.setTimeout(observePreviewReadiness, PREVIEW_POLL_MS);
    };

    const beginPreviewReadiness = () => {
      clearPreviewTimers();
      previewWatchdogTimer = hostWindow.setTimeout(() => {
        if (!isActive() || previewLive || !cameraOpened) return;
        publishDiagnostic('preview-stalled');
        options.onStatus?.('preview-stalled');
        fail('preview-stalled');
      }, previewWatchdogMs);
      observePreviewReadiness();
    };

    const listen = (eventName: CameraKitEventName, listener: (payload: unknown) => void) => {
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
        options.onStatus?.('waiting-first-frame');
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
          pendingCapture = normalizeCameraKitCapture((payload ?? {}) as CameraKitCapturePayload);
          acceptCapture();
        } catch (error) {
          fail(error instanceof CameraKitCaptureError ? 'invalid-capture' : 'camera-unavailable');
        }
      });

      options.signal?.addEventListener('abort', close, { once: true });
      if (options.signal?.aborted) {
        close();
        return { captureProfileId: profile.id, cancel: close };
      }

      const rect = options.mountElement.getBoundingClientRect();
      options.mountElement.id = 'YMK-module';
      videoBridge = createSafariVideoBridge(options.mountElement);
      this.activeCancel = close;
      publishDiagnostic('init-called');
      sdk.init({
        faceDetectionMode: profile.faceDetectionMode,
        imageFormat: profile.imageFormat,
        language: 'enu',
        qualityLevel: profile.qualityLevel,
        videoQuality: profile.videoQuality,
        countingDuration: stableForMs,
        hideFlipCameraButton: profile.hideFlipCameraButton,
        disableCameraResolutionCheck: profile.disableCameraResolutionCheck,
        width: boundedDimension(rect.width, 390),
        height: boundedDimension(rect.height, 520),
      });
      options.onStatus?.('requesting-permission');
      sdk.openCameraKit();
    } catch (error) {
      fail('sdk-unavailable');
      throw error;
    }

    return { captureProfileId: profile.id, cancel: close };
  }
}
