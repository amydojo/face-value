import { useEffect, useRef, useState } from 'react';
import { GUIDE, type GuideState, type Observation } from './guidance';
import {
  LOCAL_OPTICS_MODEL,
  MEDIAPIPE_TASKS_VISION_VERSION,
  type LandmarkerInitReport as LandmarkerInit,
} from './landmarkSource';
import {
  EXPERIMENTAL_TOLERANCES,
  LANDMARK,
  LOCAL_OPTICS_METRICS_VERSION,
  type CaptureComparison,
  type CaptureMeasurement,
  type ComparisonRow,
} from './opticsMetrics';
import { buildTestReport, exportLog, exportPair, type ExportedPair } from './opticsExport';
import type { OpticsCapture } from './opticsSession';
import { summarize, type ScanRecord } from './scanMetrics';
import styles from './LocalOptics.module.css';

// Engineering view of the experiment: every number, gate and diagnostic, collapsed by default.

const CAPABILITIES: Array<[string, string, string]> = [
  [
    'Face presence and count',
    'Measured',
    'Landmark model, every frame; two faces are detected and rejected',
  ],
  ['Head roll', 'Measured', 'Angle of the outer-eye line in the image'],
  [
    'Head yaw and pitch',
    'Model estimate',
    'From the landmark model’s transformation matrix; sign convention not device-verified',
  ],
  ['Apparent face size', 'Measured', 'Outer-eye distance as a share of frame width'],
  ['Crop position and margins', 'Measured', 'Landmark bounding box in the frame'],
  [
    'Motion during capture',
    'Measured',
    'Landmark movement between frames; whole-frame pixel change',
  ],
  [
    'Face brightness, spread, clipping',
    'Measured (relative)',
    'Camera-processed pixels with auto exposure, not illuminance',
  ],
  [
    'Side shading',
    'Measured (proxy)',
    'Left vs right face brightness, not a light-direction estimate',
  ],
  [
    'Scene colour outside the face',
    'Estimate',
    'Moves with background content and auto white balance',
  ],
  ['Colour cast', 'Unavailable', 'Needs a neutral reference in frame; skin colour is never used'],
  ['Illuminance, colour temperature', 'Unavailable', 'No photometric access from the browser'],
  [
    'Exposure, white balance, ISO',
    'Reported only if the browser exposes them',
    'Listed below per capture',
  ],
];

const formatValue = (property: string, value: number | null) => {
  if (value === null) return '—';
  if (['Roll', 'Yaw', 'Pitch'].includes(property)) return `${value.toFixed(1)}°`;
  if (property === 'Apparent size' || property === 'Face brightness') return value.toFixed(3);
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(3);
};

