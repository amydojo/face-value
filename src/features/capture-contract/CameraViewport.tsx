import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { YouCamProviderError } from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import {
  analyzeLongitudinalCapture,
  LocalProtocolMismatchError,
} from '../../adapters/analysis/youcam/longitudinalAnalysis';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import { metadataForCapture, ObjectUrlRegistry } from '../../adapters/camera/browserCamera';
import {
  createCameraKitAdapter,
  type CameraKitAdapter,
  type GuidedCaptureFailure,
  type GuidedCaptureSession,
} from '../../adapters/camera/youcam-camera-kit';
import type { CameraFailureReason } from '../../adapters/camera/browserCamera';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import type {
  CameraCaptureProfileId,
  CameraState,
  CaptureKind,
  CaptureMetadata,
} from '../../domain/model';
import { isYouCamProtocolEligible } from '../../domain/phaseB5';
import { logSafeAnalysisDiagnostic, translateProviderError } from '../../domain/youcamEvidence';
import {
  CAMERA_KIT_ACQUISITION_MS,
  CaptureSequence,
  createCaptureSequenceState,
  getNextCaptureSequenceDeadline,
  reduceCaptureSequence,
  type CaptureSequenceEvent,
  type CaptureSequenceState,
} from '../capture-sequence';
import styles from '../../styles/FaceValue.module.css';

const requestIdentity = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `analysis-${systemClock.now().replace(/\D/g, '')}-${Math.random().toString(36).slice(2)}`;

const legacyFailureReason = (failure: GuidedCaptureFailure): CameraFailureReason => {
  if (failure === 'permission-denied') return 'denied';
  if (failure === 'unsupported-browser' || failure === 'sdk-unavailable') {
    return 'unsupported';
  }
  if (failure === 'unsupported-resolution') return 'overconstrained';
  if (failure === 'camera-unavailable') return 'no_camera';
  return 'unknown';
};

const failureForCameraState = (cameraState: CameraState): GuidedCaptureFailure | null => {
  if (cameraState === 'denied') return 'permission-denied';
  if (cameraState === 'unsupported') return 'unsupported-browser';
  if (cameraState === 'no_camera') return 'camera-unavailable';
  if (cameraState === 'overconstrained') return 'unsupported-resolution';
  if (cameraState === 'error') return 'camera-unavailable';
  return null;
};

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());

