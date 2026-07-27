import { useCallback, useEffect, useRef, useState } from 'react';
import { MockOpticalAnalysisAdapter } from '../adapters/analysis/MockOpticalAnalysisAdapter';
import { systemClock } from '../adapters/clock/clock';
import { useFaceValue } from '../app/faceValueContext';
import { EvidenceShell, ScreenHeader } from '../components/hardware';
import type { AnalysisScenario, ProductPlacement } from '../domain/model';
import { PRODUCTS } from '../fixtures/products';
import { Archive } from './archive/Archive';
import { CameraViewport } from './capture-contract/CameraViewport';
import { CaptureContract } from './capture-contract/CaptureContract';
import { EvidenceVerdict } from './evidence-cassette/EvidenceVerdict';
import { placementForVerdict } from './evidence-cassette/verdictDisposition';
import { EvidenceRecord } from './evidence-record/EvidenceRecord';
import { EvidenceCassetteSelector, EvidenceInstrument } from './evidence-instrument/EvidenceInstrument';
import styles from '../styles/FaceValue.module.css';

const analysisAdapter = new MockOpticalAnalysisAdapter();

const nextStepRows: Array<{
  value: ProductPlacement;
  code: string;
  label: string;
  note: string;
}> = [
  { value: 'established', code: 'S4', label: 'Established routine', note: 'Keep using it for this job' },
  { value: 'useful_elsewhere', code: 'U2', label: 'Useful elsewhere', note: 'Give it a different job' },
  { value: 'paused', code: 'P1', label: 'Paused', note: 'Test longer before deciding' },
  { value: 'retry_alone', code: 'R3', label: 'Retry alone', note: 'Run a cleaner single-product trial' },
  { value: 'released', code: 'E7', label: 'Released', note: 'Close the trial and move on' },
];

const nextStepLabel = (placement: ProductPlacement) => {
  const row = nextStepRows.find((item) => item.value === placement);
  return row ? `${row.code} · ${row.label}` : placement.replaceAll('_', ' ');
};

