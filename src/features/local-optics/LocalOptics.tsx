import { useEffect, useMemo, useRef, useState } from 'react';
import { FaceValueActuator } from '../../components/FaceValueActuator';
import { GuideOverlay, type OverlayMode } from './GuideOverlay';
import {
  baselineTemplate,
  CaptureGuide,
  instructionFor,
  mismatchReasons,
  rejectionMessage,
  retainedBaselineMeasurement,
  type BaselineTemplate,
  type GuideState,
  type Instruction,
  type Observation,
} from './guidance';
import { LabPanel } from './LabPanel';
import { loadMediaPipeLandmarker } from './landmarkSource';
import { compareCaptures, type CaptureComparison, type CaptureMeasurement } from './opticsMetrics';
import { browserOpticsDeps, CAPTURE_FRAMES, OpticsSession, type OpticsCapture, type OpticsSessionDeps } from './opticsSession';
import { newScanRecord, type ScanOutcome, type ScanRecord } from './scanMetrics';
import styles from './LocalOptics.module.css';

// Guided, hand-held-first capture for the Local Optics experiment. The person sees the camera, an
// outline, one instruction and one action; every number lives in the collapsed Lab panel.

type Failure = 'denied' | 'no_camera' | 'unsupported' | 'insecure' | 'camera' | 'model';

type ScanResult =
  | { kind: 'baseline' }
  | { kind: 'match'; comparison: CaptureComparison }
  | { kind: 'mismatch'; comparison: CaptureComparison; reasons: string[] }
  | { kind: 'insufficient'; comparison: CaptureComparison };

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'live' }
  | { kind: 'capturing'; trigger: 'auto' | 'manual'; done: number; total: number }
  | { kind: 'result'; result: ScanResult }
  | { kind: 'paused'; why: 'background' | 'interrupted' }
  | { kind: 'failed'; failure: Failure; detail?: string };

type ModelState = { kind: 'off' } | { kind: 'loading' } | { kind: 'ready'; name: string } | { kind: 'failed'; message: string };

interface Baseline {
  template: BaselineTemplate;
  measurement: CaptureMeasurement;
}

/** Automatic bursts rejected in a row before auto-capture pauses and asks the person. */
export const MAX_AUTO_REJECTIONS = 3;
/** Time in the live guide without a capture before the help card appears. */
export const DEFAULT_HELP_AFTER_MS = 25_000;

const FAILURE_COPY: Record<Failure, { title: string; detail: string }> = {
  denied: {
    title: 'Camera access is off',
    detail: 'Allow camera access for this site, then try again. In Safari, tap ᴀA in the address bar, then Website Settings, then Camera.',
  },
  no_camera: { title: 'No camera found', detail: 'This device did not offer a camera to the browser.' },
  unsupported: { title: 'This browser can’t open the camera', detail: 'Open this page in Safari on iPhone.' },
  insecure: { title: 'This page needs a secure address', detail: 'The camera only works over https://.' },
  camera: { title: 'The camera didn’t start', detail: 'Close other apps that might be using the camera, then try again.' },
  model: { title: 'The face guide couldn’t load', detail: 'Check your connection, then try again.' },
};

const HELP_TIPS: Record<string, string> = {
  stillness: 'Rest your elbows on a table, or lean the phone against something steady.',
  light: 'Face a window or a soft lamp, away from bright light behind you.',
  alignment: 'Hold the phone at eye level, about an arm’s length away.',
  face: 'Make sure your face is well lit and fully in view.',
};

const now = () => performance.now();