function initialSequenceState(cameraState: CameraState): CaptureSequenceState {
  const at = now();
  const state = createCaptureSequenceState(at);
  const failure = failureForCameraState(cameraState);
  return failure ? reduceCaptureSequence(state, { type: 'FAILED', failure, at }) : state;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

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
  const reducedMotion = useReducedMotion();
  const reducer = useMemo(
    () => (current: CaptureSequenceState, event: CaptureSequenceEvent) =>
      reduceCaptureSequence(current, event, { reducedMotion }),
    [reducedMotion],
  );
  const [sequence, sendSequence] = useReducer(reducer, cameraState, initialSequenceState);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const sessionRef = useRef<GuidedCaptureSession | null>(null);
  const adapterRef = useRef<CameraKitAdapter | null>(null);
  adapterRef.current ??= cameraAdapter ?? createCameraKitAdapter();
  const providerRef = useRef(createSkinAnalysisProvider());
  const objectUrlsRef = useRef(new ObjectUrlRegistry());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingCaptureRef = useRef<PendingCapture | null>(null);
  const currentCaptureUrlRef = useRef<string | null>(null);
  const previousSequencePhaseRef = useRef(sequence.phase);
  const runInFlightRef = useRef(false);
  const startInFlightRef = useRef(false);
  const analysisStartedForCaptureRef = useRef(false);
  const hapticSentRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restartCameraRef = useRef<HTMLButtonElement | null>(null);
  const retryAnalysisRef = useRef<HTMLButtonElement | null>(null);
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
  const [captureStarted, setCaptureStarted] = useState(false);
  const [previewLive, setPreviewLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [fixture, setFixture] = useState(false);

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
      dispatch({
        type: kind === 'baseline' ? 'BASELINE_ANALYSIS_STARTED' : 'FOLLOWUP_ANALYSIS_STARTED',
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
          stage: caught instanceof LocalProtocolMismatchError ? 'protocol-preflight' : 'provider',
          role: kind,
          outcome: 'failed',
          code,
        });
        if (caught instanceof LocalProtocolMismatchError) {
          dispatch({ type: 'COMPARISON_REJECTED', error });
        } else {
          dispatch({
            type: kind === 'baseline' ? 'BASELINE_ANALYSIS_FAILED' : 'FOLLOWUP_ANALYSIS_FAILED',
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
    objectUrlsRef.current.revokeAll();
    currentCaptureUrlRef.current = null;
    pendingCaptureRef.current = null;
    analysisStartedForCaptureRef.current = false;
    hapticSentRef.current = false;
    setCaptureStarted(true);
    setPreviewLive(false);
    setStarting(true);
    setFixture(false);
    sendSequence({ type: 'RESET', at: now() });
    callbacksRef.current.onRequesting();

    try {
      const session = await adapterRef.current!.start({
        mountElement,
        stableForMs: CAMERA_KIT_ACQUISITION_MS,
        frozenCaptureProfileId:
          kind === 'followup' ? (stateRef.current.baselineCapture?.cameraProfileId ?? null) : null,
        onQuality: (nextQuality) => {
          sendSequence({
            type: 'SIGNALS_RECEIVED',
            sample: nextQuality,
            at: now(),
          });
        },
        onCapture: (image, cameraProfileId) => {
          const imageUrl = objectUrlsRef.current.create(image);
          currentCaptureUrlRef.current = imageUrl;
          pendingCaptureRef.current = {
            image,
            source: 'camera',
            fileName: `${kind}-camera-kit.jpg`,
            cameraProfileId,
          };
          callbacksRef.current.onCapturing();
          sendSequence({
            type: 'CAPTURE_AVAILABLE',
            image: imageUrl,
            at: now(),
          });
        },
        onFailure: (nextFailure) => {
          setPreviewLive(false);
          setStarting(false);
          sendSequence({
            type: 'FAILED',
            failure: nextFailure,
            at: now(),
          });
          callbacksRef.current.onFailure(legacyFailureReason(nextFailure));
        },
        onStatus: (status) => {
          if (status === 'camera-opening') setStarting(true);
          if (status === 'preview-live') {
            setPreviewLive(true);
            setStarting(false);
            callbacksRef.current.onReady();
          }
        },
      });
      sessionRef.current = session;
      setFixture(mountElement.dataset.cameraKitFixture === 'active');
    } catch {
      setStarting(false);
      sendSequence({
        type: 'FAILED',
        failure: 'sdk-unavailable',
        at: now(),
      });
    } finally {
      startInFlightRef.current = false;
    }
  }, [kind]);

  useEffect(() => {
    const deadline = getNextCaptureSequenceDeadline(sequence, {
      reducedMotion,
    });
    if (deadline === null) return;
    const timer = window.setTimeout(
      () => sendSequence({ type: 'TICK', at: now() }),
      Math.max(1, Math.ceil(deadline - now())),
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, sequence]);

  useEffect(() => {
    const previousPhase = previousSequencePhaseRef.current;
    previousSequencePhaseRef.current = sequence.phase;
    const cancelledLock =
      (previousPhase === 'locking' || previousPhase === 'scanning') &&
      (sequence.phase === 'aligning' || sequence.phase === 'searching');
    if (!cancelledLock) return;
    const imageUrl = currentCaptureUrlRef.current;
    if (imageUrl) objectUrlsRef.current.revoke(imageUrl);
    currentCaptureUrlRef.current = null;
    pendingCaptureRef.current = null;
    analysisStartedForCaptureRef.current = false;
  }, [sequence.phase]);

  useEffect(() => {
    if (sequence.phase !== 'captured' || hapticSentRef.current) return;
    hapticSentRef.current = true;
    try {
      navigator.vibrate?.(10);
    } catch {
      // Haptics are optional and unsupported on iOS Safari.
    }
  }, [sequence.phase]);

  useEffect(() => {
    const pending = pendingCaptureRef.current;
    if (!sequence.handoffReady || !pending || analysisStartedForCaptureRef.current) {
      return;
    }
    analysisStartedForCaptureRef.current = true;
    void analyzeCapture(pending);
  }, [analyzeCapture, sequence.handoffReady]);

  useEffect(() => {
    if (!captureStarted) return;
    if (typeof screenRef.current?.scrollTo === 'function') {
      screenRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    const priorOverflow = document.body.style.overflow;
    const priorOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = priorOverflow;
      document.body.style.overscrollBehavior = priorOverscroll;
    };
  }, [captureStarted]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
      startInFlightRef.current = false;
      cancelAnalysis();
      pendingCaptureRef.current = null;
      currentCaptureUrlRef.current = null;
      objectUrls.revokeAll();
    };
  }, [cancelAnalysis]);

  const chooseFile = (file: File | undefined) => {
    if (!file || runInFlightRef.current) return;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setPreviewLive(false);
    setStarting(false);
    analysisStartedForCaptureRef.current = true;
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
    currentCaptureUrlRef.current = null;
    objectUrlsRef.current.revokeAll();
    callbacksRef.current.onBack();
  };

  const analysisError = state.analysisError?.role === kind ? state.analysisError : null;
  const isAnalyzing = state.processing === 'running' && state.analysisRole === kind;
  const failed = sequence.phase === 'error';

  useEffect(() => {
    const target = analysisError
      ? retryAnalysisRef.current
      : sequence.failure === 'preview-stalled'
        ? restartCameraRef.current
        : failed
          ? fileInputRef.current
          : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [analysisError, failed, sequence.failure]);

  return (
    <section
      ref={screenRef}
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
      <div className={styles.captureRouteBar}>
        <button type="button" className={styles.textButton} onClick={leave}>
          ← Back
        </button>
        <p className={styles.eyebrow}>
          {kind === 'baseline' ? 'GUIDED BASELINE' : 'GUIDED FOLLOW-UP'}
        </p>
      </div>

      <CaptureSequence
        state={sequence}
        accession={accession}
        product={product}
        job={job}
        mountRef={mountRef}
        fixture={fixture}
        previewLive={previewLive}
        reducedMotion={reducedMotion}
      />

      {!isAnalyzing && (!captureStarted || failed) && (
        <button
          ref={sequence.failure === 'preview-stalled' ? restartCameraRef : null}
          type="button"
          className={styles.captureStartAction}
          disabled={starting}
          onClick={startGuidedCapture}
        >
          {starting
            ? 'OPENING CAMERA'
            : sequence.failure === 'preview-stalled'
              ? 'RESTART CAMERA'
              : failed
                ? 'TRY CAMERA AGAIN'
                : captureStarted
                  ? 'TRY CAMERA AGAIN'
                  : 'START GUIDED CAPTURE'}
        </button>
      )}

      {analysisError && (
        <div className={styles.notice} role="alert">
          <strong>We couldn’t read this scan.</strong>
          <p>{analysisError.message}</p>
          <p>Your image was not saved. Your existing trial is safe.</p>
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

      <label className={styles.captureFileFallback}>
        USE AN EXISTING PHOTO
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
      <p className={styles.capturePrivacyLine}>
        The image is analyzed in memory and discarded. Face images are never added to your trial or
        Evidence Record.
      </p>
    </section>
  );
}
