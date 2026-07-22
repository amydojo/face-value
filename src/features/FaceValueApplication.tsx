import { useEffect, useRef, useState } from 'react';
import { MockOpticalAnalysisAdapter } from '../adapters/analysis/MockOpticalAnalysisAdapter';
import { systemClock } from '../adapters/clock/clock';
import { useFaceValue } from '../app/faceValueContext';
import { PRODUCTS } from '../fixtures/products';
import { AccessibleMovementMenu } from '../components/AccessibleMovementMenu';
import { CabinetNavigation } from '../components/CabinetNavigation';
import { DrawerCarousel } from '../components/DrawerCarousel';
import { DrawerLabelPlate, DrawerShell, ObservationStatus, ProductSpecimen, TransferTrack, CabinetShell } from '../components/hardware';
import { TraceRail } from '../components/TraceRail';
import { DisturbanceRegister } from '../components/DisturbanceRegister';
import { Archive } from './archive/Archive';
import { CameraViewport } from './capture-contract/CameraViewport';
import { CaptureContract } from './capture-contract/CaptureContract';
import { EvidenceRecord } from './evidence-record/EvidenceRecord';
import { ProgressMode } from './progress-mode/ProgressMode';
import type { AnalysisScenario } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

const analysisAdapter = new MockOpticalAnalysisAdapter();

function Header({ code = 'FV–014', dark = false }: { code?: string; dark?: boolean }) {
  return <header className={`${styles.header} ${dark ? styles.headerDark : ''}`}><strong>FACE VALUE</strong><span>{code}</span></header>;
}

