import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attachStream,
  captureFrame,
  metadataForCapture,
  ObjectUrlRegistry,
  releaseStream,
  requestCamera,
  type CameraFailureReason,
} from '../../adapters/camera/browserCamera';
import { YouCamProviderError } from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import {
  analyzeLongitudinalCapture,
  LocalProtocolMismatchError,
} from '../../adapters/analysis/youcam/longitudinalAnalysis';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import { useFaceValue } from '../../app/faceValueContext';
import type { CameraState, CaptureKind, CaptureMetadata } from '../../domain/model';
import {
  logSafeAnalysisDiagnostic,
  translateProviderError,
} from '../../domain/youcamEvidence';
import styles from '../../styles/FaceValue.module.css';

const failureCopy: Record<CameraFailureReason, string> = {
  unsupported: 'This browser does not expose camera capture. Choose a photo instead.',
  denied: 'Camera permission was not granted. You can continue with a file capture.',
  no_camera: 'No camera was found. You can continue with a file capture.',
  overconstrained: 'The preferred camera could not be opened. You can continue with a file capture.',
  unknown: 'The camera could not be opened. You can continue with a file capture.',
};

interface PendingCapture {
  image: Blob;
  source: 'camera' | 'file';
  previewUrl: string;
  fileName?: string;
}

