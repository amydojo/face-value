import { useEffect, useState } from 'react';
import { MockOpticalAnalysisAdapter } from '../adapters/analysis/MockOpticalAnalysisAdapter';
import { systemClock } from '../adapters/clock/clock';
import { useFaceValue } from '../app/faceValueContext';
import { EvidenceNavigation } from '../components/EvidenceNavigation';
import { EvidenceDisposition, EvidenceShell, ObservationStatus, ScreenHeader } from '../components/hardware';
import { DisturbanceRegister } from '../components/DisturbanceRegister';
import { TraceRail } from '../components/TraceRail';
import type { AnalysisScenario } from '../domain/model';
import { PRODUCTS } from '../fixtures/products';
import { Archive } from './archive/Archive';
import { CameraViewport } from './capture-contract/CameraViewport';
import { CaptureContract } from './capture-contract/CaptureContract';
import { EvidenceRecord } from './evidence-record/EvidenceRecord';
import { EvidenceCassetteSelector, EvidenceInstrument } from './evidence-instrument/EvidenceInstrument';
import { ProgressMode } from './progress-mode/ProgressMode';
import styles from '../styles/FaceValue.module.css';

const analysisAdapter = new MockOpticalAnalysisAdapter();

export function FaceValueApplication() {
  const { state, dispatch } = useFaceValue();
  const specimen = PRODUCTS[state.selectedDrawerIndex] ?? PRODUCTS[0];
  const interferenceSpecimen = PRODUCTS.find((product) => product.accession === 'C2–01') ?? PRODUCTS[1] ?? PRODUCTS[0];
  const [traceLabel, setTraceLabel] = useState('Less tight after cleansing');
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

  const runAnalysis = async () => {
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

  const navigation = (
    <EvidenceNavigation
      onIndex={() => dispatch({ type: 'RETURN_TO_CABINET' })}
      onCapture={() => state.assignedJob && dispatch({
        type: 'BEGIN_CAPTURE',
        kind: state.baselineCapture ? 'followup' : 'baseline',
      })}
      onRecords={() => dispatch({ type: 'VIEW_ARCHIVE' })}
    />
  );

  const renderContent = () => {
    switch (state.stage) {
      case 'welcome':
        return (
          <section className={styles.welcome} data-fv-screen="welcome">
            <div>
              <p className={styles.eyebrow}>PERSONAL LONGITUDINAL EVIDENCE</p>
              <h1>Is your skincare actually doing anything?</h1>
              <p>Put one product on trial. Face Value preserves repeat observations and tells you whether it is earning its place.</p>
            </div>
            <EvidenceInstrument state="dormant" compact />
            <button
              data-stage-focus
              className={styles.primaryAction}
              type="button"
              onClick={() => dispatch({ type: 'OPEN_CABINET' })}
            >
              <span>OPEN EVIDENCE INDEX</span><span aria-hidden="true">→</span>
            </button>
            <div className={styles.privacyBadge}>PRIVATE BY DEFAULT · RAW IMAGES STAY IN MEMORY</div>
          </section>
        );

      case 'cabinet':
        return (
          <>
            <ScreenHeader />
            <section className={styles.indexScreen} data-fv-screen="index">
              <div className={styles.directory}><p>CASSETTE REGISTER&nbsp;&nbsp; A1</p><p>DAY 12 OF 28</p></div>
              <h1 data-stage-focus tabIndex={-1}>EVIDENCE INDEX</h1>
              <div className={styles.indexRegister} aria-label="Cassette status register">
                <button type="button" onClick={() => dispatch({ type: 'BROWSE_DRAWERS' })}>
                  <span>A1</span><strong>ACTIVE OBSERVATION</strong><small>1</small>
                </button>
                <button type="button"><span>S4</span><strong>ESTABLISHED</strong><small>3</small></button>
                <button type="button"><span>R3</span><strong>RETRY ALONE</strong><small>2</small></button>
                <button type="button"><span>P1</span><strong>PAUSED</strong><small>1</small></button>
                <button type="button" onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}>
                  <span>E7</span><strong>EVIDENCE ARCHIVE</strong><small>{Math.max(13, state.archive.length)}</small>
                </button>
              </div>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                state={state.observation === 'review_due' ? 'reviewDue' : 'active'}
                status={state.observation === 'review_due' ? 'REVIEW DUE' : 'EVIDENCE SETTLING'}
                onActivate={() => dispatch({ type: 'BROWSE_DRAWERS' })}
                actionLabel={`Browse evidence cassettes. Active cassette ${specimen.accession}.`}
              />
              <button
                type="button"
                className={styles.nextActionCard}
                aria-label="Browse evidence cassettes"
                onClick={() => dispatch({ type: 'BROWSE_DRAWERS' })}
              >
                <span>NEXT VALID ACTION</span>
                <strong>Record a comparable follow-up</strong>
                <small>Consistent conditions required</small>
                <time>27 JUL</time>
                <b aria-hidden="true">→</b>
              </button>
            </section>
            {navigation}
          </>
        );

      case 'browse':
        return (
          <>
            <ScreenHeader />
            <section className={styles.browseScreen} data-fv-screen="browse">
              <div className={styles.directory}><p>A1&nbsp;&nbsp; CASSETTE INDEX</p><p>SELECT ONE</p></div>
              <h1 className={styles.srOnly}>Browse evidence cassettes</h1>
              <EvidenceCassetteSelector
                products={PRODUCTS}
                index={state.selectedDrawerIndex}
                job={state.assignedJob}
                onPrevious={() => dispatch({ type: 'PREVIOUS_DRAWER' })}
                onNext={() => dispatch({ type: 'NEXT_DRAWER' })}
                onInspect={() => dispatch({ type: 'OPEN_DRAWER' })}
              />
            </section>
            {navigation}
          </>
        );

      case 'specimen':
      case 'job':
        if (state.assignedJob) {
          return (
            <>
              <ScreenHeader />
              <section className={styles.specimenScreen} data-fv-screen="specimen-active">
                <div className={styles.directory}><p>{state.assignedJob}</p><p>ACTIVE</p></div>
                <h1>{specimen.product}</h1>
                <EvidenceInstrument specimen={specimen} job={state.assignedJob} state="active" />
                <button
                  type="button"
                  data-stage-focus
                  className={styles.parameterPanel}
                  aria-label="Complete Capture Contract"
                  onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'baseline' })}
                >
                  <span>ASSIGNED EVIDENCE ROLE</span>
                  <strong>{state.assignedJob}</strong>
                  <small>ONE PRODUCT · ONE JOB · REPEATABLE CONDITIONS</small>
                  <b aria-hidden="true">→</b>
                </button>
              </section>
            </>
          );
        }
        return (
          <>
            <ScreenHeader />
            <section className={styles.specimenScreen} data-fv-screen="specimen">
              <div className={styles.directory}><p>{specimen.accession}&nbsp;&nbsp; SPECIMEN</p><p>ASSIGN JOB</p></div>
              <h1>{specimen.product}</h1>
              <EvidenceInstrument specimen={specimen} state="selected" selected />
              <fieldset className={styles.jobOptions}>
                <legend>GIVE THIS PRODUCT ONE EXPLICIT JOB</legend>
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
            <section className={styles.observationScreen} data-fv-screen="observation">
              <div className={styles.directory}>
                <p>{state.assignedJob ?? 'ACTIVE OBSERVATION'}</p>
                <p>{state.observation === 'active_disturbed' ? 'DISTURBED' : 'SETTLING'}</p>
              </div>
              <h1>Evidence is still settling.</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                state={state.observation === 'active_disturbed' ? 'disturbed' : 'active'}
                secondarySpecimen={state.observation === 'active_disturbed' ? interferenceSpecimen : undefined}
              />
              <ObservationStatus observation={state.observation} comparison={state.comparison} confidence={state.confidence} />
              <TraceRail trace={state.trace} disturbed={state.observation === 'active_disturbed'} />
              {!state.trace && (
                <div className={styles.traceForm}>
                  <label>Lightweight Trace<input value={traceLabel} onChange={(event) => setTraceLabel(event.target.value)} /></label>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => dispatch({
                      type: 'ADD_TRACE',
                      trace: { id: 'trace-1', label: 'VISIBLE SIGNAL', detail: traceLabel, observedAt: systemClock.now() },
                    })}
                  >
                    Add Trace
                  </button>
                </div>
              )}
              {state.trace && state.disturbance === 'none' && (
                <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'INTRODUCE_SECOND_PRODUCT' })}>
                  Register C2–01 Hydrating Drops in this window
                </button>
              )}
              {state.trace && state.disturbance !== 'detected' && (
                <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'followup' })}>
                  Record a comparable follow-up
                </button>
              )}
              <button type="button" className={styles.dangerAction} onClick={() => dispatch({ type: 'DELETE_OBSERVATION' })}>
                Delete observation
              </button>
            </section>
            {navigation}
          </>
        );

      case 'disturbance':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.disturbanceScreen} data-fv-screen="disturbance">
              <div className={styles.directory}><p>{state.assignedJob}</p><p>2 ACTIVE</p></div>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                state="disturbed"
                secondarySpecimen={interferenceSpecimen}
              />
              <DisturbanceRegister accession={interferenceSpecimen.accession} product={interferenceSpecimen.product} />
              <div className={styles.decisionSurface}>
                <h1>Two products share one observation window.</h1>
                <p>{interferenceSpecimen.accession} is registered as interference. Remove it from this window, or preserve the overlap with a lower-confidence conclusion.</p>
                <button
                  data-stage-focus
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'cooling' })}
                >
                  Remove {interferenceSpecimen.accession} from this window
                </button>
                <button type="button" className={styles.darkSecondary} onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'overlap' })}>
                  Continue with lower confidence
                </button>
              </div>
            </section>
          </>
        );

      case 'analysis':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.analysisScreen} data-fv-screen="analysis">
              <div className={styles.directory}><p>SIMULATED OPTICAL COMPARISON</p><p>{state.processing === 'running' ? 'PROCESSING' : 'REVIEW'}</p></div>
              <EvidenceInstrument specimen={specimen} job={state.assignedJob} state="reviewDue" compact />
              {devScenario}
              <p>This MVP uses deterministic local fixture results. No external analysis service has run.</p>
              {state.analysis ? (
                <>
                  <ObservationStatus observation={state.observation} comparison={state.analysis.comparison} confidence={state.confidence} />
                  <div className={styles.analysisSummary}><strong>{state.analysis.finding}</strong><p>{state.analysis.nonFinding}</p></div>
                  <button data-stage-focus type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'ENTER_PROGRESS' })}>
                    Enter verdict review
                  </button>
                </>
              ) : (
                <button data-stage-focus type="button" className={styles.primaryAction} onClick={runAnalysis}>Run simulated comparison</button>
              )}
            </section>
          </>
        );

      case 'analysis_failure':
        return (
          <section className={styles.failureScreen}>
            <p className={styles.eyebrow}>OPTICAL ANALYSIS UNAVAILABLE</p>
            <h1>Your observation is still saved.</h1>
            <p>No finding was fabricated. The structured observation remains available for a retake.</p>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>Retake follow-up</button>
            <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>Return to Evidence Index</button>
          </section>
        );

      case 'comparison_refused':
        return (
          <section className={styles.failureScreen}>
            <p className={styles.eyebrow}>NOT SUITABLE FOR PROGRESS COMPARISON</p>
            <h1>No progress conclusion was generated.</h1>
            <p>Conditions changed enough that comparison would overstate the evidence.</p>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>Retake</button>
            <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'SAVE_CONTEXT_ONLY' })}>Save as context only</button>
          </section>
        );

      case 'progress':
        return state.analysis ? (
          <ProgressMode
            specimen={specimen}
            job={state.assignedJob}
            result={state.analysis}
            confidence={state.confidence}
            lowerConfidence={state.disturbance === 'overlap_retained'}
            onContinue={() => dispatch({
              type: 'SELECT_PLACEMENT',
              placement: state.disturbance === 'overlap_retained' ? 'retry_alone' : 'established',
            })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        ) : null;

      case 'placement':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.placementScreen} data-fv-screen="placement">
              <div className={styles.directory}><p>EVIDENCE DISPOSITION</p><p>{state.placementSealed ? 'COMMITTED' : 'REVIEW'}</p></div>
              <h1>{state.placementSealed ? 'Cassette classified.' : 'Give the evidence a place.'}</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                state={state.placementSealed ? 'classified' : 'active'}
                status={state.placementSealed ? 'CLASSIFIED' : 'AWAITING DISPOSITION'}
                outputReady={state.placementSealed}
              />
              <EvidenceDisposition
                placement={state.placement}
                classified={state.placementSealed}
                onSelect={(placement) => dispatch({ type: 'SELECT_PLACEMENT', placement })}
                onClassify={() => dispatch({ type: 'SEAL_PLACEMENT' })}
                onGenerate={() => dispatch({ type: 'GENERATE_RECORD', now: systemClock.now() })}
              />
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
    <EvidenceShell tone={tone} label="Face Value personal skincare evidence instrument">
      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">{state.announcement}</div>
      {renderContent()}
    </EvidenceShell>
  );
}
