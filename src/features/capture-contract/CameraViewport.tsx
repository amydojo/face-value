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
import type { CameraState, CaptureKind, CaptureMetadata } from '../../domain/model';
import styles from '../../styles/FaceValue.module.css';

const failureCopy: Record<CameraFailureReason, string> = {
  unsupported: 'This browser does not expose camera capture. Choose a photo instead.',
  denied: 'Camera permission was not granted. You can continue with a file capture.',
  no_camera: 'No camera was found. You can continue with a file capture.',
  overconstrained: 'The preferred camera could not be opened. You can continue with a file capture.',
  unknown: 'The camera could not be opened. You can continue with a file capture.',
};

interface PendingCapture {
  blob: Blob;
  source: 'camera' | 'file';
  previewUrl: string;
}

export function CameraViewport({
  kind,
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
  cameraState: CameraState;
  onRequesting: () => void;
  onReady: () => void;
  onCapturing: () => void;
  onFailure: (reason: CameraFailureReason) => void;
  onAccepted: (metadata: CaptureMetadata) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urls = useRef(new ObjectUrlRegistry());
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [failure, setFailure] = useState<CameraFailureReason | null>(null);

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

  useEffect(
    () => () => {
      cleanupStream();
      urls.current.revokeAll();
    },
    [cleanupStream],
  );

  const openCamera = async () => {
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

  const stageBlob = (blob: Blob, source: 'camera' | 'file') => {
    discardPendingCapture();
    const previewUrl = urls.current.create(blob);
    setPendingCapture({ blob, source, previewUrl });
    cleanupStream();
  };

  const capture = async () => {
    if (!videoRef.current) return;
    onCapturing();
    try {
      const blob = await captureFrame(videoRef.current);
      stageBlob(blob, 'camera');
    } catch {
      cleanupStream();
      setFailure('unknown');
      onFailure('unknown');
    }
  };

  const fileChanged = (file: File | undefined) => {
    if (!file) return;
    stageBlob(file, 'file');
  };

  const acceptPendingCapture = () => {
    if (!pendingCapture) return;
    onAccepted(metadataForCapture(kind, pendingCapture.source, pendingCapture.blob.type));
  };

  const deleteCapture = () => {
    discardPendingCapture();
    onDelete();
  };

  const leave = () => {
    cleanupStream();
    discardPendingCapture();
    onBack();
  };

  return (
    <section className={styles.cameraScreen} aria-labelledby="camera-heading">
      <button type="button" className={styles.textButton} onClick={leave}>
        ← Back
      </button>
      <p className={styles.eyebrow}>{kind.toUpperCase()} CAPTURE</p>
      <h1 id="camera-heading">Comparable evidence begins with honest conditions.</h1>
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
      {failure && (
        <div className={styles.notice} role="status">
          <strong>CAMERA UNAVAILABLE</strong>
          <p>{failureCopy[failure]}</p>
        </div>
      )}
      {!pendingCapture && cameraState !== 'ready' && cameraState !== 'capturing' && (
        <button type="button" className={styles.primaryAction} onClick={openCamera}>
          Request camera access
        </button>
      )}
      {!pendingCapture && cameraState === 'ready' && (
        <button type="button" className={styles.primaryAction} onClick={capture}>
          Capture frame
        </button>
      )}
      <label className={styles.fileFallback}>
        Choose a photo instead
        <input
          aria-label="Choose a face photo"
          type="file"
          accept="image/*"
          capture="user"
          onChange={(event) => fileChanged(event.target.files?.[0])}
        />
      </label>
      {pendingCapture && (
        <>
          <button type="button" className={styles.primaryAction} onClick={acceptPendingCapture}>
            Use this capture
          </button>
          <button type="button" className={styles.secondaryAction} onClick={deleteCapture}>
            Delete current capture
          </button>
        </>
      )}
      <p className={styles.privacyLine}>
        No server upload · No local image persistence · Analysis orientation: unmirrored
      </p>
    </section>
  );
}
