import { useEffect, useState } from 'react';
import { ScreenHeader } from '../components/hardware';
import type { AnalysisResult, ProductPlacement } from '../domain/model';
import { PRODUCTS } from '../fixtures/products';
import { useFaceValue } from '../app/faceValueContext';
import { systemClock } from '../app/clock';
import { CameraViewport } from './capture-contract/CameraViewport';
import { CaptureContract } from './capture-contract/CaptureContract';
import { EvidenceVerdict } from './evidence-cassette/EvidenceVerdict';
import { placementForVerdict } from './evidence-cassette/verdictDisposition';
import { EvidenceInstrument } from './evidence-instrument/EvidenceInstrument';
import {
  deriveHumanButterMachineState,
  evidenceRecordFromHumanButter,
  getNextStepPresentation,
} from './evidence-machine/humanButterMachineAdapter';
import { EvidenceMachineRelease } from './evidence-machine/EvidenceMachineRelease';
import { EvidenceRecordArtifact } from './evidence-machine/EvidenceRecordArtifact';
import styles from '../styles/FaceValue.module.css';

function analysisForScenario(scenario: string): AnalysisResult {
  if (scenario === 'likely_change') {
    return {
      captureQuality: 'accepted',
      comparison: 'comparable',
      visibleSignal: 'visible signal changed in the assigned job',
      confidence: 'likely',
      finding: 'The assigned signal moved in a favorable direction.',
      nonFinding: 'This does not prove the product caused every visible change.',
      relevantContext: 'No major competing product was reported during the final comparison window.',
      recommendedAction: 'keep',
      claimBoundary: 'This is personal longitudinal evidence, not a clinical efficacy claim.',
      simulated: true,
    };
  }
  if (scenario === 'partial') {
    return {
      captureQuality: 'context_only',
      comparison: 'partially_comparable',
      visibleSignal: 'some visible change, with uneven conditions',
      confidence: 'possible',
      finding: 'There may be movement in the assigned signal.',
      nonFinding: 'The change is not reliable enough to credit this product cleanly.',
      relevantContext: 'Capture or routine conditions differed across the trial.',
      recommendedAction: 'wait',
      claimBoundary: 'The result remains provisional until a cleaner comparison exists.',
      simulated: true,
    };
  }
  if (scenario === 'not_comparable') {
    return {
      captureQuality: 'rejected',
      comparison: 'not_comparable',
      visibleSignal: 'comparison unavailable',
      confidence: 'insufficient',
      finding: 'These scans could not be compared under the same conditions.',
      nonFinding: 'No product result was created.',
      relevantContext: 'The follow-up did not match the baseline capture contract.',
      recommendedAction: 'reassess',
      claimBoundary: 'No conclusion is supported from an incompatible pair.',
      simulated: true,
    };
  }
  return {
    captureQuality: 'accepted',
    comparison: 'comparable',
    visibleSignal: 'no clear movement in the assigned signal',
    confidence: 'possible',
    finding: 'No clear change yet.',
    nonFinding: 'The product has not earned or lost its place from this comparison alone.',
    relevantContext: 'The trial may need more time or a cleaner comparison window.',
    recommendedAction: 'wait',
    claimBoundary: 'Absence of a clear signal is not proof of no effect.',
    simulated: true,
  };
}

const nextStepLabel = (placement: ProductPlacement): string =>
  getNextStepPresentation(placement).label;
const nextStepGuidance = (placement: ProductPlacement): string =>
  getNextStepPresentation(placement).guidance;

