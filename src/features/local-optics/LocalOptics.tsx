import { useEffect, useRef, useState } from 'react';
import { loadMediaPipeLandmarker, LOCAL_OPTICS_MODEL, MEDIAPIPE_TASKS_VISION_VERSION } from './landmarkSource';
import {
  compareCaptures,
  EXPERIMENTAL_TOLERANCES,
  LANDMARK,
  LOCAL_OPTICS_METRICS_VERSION,
  type CaptureComparison,
  type CaptureMeasurement,
  type ComparisonRow,
} from './opticsMetrics';
import {
  browserOpticsDeps,
  OpticsSession,
  type LiveReading,
  type OpticsCapture,
  type OpticsSessionDeps,
} from './opticsSession';
import styles from './LocalOptics.module.css';

type ModelState = { kind: 'off' } | { kind: 'loading' } | { kind: 'ready'; name: string } | { kind: 'failed'; message: string };
type Slot = 'baseline' | 'comparison';

const CAPABILITIES: Array<[string, string, string]> = [
  ['Face presence and count', 'Measured', 'Landmark model, every frame; two faces are detected and rejected'],
  ['Head roll', 'Measured', 'Angle of the outer-eye line in the image'],
  ['Head yaw and pitch', 'Model estimate', 'From the landmark model’s transformation matrix; sign convention not device-verified'],
  ['Apparent face size', 'Measured', 'Outer-eye distance as a share of frame width'],
  ['Crop position and margins', 'Measured', 'Landmark bounding box in the frame'],
  ['Motion during capture', 'Measured', 'Landmark movement between frames; whole-frame pixel change'],
  ['Face brightness, spread, clipping', 'Measured (relative)', 'Camera-processed pixels with auto exposure, not illuminance'],
  ['Side shading', 'Measured (proxy)', 'Left vs right face brightness, not a light-direction estimate'],
  ['Scene colour outside the face', 'Estimate', 'Moves with background content and auto white balance'],
  ['Colour cast', 'Unavailable', 'Needs a neutral reference in frame; skin colour is never used'],
  ['Illuminance, colour temperature', 'Unavailable', 'No photometric access from the browser'],
  ['Exposure, white balance, ISO', 'Reported only if the browser exposes them', 'Listed below per capture'],
];

const formatValue = (property: string, value: number | null) => {
  if (value === null) return '—';
  if (['Roll', 'Yaw', 'Pitch'].includes(property)) return `${value.toFixed(1)}°`;
  if (property === 'Apparent size' || property === 'Face brightness') return value.toFixed(3);
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(3);
};

const formatDifference = (r: ComparisonRow) => {
  if (r.difference === null) return '—';
  if (r.property === 'Apparent size' || r.property === 'Face brightness') return `${(r.difference * 100).toFixed(1)}%`;
  return formatValue(r.property, r.difference);
};

const STATUS_TEXT: Record<ComparisonRow['status'], string> = {
  within_experimental_tolerance: 'Within',
  outside_experimental_tolerance: 'Outside',
  shown_without_tolerance: 'Shown only',
  not_measured: 'Not measured',
};

const OVERALL_TEXT: Record<CaptureComparison['overall'], string> = {
  not_comparable: 'Not comparable',
  insufficient_evidence: 'Insufficient evidence',
  within_experimental_tolerances: 'Within experimental tolerances (measured properties only)',
};

function drawSnapshot(target: HTMLCanvasElement, capture: OpticsCapture) {
  const { snapshot, faces } = capture;
  target.width = snapshot.width;
  target.height = snapshot.height;
  const context = target.getContext('2d');
  if (!context) return;
  context.drawImage(snapshot, 0, 0);
  context.lineWidth = 1.5;
  for (const face of faces) {
    let [l, t, r, b] = [1, 1, 0, 0];
    context.fillStyle = 'rgba(255, 196, 0, 0.8)';
    for (const p of face.points) {
      l = Math.min(l, p.x);
      t = Math.min(t, p.y);
      r = Math.max(r, p.x);
      b = Math.max(b, p.y);
      context.fillRect(p.x * target.width - 0.5, p.y * target.height - 0.5, 1, 1);
    }
    context.strokeStyle = faces.length === 1 ? '#3ddc84' : '#ff5a5a';
    context.strokeRect(l * target.width, t * target.height, (r - l) * target.width, (b - t) * target.height);
    const a = face.points[LANDMARK.rightEyeOuter];
    const z = face.points[LANDMARK.leftEyeOuter];
    if (a && z) {
      context.beginPath();
      context.moveTo(a.x * target.width, a.y * target.height);
      context.lineTo(z.x * target.width, z.y * target.height);
      context.stroke();
    }
  }
}

