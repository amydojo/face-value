import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { CaptureKind, CaptureMetadata } from '../../domain/model';
import type { EvidenceTrialState } from '../evidence-machine/evidenceTrial';
import { EvidenceMachine } from '../evidence-machine/EvidenceMachine';
import styles from './CanonicalFaceValueApplication.module.css';

const conditions = [
  'Lighting is comparable',
  'Face position is consistent',
  'Camera distance is consistent',
  'No makeup change',
  'No recent exercise or heat',
  'Recent cleansing is comparable',
  'Recent product timing is comparable',
  'Time of day is comparable',
];

const metadata = (kind: CaptureKind, source: CaptureMetadata['source'], mimeType: CaptureMetadata['mimeType']): CaptureMetadata => ({
  id: `${kind}-${source}-${Date.now()}`,
  kind,
  source,
  mimeType,
  createdAt: new Date().toISOString(),
  orientationRule: 'analysis-unmirrored',
});

export function CanonicalCaptureContract({
  trial,
  kind,
  onContinue,
  onCancel,
}: {
  trial: EvidenceTrialState;
  kind: CaptureKind;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const complete = useMemo(() => conditions.every((condition) => confirmed[condition]), [confirmed]);

  return (
    <main className={styles.shell} data-fv-screen={`${kind}-capture-contract`}>
      <header className={styles.header}><b>FACE VALUE</b><span>{trial.specimenCode}</span></header>
      <div className={styles.rule} />
      <section className={styles.captureFlow}>
        <button type="button" className={styles.textButton} onClick={onCancel}>← Back</button>
        <div><p className={styles.eyebrow}>{kind.toUpperCase()} CAPTURE CONTRACT</p><h1>Confirm what the camera cannot know.</h1><p>Raw image data stays in memory and is discarded after capture.</p></div>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} compact />
        <fieldset className={styles.conditionList}><legend>COMPARABLE CONDITIONS</legend>{conditions.map((condition) => (
          <label key={condition}><input type="checkbox" checked={Boolean(confirmed[condition])} onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirmed((current) => ({ ...current, [condition]: event.target.checked }))} /><span>{condition}</span></label>
        ))}</fieldset>
        <button type="button" className={styles.pagePrimary} disabled={!complete} onClick={onContinue}>READY TO CAPTURE <span>→</span></button>
      </section>
    </main>
  );
}

export function CanonicalCamera({
  trial,
  kind,
  onAccepted,
  onBack,
}: {
  trial: EvidenceTrialState;
  kind: CaptureKind;
  onAccepted: (metadata: CaptureMetadata) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('Use the front camera or choose one existing image.');

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const requestCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setMessage('Camera access is unavailable. File capture remains available.');
      return;
    }
    setStatus('requesting');
    setMessage('Requesting camera permission.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
      setMessage('Camera ready.');
    } catch {
      setStatus('error');
      setMessage('Camera permission was not available. File capture remains available.');
      stop();
    }
  };

  const captureCamera = () => {
    if (status !== 'ready') return;
    setMessage('Frame recorded. Raw pixels were not persisted.');
    stop();
    onAccepted(metadata(kind, 'camera', 'image/jpeg'));
  };

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    const mimeType: CaptureMetadata['mimeType'] = file.type === 'image/png'
      ? 'image/png'
      : file.type === 'image/webp'
        ? 'image/webp'
        : file.type === 'image/heic'
          ? 'image/heic'
          : file.type === 'image/jpeg'
            ? 'image/jpeg'
            : 'image/unknown';
    setMessage('Image accepted. Raw pixels remain memory-only.');
    stop();
    onAccepted(metadata(kind, 'file', mimeType));
  };

  return (
    <main className={styles.shell} data-fv-screen={`${kind}-camera`}>
      <header className={styles.header}><b>FACE VALUE</b><span>{trial.specimenCode}</span></header>
      <div className={styles.rule} />
      <section className={styles.captureFlow}>
        <button type="button" className={styles.textButton} onClick={() => { stop(); onBack(); }}>← Conditions</button>
        <div><p className={styles.eyebrow}>{kind.toUpperCase()} SCAN</p><h1>Record one comparable frame.</h1></div>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} compact />
        <div className={styles.cameraViewport} data-camera-status={status}>
          <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
          {status !== 'ready' && <p>{message}</p>}
        </div>
        <p role="status">{message}</p>
        {status === 'ready' ? (
          <button type="button" className={styles.pagePrimary} onClick={captureCamera}>CAPTURE FRAME <span>●</span></button>
        ) : (
          <button type="button" className={styles.pagePrimary} disabled={status === 'requesting'} onClick={() => void requestCamera()}>{status === 'requesting' ? 'REQUESTING CAMERA' : 'USE CAMERA'} <span>→</span></button>
        )}
        <label className={styles.fileControl}>CHOOSE A PHOTO<input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])} /></label>
      </section>
    </main>
  );
}