export function LocalOptics({ deps }: { deps?: OpticsSessionDeps } = {}) {
  const video = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<OpticsSession | null>(null);
  const [generation, setGeneration] = useState(0);
  const [phase, setPhaseState] = useState<Phase>({ kind: 'idle' });
  const [model, setModel] = useState<ModelState>({ kind: 'off' });
  const [live, setLive] = useState<Observation | null>(null);
  const [guide, setGuide] = useState<GuideState | null>(null);
  const [notice, setNotice] = useState<{ title: string; detail: string; key: number } | null>(null);
  const [help, setHelp] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [latest, setLatest] = useState<OpticsCapture | null>(null);
  const [followUp, setFollowUp] = useState<CaptureMeasurement | null>(null);
  const [comparison, setComparison] = useState<CaptureComparison | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [labOpen, setLabOpen] = useState(false);
  const [backgroundPauses, setBackgroundPauses] = useState(0);
  const [permission, setPermission] = useState('not checked');
  const [reducedMotion, setReducedMotion] = useState(false);

  const phaseRef = useRef<Phase>(phase);
  const setPhase = (next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const guideRef = useRef<CaptureGuide | null>(null);
  const recordRef = useRef<ScanRecord | null>(null);
  const t0 = useRef(0);
  const autoRejections = useRef(0);
  const liveSince = useRef(0);
  const lastFrame = useRef<string>('');
  const lastRejections = useRef<string[]>([]);

  const params = useMemo(() => new URLSearchParams(globalThis.location?.search ?? ''), []);
  // ?delegate=cpu skips the GPU attempt; ?helpAfter=<s> shortens the help timer for device tests.
  const requestedDelegate: 'auto' | 'CPU' = params.get('delegate') === 'cpu' ? 'CPU' : 'auto';
  const helpAfterMs = Number(params.get('helpAfter')) > 0 ? Number(params.get('helpAfter')) * 1000 : DEFAULT_HELP_AFTER_MS;
  const webgl2 = useMemo(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return gl ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }, []);

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const elapsed = () => Math.round(now() - t0.current);

  const finishRecord = (outcome: ScanOutcome) => {
    const record = recordRef.current;
    if (!record) return;
    recordRef.current = null;
    const done = { ...record, outcome, endedMs: elapsed(), instructions: [...record.instructions], bursts: [...record.bursts] };
    setScans((current) => [...current, done]);
  };

  /** Drops the last analysed frame's pixels; its numbers stay for the Lab. */
  const releaseSnapshot = () => {
    setLatest((previous) => {
      if (!previous || previous.released) return previous;
      session?.releaseCanvas(previous.snapshot);
      return { ...previous, released: true };
    });
  };

  const clearLive = () => {
    setLive(null);
    setGuide(null);
    setHelp(false);
  };

  // One session per mount; StrictMode's remount gets a fresh one and the old one is disposed.
  // Leaving the page (pagehide) releases the camera and model, then starts a clean session.
  useEffect(() => {
    const next = new OpticsSession(deps ?? browserOpticsDeps(() => loadMediaPipeLandmarker(undefined, undefined, requestedDelegate)));
    setSession(next);
    setModel({ kind: 'off' });
    setPhase({ kind: 'idle' });
    setLatest(null);
    clearLive();
    const onPageHide = () => {
      next.dispose(); // synchronously: the page may not render again before it is hidden
      finishRecord('interrupted');
      setGeneration((g) => g + 1);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      next.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new session only on mount, deps or pagehide
  }, [deps, generation, requestedDelegate]);

  // Backgrounding (app switch, lock screen) stops the camera and any burst; the model stays.
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const kind = phaseRef.current.kind;
      if (kind === 'live' || kind === 'capturing' || kind === 'starting') {
        session.stopCamera();
        setBackgroundPauses((n) => n + 1);
        if (recordRef.current) recordRef.current.interruptions += 1;
        clearLive();
        setPhase({ kind: 'paused', why: 'background' });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (!permissions?.query) {
      setPermission('not exposed by this browser');
      return;
    }
    permissions
      .query({ name: 'camera' as PermissionName })
      .then((status) => !cancelled && setPermission(status.state))
      .catch(() => !cancelled && setPermission('not exposed by this browser'));
    return () => {
      cancelled = true;
    };
  }, [phase.kind]);

  // Notices disappear on their own.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(id);
  }, [notice]);

  const ensureModel = async (current: OpticsSession) => {
    if (current.modelName) return true;
    setModel({ kind: 'loading' });
    try {
      const name = await current.loadLandmarks();
      setModel({ kind: 'ready', name });
      if (recordRef.current && recordRef.current.guideReadyMs === null) recordRef.current.guideReadyMs = elapsed();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Model could not load';
      setModel({ kind: 'failed', message });
      if (current !== session) return false;
      const kind = phaseRef.current.kind;
      if (kind === 'starting' || kind === 'live') {
        current.stopCamera();
        clearLive();
        finishRecord('failed');
        setPhase({ kind: 'failed', failure: 'model', detail: message });
      }
      return false;
    }
  };

  const openCamera = async (current: OpticsSession) => {
    if (!video.current) return false;
    if (!globalThis.isSecureContext) {
      finishRecord('failed');
      setPhase({ kind: 'failed', failure: 'insecure' });
      return false;
    }
    setPhase({ kind: 'starting' });
    try {
      const result = await current.startCamera(video.current, () => {
        if (recordRef.current) recordRef.current.interruptions += 1;
        clearLive();
        setPhase({ kind: 'paused', why: 'interrupted' });
      });
      if (phaseRef.current.kind !== 'starting') {
        // Cancelled, backgrounded or failed while the camera was opening: release what arrived.
        current.stopCamera();
        return false;
      }
      if (!result.ok) {
        const failure: Failure =
          result.reason === 'denied' ? 'denied' : result.reason === 'no_camera' ? 'no_camera' : result.reason === 'unsupported' ? 'unsupported' : 'camera';
        finishRecord('failed');
        setPhase({ kind: 'failed', failure });
        return false;
      }
    } catch {
      current.stopCamera();
      finishRecord('failed');
      setPhase({ kind: 'failed', failure: 'camera' });
      return false;
    }
    if (recordRef.current && recordRef.current.cameraReadyMs === null) recordRef.current.cameraReadyMs = elapsed();
    guideRef.current?.reset();
    liveSince.current = now();
    setPhase({ kind: 'live' });
    return true;
  };

  /** "Start scan": lazily loads the model alongside the camera. */
  const beginScan = () => {
    if (!session) return;
    finishRecord('cancelled');
    recordRef.current = newScanRecord(baseline ? 'follow_up' : 'baseline');
    releaseSnapshot();
    t0.current = now();
    guideRef.current = new CaptureGuide(baseline?.template ?? null);
    autoRejections.current = 0;
    lastRejections.current = [];
    setAutoPaused(false);
    setNotice(null);
    clearLive();
    if (session.modelName && recordRef.current) recordRef.current.guideReadyMs = 0;
    void ensureModel(session);
    void openCamera(session);
  };

  const resume = () => {
    if (!session) return;
    if (!recordRef.current) {
      beginScan();
      return;
    }
    clearLive();
    void ensureModel(session);
    void openCamera(session);
  };

  const cancel = () => {
    session?.stopCamera();
    releaseSnapshot();
    finishRecord('cancelled');
    clearLive();
    setNotice(null);
    setPhase({ kind: 'idle' });
  };

  const finish = () => {
    session?.stopCamera();
    releaseSnapshot();
    clearLive();
    setPhase({ kind: 'idle' });
  };

  const evaluate = (capture: OpticsCapture, trigger: 'auto' | 'manual', aligned: boolean) => {
    if (!session) return;
    const m = capture.measurement;
    const accepted = m.rejections.length === 0;
    recordRef.current?.bursts.push({
      trigger,
      accepted,
      rejections: [...m.rejections],
      aligned,
      landmarkMotion: m.landmarkMotion.value === null ? null : Math.round(m.landmarkMotion.value * 1e5) / 1e5,
      frameIntervalMs: capture.frameIntervalMs === null ? null : Math.round(capture.frameIntervalMs),
    });
    setLatest((previous) => {
      session.releaseCanvas(previous?.snapshot);
      return capture;
    });

    if (!accepted) {
      autoRejections.current += 1;
      lastRejections.current = [...m.rejections];
      setNotice({ ...rejectionMessage(m.rejections), key: now() });
      guideRef.current?.reset();
      liveSince.current = now();
      if (trigger === 'auto' && autoRejections.current >= MAX_AUTO_REJECTIONS) {
        setAutoPaused(true);
        setHelp(true);
        if (recordRef.current) recordRef.current.helpShown = true;
      }
      setPhase({ kind: 'live' });
      return;
    }

    if (recordRef.current) {
      recordRef.current.trigger = trigger;
      recordRef.current.acceptedMs = elapsed();
    }
    session.stopCamera();
    clearLive();
    if (!baseline) {
      const template = baselineTemplate(m);
      if (template) setBaseline({ template, measurement: retainedBaselineMeasurement(m) });
      finishRecord('accepted');
      setPhase({ kind: 'result', result: { kind: 'baseline' } });
      return;
    }
    const result = compareCaptures(baseline.measurement, m);
    setFollowUp(m);
    setComparison(result);
    if (recordRef.current) recordRef.current.comparison = result.overall;
    finishRecord('accepted');
    setPhase({
      kind: 'result',
      result:
        result.overall === 'within_experimental_tolerances'
          ? { kind: 'match', comparison: result }
          : result.overall === 'not_comparable'
            ? { kind: 'mismatch', comparison: result, reasons: mismatchReasons(result.rows) }
            : { kind: 'insufficient', comparison: result },
    });
  };

  const burst = async (trigger: 'auto' | 'manual', aligned: boolean) => {
    if (!session || !video.current || session.busy || !session.cameraActive) return;
    setPhase({ kind: 'capturing', trigger, done: 0, total: CAPTURE_FRAMES });
    try {
      const capture = await session.capture(video.current, CAPTURE_FRAMES, (done, total) => {
        if (phaseRef.current.kind === 'capturing') setPhase({ kind: 'capturing', trigger, done, total });
      });
      if (phaseRef.current.kind !== 'capturing') {
        session.releaseCanvas(capture.snapshot);
        return;
      }
      evaluate(capture, trigger, aligned);
    } catch (error) {
      // Cancel, background and interruption already moved the phase on; anything else retries.
      if (phaseRef.current.kind !== 'capturing') return;
      const message = error instanceof Error ? error.message : '';
      guideRef.current?.reset();
      setNotice(
        message === 'Camera orientation changed'
          ? { title: 'The phone turned', detail: 'Hold it in one position while capturing', key: now() }
          : { title: 'Capture didn’t finish', detail: 'Try again', key: now() },
      );
      setPhase({ kind: 'live' });
    }
  };

  // The live guide: a model reading about ten times a second while the camera and model run.
  const onObservation = useRef<(o: Observation) => void>(() => undefined);
  onObservation.current = (o: Observation) => {
    const g = guideRef.current;
    const record = recordRef.current;
    if (!g) return;
    const frameKey = `${o.frame.width}x${o.frame.height}`;
    if (lastFrame.current && frameKey !== lastFrame.current) g.reset(); // rotation
    lastFrame.current = frameKey;
    const state = g.update(o);
    setLive(o);
    setGuide(state);
    if (record) {
      if (record.firstFaceMs === null && o.faceCount === 1) record.firstFaceMs = elapsed();
      if (record.firstAlignedMs === null && state.aligned) record.firstAlignedMs = elapsed();
      record.corrections = state.corrections;
      record.instructions = state.shown;
    }
    if (!help && now() - liveSince.current > helpAfterMs) {
      setHelp(true);
      if (record) record.helpShown = true;
    }
    if (state.fire && !autoPaused) void burst('auto', true);
  };

  const guideRunning = phase.kind === 'live' && model.kind === 'ready';
  useEffect(() => {
    if (!guideRunning || !session) return;
    let raf = 0;
    let last = 0;
    let interval = 100;
    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      if (time - last < interval || !video.current) return;
      last = time;
      const started = now();
      let observation: Observation | null;
      try {
        observation = session.liveObservation(video.current, time);
      } catch {
        return;
      }
      // Slower devices get fewer readings rather than a stalled preview.
      interval = Math.min(400, Math.max(100, (now() - started) * 2.5));
      if (observation) onObservation.current(observation);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [guideRunning, session]);

  // ---------- Presentation ----------

  const followUpMode = baseline !== null;
  const cameraVisible = phase.kind === 'starting' || phase.kind === 'live' || phase.kind === 'capturing';
  const instruction: Instruction =
    phase.kind === 'capturing'
      ? { id: 'aligned', category: 'ready', title: 'Capturing', detail: 'Hold still' }
      : phase.kind === 'starting'
        ? { id: 'preparing', category: 'face', title: 'Opening the camera', detail: 'Allow camera access if asked' }
        : model.kind !== 'ready'
          ? instructionFor('preparing', followUpMode)
          : guide?.instruction.id === 'aligned' && autoPaused
            ? { id: 'aligned', category: 'ready', title: 'Ready', detail: 'Tap the button to capture' }
            : (guide?.instruction ?? instructionFor('looking', followUpMode));
  const overlayMode: OverlayMode =
    phase.kind === 'capturing'
      ? 'capturing'
      : !guideRunning || !guide
        ? 'off'
        : !live?.face
          ? 'searching'
          : guide.instruction.id === 'aligned'
            ? 'aligned'
            : 'guiding';
  const ring = phase.kind === 'capturing' ? phase.done / phase.total : guide?.instruction.id === 'aligned' && !autoPaused ? guide.hold : 0;
  const rail = (['light', 'alignment', 'stillness'] as const).map((category) => {
    const state = !guide || !live?.face ? 'pending' : guide.blocking[category] ? (guide.instruction.category === category ? 'active' : 'pending') : 'done';
    return { category, state };
  });
  const helpTip = (() => {
    // The reason bursts failed is the best hint; otherwise the most frequent recent instruction.
    const rejected = lastRejections.current;
    if (rejected.includes('motion')) return HELP_TIPS.stillness;
    if (rejected.includes('clipped_highlights')) return HELP_TIPS.light;
    if (rejected.some((r) => ['face_out_of_frame', 'no_face', 'unstable_face_count'].includes(r))) return HELP_TIPS.alignment;
    const shown = guide?.shown.slice(-6) ?? [];
    const counts = new Map<string, number>();
    for (const id of shown) {
      const category = instructionFor(id, followUpMode).category;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'alignment';
    return HELP_TIPS[top] ?? HELP_TIPS.alignment;
  })();

  const openLab = () => {
    setLabOpen(true);
    requestAnimationFrame(() => document.getElementById('local-optics-lab')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }));
  };

  return (
    <main className={styles.page} data-local-optics data-phase={phase.kind} data-scan-log={JSON.stringify(scans)}>
      <section className={styles.chamber} data-camera={cameraVisible ? 'on' : 'off'} aria-label="Face scan">
        <video ref={video} className={styles.video} muted playsInline aria-label="Camera preview" hidden={!cameraVisible} />
        {cameraVisible && (
          <GuideOverlay
            video={video.current}
            frame={live?.frame ?? null}
            target={guide?.target ?? null}
            face={live?.face ?? null}
            nudge={guide?.nudge ?? null}
            mode={overlayMode}
            reducedMotion={reducedMotion}
          />
        )}
        <div className={styles.shade} aria-hidden="true" />

        <header className={styles.topbar}>
          {cameraVisible ? (
            <button type="button" className={styles.textButton} onClick={cancel} aria-label="Cancel scan">
              <span aria-hidden="true">✕</span> Cancel
            </button>
          ) : (
            <span className={styles.tag}>Experimental · unvalidated</span>
          )}
          {cameraVisible && <span className={styles.mode}>{followUpMode ? 'Follow-up' : 'Baseline'}</span>}
          <button type="button" className={styles.textButton} onClick={openLab} aria-controls="local-optics-lab">
            Lab
          </button>
        </header>

        {cameraVisible ? (
          <>
            <div className={styles.instruction} data-instruction={instruction.id} data-category={instruction.category}>
              <p role="status" aria-live="polite" aria-atomic="true" className={styles.instructionText}>
                <span className={styles.instructionTitle}>{instruction.title}</span>
                <span className={styles.instructionDetail}>{instruction.detail}</span>
              </p>
              {notice && (
                <p className={styles.notice} role="alert" key={notice.key} data-notice>
                  <strong>{notice.title}.</strong> {notice.detail}
                </p>
              )}
            </div>

            {help && phase.kind === 'live' && (
              <aside className={styles.help} aria-label="Having trouble?" data-help>
                <p>
                  <strong>{autoPaused ? 'Hard to get a steady capture' : 'Having trouble?'}</strong> {helpTip}
                </p>
                <p className={styles.helpMuted}>You can also capture now with the button below.</p>
                {autoPaused && (
                  <button
                    type="button"
                    className={styles.helpButton}
                    onClick={() => {
                      autoRejections.current = 0;
                      setAutoPaused(false);
                      setHelp(false);
                      liveSince.current = now();
                      guideRef.current?.reset();
                    }}
                  >
                    Try automatic capture again
                  </button>
                )}
              </aside>
            )}

            <footer className={styles.deck}>
              <ol className={styles.rail} aria-label="Scan checks">
                {rail.map(({ category, state }) => (
                  <li key={category} data-rail={category} data-state={state} aria-label={`${category}: ${state === 'done' ? 'ready' : state === 'active' ? 'needs attention' : 'waiting'}`}>
                    <span className={styles.railLabel}>{category}</span>
                    <span className={styles.railMark} aria-hidden="true">
                      {state === 'done' ? '✓' : ''}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={styles.shutter}
                onClick={() => void burst('manual', guide?.aligned ?? false)}
                disabled={phase.kind !== 'live' || model.kind !== 'ready'}
                aria-label="Capture now"
                data-shutter
                data-hold={ring.toFixed(2)}
              >
                <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="46" className={styles.ringTrack} />
                  <circle cx="50" cy="50" r="46" className={styles.ringFill} style={{ strokeDashoffset: `${289 * (1 - ring)}` }} />
                </svg>
                <FaceValueActuator state={phase.kind === 'capturing' ? 'scanning' : overlayMode === 'aligned' ? 'ready' : 'rest'} />
              </button>
              <p className={styles.shutterCaption} aria-hidden="true">
                {phase.kind === 'capturing'
                  ? `${phase.done} of ${phase.total}`
                  : autoPaused
                    ? 'Tap to capture'
                    : overlayMode === 'aligned'
                      ? 'Capturing automatically'
                      : 'Captures automatically · tap to capture now'}
              </p>
            </footer>
          </>
        ) : (
          <Panel
            phase={phase}
            followUp={followUpMode}
            onStart={beginScan}
            onResume={resume}
            onDone={finish}
            onCancel={cancel}
            onNewBaseline={() => {
              setBaseline(null);
              setFollowUp(null);
              setComparison(null);
            }}
          />
        )}
      </section>

      <LabPanel
        open={labOpen}
        onToggle={setLabOpen}
        diagnostics={{
          camera: phase.kind === 'paused' ? `paused (${phase.why})` : cameraVisible ? (session?.cameraActive ? 'on' : 'starting') : 'off',
          permission,
          webgl2,
          settings: session?.cameraActive ? session.cameraSettings() : null,
          frame: live?.frame ?? null,
          init: model.kind === 'ready' ? (session?.modelInit ?? null) : null,
          requestedDelegate,
          backgroundPauses,
        }}
        live={live}
        guide={guide}
        modelName={model.kind === 'ready' ? model.name : model.kind === 'failed' ? `unavailable (${model.message})` : model.kind === 'loading' ? 'loading' : null}
        latest={latest}
        baseline={baseline?.measurement ?? null}
        followUp={followUp}
        comparison={comparison}
        scans={scans}
        modelInit={model.kind === 'ready' ? (session?.modelInit ?? null) : null}
      />
    </main>
  );
}

function Panel(props: {
  phase: Phase;
  followUp: boolean;
  onStart: () => void;
  onResume: () => void;
  onDone: () => void;
  onCancel: () => void;
  onNewBaseline: () => void;
}) {
  const { phase } = props;
  let eyebrow = props.followUp ? 'Follow-up scan' : 'Baseline scan';
  let title: string;
  let body: string;
  let list: string[] = [];
  let caveat: string | null = null;
  let primary: { label: string; action: () => void };
  let secondary: { label: string; action: () => void } | null;
  let mark: 'start' | 'done' | 'warn' = 'start';

  switch (phase.kind) {
    case 'paused':
      eyebrow = phase.why === 'background' ? 'Paused' : 'Interrupted';
      title = phase.why === 'background' ? 'Scan paused' : 'Camera interrupted';
      body =
        phase.why === 'background'
          ? 'The camera stops while Face Value is in the background.'
          : 'Another app or a call may have taken the camera.';
      primary = { label: 'Resume scan', action: props.onResume };
      secondary = { label: 'Cancel', action: props.onCancel };
      mark = 'warn';
      break;
    case 'failed':
      eyebrow = 'Can’t scan';
      title = FAILURE_COPY[phase.failure].title;
      body = FAILURE_COPY[phase.failure].detail;
      primary = { label: 'Try again', action: props.onStart };
      secondary = { label: 'Cancel', action: props.onCancel };
      mark = 'warn';
      break;
    case 'result': {
      const r = phase.result;
      eyebrow = r.kind === 'baseline' ? 'Baseline scan' : 'Follow-up scan';
      if (r.kind === 'baseline') {
        title = 'Baseline captured';
        body = 'Next time, the outline guides you back to this distance, angle and light.';
        primary = { label: 'Scan follow-up', action: props.onStart };
        secondary = { label: 'Done', action: props.onDone };
        mark = 'done';
      } else if (r.kind === 'match') {
        title = 'Matches your baseline';
        body = 'Distance, position, angle and light are within this experiment’s tolerances.';
        caveat = 'Experimental check. Not a validated comparison.';
        primary = { label: 'Done', action: props.onDone };
        secondary = { label: 'Scan again', action: props.onStart };
        mark = 'done';
      } else if (r.kind === 'mismatch') {
        title = 'Doesn’t match your baseline';
        body = r.reasons.length ? '' : 'The capture differs from your baseline.';
        list = r.reasons.slice(0, 2);
        caveat = 'Experimental check. Not a validated comparison.';
        primary = { label: 'Try again', action: props.onStart };
        secondary = { label: 'Done', action: props.onDone };
        mark = 'warn';
      } else {
        title = 'Couldn’t confirm a match';
        body = 'Some properties could not be measured in this capture.';
        primary = { label: 'Try again', action: props.onStart };
        secondary = { label: 'Done', action: props.onDone };
        mark = 'warn';
      }
      break;
    }
    default:
      title = props.followUp ? 'Match your baseline' : 'Face scan';
      body = props.followUp
        ? 'Line your face up with the outline from your baseline. Face Value captures automatically when you’re steady.'
        : 'Hold your phone at eye level. Face Value guides you into position and captures automatically when you’re steady.';
      primary = { label: 'Start scan', action: props.onStart };
      secondary = props.followUp ? { label: 'Start over with a new baseline', action: props.onNewBaseline } : null;
  }

  return (
    <div className={styles.panel} data-panel={phase.kind === 'result' ? phase.result.kind : phase.kind} data-failure={phase.kind === 'failed' ? phase.failure : undefined}>
      <div className={styles.panelBody}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.panelTitle} data-mark={mark}>
          {title}
        </h1>
        {body && <p className={styles.panelText}>{body}</p>}
        {list.length > 0 && (
          <ul className={styles.panelList}>
            {list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {caveat && <p className={styles.caveat}>{caveat}</p>}
      </div>
      <Motif mark={mark} />
      <div className={styles.panelActions}>
        <button type="button" className={styles.primary} onClick={primary.action}>
          <FaceValueActuator state={mark === 'start' ? 'ready' : mark === 'done' ? 'captured' : 'rest'} />
          <span>{primary.label}</span>
        </button>
        {secondary && (
          <button type="button" className={styles.secondary} onClick={secondary.action}>
            {secondary.label}
          </button>
        )}
        <p className={styles.privacy}>Frames stay in this tab’s memory. Nothing is uploaded or saved.</p>
      </div>
    </div>
  );
}

/** The outline motif from the live guide, at rest: arcs to start, a closed ring when done. */
function Motif({ mark }: { mark: 'start' | 'done' | 'warn' }) {
  const arcs = [45, 135, 225, 315];
  const rx = 74;
  const ry = 102;
  const point = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    return `${100 + rx * Math.cos(r)} ${130 + ry * Math.sin(r)}`;
  };
  return (
    <svg className={styles.motif} viewBox="0 0 200 260" aria-hidden="true" data-motif={mark}>
      {mark === 'done' ? (
        <>
          <ellipse cx="100" cy="130" rx={rx} ry={ry} className={styles.motifRing} />
          <path d="M80 131 l14 14 l27 -30" className={styles.motifCheck} />
        </>
      ) : (
        <>
          {arcs.map((a) => (
            <path key={a} d={`M ${point(a - 30)} A ${rx} ${ry} 0 0 1 ${point(a + 30)}`} className={styles.motifArc} />
          ))}
          <circle cx="100" cy="130" r="4" className={styles.motifDot} />
        </>
      )}
    </svg>
  );
}
