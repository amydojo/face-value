import { useEffect, useMemo, useRef, useState } from 'react';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import { HD_REDNESS_PROTOCOL } from '../../adapters/analysis/youcam/contracts';
import { summarizeCalibration } from '../../domain/youcamEvidence';
import styles from '../../styles/FaceValue.module.css';

export function YouCamCalibration() {
  const provider = useRef(createSkinAnalysisProvider());
  const abortController = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const summary = useMemo(
    () => (scores.length ? summarizeCalibration(scores) : null),
    [scores],
  );

  useEffect(() => () => abortController.current?.abort(), []);

  const run = async () => {
    if (!file || status === 'running') return;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    setStatus('running');
    setError(null);

    try {
      const signal = await provider.current.analyzeCapture({
        image: file,
        fileName: file.name,
        protocol: HD_REDNESS_PROTOCOL,
        capturedAt: new Date().toISOString(),
        role: 'followup',
        signal: controller.signal,
      });
      setScores((current) => [...current, signal.rawScore]);
      setStatus('idle');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Calibration scan failed.');
      setStatus('error');
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  };

  return (
    <main>
      <section className={styles.welcome} data-fv-screen="youcam-calibration">
        <div>
          <p className={styles.eyebrow}>PROTECTED DEVELOPMENT UTILITY</p>
          <h1>Same-session redness noise study.</h1>
          <p>Prototype engineering calibration, not clinical validation.</p>
        </div>

        <div className={styles.notice}>
          <strong>MATCH THE CONDITIONS</strong>
          <p>
            Repeat front-facing scans in the same session, position, lighting, and device setup.
            Scores stay in memory only. This utility commits no threshold and changes no product trial.
          </p>
        </div>

        <label className={styles.fileFallback}>
          Choose the next matched JPEG or PNG
          <input
            aria-label="Choose a matched calibration image"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={status === 'running'}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <button
          type="button"
          className={styles.primaryAction}
          disabled={!file || status === 'running'}
          onClick={() => void run()}
        >
          {status === 'running' ? 'ANALYZING MATCHED SCAN' : 'ADD MATCHED SCAN'}
        </button>

        {error && <div className={styles.notice} role="alert"><strong>SCAN NOT ADDED</strong><p>{error}</p></div>}

        {summary && (
          <div className={styles.analysisSummary} aria-live="polite">
            <strong>PROTOTYPE ENGINEERING CALIBRATION</strong>
            <p>Scores: {summary.scores.map((score) => score.toFixed(4)).join(', ')}</p>
            <p>Consecutive deltas: {summary.consecutiveDeltas.map((delta) => delta.toFixed(4)).join(', ') || '—'}</p>
            <p>Absolute consecutive deltas: {summary.absoluteConsecutiveDeltas.map((delta) => delta.toFixed(4)).join(', ') || '—'}</p>
            <p>Median absolute delta: {summary.medianAbsoluteDelta.toFixed(4)}</p>
            <p>Max absolute delta: {summary.maxAbsoluteDelta.toFixed(4)}</p>
            <p>Minimum score: {summary.minimumScore.toFixed(4)}</p>
            <p>Maximum score: {summary.maximumScore.toFixed(4)}</p>
          </div>
        )}

        <button
          type="button"
          className={styles.secondaryAction}
          disabled={scores.length === 0 || status === 'running'}
          onClick={() => setScores([])}
        >
          Clear in-memory scores
        </button>
        <p className={styles.privacyLine}>No images or scores are written to durable trial state.</p>
      </section>
    </main>
  );
}