export function FaceValueApplication() {
  const { state, dispatch } = useFaceValue();
  const specimen = PRODUCTS[state.selectedDrawerIndex] ?? PRODUCTS[0];
  const lastAction = useRef<HTMLButtonElement | null>(null);
  const [traceLabel, setTraceLabel] = useState('Less tight after cleansing');
  const tone = ['disturbance', 'analysis', 'progress'].includes(state.stage) ? 'dark' : 'light';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'BACK' });
      if (state.stage === 'cabinet' && event.key === 'ArrowLeft') dispatch({ type: 'PREVIOUS_DRAWER' });
      if (state.stage === 'cabinet' && event.key === 'ArrowRight') dispatch({ type: 'NEXT_DRAWER' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.stage]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>('[data-stage-focus], h1');
    if (target) {
      if (!target.hasAttribute('tabindex') && target.tagName !== 'BUTTON') target.setAttribute('tabindex', '-1');
      target.focus();
    }
  }, [state.stage]);

  const runAnalysis = async () => {
    dispatch({ type: 'ANALYSIS_STARTED' });
    try {
      const result = await analysisAdapter.compare({ scenario: state.analysisScenario, overlapRetained: state.disturbance === 'overlap_retained' });
      dispatch({ type: 'ANALYSIS_SUCCEEDED', result });
    } catch {
      dispatch({ type: 'ANALYSIS_FAILED' });
    }
  };

  const devScenario = import.meta.env.DEV || import.meta.env.MODE === 'test' ? (
    <label className={styles.devControl}>DEVELOPMENT FIXTURE<select aria-label="Analysis fixture" value={state.analysisScenario} onChange={(e) => dispatch({ type: 'SET_SCENARIO', scenario: e.target.value as AnalysisScenario })}>
      <option value="likely_change">Comparable · likely change</option><option value="no_change">Comparable · no reliable change</option><option value="partial">Partially comparable</option><option value="not_comparable">Not comparable</option><option value="failure">Analysis failure</option><option value="overlap_reduced">Overlap · reduced confidence</option>
    </select></label>
  ) : null;

  const nav = <CabinetNavigation onShelf={() => dispatch({ type: 'RETURN_TO_CABINET' })} onCapture={() => state.assignedJob ? dispatch({ type: 'BEGIN_CAPTURE', kind: state.baselineCapture ? 'followup' : 'baseline' }) : undefined} onRecords={() => dispatch({ type: 'VIEW_ARCHIVE' })} />;

  const renderContent = () => {
    switch (state.stage) {
      case 'welcome': return <section className={styles.welcome}><p className={styles.eyebrow}>THE EVIDENCE FRIDGE</p><h1>Has this product earned a place in your routine?</h1><p>Face Value preserves comparable observations without grading your face.</p><button ref={lastAction} data-stage-focus className={styles.primaryAction} type="button" onClick={() => dispatch({ type: 'OPEN_CABINET' })}>Open the Evidence Fridge</button><div className={styles.privacyBadge}>PRIVATE BY DEFAULT · RAW IMAGES STAY IN MEMORY</div></section>;
      case 'cabinet': return <><Header /><section className={styles.cabinetHome}><div className={styles.directory}><p>ACTIVE SHELF <span>A1</span></p><p>DAY 12 OF 28</p></div><h1>CABINET</h1><div className={styles.cabinetRows}><button type="button"><span>A1</span><strong>ACTIVE OBSERVATION</strong><small>1</small></button><button type="button"><span>S4</span><strong>ESTABLISHED ROUTINE</strong><small>3</small></button><button type="button"><span>C2</span><strong>COOLING SHELF</strong><small>2</small></button><button type="button"><span>P1</span><strong>PAUSED</strong><small>1</small></button><button type="button" onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}><span>E7</span><strong>STORED EVIDENCE</strong><small>{Math.max(13, state.archive.length)}</small></button></div><DrawerCarousel products={PRODUCTS} index={state.selectedDrawerIndex} onPrevious={() => dispatch({ type: 'PREVIOUS_DRAWER' })} onNext={() => dispatch({ type: 'NEXT_DRAWER' })} onOpen={() => dispatch({ type: 'OPEN_DRAWER' })} /></section>{nav}</>;
      case 'specimen':
      case 'job': return <><Header /><section className={styles.specimenScreen}><p className={styles.eyebrow}>OBSERVATION SHELF</p><h1>{specimen.product}</h1><DrawerShell state="open"><ProductSpecimen specimen={specimen} /><DrawerLabelPlate specimen={specimen} job={state.assignedJob} state="settling" /></DrawerShell><fieldset className={styles.jobOptions}><legend>Assign one explicit product job</legend>{specimen.jobOptions.map((job) => <label key={job}><input type="radio" name="job" checked={state.assignedJob === job} onChange={() => dispatch({ type: 'ASSIGN_JOB', job })} /><span>{job}</span></label>)}</fieldset><button type="button" className={styles.primaryAction} disabled={!state.assignedJob} onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'baseline' })}>Complete Capture Contract</button></section></>;
      case 'capture_contract': return <CaptureContract kind={state.captureKind} onBack={() => dispatch({ type: 'BACK' })} onConfirm={(outcome) => dispatch({ type: 'CONFIRM_CONTRACT', outcome })} />;
      case 'camera': return <CameraViewport kind={state.captureKind} cameraState={state.camera} onRequesting={() => dispatch({ type: 'CAMERA_REQUESTED' })} onReady={() => dispatch({ type: 'CAMERA_READY' })} onCapturing={() => dispatch({ type: 'CAMERA_CAPTURING' })} onFailure={(reason) => dispatch({ type: 'CAMERA_FAILED', reason })} onAccepted={(metadata) => dispatch({ type: 'CAPTURE_ACCEPTED', metadata })} onDelete={() => dispatch({ type: 'DELETE_CURRENT_CAPTURE' })} onBack={() => dispatch({ type: 'BACK' })} />;
      case 'observation': return <><Header /><section className={styles.observationScreen}><p className={styles.eyebrow}>{state.observation === 'active_disturbed' ? 'LOWER-CONFIDENCE OBSERVATION' : 'ACTIVE STABLE OBSERVATION'}</p><h1>Evidence is still settling.</h1><DrawerShell state={state.observation === 'active_disturbed' ? 'disturbed' : 'open'}><ProductSpecimen specimen={specimen} compact /><DrawerLabelPlate specimen={specimen} job={state.assignedJob} state={state.observation === 'active_disturbed' ? 'disturbed' : 'settling'} /></DrawerShell><ObservationStatus observation={state.observation} comparison={state.comparison} confidence={state.confidence} /><TraceRail trace={state.trace} disturbed={state.observation === 'active_disturbed'} />{!state.trace && <div className={styles.traceForm}><label>Lightweight Trace<input value={traceLabel} onChange={(e) => setTraceLabel(e.target.value)} /></label><button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'ADD_TRACE', trace: { id: 'trace-1', label: 'VISIBLE SIGNAL', detail: traceLabel, observedAt: systemClock.now() } })}>Add Trace</button></div>}{state.trace && state.disturbance === 'none' && <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'INTRODUCE_SECOND_PRODUCT' })}>Introduce C2–01 Hydrating Drops</button>}{state.trace && state.disturbance !== 'detected' && <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'BEGIN_CAPTURE', kind: 'followup' })}>Record a comparable follow-up</button>}<button type="button" className={styles.dangerAction} onClick={() => dispatch({ type: 'DELETE_OBSERVATION' })}>Delete observation</button></section>{nav}</>;
      case 'disturbance': return <><Header dark /><section className={styles.disturbanceScreen}><p className={styles.eyebrow}>POST-ACNE PIGMENTATION · 2 ACTIVE</p><DrawerShell state="disturbed"><ProductSpecimen specimen={specimen} compact /><div className={styles.intrudingProduct}>C2–01<br /><small>NEW ACTIVE</small></div><DrawerLabelPlate specimen={specimen} job={state.assignedJob} state="disturbed" /></DrawerShell><TraceRail trace={state.trace} disturbed /><DisturbanceRegister accession="C2–01" product="HYDRATING DROPS" /><h1>Two products are active.</h1><p>C2–01 entered this observation window. Return it to Cooling, or continue with lower-confidence findings.</p><button data-stage-focus type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'cooling' })}>Return C2–01 to Cooling</button><button type="button" className={styles.darkSecondary} onClick={() => dispatch({ type: 'RESOLVE_DISTURBANCE', resolution: 'overlap' })}>Continue with lower confidence</button></section></>;
      case 'analysis': return <><Header dark /><section className={styles.analysisScreen}><p className={styles.eyebrow}>SIMULATED OPTICAL COMPARISON</p><h1>Review what the fixture is allowed to claim.</h1>{devScenario}<p>This MVP uses deterministic local fixture results. No external analysis service has run.</p>{state.analysis ? <><ObservationStatus observation={state.observation} comparison={state.analysis.comparison} confidence={state.confidence} /><div className={styles.analysisSummary}><strong>{state.analysis.finding}</strong><p>{state.analysis.nonFinding}</p></div><button data-stage-focus type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'ENTER_PROGRESS' })}>Enter Progress Mode</button></> : <button data-stage-focus type="button" className={styles.primaryAction} onClick={runAnalysis}>Run simulated comparison</button>}</section></>;
      case 'analysis_failure': return <section className={styles.failureScreen}><p className={styles.eyebrow}>OPTICAL ANALYSIS UNAVAILABLE</p><h1>Your observation is still saved.</h1><p>No finding was fabricated. The structured observation remains available for a retake.</p><button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>Retake follow-up</button><button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>Return to cabinet</button></section>;
      case 'comparison_refused': return <section className={styles.failureScreen}><p className={styles.eyebrow}>NOT SUITABLE FOR PROGRESS COMPARISON</p><h1>No progress conclusion was generated.</h1><p>Conditions changed enough that comparison would overstate the evidence.</p><button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>Retake</button><button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'SAVE_CONTEXT_ONLY' })}>Save as context only</button></section>;
      case 'progress': return state.analysis ? <ProgressMode result={state.analysis} confidence={state.confidence} lowerConfidence={state.disturbance === 'overlap_retained'} onContinue={() => dispatch({ type: 'SELECT_PLACEMENT', placement: state.disturbance === 'overlap_retained' ? 'retry_alone' : 'established' })} onBack={() => dispatch({ type: 'BACK' })} /> : null;
      case 'placement': return <><Header /><section className={styles.placementScreen}><p className={styles.eyebrow}>RE-SHELVING</p><h1>Placement itself is the conclusion.</h1><DrawerShell state="transfer"><ProductSpecimen specimen={specimen} compact /><DrawerLabelPlate specimen={specimen} job={state.assignedJob} state={state.placementSealed ? 'sealed' : 'settling'} /></DrawerShell><TransferTrack placement={state.placement} />{state.placementSealed ? <div className={styles.placementSealed} role="status">PLACEMENT SEALED · {state.placement.replaceAll('_', ' ')}</div> : <AccessibleMovementMenu selected={state.placement} onSelect={(placement) => dispatch({ type: 'SELECT_PLACEMENT', placement })} />}{state.placementSealed ? <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'GENERATE_RECORD', now: systemClock.now() })}>Generate Evidence Record</button> : <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'SEAL_PLACEMENT' })}>Seal placement</button>}</section></>;
      case 'record': return state.record ? <EvidenceRecord record={state.record} onArchive={() => dispatch({ type: 'VIEW_ARCHIVE' })} onCabinet={() => dispatch({ type: 'RETURN_TO_CABINET' })} onBack={() => dispatch({ type: 'BACK' })} /> : null;
      case 'archive': return <Archive records={state.archive} onOpen={(record) => dispatch({ type: 'VIEW_RECORD', record })} onBack={() => dispatch({ type: 'BACK' })} onClear={() => dispatch({ type: 'CLEAR_DEMO_DATA' })} />;
      default: return null;
    }
  };

  return <CabinetShell tone={tone} label="Face Value personal skincare evidence system"><div className={styles.liveRegion} aria-live="polite" aria-atomic="true">{state.announcement}</div>{renderContent()}</CabinetShell>;
}