const nextStepGuidance = (placement: ProductPlacement) => {
  if (placement === 'retry_alone') return 'Try it again without another active product in the same trial.';
  if (placement === 'established') return 'Keep using it for the job you tested and continue watching for change.';
  if (placement === 'paused') return 'Give the trial more time before you make a stronger call.';
  if (placement === 'useful_elsewhere') return 'Keep the product, but assign it a different job next time.';
  if (placement === 'released') return 'Close this trial and remove the product from the active routine.';
  return 'Keep the next step explicit and reversible.';
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function FaceValueApplication() {
  const { state, dispatch } = useFaceValue();
  const specimen = PRODUCTS[state.selectedDrawerIndex] ?? PRODUCTS[0];
  const interferenceSpecimen = PRODUCTS.find((product) => product.accession === 'C2–01') ?? PRODUCTS[1] ?? PRODUCTS[0];
  const [noteDraft, setNoteDraft] = useState('Less tight after cleansing');
  const [noteEditing, setNoteEditing] = useState(false);
  const [observationSummaryOpen, setObservationSummaryOpen] = useState(false);
  const [nextStepOverrideOpen, setNextStepOverrideOpen] = useState(false);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const noteTriggerRef = useRef<HTMLButtonElement>(null);
  const analysisRequestRef = useRef<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const tone = ['disturbance', 'analysis', 'progress', 'placement'].includes(state.stage) ? 'dark' : 'light';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'BACK' });
      if (state.stage === 'browse' && event.key === 'ArrowLeft') dispatch({ type: 'PREVIOUS_DRAWER' });
      if (state.stage === 'browse' && event.key === 'ArrowRight') dispatch({ type: 'NEXT_DRAWER' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.stage]);

  useEffect(() => {
    if (state.stage !== 'observation') {
      setObservationSummaryOpen(false);
      setNoteEditing(false);
    }
    if (state.stage !== 'placement') setNextStepOverrideOpen(false);
  }, [state.stage]);

  useEffect(() => {
    if (noteEditing) noteInputRef.current?.focus();
  }, [noteEditing]);

  const runAnalysis = useCallback(async () => {
    dispatch({ type: 'ANALYSIS_STARTED' });
    try {
      const result = await analysisAdapter.compare({
        scenario: state.analysisScenario,
        overlapRetained: state.disturbance === 'overlap_retained',
      });
      dispatch({ type: 'ANALYSIS_SUCCEEDED', result });
    } catch {
      dispatch({ type: 'ANALYSIS_FAILED' });
    }
  }, [dispatch, state.analysisScenario, state.disturbance]);

  useEffect(() => {
    if (
      state.stage !== 'analysis' ||
      state.analysis ||
      state.processing !== 'idle' ||
      !state.followupCapture
    ) return;

    const requestKey = state.followupCapture.id;
    if (analysisRequestRef.current === requestKey) return;
    analysisRequestRef.current = requestKey;
    void runAnalysis();
  }, [runAnalysis, state.analysis, state.followupCapture, state.processing, state.stage]);

  useEffect(() => {
    if (state.stage !== 'placement' || !state.placementSealed || !state.record) return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'OPEN_SAVED_RESULT' }),
      reducedMotion ? 0 : 520,
    );
    return () => window.clearTimeout(timer);
  }, [dispatch, reducedMotion, state.placementSealed, state.record, state.stage]);

  const openNoteEditor = () => {
    setNoteDraft(state.trace?.detail ?? 'Less tight after cleansing');
    setNoteEditing(true);
  };

  const closeNoteEditor = () => {
    setNoteEditing(false);
    window.requestAnimationFrame(() => noteTriggerRef.current?.focus());
  };

  const saveNote = () => {
    const detail = noteDraft.trim();
    if (!detail) return;
    dispatch({
      type: 'ADD_TRACE',
      trace: {
        id: state.trace?.id ?? 'note-1',
        label: 'WHAT YOU NOTICED',
        detail,
        observedAt: state.trace?.observedAt ?? systemClock.now(),
      },
    });
    closeNoteEditor();
  };

  const devScenario = import.meta.env.DEV || import.meta.env.MODE === 'test' ? (
    <label className={styles.devControl}>
      DEVELOPMENT FIXTURE
      <select
        aria-label="Analysis fixture"
        value={state.analysisScenario}
        onChange={(event) => dispatch({ type: 'SET_SCENARIO', scenario: event.target.value as AnalysisScenario })}
      >
        <option value="likely_change">Comparable · likely change</option>
        <option value="no_change">Comparable · no reliable change</option>
        <option value="partial">Partially comparable</option>
        <option value="not_comparable">Not comparable</option>
        <option value="failure">Analysis failure</option>
        <option value="overlap_reduced">Overlap · reduced confidence</option>
      </select>
    </label>
  ) : null;

  const renderContent = () => {
    switch (state.stage) {
      case 'welcome':
        return (
          <section className={styles.welcome} data-fv-screen="welcome">
            <div>
              <p className={styles.eyebrow}>ONE PRODUCT · ONE JOB · ONE HONEST RESULT</p>
              <h1>Is your skincare actually doing anything?</h1>
              <p>Put one product on trial. Face Value compares repeat scans and tells you whether it is earning its place.</p>
            </div>
            <EvidenceInstrument state="dormant" compact />
            <button
              data-stage-focus
              className={styles.primaryAction}
              type="button"
              onClick={() => dispatch({ type: 'OPEN_CABINET' })}
            >
              <span>VIEW YOUR TRIALS</span><span aria-hidden="true">→</span>
            </button>
            <div className={styles.privacyBadge}>PRIVATE BY DEFAULT · RAW IMAGES STAY IN MEMORY</div>
          </section>
        );

      case 'cabinet': {
        const reviewDue = state.observation === 'review_due';
        const activeTrial = state.assignedJob !== null && state.observation !== 'none';
        const activateTrial = () => {
          if (reviewDue) dispatch({ type: 'OPEN_REVIEW_DUE' });
          else if (activeTrial) dispatch({ type: 'OPEN_DRAWER' });
          else dispatch({ type: 'BROWSE_DRAWERS' });
        };
        return (
          <>
            <ScreenHeader />
            <section className={styles.indexScreen} data-fv-screen="trials">
              <div className={styles.directory}><p>YOUR TRIALS</p><p>{reviewDue ? 'READY' : activeTrial ? 'ACTIVE' : 'SELECT ONE'}</p></div>
              <h1 data-stage-focus tabIndex={-1}>Your trials</h1>
              <p>{activeTrial ? '1 active trial' : 'No active trial'} · {Math.max(13, state.archive.length)} past results</p>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode={reviewDue ? 'review-due' : activeTrial ? 'active' : 'index'}
                status={reviewDue ? 'READY TO COMPARE' : activeTrial ? 'TRIAL IN PROGRESS' : 'SELECT A TRIAL'}
                onActivate={activateTrial}
                actionLabel={reviewDue
                  ? `Reveal result for ${specimen.product}`
                  : activeTrial
                    ? `View trial for ${specimen.product}`
                    : `Choose a trial starting with ${specimen.product}`}
              />
              <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}>
                Past results
              </button>
            </section>
          </>
        );
      }

      case 'browse':
        return (
          <>
            <ScreenHeader />
            <section className={styles.browseScreen} data-fv-screen="trial-selection">
              <div className={styles.directory}><p>YOUR TRIALS</p><p>CHOOSE ONE</p></div>
              <h1 className={styles.srOnly}>Choose a product trial</h1>
              <EvidenceCassetteSelector
                products={PRODUCTS}
                index={state.selectedDrawerIndex}
                job={state.assignedJob}
                onPrevious={() => dispatch({ type: 'PREVIOUS_DRAWER' })}
                onNext={() => dispatch({ type: 'NEXT_DRAWER' })}
                onInspect={() => dispatch({ type: 'OPEN_DRAWER' })}
              />
            </section>
          </>
        );

      case 'specimen':
      case 'job':
        if (state.assignedJob) {
          return (
            <>
              <ScreenHeader />
              <section className={styles.specimenScreen} data-fv-screen="trial-ready">
                <div className={styles.directory}><p>{specimen.product}</p><p>READY</p></div>
                <h1>Ready for a baseline.</h1>
                <EvidenceInstrument
                  specimen={specimen}
                  job={state.assignedJob}
                  mode="active"
                  summary={(
                    <div className={styles.analysisSummary}>
                      <strong>{state.assignedJob}</strong>
                      <p>This is the one job this trial will judge.</p>
                    </div>
                  )}
                  actionLabel={`Open trial summary for ${specimen.product}`}
                />
                <p>Take one scan now. You’ll compare it with a follow-up under similar conditions.</p>
                <button
                  type="button"
                  data-stage-focus
                  className={styles.primaryAction}
                  aria-label="Take baseline scan"
                  onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'baseline' })}
                >
                  TAKE BASELINE SCAN
                </button>
              </section>
            </>
          );
        }
        return (
          <>
            <ScreenHeader />
            <section className={styles.specimenScreen} data-fv-screen="trial-job">
              <div className={styles.directory}><p>{specimen.product}</p><p>ONE JOB</p></div>
              <h1>What should this product change?</h1>
              <EvidenceInstrument
                specimen={specimen}
                mode="active"
                selected
                summary={(
                  <div className={styles.analysisSummary}>
                    <strong>{specimen.product}</strong>
                    <p>Choose one job so the follow-up scan has a fair question to answer.</p>
                  </div>
                )}
                actionLabel={`View trial for ${specimen.product}`}
              />
              <fieldset className={styles.jobOptions}>
                <legend>GIVE THIS PRODUCT ONE JOB</legend>
                {specimen.jobOptions.map((job) => (
                  <label key={job}>
                    <input
                      type="radio"
                      name="job"
                      checked={state.assignedJob === job}
                      onChange={() => dispatch({ type: 'ASSIGN_JOB', job })}
                    />
                    <span>{job}</span>
                  </label>
                ))}
              </fieldset>
            </section>
          </>
        );

      case 'capture_contract':
        return (
          <CaptureContract
            kind={state.captureKind}
            accession={specimen.accession}
            product={specimen.product}
            job={state.assignedJob}
            onBack={() => dispatch({ type: 'BACK' })}
            onConfirm={(outcome) => dispatch({ type: 'CONFIRM_CONTRACT', outcome })}
          />
        );

      case 'camera':
        return (
          <CameraViewport
            kind={state.captureKind}
            accession={specimen.accession}
            product={specimen.product}
            job={state.assignedJob}
            cameraState={state.camera}
            onRequesting={() => dispatch({ type: 'CAMERA_REQUESTED' })}
            onReady={() => dispatch({ type: 'CAMERA_READY' })}
            onCapturing={() => dispatch({ type: 'CAMERA_CAPTURING' })}
            onFailure={(reason) => dispatch({ type: 'CAMERA_FAILED', reason })}
            onAccepted={(metadata) => dispatch({ type: 'CAPTURE_ACCEPTED', metadata })}
            onDelete={() => dispatch({ type: 'DELETE_CURRENT_CAPTURE' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'observation':
        return (
          <>
            <ScreenHeader />
            <section className={styles.observationScreen} data-fv-screen="trial-in-progress">
              <div className={styles.directory}>
                <p>{specimen.product}</p>
                <p>TRIAL IN PROGRESS</p>
              </div>
              <h1>Still observing.</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode="active"
                state={state.observation === 'active_disturbed' ? 'disturbed' : undefined}
                secondarySpecimen={state.observation === 'active_disturbed' ? interferenceSpecimen : undefined}
                expanded={observationSummaryOpen}
                onActivate={() => setObservationSummaryOpen((open) => !open)}
                onEscape={() => setObservationSummaryOpen(false)}
                actionLabel={`${observationSummaryOpen ? 'Close' : 'Open'} trial summary for ${specimen.product}`}
              />
              {observationSummaryOpen && (
                <div className={styles.analysisSummary} data-fv-part="trial-summary">
                  <strong>{state.assignedJob ?? 'TRIAL IN PROGRESS'}</strong>
                  <p>{state.trace?.detail ?? 'No note yet.'}</p>
                </div>
              )}
              <p>Next useful comparison: July 27</p>
              {state.trace && !noteEditing && <p>“{state.trace.detail}”</p>}

              {noteEditing ? (
                <div className={styles.traceForm} role="group" aria-labelledby="note-editor-heading">
                  <label id="note-editor-heading">
                    What did you notice?
                    <input
                      ref={noteInputRef}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                    />
                  </label>
                  <button type="button" className={styles.primaryAction} onClick={saveNote}>SAVE NOTE</button>
                  <button type="button" className={styles.textButton} onClick={closeNoteEditor}>Cancel</button>
                </div>
              ) : (
                <button ref={noteTriggerRef} type="button" className={styles.textButton} onClick={openNoteEditor}>
                  {state.trace ? 'Edit note' : 'Add note'}
                </button>
              )}

              {!noteEditing && (
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'followup' })}
                >
                  TAKE FOLLOW UP SCAN
                </button>
              )}

              <details className={styles.analysisSummary}>
                <summary>Trial details</summary>
                <p>{state.assignedJob}</p>
                <p>Comparison: {state.comparison.replaceAll('_', ' ')}</p>
                <p>Confidence: {state.confidence}</p>
                {devScenario}
                {state.disturbance === 'none' && (
                  <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'INTRODUCE_SECOND_PRODUCT' })}>
                    Add another product
                  </button>
                )}
                <button type="button" className={styles.dangerAction} onClick={() => dispatch({ type: 'DELETE_OBSERVATION' })}>
                  End trial
                </button>
              </details>
            </section>
          </>
        );

      case 'disturbance':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.disturbanceScreen} data-fv-screen="another-product">
              <div className={styles.directory}><p>{specimen.product}</p><p>TWO PRODUCTS</p></div>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode="active"
                state="disturbed"
                secondarySpecimen={interferenceSpecimen}
                summary={(
                  <div className={styles.analysisSummary}>
                    <strong>{specimen.product} + {interferenceSpecimen.product}</strong>
                    <p>Two products shared the same trial window.</p>
                  </div>
                )}
                actionLabel={`Open trial summary for ${specimen.product} and ${interferenceSpecimen.product}`}
              />
              <div className={styles.decisionSurface}>
                <h1>{interferenceSpecimen.product} entered this trial.</h1>
                <p>That makes it harder to know which product caused any change.</p>
                <button
                  data-stage-focus
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'cooling' })}
                >
                  REMOVE {interferenceSpecimen.product.toUpperCase()}
                </button>
                <button type="button" className={styles.darkSecondary} onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'overlap' })}>
                  Keep both and accept a less certain result
                </button>
                <details>
                  <summary>How this affects the evidence</summary>
                  <p>Both products remain recorded, but Face Value will lower confidence and avoid giving either one clean credit.</p>
                </details>
              </div>
            </section>
          </>
        );

      case 'analysis':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.analysisScreen} data-fv-screen="result-ready">
              <div className={styles.directory}><p>FOLLOW UP SCAN</p><p>{state.processing === 'running' ? 'COMPARING' : 'READY'}</p></div>
              <h1>{state.analysis ? 'Your result is ready.' : 'Comparing your scans.'}</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode="review-due"
                compact
                onActivate={state.analysis ? () => dispatch({ type: 'ENTER_PROGRESS' }) : undefined}
                summary={!state.analysis ? (
                  <div className={styles.analysisSummary}>
                    <strong>Comparison in progress</strong>
                    <p>Your trial is preserved while the scans are checked.</p>
                  </div>
                ) : undefined}
                actionLabel={state.analysis ? `Reveal result for ${specimen.product}` : `Open comparison status for ${specimen.product}`}
              />
              <p>{state.analysis ? 'Pull to reveal result.' : 'The result will be ready here. No extra action is needed.'}</p>
              {state.analysis && (
                <div className={styles.analysisSummary}>
                  <strong>{state.analysis.finding}</strong>
                  <p>{state.analysis.nonFinding}</p>
                </div>
              )}
            </section>
          </>
        );

      case 'analysis_failure':
        return (
          <section className={styles.failureScreen} data-fv-screen="analysis-failure">
            <p className={styles.eyebrow}>COMPARISON UNAVAILABLE</p>
            <h1>Your trial is still saved.</h1>
            <p>Nothing was fabricated. Take another follow-up scan when conditions are stable.</p>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>RETAKE FOLLOW UP SCAN</button>
            <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>Your trials</button>
          </section>
        );

      case 'comparison_refused':
        return (
          <section className={styles.failureScreen} data-fv-screen="comparison-refused">
            <p className={styles.eyebrow}>NOT FAIR TO COMPARE</p>
            <h1>These scans are not fair to compare.</h1>
            <p>Nothing was concluded from them.</p>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>RETAKE FOLLOW UP SCAN</button>
            <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'SAVE_CONTEXT_ONLY' })}>Save as context only</button>
          </section>
        );

      case 'progress': {
        if (!state.analysis) return null;
        const recommendedPlacement = placementForVerdict(state.analysis, state.disturbance);
        return (
          <EvidenceVerdict
            specimen={specimen}
            job={state.assignedJob}
            result={state.analysis}
            confidence={state.confidence}
            lowerConfidence={state.disturbance === 'overlap_retained'}
            recommendedPlacement={recommendedPlacement}
            onContinue={(placement) => dispatch({ type: 'SELECT_PLACEMENT', placement })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );
      }

      case 'placement':
        return (
          <>
            <ScreenHeader dark />
            <section
              className={styles.placementScreen}
              data-fv-screen="next-step"
              data-fv-part="next-step"
              data-fv-selected-placement={state.placement}
            >
              <div className={styles.directory}><p>NEXT STEP</p><p>{state.placementSealed ? 'SAVED' : 'REVIEW'}</p></div>
              <h1>{state.placementSealed ? 'Saved to your evidence.' : 'One clear next step.'}</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode={state.placementSealed ? 'classified' : 'active'}
                status={state.placementSealed ? 'SAVED RESULT' : 'NEXT STEP READY'}
                outputReady={state.placementSealed}
                onActivate={state.placementSealed ? () => dispatch({ type: 'OPEN_SAVED_RESULT' }) : undefined}
                summary={!state.placementSealed ? (
                  <div className={styles.analysisSummary}>
                    <strong>{nextStepLabel(state.placement)}</strong>
                    <p>{nextStepGuidance(state.placement)}</p>
                  </div>
                ) : undefined}
                actionLabel={state.placementSealed
                  ? `Open saved result ${specimen.accession}`
                  : `Open next step summary for ${specimen.product}`}
              />

              {state.placementSealed ? (
                <div className={styles.analysisSummary} role="status">
                  <strong>Saved to your evidence.</strong>
                  <p>Your scans, note, trial conditions, confidence, and next step were preserved.</p>
                </div>
              ) : (
                <div className={styles.decisionSurface}>
                  <p>We’ll save this as:</p>
                  <h2>{nextStepLabel(state.placement)}</h2>
                  <p>{nextStepGuidance(state.placement)}</p>
                  <button
                    type="button"
                    data-stage-focus
                    className={styles.primaryAction}
                    onClick={() => dispatch({ type: 'SAVE_RESULT', now: systemClock.now() })}
                  >
                    SAVE RESULT
                  </button>
                  <button
                    type="button"
                    className={styles.darkSecondary}
                    aria-expanded={nextStepOverrideOpen}
                    aria-controls="next-step-options"
                    onClick={() => setNextStepOverrideOpen((open) => !open)}
                  >
                    Choose a different next step
                  </button>
                  <fieldset id="next-step-options" className={styles.jobOptions} hidden={!nextStepOverrideOpen}>
                    <legend>Choose a different next step</legend>
                    {nextStepRows.map((row) => (
                      <label key={row.value}>
                        <input
                          type="radio"
                          name="next-step"
                          value={row.value}
                          checked={state.placement === row.value}
                          onChange={() => dispatch({ type: 'SELECT_PLACEMENT', placement: row.value })}
                        />
                        <span>{row.code} · {row.label}<small>{row.note}</small></span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
            </section>
          </>
        );

      case 'record':
        return state.record ? (
          <EvidenceRecord
            record={state.record}
            onArchive={() => dispatch({ type: 'VIEW_ARCHIVE' })}
            onIndex={() => dispatch({ type: 'RETURN_TO_CABINET' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        ) : null;

      case 'archive':
        return (
          <Archive
            records={state.archive}
            onOpen={(record) => dispatch({ type: 'VIEW_RECORD', record })}
            onBack={() => dispatch({ type: 'BACK' })}
            onClear={() => dispatch({ type: 'CLEAR_DEMO_DATA' })}
          />
        );

      default:
        return null;
    }
  };

  return (
    <EvidenceShell tone={tone} label="Face Value product trial instrument">
      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">{state.announcement}</div>
      {renderContent()}
    </EvidenceShell>
  );
}