function CaptureCard({ label, capture }: { label: string; capture: OpticsCapture | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current && capture) drawSnapshot(canvas.current, capture);
    const target = canvas.current;
    return () => {
      if (target) {
        target.width = 0;
        target.height = 0;
      }
    };
  }, [capture]);
  const m = capture?.measurement;
  return (
    <section className={styles.card} aria-label={`${label} capture`} data-local-optics-capture={label.toLowerCase()}>
      <h3>{label}</h3>
      {capture ? <canvas ref={canvas} className={styles.snapshot} aria-hidden="true" /> : <p className={styles.muted}>Not captured</p>}
      {m && <CaptureFacts measurement={m} />}
    </section>
  );
}

function CaptureFacts({ measurement: m }: { measurement: CaptureMeasurement }) {
  const settings = Object.entries(m.camera.settings);
  return (
    <>
      <p data-local-optics-frames>
        {m.frameCount} frames · {m.frameSize.width}×{m.frameSize.height} · faces per frame{' '}
        {m.faceCounts.length ? `${Math.min(...m.faceCounts)}–${Math.max(...m.faceCounts)}` : 'not measured'}
      </p>
      {m.rejections.length > 0 ? (
        <ul className={styles.rejections} data-local-optics-rejections>
          {m.rejections.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p data-local-optics-rejections>No capture gate failed</p>
      )}
      <p className={styles.muted}>
        Whole-frame brightness {m.frameLuma.value?.toFixed(1) ?? '—'} · pixel motion {m.pixelMotion.value?.toFixed(2) ?? '—'}
      </p>
      <details>
        <summary>Camera-reported settings ({settings.length})</summary>
        <dl className={styles.settings}>
          {settings.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}

export function LocalOptics({ deps }: { deps?: OpticsSessionDeps } = {}) {
  const video = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<OpticsSession | null>(null);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'failed'>('off');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelState>({ kind: 'off' });
  const [busy, setBusy] = useState<Slot | null>(null);
  const [live, setLive] = useState<LiveReading | null>(null);
  const [captures, setCaptures] = useState<Record<Slot, OpticsCapture | null>>({ baseline: null, comparison: null });

  const [generation, setGeneration] = useState(0);

  // One session per mount; StrictMode's remount gets a fresh one and the old one is disposed.
  // Leaving the page (pagehide) also releases the camera and model, then starts a clean session.
  useEffect(() => {
    const next = new OpticsSession(deps ?? browserOpticsDeps(() => loadMediaPipeLandmarker()));
    setSession(next);
    setCamera('off');
    setCameraError(null);
    setModel({ kind: 'off' });
    setCaptures({ baseline: null, comparison: null });
    const onPageHide = () => {
      next.dispose(); // synchronously: the page may not render again before it is hidden
      setGeneration((g) => g + 1);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      next.dispose();
    };
  }, [deps, generation]);

  // Live readout: one real model reading about four times a second, only while the camera and
  // model are both running. Nothing is kept; each reading replaces the last.
  useEffect(() => {
    if (!session || camera !== 'on' || model.kind !== 'ready') {
      setLive(null);
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 250 && video.current) {
        last = now;
        try {
          const reading = session.liveReading(video.current, now);
          if (reading) setLive(reading);
        } catch {
          setLive(null);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [session, camera, model.kind]);

  const comparison =
    captures.baseline && captures.comparison
      ? compareCaptures(captures.baseline.measurement, captures.comparison.measurement)
      : null;

  const startCamera = async () => {
    if (!video.current || !session) return;
    setCamera('starting');
    setCameraError(null);
    try {
      const result = await session.startCamera(video.current);
      if (result.ok) setCamera('on');
      else {
        setCamera('failed');
        setCameraError(result.reason);
      }
    } catch {
      setCamera('failed');
      setCameraError('no_frames');
    }
  };

  const loadModel = async () => {
    if (!session) return;
    setModel({ kind: 'loading' });
    try {
      setModel({ kind: 'ready', name: await session.loadLandmarks() });
    } catch (error) {
      setModel({ kind: 'failed', message: error instanceof Error ? error.message : 'Model could not load' });
    }
  };

  const capture = async (slot: Slot) => {
    if (!video.current || !session) return;
    setBusy(slot);
    try {
      const next = await session.capture(video.current);
      setCaptures((current) => {
        session.releaseCanvas(current[slot]?.snapshot);
        return { ...current, [slot]: next };
      });
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    if (!session) return;
    setCaptures((current) => {
      session.releaseCanvas(current.baseline?.snapshot);
      session.releaseCanvas(current.comparison?.snapshot);
      return { baseline: null, comparison: null };
    });
  };

  return (
    <main className={styles.page} data-local-optics>
      <header className={styles.header}>
        <p className={styles.tag} data-local-optics-label>
          EXPERIMENTAL · UNVALIDATED · {LOCAL_OPTICS_METRICS_VERSION}
        </p>
        <h1>Local capture comparability</h1>
        <p>
          Measures capture conditions on this device. Not connected to Face Value results, verdicts or YouCam. Frames
          stay in this tab’s memory and are never uploaded or saved.
        </p>
      </header>

      <section className={styles.stage}>
        <video ref={video} className={styles.preview} muted playsInline aria-label="Camera preview" />
        <div className={styles.controls}>
          <button type="button" onClick={startCamera} disabled={!session || camera === 'on' || camera === 'starting'}>
            {camera === 'on' ? 'Camera on' : camera === 'starting' ? 'Starting…' : 'Start camera'}
          </button>
          <button type="button" onClick={loadModel} disabled={!session || model.kind === 'loading' || model.kind === 'ready'}>
            {model.kind === 'ready' ? 'Landmarks loaded' : model.kind === 'loading' ? 'Loading landmarks…' : 'Load face landmarks'}
          </button>
          <button type="button" onClick={() => capture('baseline')} disabled={camera !== 'on' || busy !== null}>
            {busy === 'baseline' ? 'Capturing…' : 'Capture baseline'}
          </button>
          <button type="button" onClick={() => capture('comparison')} disabled={camera !== 'on' || busy !== null}>
            {busy === 'comparison' ? 'Capturing…' : 'Capture comparison'}
          </button>
          <button type="button" onClick={reset} disabled={!captures.baseline && !captures.comparison}>
            Clear captures
          </button>
        </div>
        <p className={styles.live} data-local-optics-live aria-live="off">
          {live
            ? `Live · faces ${live.faceCount}` +
              (live.faceCount === 1
                ? ` · roll ${live.rollDegrees?.toFixed(1)}° · yaw ${live.yawDegrees?.toFixed(1) ?? '—'}° · size ${live.interocularFraction?.toFixed(3)}${live.outOfFrame ? ' · OUT OF FRAME' : ''}`
                : '')
            : 'Live · start the camera and load landmarks'}
        </p>
        <p className={styles.status} role="status" data-local-optics-status>
          Camera: {camera}
          {cameraError ? ` (${cameraError})` : ''} · Landmarks:{' '}
          {model.kind === 'ready'
            ? model.name
            : model.kind === 'failed'
              ? `unavailable (${model.message})`
              : model.kind === 'loading'
                ? 'loading'
                : 'not loaded'}
        </p>
        <p className={styles.muted}>
          Loading landmarks fetches MediaPipe Tasks Vision {MEDIAPIPE_TASKS_VISION_VERSION} and{' '}
          {LOCAL_OPTICS_MODEL.variant} from this site, checks the model’s SHA-256, and runs it in this tab. No camera
          frame is sent anywhere.
        </p>
      </section>

      <div className={styles.captures}>
        <CaptureCard label="Baseline" capture={captures.baseline} />
        <CaptureCard label="Comparison" capture={captures.comparison} />
      </div>

      {comparison && (
        <section className={styles.card} aria-label="Comparison" data-local-optics-comparison={comparison.overall}>
          <h2>{OVERALL_TEXT[comparison.overall]}</h2>
          {comparison.reasons.length > 0 && (
            <ul className={styles.rejections}>
              {comparison.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Kind</th>
                  <th>Base</th>
                  <th>Comp</th>
                  <th>Δ</th>
                  <th>vs exp. tolerance</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((r) => (
                  <tr key={r.property} data-status={r.status}>
                    <th scope="row">{r.property}</th>
                    <td>{r.provenance.replace('_', ' ')}</td>
                    <td>{formatValue(r.property, r.baseline)}</td>
                    <td>{formatValue(r.property, r.comparison)}</td>
                    <td>{formatDifference(r)}</td>
                    <td>{STATUS_TEXT[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.muted}>
            Not assessed: {comparison.notAssessed.join('; ')}. Tolerances {EXPERIMENTAL_TOLERANCES.version} are exploratory
            and unvalidated.
          </p>
        </section>
      )}

      <section className={styles.card} aria-label="Capability matrix">
        <h2>What this measures</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <tbody>
              {CAPABILITIES.map(([property, kind, how]) => (
                <tr key={property}>
                  <th scope="row">{property}</th>
                  <td>{kind}</td>
                  <td>{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
