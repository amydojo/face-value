import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { YouCamProviderError } from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import {
  analyzeLongitudinalCapture,
  LocalProtocolMismatchError,
} from '../../adapters/analysis/youcam/longitudinalAnalysis';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import { metadataForCapture } from '../../adapters/camera/browserCamera';
import {
  createCameraKitAdapter,
  emptyGuidedCaptureQuality,
  type CameraKitAdapter,
  type GuidedCaptureFailure,
  type GuidedCaptureQuality,
  type GuidedCaptureSession,
} from '../../adapters/camera/youcam-camera-kit';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import type {
  CameraCaptureProfileId,
  CameraState,
  CaptureKind,
  CaptureMetadata,
} from '../../domain/model';
import { isYouCamProtocolEligible } from '../../domain/phaseB5';
import {
  logSafeAnalysisDiagnostic,
  translateProviderError,
} from '../../domain/youcamEvidence';
import styles from '../../styles/FaceValue.module.css';
import type { CameraFailureReason } from '../../adapters/camera/browserCamera';

const failureCopy: Record<GuidedCaptureFailure, {
  heading: string;
  body: string;
}> = {
  'sdk-unavailable': {
    heading: 'Guided capture is unavailable.',
    body: 'Choose a photo to continue. Your trial has not changed.',
  },
  'unsupported-browser': {
    heading: 'Guided capture is unavailable.',
    body: 'Choose a photo to continue. Your trial has not changed.',
  },
  'permission-denied': {
    heading: 'Camera access is off.',
    body: 'Allow camera access or choose a photo instead.',
  },
  'camera-unavailable': {
    heading: 'Guided capture is unavailable.',
    body: 'Choose a photo to continue. Your trial has not changed.',
  },
  'preview-stalled': {
    heading: 'The camera preview did not start.',
    body: 'Restart the camera or choose a photo instead. Your trial has not changed.',
  },
  'unsupported-resolution': {
    heading: 'This camera cannot create the required scan.',
    body: 'Choose a higher-resolution photo instead.',
  },
  'invalid-capture': {
    heading: 'This camera cannot create the required scan.',
    body: 'Choose a higher-resolution photo instead.',
  },
};

const guidanceCopy: Record<GuidedCaptureQuality['guidance'], string> = {
  'center-face': 'Center your face.',
  'move-closer': 'Move closer. Your face needs to fill more of the frame.',
  'move-back': 'Move back slightly.',
  'look-forward': 'Look straight ahead.',
  'more-light': 'Find more even light.',
  'hold-still': 'Hold still…',
  ready: 'Capture accepted.',
};

const requestIdentity = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `analysis-${systemClock.now().replace(/\D/g, '')}-${Math.random().toString(36).slice(2)}`;

const legacyFailureReason = (
  failure: GuidedCaptureFailure,
): CameraFailureReason => {
  if (failure === 'permission-denied') return 'denied';
  if (failure === 'unsupported-browser' || failure === 'sdk-unavailable') {
    return 'unsupported';
  }
  if (failure === 'unsupported-resolution') return 'overconstrained';
  return 'unknown';
};

interface PendingCapture {
  image: Blob;
  source: 'camera' | 'file';
  fileName: string;
  cameraProfileId: CameraCaptureProfileId | null;
}

