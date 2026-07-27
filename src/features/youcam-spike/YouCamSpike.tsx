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
  const [signal, setSignal] = useState<SkinAnalysisSignal | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortController.current?.abort();
    },
    [],
  );

  const run = async () => {
    if (!file || !accessToken.trim() || status === 'running') return;

    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setSignal(null);
    setError(null);
    setStatus('running');

    try {
      const provider = new YouCamSkinAnalysisProvider({
        accessToken: accessToken.trim(),
      });
      const result = await provider.analyzeCapture({
        image: file,
        fileName: file.name,
        protocol: HD_REDNESS_PROTOCOL,
        capturedAt: new Date().toISOString(),
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
        setError(`${caught.message} (${caught.code})`);
      } else {
        setError('The live YouCam score could not be produced.');
      }
      setStatus('error');
    }
  };

  const cancel = () => {
    abortController.current?.abort();
    abortController.current = null;
    setStatus('idle');
  };

  return (
    <main>
      <section className={styles.welcome} data-fv-screen="youcam-phase-a">
        <div>
          <p className={styles.eyebrow}>PHASE A · LIVE SCORE SPIKE</p>
          <h1>Secure one real redness signal.</h1>
          <p>
            This protected engineering route uploads one selected image directly to YouCam,
            requests only <code>hd_redness</code>, and returns the underlying <code>raw_score</code>.
          </p>
        </div>

        <div className={styles.analysisSummary}>
          <strong>Frozen protocol</strong>
          <p>Skin Analysis v2.1 · HD redness · raw score only · JSON response</p>
        </div>

        <label className={styles.fileFallback}>
          Choose a front-facing JPEG or PNG
          <input
            aria-label="Choose a face image for the YouCam spike"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSignal(null);
              setError(null);
              setStatus('idle');
            }}
          />
        </label>
        {file && <p>{file.name} · {Math.ceil(file.size / 1024).toLocaleString()} KB</p>}

        <label className={styles.traceForm}>
          Spike access token
          <input
            type="password"
            autoComplete="off"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </label>

        <div className={styles.notice}>
          <strong>PROCESSING DISCLOSURE</strong>
          <p>
            The selected image is sent to Perfect Corp for analysis. Face Value does not place
            the image, signed upload URL, or API credentials in browser storage.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryAction}
          disabled={!file || !accessToken.trim() || status === 'running'}
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
            <p>Task: {signal.providerTaskId}</p>
          </div>
        )}

        <p className={styles.privacyLine}>
          Development evidence only · no verdict is generated in Phase A
        </p>
      </section>
    </main>
  );
}