const requestIdentity = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CameraViewport({
  kind,
  accession = 'A1–01',
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
}) {
  const { state, dispatch } = useFaceValue();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urls = useRef(new ObjectUrlRegistry());
  const provider = useRef(createSkinAnalysisProvider());
  const abortController = useRef<AbortController | null>(null);
  const activeRequestId = useRef<string | null>(null);
  const runInFlight = useRef(false);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [failure, setFailure] = useState<CameraFailureReason | null>(null);
  const isPhaseBTrial =
    state.selectedSpecimenId === 'one-thing' &&
    state.assignedJob === 'Reduce visible redness';
  const isAnalyzing =
    state.processing === 'running' && state.analysisRole === kind;
  const analysisError = state.analysisError?.role === kind
    ? state.analysisError
    : null;

  const cleanupStream = useCallback(() => {
    releaseStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const discardPendingCapture = useCallback(() => {
    setPendingCapture((current) => {
      if (current) urls.current.revoke(current.previewUrl);
      return null;
    });
  }, []);

  const cancelActiveAnalysis = useCallback(() => {
    const requestId = activeRequestId.current;
    abortController.current?.abort();
    abortController.current = null;
    activeRequestId.current = null;
    runInFlight.current = false;
    if (requestId) {
      logSafeAnalysisDiagnostic({
        stage: 'cancelled',
        role: kind,
        outcome: 'cancelled',
      });
      dispatch({ type: 'ANALYSIS_CANCELLED', requestId });
    }
  }, [dispatch, kind]);

  useEffect(
    () => () => {
      cancelActiveAnalysis();
      cleanupStream();
      urls.current.revokeAll();
    },
    [cancelActiveAnalysis, cleanupStream],
  );

  const openCamera = async () => {
    if (isAnalyzing) return;
    onRequesting();
    setFailure(null);
    const result = await requestCamera();
    if (result.ok === false) {
      cleanupStream();
      setFailure(result.reason);
      onFailure(result.reason);
      return;
    }
    streamRef.current = result.stream;
    if (videoRef.current) attachStream(videoRef.current, result.stream);
    onReady();
  };

  const stageCapture = (image: Blob, source: 'camera' | 'file', fileName?: string) => {
    if (isAnalyzing) return;
    discardPendingCapture();
    const previewUrl = urls.current.create(image);
    setPendingCapture({ image, source, previewUrl, fileName });
    cleanupStream();
  };

  const capture = async () => {
    if (!videoRef.current || isAnalyzing) return;
    onCapturing();
    try {
      const image = await captureFrame(videoRef.current);
      stageCapture(image, 'camera', `${kind}.jpg`);
    } catch {
      cleanupStream();
      setFailure('unknown');
      onFailure('unknown');
    }
  };

  const fileChanged = (file: File | undefined) => {
    if (!file || isAnalyzing) return;
    stageCapture(file, 'file', file.name);
  };

  const acceptPendingCapture = async () => {
    if (!pendingCapture || runInFlight.current) return;

    const metadata = metadataForCapture(kind, pendingCapture.source, pendingCapture.image.type);
    if (!isPhaseBTrial) {
      onAccepted(metadata);
      return;
    }

    if (kind === 'baseline' && state.processing === 'failed') {
      dispatch({ type: 'BASELINE_RETRY_REQUESTED' });
    }

    const requestId = requestIdentity();
    const controller = new AbortController();
    runInFlight.current = true;
    abortController.current = controller;
    activeRequestId.current = requestId;
    dispatch({
      type: kind === 'baseline'
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
        provider: provider.current,
        role: kind,
        image: pendingCapture.image,
        fileName: pendingCapture.fileName,
        metadata,
        frozenProtocol: state.longitudinalEvidence.protocol,
        signal: controller.signal,
      });

      if (activeRequestId.current !== requestId) {
        logSafeAnalysisDiagnostic({
          stage: 'completion',
          role: kind,
          outcome: 'stale-response-ignored',
        });
        return;
      }

      activeRequestId.current = null;
      abortController.current = null;
      discardPendingCapture();
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
        dispatch({ type: 'COMPARISON_CREATED' });
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

      const code = caught instanceof LocalProtocolMismatchError
        ? caught.code
        : caught instanceof YouCamProviderError
          ? caught.code
          : 'unknown_provider_failure';
      const error = translateProviderError(code, kind);
      logSafeAnalysisDiagnostic({
        stage: caught instanceof LocalProtocolMismatchError
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
          type: kind === 'baseline'
            ? 'BASELINE_ANALYSIS_FAILED'
            : 'FOLLOWUP_ANALYSIS_FAILED',
          requestId,
          error,
        });
      }
    } finally {
      if (activeRequestId.current === requestId) activeRequestId.current = null;
      if (abortController.current === controller) abortController.current = null;
      runInFlight.current = false;
    }
  };

  const deleteCapture = () => {
    cancelActiveAnalysis();
    discardPendingCapture();
    onDelete();
  };

  const leave = () => {
    cancelActiveAnalysis();
    cleanupStream();
    discardPendingCapture();
    onBack();
  };

  return (
    <section className={styles.cameraScreen} aria-labelledby="camera-heading">
      <button type="button" className={styles.textButton} onClick={leave}>← Back</button>
      <div className={styles.captureIdentity} aria-label={`Cassette ${accession}, ${product}, ${job ?? 'job unassigned'}`}>
        <span>{accession}</span><strong>{product}</strong><small>{job ?? 'JOB UNASSIGNED'}</small>
      </div>
      <p className={styles.eyebrow}>{kind.toUpperCase()} OBSERVATION CAPTURE</p>
      <h1 id="camera-heading">Comparable evidence begins with honest conditions.</h1>
      <div className={styles.cameraInstrumentFrame}>
        <div
          className={styles.cameraViewport}
          aria-label="Observed face region. Preview is mirrored for framing; evidence pixels are captured unmirrored."
        >
          {pendingCapture ? (
            <img src={pendingCapture.previewUrl} alt="Current private capture preview" />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline />
          )}
          {!pendingCapture && cameraState !== 'ready' && cameraState !== 'capturing' && (
            <div className={styles.cameraPlaceholder}>
              PRIVATE BY DEFAULT
              <br />
              <small>Original image remains in memory only</small>
            </div>
          )}
        </div>
        <div className={styles.cameraAccessionRail} aria-hidden="true">
          <span>{accession}</span><strong>{kind.toUpperCase()} OBSERVATION</strong><i />
        </div>
      </div>
      {failure && (
        <div className={styles.notice} role="status">
          <strong>CAMERA UNAVAILABLE</strong>
          <p>{failureCopy[failure]}</p>
        </div>
      )}
      {analysisError && (
        <div className={styles.notice} role="alert">
          <strong>{kind === 'baseline' ? 'BASELINE NOT SECURED' : 'FOLLOW-UP NOT SECURED'}</strong>
          <p>{analysisError.message}</p>
        </div>
      )}
      {!pendingCapture && cameraState !== 'ready' && cameraState !== 'capturing' && (
        <button type="button" className={styles.primaryAction} disabled={isAnalyzing} onClick={openCamera}>Request camera access</button>
      )}
      {!pendingCapture && cameraState === 'ready' && (
        <button type="button" className={styles.primaryAction} disabled={isAnalyzing} onClick={capture}>Capture frame</button>
      )}
      <label className={styles.fileFallback}>
        Choose a photo instead
        <input
          aria-label="Choose a face photo"
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          capture="user"
          disabled={isAnalyzing}
          onChange={(event) => fileChanged(event.target.files?.[0])}
        />
      </label>
      {pendingCapture && (
        <>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={isAnalyzing}
            onClick={() => void acceptPendingCapture()}
          >
            {isAnalyzing
              ? kind === 'baseline'
                ? 'SECURING BASELINE'
                : 'SECURING FOLLOW-UP'
              : analysisError
                ? 'RETRY ANALYSIS'
                : 'USE THIS CAPTURE'}
          </button>
          <button type="button" className={styles.secondaryAction} disabled={isAnalyzing} onClick={deleteCapture}>Delete current capture</button>
        </>
      )}
      <p className={styles.privacyLine}>
        The image is sent to Perfect Corp for analysis · No local image persistence · Analysis orientation: unmirrored
      </p>
    </section>
  );
}