export function FaceValueApplication() {
  const { state, dispatch } = useFaceValue();
  const [noteDraft, setNoteDraft] = useState(state.trace?.detail ?? '');
  const [noteEditing, setNoteEditing] = useState(false);
  const [archiveOpenId, setArchiveOpenId] = useState<string | null>(null);
  const [nextStepOverrideOpen, setNextStepOverrideOpen] = useState(false);
  const specimen = PRODUCTS.find((product) => product.id === state.selectedSpecimenId) ?? PRODUCTS[0];
  const interferenceSpecimen = PRODUCTS[1];

  useEffect(() => {
    if (state.stage !== 'analysis' || state.processing !== 'idle') return undefined;
    if (state.analysis || state.longitudinalEvidence?.comparison) return undefined;
    dispatch({ type: 'ANALYSIS_STARTED' });
    const timer = window.setTimeout(() => {
      dispatch({ type: 'ANALYSIS_SUCCEEDED', result: analysisForScenario(state.analysisScenario) });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [dispatch, state.analysis, state.analysisScenario, state.longitudinalEvidence?.comparison, state.processing, state.stage]);

  const nextStepRows: Array<{ value: ProductPlacement; code: string; label: string; note: string }> = [
    { value: 'established', code: 'S4', label: 'Established routine', note: 'Keep using it for this job.' },
    { value: 'paused', code: 'P1', label: 'Paused', note: 'Give the trial more time.' },
    { value: 'retry_alone', code: 'R3', label: 'Retry alone', note: 'Test without another active product.' },
    { value: 'released', code: 'E7', label: 'Released', note: 'Remove it from the active routine.' },
  ];

  const content = (() => {
    switch (state.stage) {
      case 'welcome':
        return (
          <section className={styles.welcome} data-fv-screen="welcome">
            <div>
              <p className={styles.eyebrow}>FACE VALUE</p>
              <h1 data-stage-focus tabIndex={-1}>Is your skincare actually doing anything?</h1>
              <p>Put one product on trial. Face Value compares repeat skin scans and tells you whether it is earning its place.</p>
            </div>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'ENTER_CABINET' })}>VIEW YOUR TRIALS</button>
          </section>
        );

      case 'cabinet':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.cabinetScreen} data-fv-screen="your-trials">
              <div className={styles.directory}><p>YOUR TRIALS</p><p>{state.archive.length} PAST RESULT{state.archive.length === 1 ? '' : 'S'}</p></div>
              <h1 data-stage-focus tabIndex={-1}>Your trials</h1>
              <p>{state.observation === 'review_due' ? 'One trial is ready to compare.' : state.observation === 'active_stable' ? 'One trial is still observing.' : 'Choose one product and give it one job.'}</p>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode={state.observation === 'review_due' ? 'review-due' : state.observation === 'active_stable' ? 'active' : 'index'}
                outputReady={Boolean(state.record)}
                onActivate={() => dispatch({ type: state.observation === 'none' ? 'ENTER_BROWSE' : 'OPEN_ACTIVE_TRIAL' })}
                actionLabel={state.observation === 'none'
                  ? `Choose a trial starting with ${specimen.product}`
                  : `Open active trial for ${specimen.product}`}
              />
              {state.archive.length > 0 && (
                <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'OPEN_ARCHIVE' })}>Past results</button>
              )}
            </section>
          </>
        );

      case 'browse':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.browseScreen} data-fv-screen="trial-selector">
              <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
              <h1 data-stage-focus tabIndex={-1}>Choose one product.</h1>
              <EvidenceInstrument
                products={PRODUCTS}
                specimen={specimen}
                index={state.selectedDrawerIndex}
                mode="selector"
                onPrevious={() => dispatch({ type: 'PREVIOUS_DRAWER' })}
                onNext={() => dispatch({ type: 'NEXT_DRAWER' })}
                onActivate={() => dispatch({ type: 'OPEN_SPECIMEN' })}
              />
            </section>
          </>
        );

      case 'specimen':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.specimenScreen} data-fv-screen="trial-specimen">
              <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
              <EvidenceInstrument specimen={specimen} mode="active" />
              <h1 data-stage-focus tabIndex={-1}>{specimen.product}</h1>
              <p>Give this product one job before the baseline scan.</p>
              <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'ASSIGN_JOB' })}>GIVE IT ONE JOB</button>
            </section>
          </>
        );

      case 'job':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.jobScreen} data-fv-screen="assign-job">
              <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'BACK' })}>← Back</button>
              <p className={styles.eyebrow}>ONE PRODUCT · ONE JOB</p>
              <h1 data-stage-focus tabIndex={-1}>What should this product change?</h1>
              <fieldset className={styles.jobOptions}>
                <legend>Choose one visible job</legend>
                {specimen.jobOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name="assigned-job"
                      value={option}
                      checked={state.assignedJob === option}
                      onChange={() => dispatch({ type: 'SELECT_JOB', job: option })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
              <button type="button" className={styles.primaryAction} disabled={!state.assignedJob} onClick={() => dispatch({ type: 'BEGIN_BASELINE' })}>TAKE BASELINE SCAN</button>
            </section>
          </>
        );

      case 'capture_contract':
        return (
          <CaptureContract
            kind={state.captureKind}
            specimen={specimen}
            job={state.assignedJob}
            onBack={() => dispatch({ type: 'BACK' })}
            onComplete={(outcome) => dispatch({ type: 'CAPTURE_CONTRACT_COMPLETED', outcome })}
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
            onDelete={() => dispatch({ type: 'CAPTURE_DELETED' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'observation':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.observationScreen} data-fv-screen="trial-in-progress">
              <div className={styles.directory}><p>TRIAL IN PROGRESS</p><p>{specimen.accession}</p></div>
              <h1 data-stage-focus tabIndex={-1}>Still observing.</h1>
              <EvidenceInstrument
                specimen={specimen}
                job={state.assignedJob}
                mode="active"
                summary={state.trace ? (
                  <div className={styles.analysisSummary}>
                    <strong>{state.trace.label}</strong>
                    <p>{state.trace.detail}</p>
                  </div>
                ) : undefined}
              />
              <p>Your baseline is secured. Return under similar conditions for the follow-up scan.</p>
              {noteEditing ? (
                <div className={styles.traceForm}>
                  <label htmlFor="trial-note">What did you notice?</label>
                  <textarea id="trial-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
                  <button type="button" className={styles.primaryAction} onClick={() => {
                    dispatch({ type: 'SAVE_TRACE', detail: noteDraft, now: systemClock.now() });
                    setNoteEditing(false);
                  }}>SAVE NOTE</button>
                  <button type="button" className={styles.textButton} onClick={() => setNoteEditing(false)}>Cancel</button>
                </div>
              ) : (
                <>
                  <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'BEGIN_FOLLOWUP' })}>TAKE FOLLOW UP SCAN</button>
                  <button type="button" className={styles.secondaryAction} onClick={() => {
                    setNoteDraft(state.trace?.detail ?? '');
                    setNoteEditing(true);
                  }}>{state.trace ? 'Edit note' : 'Add note'}</button>
                </>
              )}
              <details>
                <summary>Trial options</summary>
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
            <p className={styles.eyebrow}>COMPARISON UNAVAILABLE</p>
            <h1>Comparison unavailable</h1>
            <p>These scans could not be compared under the same conditions.</p>
            <button type="button" className={styles.primaryAction} onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}>RETRY UNDER MATCHED CONDITIONS</button>
            <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>Your trials</button>
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
              {state.placementSealed && state.record && (
                <EvidenceMachineRelease
                  machine={deriveHumanButterMachineState(state, specimen)}
                  onCollect={() => dispatch({ type: 'OPEN_SAVED_RESULT' })}
                />
              )}
            </section>
          </>
        );

      case 'record':
        if (!state.record) return null;
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.recordScreen} data-fv-screen="saved-result">
              <div className={styles.directory}><p>SAVED RESULT</p><p>{state.record.accession}</p></div>
              <h1 data-stage-focus tabIndex={-1}>Your evidence.</h1>
              <EvidenceRecordArtifact
                record={evidenceRecordFromHumanButter(state.record)}
                mode="collected"
                onOpen={() => setArchiveOpenId(state.record?.id ?? null)}
              />
              {archiveOpenId === state.record.id && (
                <div className={styles.recordDetail}>
                  <h2>EVIDENCE DETAIL</h2>
                  <p><strong>Observed</strong>{state.record.finding}</p>
                  <p><strong>Not established</strong>{state.record.nonFinding}</p>
                  <p><strong>Context</strong>{state.record.limitations?.join(' ') ?? state.record.note ?? 'No additional context changed the result boundary.'}</p>
                  <p><strong>Confidence</strong>{state.record.claimBoundary}</p>
                  <p><strong>Next step</strong>{nextStepGuidance(state.record.finalPlacement)}</p>
                  <p><strong>Comparison</strong>{state.record.evidenceSource ?? state.record.comparison}</p>
                  {typeof state.record.baselineRawScore === 'number' && typeof state.record.followUpRawScore === 'number' && (
                    <p><strong>Signal</strong>{state.record.baselineRawScore.toFixed(2)} → {state.record.followUpRawScore.toFixed(2)}</p>
                  )}
                </div>
              )}
              <button type="button" className={styles.primaryAction} onClick={() => setArchiveOpenId(state.record?.id ?? null)}>VIEW EVIDENCE DETAIL</button>
              <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>Your trials</button>
              <button type="button" className={styles.secondaryAction} onClick={() => dispatch({ type: 'OPEN_ARCHIVE' })}>Past results</button>
            </section>
          </>
        );

      case 'archive':
        return (
          <>
            <ScreenHeader dark />
            <section className={styles.archiveScreen} data-fv-screen="past-results" aria-label="Past results">
              <button type="button" className={styles.textButton} onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}>← Your trials</button>
              <h1 data-stage-focus tabIndex={-1}>Past results</h1>
              {state.archive.length === 0 ? <p>No saved results yet.</p> : state.archive.map((record) => (
                <EvidenceRecordArtifact
                  key={record.id}
                  record={evidenceRecordFromHumanButter(record)}
                  mode="archive"
                  onOpen={() => setArchiveOpenId(record.id)}
                />
              ))}
              {archiveOpenId && (() => {
                const record = state.archive.find((item) => item.id === archiveOpenId);
                if (!record) return null;
                return (
                  <div className={styles.recordDetail}>
                    <h2>EVIDENCE DETAIL</h2>
                    <p><strong>Observed</strong>{record.finding}</p>
                    <p><strong>Not established</strong>{record.nonFinding}</p>
                    <p><strong>Context</strong>{record.limitations?.join(' ') ?? record.note ?? 'No additional context changed the result boundary.'}</p>
                    <p><strong>Confidence</strong>{record.claimBoundary}</p>
                    <p><strong>Next step</strong>{nextStepGuidance(record.finalPlacement)}</p>
                    <p><strong>Comparison</strong>{record.evidenceSource ?? record.comparison}</p>
                    {typeof record.baselineRawScore === 'number' && typeof record.followUpRawScore === 'number' && (
                      <p><strong>Signal</strong>{record.baselineRawScore.toFixed(2)} → {record.followUpRawScore.toFixed(2)}</p>
                    )}
                  </div>
                );
              })()}
            </section>
          </>
        );

      default:
        return null;
    }
  })();

  return (
    <main>
      {content}
      <div className={styles.srOnly} aria-live="polite">{state.announcement}</div>
    </main>
  );
}