export function CameraViewport({
  kind,
  accession = 'SPECIMEN 01',
  product = 'Active specimen',
  job = 'Active observation',
  cameraState,
  onRequesting,
  onReady,
  onCapturing,
  onFailure,
  onAccepted,
  onDelete,
  onBack,
  cameraAdapter,
}: {
  kind: CaptureKind;
  accession?: string;
  product?: string;
  job?: string | null;
  cameraState: CameraState;
  onRequesting: () => void;
  onReady: () => void;
  onCapturing: () => void;
  onFailure: (reason: CameraFailureReason) => void;
  onAccepted: (metadata: CaptureMetadata) => void;
  onDelete: () => void;
  onBack: () => void;
  cameraAdapter?: CameraKitAdapter;
}) {
  const { state, dispatch } = useFaceValue();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<GuidedCaptureSession | null>(null);
  const adapterRef = useRef<CameraKitAdapter | null>(null);
  adapterRef.current ??= cameraAdapter ?? createCameraKitAdapter();
  const providerRef = useRef(createSkinAnalysisProvider());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingCaptureRef = useRef<PendingCapture | null>(null);
  const runInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restartCameraRef = useRef<HTMLButtonElement | null>(null);
  const retryAnalysisRef = useRef<HTMLButtonElement | null>(null);
  const announcedGuidanceRef = useRef<GuidedCaptureQuality['guidance'] | null>(
    null,
  );
  const readyReportedRef = useRef(false);
  const stateRef = useRef(state);
  const callbacksRef = useRef({
    onRequesting,
    onReady,
    onCapturing,
    onFailure,
    onAccepted,
    onDelete,
    onBack,
  });
  const [quality, setQuality] = useState<GuidedCaptureQuality>(
    emptyGuidedCaptureQuality,
  );
  const [failure, setFailure] = useState<GuidedCaptureFailure | null>(null);
  const [captureAnnouncement, setCaptureAnnouncement] = useState(
    'Start guided capture when you are ready.',
  );
  const [captureStarted, setCaptureStarted] = useState(false);
  const [previewLive, setPreviewLive] = useState(false);
  const [starting, setStarting] = useState(false);

  stateRef.current = state;
  callbacksRef.current = {
    onRequesting,
    onReady,
    onCapturing,
    onFailure,
    onAccepted,
    onDelete,
    onBack,
  };

  const cancelAnalysis = useCallback(() => {
    const requestId = activeRequestIdRef.current;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeRequestIdRef.current = null;
    runInFlightRef.current = false;
    if (requestId) {
      dispatch({ type: 'ANALYSIS_CANCELLED', requestId });
      logSafeAnalysisDiagnostic({
        stage: 'cancelled',
        role: kind,
        outcome: 'cancelled',
      });
    }
  }, [dispatch, kind]);

  const analyzeCapture = useCallback(
    async (pending: PendingCapture) => {
      if (runInFlightRef.current) return;
      pendingCaptureRef.current = pending;
      const current = stateRef.current;
      const metadata = metadataForCapture(
        kind,
        pending.source,
        pending.image.type,
        systemClock.now(),
        pending.cameraProfileId,
      );

      if (!isYouCamProtocolEligible(current.registeredProduct)) {
        callbacksRef.current.onAccepted(metadata);
        pendingCaptureRef.current = null;
        return;
      }

      if (kind === 'baseline' && current.processing === 'failed') {
        dispatch({ type: 'BASELINE_RETRY_REQUESTED' });
      }

      const requestId = requestIdentity();
      const controller = new AbortController();
      runInFlightRef.current = true;
      abortControllerRef.current = controller;
      activeRequestIdRef.current = requestId;
      setCaptureAnnouncement('Capture accepted. Analysis begins now.');
      dispatch({
        type:
          kind === 'baseline'
            ? 'BASELINE_ANALYSIS_STARTED'
            : 'FOLLOWUP_ANALYSIS_STARTED',
        requestId,
        metadata,
      });
      logSafeAnalysisDiagnostic({
        stage: 'started',
        role: kind,
        outcome: 'started',
      });

      try {
        const analyzed = await analyzeLongitudinalCapture({
          provider: providerRef.current,
          role: kind,
          image: pending.image,
          fileName: pending.fileName,
          metadata,
          frozenProtocol: current.longitudinalEvidence.protocol,
          signal: controller.signal,
        });

        if (activeRequestIdRef.current !== requestId) {
          pendingCaptureRef.current = null;
          logSafeAnalysisDiagnostic({
            stage: 'completion',
            role: kind,
            outcome: 'stale-response-ignored',
          });
          return;
        }

        activeRequestIdRef.current = null;
        abortControllerRef.current = null;
        pendingCaptureRef.current = null;
        if (kind === 'baseline') {
          dispatch({
            type: 'BASELINE_ANALYSIS_ACCEPTED',
            requestId,
            protocol: analyzed.protocol,
            signal: analyzed.durableSignal,
          });
        } else {
          dispatch({
            type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
            requestId,
            signal: analyzed.durableSignal,
          });
        }
        logSafeAnalysisDiagnostic({
          stage: 'normalized',
          role: kind,
          outcome: 'accepted',
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          dispatch({ type: 'ANALYSIS_CANCELLED', requestId });
          return;
        }

        const code =
          caught instanceof LocalProtocolMismatchError
            ? caught.code
            : caught instanceof YouCamProviderError
              ? caught.code
              : caught instanceof TypeError
                ? 'network_interrupted'
              : 'unknown_provider_failure';
        const error = translateProviderError(code, kind);
        logSafeAnalysisDiagnostic({
          stage:
            caught instanceof LocalProtocolMismatchError
              ? 'protocol-preflight'
              : 'provider',
          role: kind,
          outcome: 'failed',
          code,
        });
        if (caught instanceof LocalProtocolMismatchError) {
          dispatch({ type: 'COMPARISON_REJECTED', error });
        } else {
          dispatch({
            type:
              kind === 'baseline'
                ? 'BASELINE_ANALYSIS_FAILED'
                : 'FOLLOWUP_ANALYSIS_FAILED',
            requestId,
            error,
          });
        }
      } finally {
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current = null;
        }
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        runInFlightRef.current = false;
      }
    },
    [dispatch, kind],
  );

  const startGuidedCapture = useCallback(async () => {
    if (startInFlightRef.current || runInFlightRef.current) return;
    const mountElement = mountRef.current;
    if (!mountElement) return;
    startInFlightRef.current = true;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setFailure(null);
    setQuality(emptyGuidedCaptureQuality());
    setCaptureAnnouncement('Opening camera…');
    announcedGuidanceRef.current = null;
    readyReportedRef.current = false;
    setCaptureStarted(true);
    setPreviewLive(false);
    setStarting(true);
    callbacksRef.current.onRequesting();

    try {
      const session = await adapterRef.current!.start({
        mountElement,
        stableForMs: 800,
        frozenCaptureProfileId:
          kind === 'followup'
            ? stateRef.current.baselineCapture?.cameraProfileId ?? null
            : null,
        onQuality: (nextQuality) => {
          setQuality((current) =>
            JSON.stringify(current) === JSON.stringify(nextQuality)
              ? current
              : nextQuality,
          );
          if (announcedGuidanceRef.current !== nextQuality.guidance) {
            announcedGuidanceRef.current = nextQuality.guidance;
            setCaptureAnnouncement(guidanceCopy[nextQuality.guidance]);
          }
          if (nextQuality.ready && !readyReportedRef.current) {
            readyReportedRef.current = true;
            callbacksRef.current.onCapturing();
          }
        },
        onCapture: (image, cameraProfileId) => {
          callbacksRef.current.onCapturing();
          void analyzeCapture({
            image,
            source: 'camera',
            fileName: `${kind}-camera-kit.jpg`,
            cameraProfileId,
          });
        },
        onFailure: (nextFailure) => {
          setFailure(nextFailure);
          setPreviewLive(false);
          setStarting(false);
          setCaptureAnnouncement(
            nextFailure === 'preview-stalled'
              ? 'Camera preview stalled. Restart the camera or choose a photo.'
              : failureCopy[nextFailure].heading,
          );
          callbacksRef.current.onFailure(
            legacyFailureReason(nextFailure),
          );
        },
        onStatus: (status) => {
          if (status === 'camera-opening') {
            setStarting(true);
          }
          if (status === 'preview-live') {
            setPreviewLive(true);
            setStarting(false);
            setCaptureAnnouncement('Camera preview is live. Center your face.');
            callbacksRef.current.onReady();
          }
        },
      });
      sessionRef.current = session;
    } catch {
      setStarting(false);
      setFailure((current) => current ?? 'sdk-unavailable');
    } finally {
      startInFlightRef.current = false;
    }
  }, [analyzeCapture, kind]);

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      startInFlightRef.current = false;
      cancelAnalysis();
      pendingCaptureRef.current = null;
    };
  }, [cancelAnalysis]);

  const chooseFile = (file: File | undefined) => {
    if (!file || runInFlightRef.current) return;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setPreviewLive(false);
    setStarting(false);
    setCaptureAnnouncement('Photo selected. Analysis begins now.');
    void analyzeCapture({
      image: file,
      source: 'file',
      fileName: file.name,
      cameraProfileId: null,
    });
  };

  const retryAnalysis = () => {
    const pending = pendingCaptureRef.current;
    if (!pending || runInFlightRef.current) return;
    void analyzeCapture(pending);
  };

  const leave = () => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    startInFlightRef.current = false;
    cancelAnalysis();
    pendingCaptureRef.current = null;
    callbacksRef.current.onBack();
  };

  const analysisError =
    state.analysisError?.role === kind ? state.analysisError : null;
  const isAnalyzing =
    state.processing === 'running' && state.analysisRole === kind;

  useEffect(() => {
    const target = analysisError
      ? retryAnalysisRef.current
      : failure === 'preview-stalled'
        ? restartCameraRef.current
        : failure
        ? fileInputRef.current
        : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [analysisError, failure]);

  return (
    <section
      className={styles.cameraScreen}
      aria-labelledby="camera-heading"
      data-camera-state={cameraState}
      data-preview-state={
        previewLive
          ? 'preview-live'
          : starting
            ? 'camera-opening'
            : captureStarted
              ? 'camera-stopped'
              : 'not-started'
      }
    >
      <button type="button" className={styles.textButton} onClick={leave}>
        ← Back
      </button>
      <div
        className={styles.captureIdentity}
        aria-label={`${accession}, ${product}, ${job ?? 'job unassigned'}`}
      >
        <span>{accession}</span>
        <strong>{product}</strong>
        <small>{job ?? 'JOB UNASSIGNED'}</small>
      </div>
      <p className={styles.eyebrow}>
        {kind === 'baseline' ? 'GUIDED BASELINE' : 'GUIDED FOLLOW-UP'}
      </p>
      <h1 id="camera-heading" data-stage-focus tabIndex={-1}>
        Center your face
      </h1>

      {!isAnalyzing && !captureStarted && !failure && (
        <button
          type="button"
          className={styles.primaryAction}
          disabled={starting}
          onClick={startGuidedCapture}
        >
          START GUIDED CAPTURE
        </button>
      )}

      <div className={styles.guidedCaptureFrame}>
        <div
          ref={mountRef}
          className={styles.cameraKitMount}
          aria-label="Private guided face capture"
        />
        <div className={styles.faceGuide} aria-hidden="true" />
        <dl className={styles.captureQuality} aria-label="Capture quality">
          <div data-accepted={quality.hasFace}>
            <dt>FACE</dt>
            <dd>{quality.hasFace ? '✓' : '—'}</dd>
          </div>
          <div
            data-accepted={
              quality.positionAccepted && quality.frontalAccepted
            }
          >
            <dt>POSITION</dt>
            <dd>
              {quality.positionAccepted && quality.frontalAccepted ? '✓' : '—'}
            </dd>
          </div>
          <div data-accepted={quality.lightingAccepted}>
            <dt>LIGHT</dt>
            <dd>{quality.lightingAccepted ? '✓' : '—'}</dd>
          </div>
        </dl>
      </div>

      <p className={styles.captureGuidance} aria-hidden="true">
        {isAnalyzing
          ? kind === 'baseline'
            ? 'Securing baseline…'
            : 'Securing follow-up…'
          : starting
            ? 'Opening camera…'
            : previewLive
              ? guidanceCopy[quality.guidance]
              : captureStarted
                ? 'Camera is stopped.'
                : 'Start guided capture when you are ready.'}
      </p>
      <div
        className={styles.guidanceLiveRegion}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {captureAnnouncement}
      </div>

      {failure && (
        <div className={styles.notice} role="alert">
          <strong>{failureCopy[failure].heading}</strong>
          <p>{failureCopy[failure].body}</p>
        </div>
      )}
      {analysisError && (
        <div className={styles.notice} role="alert">
          <strong>We couldn’t read this scan.</strong>
          <p>{analysisError.message}</p>
          <p>
            Your image was not saved. Your existing trial is safe.
          </p>
          {pendingCaptureRef.current && (
            <button
              ref={retryAnalysisRef}
              type="button"
              className={styles.secondaryAction}
              disabled={isAnalyzing}
              onClick={retryAnalysis}
            >
              TRY AGAIN
            </button>
          )}
        </div>
      )}

      {!isAnalyzing &&
        failure === 'preview-stalled' && (
          <button
            ref={restartCameraRef}
            type="button"
            className={styles.primaryAction}
            disabled={starting}
            onClick={startGuidedCapture}
          >
            RESTART CAMERA
          </button>
        )}

      <label className={styles.fileFallback}>
        CHOOSE A PHOTO INSTEAD
        <input
          ref={fileInputRef}
          aria-label="Choose a face photo"
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          capture="user"
          disabled={isAnalyzing}
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </label>
      <p className={styles.privacyLine}>
        The image is analyzed in memory and discarded. Face images are never
        added to your trial or Evidence Record.
      </p>
    </section>
  );
}
