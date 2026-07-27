import { useEffect, useRef, useState } from 'react';
import {
  YouCamProviderError,
  YouCamSkinAnalysisProvider,
} from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import {
  HD_REDNESS_PROTOCOL,
  type SkinAnalysisSignal,
} from '../../adapters/analysis/youcam/contracts';
import styles from '../../styles/FaceValue.module.css';

export function YouCamSpike() {
  const [file, setFile] = useState<File | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);
  const [signal, setSignal] = useState<SkinAnalysisSignal | null>(null);
  const [status, setStatus] = useState<'idle' | 'unlocking' | 'running' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const runInFlight = useRef(false);

  useEffect(
    () => () => {
      abortController.current?.abort();
    },
    [],
  );

  const unlock = async () => {
    if (!accessToken.trim() || status === 'unlocking') return;
    const token = accessToken.trim();
    setAccessToken('');
    setError(null);
    setStatus('unlocking');

    try {
      const response = await fetch('/api/youcam/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json() as {
        authenticated?: boolean;
        expiresAt?: string;
        error?: { code?: string; message?: string };
      };
      if (!response.ok || body.authenticated !== true) {
        throw new Error(body.error?.message ?? 'The protected demo session could not be opened.');
      }
      setSessionOpen(true);
      setSessionExpiry(body.expiresAt ?? null);
      setStatus('idle');
    } catch (caught) {
      setSessionOpen(false);
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'The protected demo session could not be opened.');
    }
  };

  const run = async () => {
    if (!file || !sessionOpen || runInFlight.current) return;

    runInFlight.current = true;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setSignal(null);
    setError(null);
    setStatus('running');

    try {
      const provider = new YouCamSkinAnalysisProvider();
      const result = await provider.analyzeCapture({
        image: file,
        fileName: file.name,
        protocol: HD_REDNESS_PROTOCOL,
        capturedAt: new Date().toISOString(),
        role: 'baseline',
        signal: controller.signal,
      });
      setSignal(result);
      setStatus('success');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      if (caught instanceof YouCamProviderError) {
        if (caught.status === 401) setSessionOpen(false);
        setError(`${caught.message} (${caught.code})`);
      } else if (caught instanceof Error) {
        setError(`${caught.message} (${caught.name})`);
      } else {
        setError('The live YouCam score failed with an unknown browser error.');
      }
      setStatus('error');
    } finally {
      runInFlight.current = false;
      if (abortController.current === controller) abortController.current = null;
    }
  };

  const cancel = () => {
    abortController.current?.abort();
    abortController.current = null;
  };

  return (
    <main>
      <section className={styles.welcome} data-fv-screen="youcam-engineering-gate">
        <div>
          <p className={styles.eyebrow}>PROTECTED ENGINEERING GATE</p>
          <h1>Open the live analysis session.</h1>
          <p>
            The raw demo token is exchanged once for a short-lived signed session cookie.
            The Face Value product flow never reads or stores that token.
          </p>
        </div>

        <label className={styles.traceForm}>
          Protected demo token
          <input
            type="password"
            autoComplete="off"
            disabled={status === 'unlocking' || status === 'running'}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!accessToken.trim() || status === 'unlocking' || status === 'running'}
          onClick={() => void unlock()}
        >
          {status === 'unlocking' ? 'OPENING SESSION' : 'OPEN PROTECTED SESSION'}
        </button>

        {sessionOpen && (
          <div className={styles.analysisSummary} role="status">
            <strong>SESSION OPEN</strong>
            <p>Secure · HttpOnly · SameSite · short lived</p>
            {sessionExpiry && <p>Expires {new Date(sessionExpiry).toLocaleTimeString()}</p>}
          </div>
        )}

        <div className={styles.analysisSummary}>
          <strong>Frozen protocol</strong>
          <p>Skin Analysis v2.1 · HD redness · raw score only · JSON response</p>
        </div>

        <label className={styles.fileFallback}>
          Choose a front-facing JPEG or PNG
          <input
            aria-label="Choose a face image for the YouCam spike"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={!sessionOpen || status === 'running'}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSignal(null);
              setError(null);
              setStatus('idle');
            }}
          />
        </label>
        {file && <p>{file.name} · {Math.ceil(file.size / 1024).toLocaleString()} KB</p>}

        <div className={styles.notice}>
          <strong>PROCESSING DISCLOSURE</strong>
          <p>
            The selected image is sent to Perfect Corp for analysis. Face Value does not place
            the image, signed upload URL, API credentials, or provider payload in browser storage.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryAction}
          disabled={!file || !sessionOpen || status === 'running'}
          onClick={() => void run()}
        >
          {status === 'running' ? 'ANALYZING REDNESS' : 'RUN LIVE HD REDNESS'}
        </button>

        {status === 'running' && (
          <button type="button" className={styles.secondaryAction} onClick={cancel}>
            Cancel analysis
          </button>
        )}

        {error && (
          <div className={styles.notice} role="alert">
            <strong>LIVE SCORE UNAVAILABLE</strong>
            <p>{error}</p>
          </div>
        )}

        {signal && (
          <div className={styles.analysisSummary} aria-live="polite">
            <strong>REAL PROVIDER SIGNAL</strong>
            <p>Concern: {signal.concern}</p>
            <p>Raw score: {signal.rawScore.toFixed(4)}</p>
            <p>Mode: {signal.mode.toUpperCase()} · Provider: YouCam v{signal.apiVersion}</p>
            <p>Task reference: {signal.ephemeralTaskReference}</p>
          </div>
        )}

        <p className={styles.privacyLine}>
          Protected development evidence only · no provider verdict is generated here
        </p>
      </section>
    </main>
  );
}
