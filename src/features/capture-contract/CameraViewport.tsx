import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { YouCamProviderError } from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import { LocalProtocolMismatchError } from '../../adapters/analysis/youcam/longitudinalAnalysis';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import {
  analyzeRednessBurstFrames,
  RednessBurstProviderFailure,
  type EphemeralRednessFrame,
} from '../../adapters/analysis/youcam/rednessBurstAnalysis';
import { metadataForCapture, ObjectUrlRegistry } from '../../adapters/camera/browserCamera';
import type { CameraFailureReason } from '../../adapters/camera/browserCamera';
import {
  createCameraKitAdapter,
  type CameraKitAdapter,
  type CameraKitDiagnostic,
  type GuidedCaptureFailure,
  type GuidedCaptureSession,
  type GuidedCaptureStatus,
} from '../../adapters/camera/youcam-camera-kit';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import type {
  AnalysisErrorState,
  CameraState,
  CaptureKind,
  CaptureMetadata,
} from '../../domain/model';
import {
  REDNESS_BURST_FINALIZATION_MS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../domain/rednessEvidenceBurst';
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

const identity = (prefix: string): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${prefix}-${systemClock.now().replace(/\D/g, '')}-${Math.random().toString(36).slice(2)}`;

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

class EphemeralBurstFrameRegistry {
  private readonly frames = new Map<string, EphemeralRednessFrame>();

  add(frame: EphemeralRednessFrame): boolean {
    if (this.frames.has(frame.frameId)) return false;
    this.frames.set(frame.frameId, frame);
    return true;
  }

  values(): EphemeralRednessFrame[] {
    return [...this.frames.values()];
  }

  get size(): number {
    return this.frames.size;
  }

  release(frameId: string): void {
    this.frames.delete(frameId);
  }

  releaseAll(): void {
    this.frames.clear();
  }
}

interface ActiveGeneration {
  id: string;
  controller: AbortController;
}

function analysisErrorFor(error: unknown, role: CaptureKind): AnalysisErrorState {
  const code =
    error instanceof LocalProtocolMismatchError
      ? error.code
      : error instanceof YouCamProviderError
        ? error.code
        : error instanceof TypeError
          ? 'network_interrupted'
          : 'unknown_provider_failure';
  return translateProviderError(code, role);
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const sessionRef = useRef<GuidedCaptureSession | null>(null);
  const adapterRef = useRef<CameraKitAdapter | null>(null);
  adapterRef.current ??= cameraAdapter ?? createCameraKitAdapter();
  const providerRef = useRef(createSkinAnalysisProvider());
  const objectUrlsRef = useRef(new ObjectUrlRegistry());
  const frameRegistryRef = useRef(new EphemeralBurstFrameRegistry());
  const activeGenerationRef = useRef<ActiveGeneration | null>(null);
  const currentCaptureUrlRef = useRef<string | null>(null);
  const currentCaptureFrameIdRef = useRef<string | null>(null);
  const previousSequencePhaseRef = useRef(sequence.phase);
  const startInFlightRef = useRef(false);
  const analysisStartedRef = useRef(false);
  const hapticSentRef = useRef(false);
  const captureRequestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const restartCameraRef = useRef<HTMLButtonElement | null>(null);
  const retryBurstRef = useRef<HTMLButtonElement | null>(null);
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
  const [fileLimitation, setFileLimitation] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<GuidedCaptureStatus | 'idle'>('idle');
  const diagnosticMode =
    import.meta.env.DEV &&
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('camera-kit-diagnostics') === '1';
  const [cameraDiagnostics, setCameraDiagnostics] = useState<CameraKitDiagnostic[]>([]);

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

  const releaseCapturedResources = useCallback(() => {
    frameRegistryRef.current.releaseAll();
    currentCaptureFrameIdRef.current = null;
    currentCaptureUrlRef.current = null;
    objectUrlsRef.current.revokeAll();
  }, []);

  const cancelActiveGeneration = useCallback(
    (notifyReducer: boolean) => {
      const active = activeGenerationRef.current;
      activeGenerationRef.current = null;
      active?.controller.abort();
      sessionRef.current?.cancel();
      sessionRef.current = null;
      startInFlightRef.current = false;
      analysisStartedRef.current = false;
      captureRequestedRef.current = false;
      releaseCapturedResources();
      if (notifyReducer && active) {
        dispatch({ type: 'REDNESS_BURST_CANCELLED', generationId: active.id });
        logSafeAnalysisDiagnostic({
          stage: 'cancelled',
          role: kind,
          outcome: 'cancelled',
        });
      }
    },
    [dispatch, kind, releaseCapturedResources],
  );

  const failBurst = useCallback(
    (generationId: string, error: AnalysisErrorState) => {
      dispatch({
        type: 'REDNESS_BURST_FAILED',
        generationId,
        error,
      });
      const active = activeGenerationRef.current;
      if (active?.id === generationId) {
        active.controller.abort();
        activeGenerationRef.current = null;
      }
      sessionRef.current?.cancel();
      sessionRef.current = null;
      releaseCapturedResources();
    },
    [dispatch, releaseCapturedResources],
  );

  const analyzeBurst = useCallback(
    async (generation: ActiveGeneration) => {
      const frames = frameRegistryRef.current.values();
      try {
        await analyzeRednessBurstFrames({
          provider: providerRef.current,
          role: kind,
          frames,
          frozenProtocol: stateRef.current.longitudinalEvidence.protocol,
          generationId: generation.id,
          signal: generation.controller.signal,
          requestIdFactory: (frameId, attempt) =>
            `${identity('analysis')}-${frameId}-attempt-${attempt}`,
          releaseFrame: (frameId) => {
            frameRegistryRef.current.release(frameId);
            if (currentCaptureFrameIdRef.current === frameId) {
              const url = currentCaptureUrlRef.current;
              if (url) objectUrlsRef.current.revoke(url);
              currentCaptureUrlRef.current = null;
              currentCaptureFrameIdRef.current = null;
            }
          },
          onRequestStarted: ({ generationId, frameId, requestId, attempt }) => {
            if (activeGenerationRef.current?.id !== generationId) return;
            dispatch({
              type: 'REDNESS_BURST_ANALYSIS_STARTED',
              generationId,
              frameId,
              requestId,
              attempt,
            });
            logSafeAnalysisDiagnostic({
              stage: 'started',
              role: kind,
              outcome: 'started',
            });
          },
          onRequestFailed: ({ generationId, frameId, requestId, attempt, terminal, error }) => {
            if (activeGenerationRef.current?.id !== generationId) return;
            const translated = analysisErrorFor(error, kind);
            dispatch({
              type: 'REDNESS_BURST_ANALYSIS_FAILED',
              generationId,
              frameId,
              requestId,
              attempt,
              terminal,
              error: translated,
            });
            logSafeAnalysisDiagnostic({
              stage:
                error instanceof LocalProtocolMismatchError ? 'protocol-preflight' : 'provider',
              role: kind,
              outcome: terminal ? 'failed' : 'retrying',
              code: translated.code,
            });
          },
          onRequestAccepted: ({ generationId, frameId, requestId, attempt, protocol, signal }) => {
            if (activeGenerationRef.current?.id !== generationId) {
              logSafeAnalysisDiagnostic({
                stage: 'completion',
                role: kind,
                outcome: 'stale-response-ignored',
              });
              return;
            }
            dispatch({
              type: 'REDNESS_BURST_ANALYSIS_ACCEPTED',
              generationId,
              frameId,
              requestId,
              attempt,
              protocol,
              signal,
            });
            logSafeAnalysisDiagnostic({
              stage: 'normalized',
              role: kind,
              outcome: 'accepted',
            });
          },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (activeGenerationRef.current?.id !== generation.id) return;
        if (error instanceof LocalProtocolMismatchError) {
          dispatch({
            type: 'COMPARISON_REJECTED',
            error: analysisErrorFor(error, kind),
          });
          activeGenerationRef.current = null;
          return;
        }
        if (!(error instanceof RednessBurstProviderFailure)) {
          failBurst(generation.id, analysisErrorFor(error, kind));
        }
      }
    },
    [dispatch, failBurst, kind],
  );

  const startGuidedCapture = useCallback(async () => {
    if (startInFlightRef.current || stateRef.current.processing === 'running') return;
    const mountElement = mountRef.current;
    if (!mountElement) return;

    const previous = activeGenerationRef.current;
    if (previous) cancelActiveGeneration(true);
    const generationId = identity('burst-generation');
    const generation: ActiveGeneration = {
      id: generationId,
      controller: new AbortController(),
    };
    activeGenerationRef.current = generation;
    startInFlightRef.current = true;
    sessionRef.current?.cancel();
    sessionRef.current = null;
    releaseCapturedResources();
    analysisStartedRef.current = false;
    hapticSentRef.current = false;
    captureRequestedRef.current = false;
    setCaptureStarted(true);
    setPreviewLive(false);
    setStarting(true);
    setFixture(false);
    setFileLimitation(false);
    setPreviewStatus('loading');
    setCameraDiagnostics([]);
    sendSequence({ type: 'RESET', at: now() });
    callbacksRef.current.onRequesting();

    const startedAt = systemClock.now();
    dispatch({
      type: 'REDNESS_BURST_STARTED',
      generationId,
      burstId: identity(`${kind}-burst`),
      sessionId: identity(`${kind}-session`),
      role: kind,
      startedAt,
    });

    try {
      const session = await adapterRef.current!.start({
        mountElement,
        previewElement: videoRef.current,
        signal: generation.controller.signal,
        burstGenerationId: generationId,
        stableForMs: CAMERA_KIT_ACQUISITION_MS,
        frozenCaptureProfileId:
          kind === 'followup' ? (stateRef.current.baselineCapture?.cameraProfileId ?? null) : null,
        onQuality: (nextQuality) => {
          if (activeGenerationRef.current?.id !== generationId) return;
          sendSequence({
            type: 'SIGNALS_RECEIVED',
            sample: nextQuality,
            at: now(),
          });
        },
        onCapture: (image, cameraProfileId, frame) => {
          if (
            activeGenerationRef.current?.id !== generationId ||
            generation.controller.signal.aborted
          ) {
            return;
          }
          if (!frame) {
            failBurst(generationId, {
              role: kind,
              code: 'current_frame_unavailable',
              message:
                'This camera path could not prove three current frames. Try the live camera.',
              retryable: true,
            });
            return;
          }
          const frozenCaptureProfile =
            kind === 'followup'
              ? (stateRef.current.longitudinalEvidence.baselineBurst?.captureProfileId ??
                stateRef.current.baselineCapture?.cameraProfileId ??
                null)
              : null;
          if (frozenCaptureProfile && cameraProfileId !== frozenCaptureProfile) {
            failBurst(generationId, {
              role: kind,
              code: 'capture_profile_mismatch',
              message:
                'This camera profile does not match the saved baseline. Existing evidence is unchanged.',
              retryable: true,
            });
            return;
          }
          const metadata = metadataForCapture(
            kind,
            'camera',
            image.type,
            frame.capturedAt,
            cameraProfileId,
            frame.frameId,
          );
          const position = frameRegistryRef.current.size + 1;
          const added = frameRegistryRef.current.add({
            frameId: frame.frameId,
            image,
            fileName: `${kind}-measurement-${position}-${frame.frameId}.jpg`,
            metadata,
          });
          if (!added) {
            failBurst(generationId, {
              role: kind,
              code: 'duplicate_frame_identifier',
              message: 'A camera frame repeated unexpectedly. Try the scan again.',
              retryable: true,
            });
            return;
          }
          dispatch({
            type: 'REDNESS_BURST_FRAME_CAPTURED',
            generationId,
            frame: {
              frameId: frame.frameId,
              capture: metadata,
              quality: {
                currentFrame: 'accepted',
                exposure: 'accepted',
                movement: 'accepted',
              },
            },
          });
          if (frameRegistryRef.current.size === REDNESS_BURST_REQUIRED_MEASUREMENTS) {
            const imageUrl = objectUrlsRef.current.create(image);
            currentCaptureUrlRef.current = imageUrl;
            currentCaptureFrameIdRef.current = frame.frameId;
            callbacksRef.current.onCapturing();
            sendSequence({
              type: 'CAPTURE_AVAILABLE',
              image: imageUrl,
              at: now(),
            });
          }
        },
        onRejectedAttempt: (attempt) => {
          if (activeGenerationRef.current?.id !== generationId) return;
          dispatch({
            type: 'REDNESS_BURST_CAPTURE_REJECTED',
            generationId,
            frame: {
              ...attempt,
              stage: 'capture',
            },
          });
        },
        onBurstComplete: (summary) => {
          if (
            activeGenerationRef.current?.id !== generationId ||
            summary.acceptedFrameCount !== REDNESS_BURST_REQUIRED_MEASUREMENTS ||
            frameRegistryRef.current.size !== REDNESS_BURST_REQUIRED_MEASUREMENTS
          ) {
            return;
          }
          dispatch({
            type: 'REDNESS_BURST_CAPTURE_COMPLETED',
            generationId,
          });
        },
        onFailure: (nextFailure) => {
          if (
            generation.controller.signal.aborted ||
            activeGenerationRef.current?.id !== generationId
          ) {
            return;
          }
          setPreviewLive(false);
          setStarting(false);
          setPreviewStatus(nextFailure === 'preview-stalled' ? 'preview-stalled' : 'closed');
          sendSequence({
            type: 'FAILED',
            failure: nextFailure,
            at: now(),
          });
          callbacksRef.current.onFailure(legacyFailureReason(nextFailure));
          failBurst(generationId, {
            role: kind,
            code:
              nextFailure === 'burst-exhausted'
                ? 'burst_attempts_exhausted'
                : `capture_${nextFailure.replaceAll('-', '_')}`,
            message:
              nextFailure === 'burst-exhausted'
                ? 'Three valid measurements could not be secured within five attempts. Try the scan again.'
                : 'The camera could not finish this evidence burst. Existing evidence is unchanged.',
            retryable: true,
          });
        },
        onStatus: (status) => {
          if (
            generation.controller.signal.aborted ||
            activeGenerationRef.current?.id !== generationId
          ) {
            return;
          }
          setPreviewStatus(status);
          if (
            status === 'loading' ||
            status === 'requesting-permission' ||
            status === 'camera-opening' ||
            status === 'waiting-first-frame'
          ) {
            setStarting(true);
          }
          if (status === 'preview-live') {
            setPreviewLive(true);
            setStarting(false);
            callbacksRef.current.onReady();
          }
          if (status === 'captured' || status === 'closed') {
            setPreviewLive(false);
            setStarting(false);
          }
        },
        onDiagnostic: (diagnostic) => {
          if (!diagnosticMode) return;
          setCameraDiagnostics((current) => [
            ...current.filter(({ stage }) => stage !== diagnostic.stage),
            diagnostic,
          ]);
        },
      });
      if (
        generation.controller.signal.aborted ||
        activeGenerationRef.current?.id !== generationId
      ) {
        session.cancel();
      } else {
        sessionRef.current = session;
        setFixture(mountElement.dataset.cameraKitFixture === 'active');
      }
    } catch {
      if (
        generation.controller.signal.aborted ||
        activeGenerationRef.current?.id !== generationId
      ) {
        return;
      }
      setStarting(false);
      setPreviewStatus('closed');
      sendSequence({
        type: 'FAILED',
        failure: 'sdk-unavailable',
        at: now(),
      });
      failBurst(generationId, {
        role: kind,
        code: 'capture_sdk_unavailable',
        message: 'The camera could not start. Existing evidence is unchanged.',
        retryable: true,
      });
    } finally {
      startInFlightRef.current = false;
    }
  }, [cancelActiveGeneration, diagnosticMode, dispatch, failBurst, kind, releaseCapturedResources]);

  useEffect(() => {
    if (
      sequence.phase !== 'scanning' ||
      !sequence.scanComplete ||
      sequence.capturedImage ||
      captureRequestedRef.current
    ) {
      return;
    }
    const capture = sessionRef.current?.capture;
    if (!capture) return;
    captureRequestedRef.current = true;
    capture();
  }, [sequence.capturedImage, sequence.phase, sequence.scanComplete]);

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
    if (cancelledLock) captureRequestedRef.current = false;
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
    const generation = activeGenerationRef.current;
    if (
      !sequence.handoffReady ||
      !generation ||
      analysisStartedRef.current ||
      state.activeRednessBurst?.generationId !== generation.id ||
      state.activeRednessBurst.status !== 'analyzing' ||
      frameRegistryRef.current.size !== REDNESS_BURST_REQUIRED_MEASUREMENTS
    ) {
      return;
    }
    analysisStartedRef.current = true;
    void analyzeBurst(generation);
  }, [analyzeBurst, sequence.handoffReady, state.activeRednessBurst]);

  useEffect(() => {
    const burst = state.activeRednessBurst;
    if (burst?.status !== 'ready' || activeGenerationRef.current?.id !== burst.generationId) {
      return;
    }
    const timer = window.setTimeout(
      () =>
        dispatch({
          type: 'REDNESS_BURST_COMMIT_REQUESTED',
          generationId: burst.generationId,
          completedAt: systemClock.now(),
        }),
      REDNESS_BURST_FINALIZATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, state.activeRednessBurst]);

  useEffect(() => {
    if (!captureStarted) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    const priorOverflow = document.body.style.overflow;
    const priorOverscroll = document.body.style.overscrollBehavior;
    const priorHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = priorOverflow;
      document.body.style.overscrollBehavior = priorOverscroll;
      document.documentElement.style.overflow = priorHtmlOverflow;
    };
  }, [captureStarted]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      const height = visualViewport?.height ?? window.innerHeight;
      screen.style.setProperty('--fv-visible-viewport-height', `${Math.round(height)}px`);
    };
    syncViewport();
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      screen.style.removeProperty('--fv-visible-viewport-height');
    };
  }, []);

  useEffect(
    () => () => {
      cancelActiveGeneration(true);
    },
    [cancelActiveGeneration],
  );

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    setFileLimitation(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const leave = () => {
    cancelActiveGeneration(true);
    callbacksRef.current.onBack();
  };

  const activeBurst = state.activeRednessBurst?.role === kind ? state.activeRednessBurst : null;
  const capturedMeasurementCount = activeBurst?.capturedFrames.length ?? 0;
  const analyzedMeasurementCount = activeBurst?.acceptedFrames.length ?? 0;
  const rejectedMeasurementCount =
    activeBurst?.rejectedFrames.filter((frame) => frame.stage === 'capture').length ?? 0;
  const providerProcessingStarted = (activeBurst?.providerRequests.length ?? 0) > 0;
  const attemptedFrameCount = activeBurst?.attemptedFrameCount ?? 0;
  const analysisError = state.analysisError?.role === kind ? state.analysisError : null;
  const isAnalyzing = activeBurst?.status === 'analyzing' || state.processing === 'running';
  const burstFailed = activeBurst?.status === 'failed';
  const failed = sequence.phase === 'error';
  const presentedAnalysisError = failed ? null : analysisError;

  useEffect(() => {
    const target = presentedAnalysisError
      ? retryBurstRef.current
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
  }, [failed, presentedAnalysisError, sequence.failure]);

  return (
    <section
      ref={screenRef}
      className={styles.cameraScreen}
      aria-labelledby="camera-heading"
      data-camera-state={cameraState}
      data-burst-status={activeBurst?.status ?? 'idle'}
      data-burst-attempts={attemptedFrameCount}
      data-burst-captured={capturedMeasurementCount}
      data-burst-accepted={analyzedMeasurementCount}
      data-preview-state={
        previewLive
          ? 'preview-live'
          : starting
            ? 'camera-opening'
            : captureStarted
              ? 'camera-stopped'
              : 'not-started'
      }
      data-preview-status={previewStatus}
    >
      <div className={styles.captureRouteBar} data-capture-route-bar>
        <button type="button" className={styles.textButton} onClick={leave}>
          ← Back
        </button>
        <p className={styles.eyebrow}>
          {kind === 'baseline' ? 'GUIDED BASELINE' : 'GUIDED FOLLOW-UP'}
        </p>
      </div>

      {diagnosticMode && (
        <aside
          className={styles.cameraContractDiagnostics}
          aria-label="Camera Kit contract diagnostics"
          data-camera-kit-contract-diagnostics
        >
          <strong>CAMERA KIT CONTRACT</strong>
          {cameraDiagnostics.length === 0 ? (
            <span>WAITING TO START</span>
          ) : (
            cameraDiagnostics.map((diagnostic) => (
              <span key={diagnostic.stage}>
                {diagnostic.stage.replaceAll('-', ' ').toUpperCase()}
                {diagnostic.surfaceType
                  ? ` · ${diagnostic.surfaceType.toUpperCase()} ${diagnostic.surfaceWidth}×${diagnostic.surfaceHeight}`
                  : ''}
              </span>
            ))
          )}
        </aside>
      )}

      <CaptureSequence
        state={sequence}
        accession={accession}
        product={product}
        job={job}
        mountRef={mountRef}
        videoRef={videoRef}
        fixture={fixture}
        previewLive={previewLive}
        previewStatus={previewStatus}
        activeCapture={captureStarted && !failed}
        reducedMotion={reducedMotion}
        captureKind={kind}
        acceptedMeasurementCount={capturedMeasurementCount}
        analyzedMeasurementCount={analyzedMeasurementCount}
        rejectedMeasurementCount={rejectedMeasurementCount}
        providerProcessingStarted={providerProcessingStarted}
        burstStatus={activeBurst?.status ?? 'idle'}
      />

      {!presentedAnalysisError && !isAnalyzing && (!captureStarted || failed) && (
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
                : 'START GUIDED CAPTURE'}
        </button>
      )}

      {presentedAnalysisError && (
        <div className={styles.notice} role="alert">
          <strong>We couldn’t finish this scan.</strong>
          <p>{presentedAnalysisError.message}</p>
          <p>No partial measurements were saved. Your existing trial is safe.</p>
          {presentedAnalysisError.retryable && (
            <button
              ref={retryBurstRef}
              type="button"
              className={styles.secondaryAction}
              disabled={isAnalyzing}
              onClick={startGuidedCapture}
            >
              TRY BURST AGAIN
            </button>
          )}
        </div>
      )}

      {fileLimitation && (
        <div className={styles.notice} role="status">
          <strong>One photo is not enough for this scan.</strong>
          <p>
            Evidence bursts require three distinct current frames. The selected photo was released
            and nothing was added to your trial.
          </p>
        </div>
      )}

      {(!captureStarted || failed || burstFailed) && !isAnalyzing && (
        <>
          <label className={styles.captureFileFallback}>
            USE AN EXISTING PHOTO · SINGLE IMAGE ONLY
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
            A single existing photo cannot complete the three-measurement burst. Selected files are
            released immediately and are never added to your trial.
          </p>
        </>
      )}
    </section>
  );
}