const formatDifference = (r: ComparisonRow) => {
  if (r.difference === null) return '—';
  if (r.property === 'Apparent size' || r.property === 'Face brightness')
    return `${(r.difference * 100).toFixed(1)}%`;
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

const n = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

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
    context.strokeRect(
      l * target.width,
      t * target.height,
      (r - l) * target.width,
      (b - t) * target.height,
    );
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

function LatestCapture({ capture }: { capture: OpticsCapture | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current && capture && !capture.released) drawSnapshot(canvas.current, capture);
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
    <section className={styles.card} aria-label="Latest capture" data-local-optics-capture="latest">
      <h3>Latest burst</h3>
      {!capture ? (
        <p className={styles.muted}>Not captured</p>
      ) : capture.released ? (
        <p className={styles.muted} data-snapshot-released>
          Frame released from memory when the scan ended. Numbers only below.
        </p>
      ) : (
        <canvas ref={canvas} className={styles.snapshot} aria-hidden="true" />
      )}
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
        {m.faceCounts.length
          ? `${Math.min(...m.faceCounts)}–${Math.max(...m.faceCounts)}`
          : 'not measured'}
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
        Landmark motion {n(m.landmarkMotion.value, 4)} (gate{' '}
        {EXPERIMENTAL_TOLERANCES.maxLandmarkMotion}) · face clipped {n(m.faceClipped.value, 4)} ·
        whole-frame brightness {n(m.frameLuma.value, 1)} · pixel motion {n(m.pixelMotion.value, 2)}
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

export interface DiagnosticsProps {
  camera: string;
  permission: string;
  webgl2: string;
  settings: Record<string, string | number | boolean> | null;
  frame: { width: number; height: number } | null;
  init: LandmarkerInit | null;
  requestedDelegate: 'auto' | 'CPU';
  backgroundPauses: number;
}

function Diagnostics(props: DiagnosticsProps) {
  const { settings, frame, init } = props;
  const rows: Array<[string, string]> = [
    [
      'Secure context (HTTPS)',
      globalThis.isSecureContext ? 'yes' : 'NO: the camera will be refused',
    ],
    [
      'Camera API',
      typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'available' : 'unavailable',
    ],
    ['Camera permission', props.permission],
    ['Camera', props.camera],
    ['Facing mode', settings ? String(settings.facingMode ?? 'not reported') : '—'],
    [
      'Frame',
      frame && frame.width
        ? `${frame.width}×${frame.height} ${frame.height > frame.width ? 'portrait' : 'landscape'}${settings?.frameRate ? ` · ${Number(settings.frameRate).toFixed(0)} fps` : ''}`
        : '—',
    ],
    ['WebGL2', props.webgl2],
    [
      'Delegate requested',
      props.requestedDelegate === 'CPU' ? 'CPU (?delegate=cpu)' : 'GPU, CPU fallback',
    ],
    [
      'Delegate in use',
      init ? `${init.delegate}${init.gpuFailure ? ` (GPU failed: ${init.gpuFailure})` : ''}` : '—',
    ],
    ['Model initialisation', init ? `${init.initMs} ms` : '—'],
    ['Background pauses', String(props.backgroundPauses)],
  ];
  return (
    <section className={styles.card} aria-label="Device diagnostics" data-local-optics-diagnostics>
      <h2>Device diagnostics</h2>
      <dl className={styles.settings}>
        {rows.map(([k, v]) => (
          <div key={k} data-diagnostic={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LiveNumbers({
  live,
  guide,
  modelName,
}: {
  live: Observation | null;
  guide: GuideState | null;
  modelName: string | null;
}) {
  const f = live?.face;
  return (
    <section className={styles.card} aria-label="Live readings">
      <h2>Live readings</h2>
      <p className={styles.mono} data-local-optics-live>
        {live
          ? `faces ${live.faceCount}` +
            (f
              ? ` · roll ${f.roll.toFixed(1)}° · yaw ${n(f.yaw, 1)}° · pitch ${n(f.pitch, 1)}° · size ${f.interocular.toFixed(3)} · x ${f.centerX.toFixed(3)} · y ${f.centerY.toFixed(3)} · margin ${f.edgeMargin.toFixed(3)}${f.outOfFrame ? ' · OUT OF FRAME' : ''}`
              : '') +
            ` · speed ${n(live.speed, 2)} iod/s · face luma ${n(live.light?.faceLuma, 0)} · clipped ${n(live.light?.clipped, 3)} · shading ${n(live.light?.shading, 3)}`
          : 'No live reading'}
      </p>
      <p className={styles.mono} data-local-optics-guide>
        {guide
          ? `guide ${guide.instruction.id} · aligned ${guide.aligned} · hold ${guide.hold.toFixed(2)} · blocking ${
              Object.entries(guide.blocking)
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join('+') || 'none'
            } · corrections ${guide.corrections}`
          : 'Guide not running'}
      </p>
      <p className={styles.muted} data-local-optics-model>
        Landmarks: {modelName ?? 'not loaded'}. MediaPipe Tasks Vision{' '}
        {MEDIAPIPE_TASKS_VISION_VERSION}, {LOCAL_OPTICS_MODEL.variant}, from this site, SHA-256
        checked, run in this tab. Guide {GUIDE.version}; tolerances{' '}
        {EXPERIMENTAL_TOLERANCES.version}.
      </p>
    </section>
  );
}

function ComparisonTable({ comparison }: { comparison: CaptureComparison }) {
  return (
    <>
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
        Not assessed: {comparison.notAssessed.join('; ')}. Tolerances{' '}
        {EXPERIMENTAL_TOLERANCES.version} are exploratory and unvalidated.
      </p>
    </>
  );
}

async function copy(text: string, done: (state: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    done('Copied');
  } catch {
    done('Copy failed: select the text and copy it');
  }
}

export interface LabPanelProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  diagnostics: DiagnosticsProps;
  live: Observation | null;
  guide: GuideState | null;
  modelName: string | null;
  latest: OpticsCapture | null;
  baseline: CaptureMeasurement | null;
  followUp: CaptureMeasurement | null;
  comparison: CaptureComparison | null;
  scans: ScanRecord[];
  modelInit: LandmarkerInit | null;
  /** Every follow-up comparison this session, recorded automatically. */
  comparisons: ExportedPair[];
  /** The last camera frame size seen, kept after the camera stops. */
  lastFrame: { width: number; height: number } | null;
}

const OVERALL_SHORT: Record<CaptureComparison['overall'], string> = {
  within_experimental_tolerances: 'matched',
  not_comparable: 'not comparable',
  insufficient_evidence: 'insufficient evidence',
};

/** The first thing in the Lab: what was tested, and one button to copy all of it. */
function TestReportCard(props: LabPanelProps) {
  const [state, setState] = useState<{ copied: boolean; text: string } | null>(null);
  const summary = summarize(props.scans);
  const latest = props.comparisons.at(-1);
  const make = () =>
    JSON.stringify(
      buildTestReport({
        scans: props.scans,
        comparisons: props.comparisons,
        init: props.modelInit,
        requestedDelegate: props.diagnostics.requestedDelegate,
        frame: props.lastFrame,
      }),
      null,
      2,
    );
  return (
    <section className={styles.reportCard} aria-label="Test report" data-test-report>
      <h2>Test report</h2>
      <p className={styles.reportFacts} data-test-report-summary>
        {summary.scans} scan{summary.scans === 1 ? '' : 's'} · {summary.accepted} accepted ·{' '}
        {summary.rejectedBursts} refused burst
        {summary.rejectedBursts === 1 ? '' : 's'}
        {summary.medianTimeToAcceptMs !== null
          ? ` · median ${(summary.medianTimeToAcceptMs / 1000).toFixed(1)} s to capture`
          : ''}
        {latest ? ` · latest follow-up ${OVERALL_SHORT[latest.overall]}` : ''}
        {props.modelInit ? ` · ${props.modelInit.delegate}` : ''}
      </p>
      <button
        type="button"
        className={styles.reportButton}
        onClick={async () => {
          const text = make();
          try {
            await navigator.clipboard.writeText(text);
            setState({ copied: true, text });
          } catch {
            setState({ copied: false, text });
          }
        }}
      >
        Copy test report
      </button>
      {state?.copied && (
        <p role="status" className={styles.muted}>
          Copied. Paste it into a note or message.
        </p>
      )}
      {state && !state.copied && (
        <>
          <p role="status" className={styles.muted}>
            Copy was blocked. Select the text below and copy it.
          </p>
          <textarea
            className={styles.export}
            readOnly
            aria-label="Test report JSON"
            value={state.text}
            onFocus={(e) => e.currentTarget.select()}
          />
        </>
      )}
      <p className={styles.muted}>
        Usability numbers and every follow-up comparison from this tab. Numbers only: no images,
        landmarks, face templates or device identifiers. Nothing is sent; you paste it.
      </p>
    </section>
  );
}

export function LabPanel(props: LabPanelProps) {
  const { comparison } = props;
  const [label, setLabel] = useState('');
  const [log, setLog] = useState<ExportedPair[]>([]);
  const [copyState, setCopyState] = useState<string | null>(null);
  const summary = summarize(props.scans);
  const logJson = JSON.stringify(
    exportLog(
      log,
      comparison ?? {
        metricsVersion: LOCAL_OPTICS_METRICS_VERSION,
        tolerancesVersion: EXPERIMENTAL_TOLERANCES.version,
      },
      props.modelInit,
      navigator.userAgent,
    ),
    null,
    2,
  );
  const scansJson = JSON.stringify({ summary, scans: props.scans }, null, 2);

  return (
    <details
      className={styles.lab}
      open={props.open}
      onToggle={(event) => props.onToggle((event.currentTarget as HTMLDetailsElement).open)}
      data-local-optics-lab
      id="local-optics-lab"
    >
      <summary>
        <span>Lab</span>
        <span className={styles.labHint}>
          Numbers, gates and diagnostics · experimental · unvalidated
        </span>
      </summary>
      <div className={styles.labBody}>
        <TestReportCard {...props} />
        <details className={styles.labDetails} data-lab-details>
          <summary>Diagnostics and details</summary>
          <div className={styles.labDetailsBody}>
            <p className={styles.tag} data-local-optics-label>
              EXPERIMENTAL · UNVALIDATED · {LOCAL_OPTICS_METRICS_VERSION}
            </p>
            <LiveNumbers live={props.live} guide={props.guide} modelName={props.modelName} />
            <Diagnostics {...props.diagnostics} />
            <LatestCapture capture={props.latest} />

            {comparison && props.baseline && props.followUp && (
              <section
                className={styles.card}
                aria-label="Comparison"
                data-local-optics-comparison={comparison.overall}
              >
                <ComparisonTable comparison={comparison} />
                <div className={styles.labControls} data-local-optics-export>
                  <input
                    aria-label="Pair label"
                    placeholder="Pair label, e.g. A01 repeat"
                    value={label}
                    maxLength={40}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLog((current) => [
                        ...current,
                        exportPair(label, comparison, props.baseline!, props.followUp!),
                      ]);
                      setLabel('');
                      setCopyState(null);
                    }}
                  >
                    Add pair to log
                  </button>
                </div>
              </section>
            )}

            {log.length > 0 && (
              <section
                className={styles.card}
                aria-label="Numeric log"
                data-local-optics-log={log.length}
              >
                <h2>
                  Numeric log · {log.length} pair{log.length === 1 ? '' : 's'}
                </h2>
                <p className={styles.muted}>
                  Numbers only: no images, landmarks or device identifiers. Kept in this tab until
                  you clear it or leave the page. Nothing is sent; copy it out yourself.
                </p>
                <textarea
                  className={styles.export}
                  readOnly
                  aria-label="Numeric log JSON"
                  value={logJson}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className={styles.labControls}>
                  <button type="button" onClick={() => copy(logJson, setCopyState)}>
                    Copy log
                  </button>
                  <button type="button" onClick={() => setLog([])}>
                    Clear log
                  </button>
                </div>
              </section>
            )}

            <section
              className={styles.card}
              aria-label="Usability log"
              data-local-optics-usability={props.scans.length}
            >
              <h2>
                Usability log · {props.scans.length} scan{props.scans.length === 1 ? '' : 's'}
              </h2>
              <p className={styles.muted}>
                Exploratory measures, not validated quality thresholds. Accepted {summary.accepted},
                cancelled {summary.cancelled}; median time to accepted capture{' '}
                {summary.medianTimeToAcceptMs === null
                  ? '—'
                  : `${(summary.medianTimeToAcceptMs / 1000).toFixed(1)} s`}
                ; median corrections {summary.medianCorrections ?? '—'}; bursts {summary.bursts},
                rejected {summary.rejectedBursts}.
              </p>
              <textarea
                className={styles.export}
                readOnly
                aria-label="Usability log JSON"
                value={scansJson}
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className={styles.labControls}>
                <button type="button" onClick={() => copy(scansJson, setCopyState)}>
                  Copy usability log
                </button>
              </div>
            </section>
            {copyState && <p className={styles.muted}>{copyState}</p>}

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
          </div>
        </details>
      </div>
    </details>
  );
}
