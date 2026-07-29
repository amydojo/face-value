import { useEffect, useMemo, useRef, useState } from 'react';
import { specimenFromRegisteredProduct } from '../adapters/product/specimenFromRegisteredProduct';
import { systemClock } from '../adapters/clock/clock';
import { useFaceValue } from '../app/faceValueContext';
import { EvidenceShell, ScreenHeader } from '../components/hardware';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  emptyCaptureContext,
  followUpIsEligible,
  trialDaySummary,
} from '../domain/phaseB5';
import { oracleTrialIdentity, oracleTrialIdentityForRecord } from '../domain/oracleTrialIdentity';
import styles from '../styles/FaceValue.module.css';
import { Archive } from './archive/Archive';
import { CaptureContextSurface } from './capture-context/CaptureContextSurface';
import { CameraViewport } from './capture-contract/CameraViewport';
import { evidenceRecordDisclosureStateForDemo } from './demo-lab/evidenceRecordDemoAdapter';
import { EvidenceRecord } from './evidence-record/EvidenceRecord';
import {
  LatestVerdictCassette,
  OracleRevealScene,
  OracleTrialStateMachine,
} from './oracle-reveal/OracleRevealScene';
import { FirstTrialScene } from './first-trial/FirstTrialScene';

const localDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatLocalDate = (value: string | null): string => {
  if (!value) return 'after your baseline interval';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'after your baseline interval'
    : localDateFormatter.format(date);
};

const readTrialNow = (fixtureNow: string | null): string => fixtureNow ?? systemClock.now();

function TrialTimeline({
  day,
  intervalDays,
  eligible,
}: {
  day: number;
  intervalDays: number;
  eligible: boolean;
}) {
  const paddedDay = String(day).padStart(2, '0');
  const paddedInterval = String(intervalDays).padStart(2, '0');

  return (
    <div
      className={styles.trialTimeline}
      data-trial-timeline
      data-followup-state={eligible ? 'ready' : 'pending'}
      role="list"
      aria-label="Trial timeline"
    >
      <i className={styles.timelineRail} aria-hidden="true" />
      <div
        className={styles.timelinePoint}
        data-timeline-position="baseline"
        data-timeline-state="complete"
        role="listitem"
        aria-label="Baseline captured"
      >
        <i className={styles.timelineMarker} aria-hidden="true">
          ✓
        </i>
        <span>BASELINE</span>
        <strong>CAPTURED</strong>
      </div>
      <div
        className={styles.timelinePoint}
        data-timeline-position="today"
        data-timeline-state={eligible ? 'complete' : 'current'}
        role="listitem"
        aria-label={`Today, day ${day}`}
      >
        <i className={styles.timelineMarker} aria-hidden="true" />
        <span>TODAY</span>
        <strong>DAY {paddedDay}</strong>
      </div>
      <div
        className={styles.timelinePoint}
        data-timeline-position="followup"
        data-timeline-state={eligible ? 'current' : 'future'}
        role="listitem"
        aria-label={eligible ? 'Follow-up ready' : `Follow-up scheduled for day ${intervalDays}`}
      >
        <i className={styles.timelineMarker} aria-hidden="true" />
        <span>FOLLOW-UP</span>
        <strong>{eligible ? 'READY' : `DAY ${paddedInterval}`}</strong>
      </div>
    </div>
  );
}

function FollowUpActionContents({
  eligible,
  daysRemaining,
}: {
  eligible: boolean;
  daysRemaining: number;
}) {
  return (
    <>
      <i className={styles.followUpAccent} aria-hidden="true" />
      <span className={styles.followUpActionCopy}>
        <small>{eligible ? 'FOLLOW-UP READY' : 'FOLLOW-UP SCAN'}</small>
        <strong>
          {eligible
            ? 'TAKE FOLLOW-UP SCAN'
            : `IN ${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'}`}
        </strong>
      </span>
      <i className={styles.followUpArrow} aria-hidden="true">
        →
      </i>
    </>
  );
}

export function FaceValueApplication() {
  const { state, dispatch, demoRuntime } = useFaceValue();
  const captureSpecimen = useMemo(
    () => (state.registeredProduct ? specimenFromRegisteredProduct(state.registeredProduct) : null),
    [state.registeredProduct],
  );
  const comparisonRequestRef = useRef<string | null>(null);
  const [baselineNoteEditing, setBaselineNoteEditing] = useState(false);
  const [baselineNoteDraft, setBaselineNoteDraft] = useState(state.baselineContext?.note ?? '');
  const homeStage = ['cabinet', 'waiting_for_followup', 'followup_ready'].includes(state.stage);
  const firstTrialStage =
    state.stage === 'welcome' || state.stage === 'product_registration' || state.stage === 'job';
  const tone =
    firstTrialStage ||
    state.stage === 'camera' ||
    state.stage === 'analysis' ||
    state.stage === 'archive' ||
    state.stage === 'record' ||
    homeStage
      ? 'dark'
      : 'light';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (state.stage === 'analysis' && state.analysis) return;
      if (event.key === 'Escape') dispatch({ type: 'BACK' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.analysis, state.stage]);

  useEffect(() => {
    if (
      state.stage !== 'analysis' ||
      demoRuntime.startingPoint === 'comparison_processing' ||
      state.analysis ||
      state.longitudinalEvidence.comparison ||
      !state.longitudinalEvidence.baseline ||
      !state.longitudinalEvidence.followUp
    ) {
      return;
    }
    const requestKey = `${state.longitudinalEvidence.baseline.capturedAt}:${state.longitudinalEvidence.followUp.capturedAt}`;
    if (comparisonRequestRef.current === requestKey) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        if (comparisonRequestRef.current === requestKey) return;
        comparisonRequestRef.current = requestKey;
        dispatch({ type: 'COMPARISON_CREATED' });
      },
      reducedMotion ? 80 : 600,
    );
    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    state.analysis,
    state.longitudinalEvidence.baseline,
    state.longitudinalEvidence.comparison,
    state.longitudinalEvidence.followUp,
    state.stage,
    demoRuntime.startingPoint,
  ]);

  useEffect(() => {
    if (
      !['waiting_for_followup', 'cabinet'].includes(state.stage) ||
      !state.longitudinalEvidence.baseline ||
      state.longitudinalEvidence.followUp
    ) {
      return;
    }
    const check = () =>
      dispatch({
        type: 'CHECK_FOLLOWUP_ELIGIBILITY',
        now: readTrialNow(demoRuntime.fixtureNow),
      });
    check();
    const interval = window.setInterval(check, 60_000);
    return () => window.clearInterval(interval);
  }, [
    dispatch,
    demoRuntime.fixtureNow,
    state.longitudinalEvidence.baseline,
    state.longitudinalEvidence.followUp,
    state.stage,
  ]);

  const renderTrialIndex = () => {
    const latestEvidence = state.archive[0] ?? null;
    const latestIdentity = latestEvidence ? oracleTrialIdentityForRecord(latestEvidence) : null;
    const hasActiveTrial = Boolean(
      state.registeredProduct &&
      state.longitudinalEvidence.baseline &&
      ['active_stable', 'active_disturbed', 'waiting', 'review_due'].includes(state.observation) &&
      !state.placementSealed,
    );
    const now = readTrialNow(demoRuntime.fixtureNow);
    const eligible = followUpIsEligible({
      followUpEligibleAt: state.followUpEligibleAt,
      demoTimelineAdvanced: state.demoTimelineAdvanced,
      now,
    });
    const summary =
      hasActiveTrial && state.baselineLockedAt && state.followUpEligibleAt
        ? trialDaySummary(state.baselineLockedAt, state.followUpEligibleAt, now)
        : null;
    const intervalDays =
      summary?.intervalDays ??
      state.registeredProduct?.expectedObservationWindowDays?.minimum ??
      FOLLOW_UP_INTERVAL_DAYS;
    const day = summary?.day ?? (eligible ? intervalDays : 1);
    const daysRemaining = eligible ? 0 : (summary?.daysRemaining ?? intervalDays);
    const activeIdentity =
      hasActiveTrial && state.registeredProduct
        ? oracleTrialIdentity({
            baselineAt: state.baselineLockedAt ?? state.longitudinalEvidence.baseline?.capturedAt,
            followUpAt: state.followUpEligibleAt,
            accession: state.registeredProduct.accession,
          })
        : null;

    if (hasActiveTrial && state.registeredProduct) {
      return (
        <>
          <ScreenHeader code={activeIdentity?.folio} dark />
          <section
            className={styles.trialContinuityScreen}
            data-fv-screen={eligible ? 'followup-ready' : 'trial-pending'}
            data-home-state="active"
            aria-labelledby="trial-index-heading"
          >
            <h1 id="trial-index-heading" className={styles.srOnly} data-stage-focus tabIndex={-1}>
              Your trials
            </h1>
            <p className={styles.continuityTrialStatus} data-continuity-status>
              {eligible ? 'FOLLOW-UP READY' : 'TRIAL IN PROGRESS'}
            </p>

            <OracleTrialStateMachine
              state={eligible ? 'followup-ready' : 'pending'}
              product={state.registeredProduct}
              day={day}
              intervalDays={intervalDays}
            />

            <TrialTimeline day={day} intervalDays={intervalDays} eligible={eligible} />

            {eligible ? (
              <button
                type="button"
                className={styles.followUpActionRail}
                data-followup-action="ready"
                aria-label="Take follow-up scan"
                onClick={() =>
                  dispatch({
                    type: 'BEGIN_CAPTURE',
                    kind: 'followup',
                    now: readTrialNow(demoRuntime.fixtureNow),
                  })
                }
              >
                <FollowUpActionContents eligible daysRemaining={0} />
              </button>
            ) : (
              <>
                <div
                  className={styles.followUpActionRail}
                  data-followup-action="pending"
                  role="status"
                  aria-label={`Follow-up scan available in ${daysRemaining} day${
                    daysRemaining === 1 ? '' : 's'
                  }`}
                >
                  <FollowUpActionContents eligible={false} daysRemaining={daysRemaining} />
                </div>
                {demoRuntime.mode !== 'ordinary' && (
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() =>
                      dispatch({
                        type: 'ADVANCE_DEMO_TIMELINE',
                        now: readTrialNow(demoRuntime.fixtureNow),
                      })
                    }
                  >
                    ADVANCE DEMO TIMELINE
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className={`${styles.previousTrialsRow} ${styles.continuityPreviousTrialsRow}`}
              data-continuity-previous-trials
              aria-label={`Previous trials, ${state.archive.length} saved result${
                state.archive.length === 1 ? '' : 's'
              }`}
              onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}
            >
              <span>PREVIOUS TRIALS</span>
              <span>
                <b>{state.archive.length}</b>
                <i aria-hidden="true">→</i>
              </span>
            </button>
          </section>
        </>
      );
    }

    return (
      <>
        <ScreenHeader code={latestIdentity?.folio} dark />
        <section
          className={`${styles.indexScreen} ${styles.homeScreen}`}
          data-fv-screen="trials"
          data-home-state="idle"
          aria-labelledby="trial-index-heading"
        >
          <h1 id="trial-index-heading" className={styles.srOnly} data-stage-focus tabIndex={-1}>
            Your trials
          </h1>
          <p className={styles.homeStatus}>NO TRIAL IN PROGRESS</p>

          {latestEvidence && (
            <section className={styles.latestVerdict} aria-label="Latest verdict">
              <LatestVerdictCassette
                record={latestEvidence}
                onViewTrial={() => dispatch({ type: 'VIEW_RECORD', record: latestEvidence })}
              />
            </section>
          )}

          <button
            type="button"
            className={styles.homePrimaryAction}
            onClick={() => dispatch({ type: 'START_PRODUCT_REGISTRATION' })}
          >
            <span>START A NEW TRIAL</span>
            <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className={styles.previousTrialsRow}
            aria-label={`Previous trials, ${state.archive.length} saved result${state.archive.length === 1 ? '' : 's'}`}
            onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}
          >
            <span>PREVIOUS TRIALS</span>
            <span>
              <b>{state.archive.length}</b>
              <i aria-hidden="true">→</i>
            </span>
          </button>
        </section>
      </>
    );
  };

  const renderContent = () => {
    if (firstTrialStage) {
      return <FirstTrialScene />;
    }

    switch (state.stage) {
      case 'camera':
        if (!captureSpecimen) {
          return (
            <section
              className={styles.failureScreen}
              data-fv-screen="product-registration-required"
            >
              <p className={styles.eyebrow}>TRIAL IDENTITY REQUIRED</p>
              <h1 data-stage-focus tabIndex={-1}>
                Your product needs to be registered.
              </h1>
              <p>No scan was added. Your existing evidence is unchanged.</p>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}
              >
                RETURN TO YOUR TRIALS
              </button>
            </section>
          );
        }
        return (
          <CameraViewport
            kind={state.captureKind}
            accession={captureSpecimen.accession}
            product={captureSpecimen.product}
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

      case 'baseline_context':
        return (
          <>
            <ScreenHeader />
            <CaptureContextSurface
              kind="baseline"
              onContinue={(context) =>
                dispatch({
                  type: 'CAPTURE_CONTEXT_RECORDED',
                  kind: 'baseline',
                  context,
                })
              }
            />
          </>
        );

      case 'followup_context':
        return (
          <>
            <ScreenHeader />
            <CaptureContextSurface
              kind="followup"
              onContinue={(context) =>
                dispatch({
                  type: 'CAPTURE_CONTEXT_RECORDED',
                  kind: 'followup',
                  context,
                })
              }
            />
          </>
        );

      case 'baseline_locked':
        return (
          <>
            <ScreenHeader />
            <section className={styles.baselineLocked} data-fv-screen="baseline-locked">
              <p className={styles.eyebrow}>BASELINE SECURED</p>
              <h1 data-stage-focus tabIndex={-1}>
                Baseline locked.
              </h1>
              <p>
                Your product is now on trial for visible redness.
                <br />
                Follow-up ready {formatLocalDate(state.followUpEligibleAt)}.
              </p>
              <div className={styles.lockedMark} aria-hidden="true">
                <span>01</span>
                <strong>BASELINE</strong>
                <b>LOCKED</b>
              </div>

              {baselineNoteEditing ? (
                <div className={styles.contextNoteEditor}>
                  <label>
                    Add a note
                    <textarea
                      autoFocus
                      rows={3}
                      maxLength={240}
                      value={baselineNoteDraft}
                      onChange={(event) => setBaselineNoteDraft(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => {
                      dispatch({
                        type: 'CAPTURE_CONTEXT_RECORDED',
                        kind: 'baseline',
                        context: {
                          ...(state.baselineContext ?? emptyCaptureContext()),
                          note: baselineNoteDraft,
                        },
                      });
                      setBaselineNoteEditing(false);
                    }}
                  >
                    SAVE NOTE
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => {
                    setBaselineNoteDraft(state.baselineContext?.note ?? '');
                    setBaselineNoteEditing(true);
                  }}
                >
                  Add a note
                </button>
              )}

              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => dispatch({ type: 'FINISH_BASELINE_SESSION' })}
              >
                <span>DONE</span>
                <span aria-hidden="true">→</span>
              </button>
            </section>
          </>
        );

      case 'cabinet':
      case 'waiting_for_followup':
      case 'followup_ready':
        return renderTrialIndex();

      case 'analysis':
        if (!state.analysis) {
          return (
            <>
              <ScreenHeader dark />
              <section className={styles.analysisScreen} data-fv-screen="comparing">
                <p className={styles.eyebrow}>MATCHING REPEAT SCANS</p>
                <h1 data-stage-focus tabIndex={-1}>
                  Comparing against your baseline…
                </h1>
                <div className={styles.comparisonProgress} role="status">
                  <span />
                  <strong>BASELINE</strong>
                  <i />
                  <strong>FOLLOW-UP</strong>
                </div>
                <p>No action is needed. Your accepted evidence is safe.</p>
              </section>
            </>
          );
        }
        if (!captureSpecimen) {
          return (
            <section
              className={styles.failureScreen}
              data-fv-screen="product-registration-required"
            >
              <p className={styles.eyebrow}>TRIAL IDENTITY REQUIRED</p>
              <h1 data-stage-focus tabIndex={-1}>
                Your product needs to be registered.
              </h1>
              <p>Your accepted evidence is unchanged.</p>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}
              >
                RETURN TO YOUR TRIALS
              </button>
            </section>
          );
        }
        return <OracleRevealScene />;

      case 'analysis_failure':
        return (
          <section className={styles.failureScreen} data-fv-screen="analysis-failure">
            <p className={styles.eyebrow}>SCAN NOT ADDED</p>
            <h1 data-stage-focus tabIndex={-1}>
              We couldn’t read this scan.
            </h1>
            <p>Your image was not saved. Your existing trial is safe.</p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() =>
                dispatch({
                  type: 'BEGIN_CAPTURE',
                  kind: 'followup',
                  now: systemClock.now(),
                })
              }
            >
              TRY AGAIN
            </button>
          </section>
        );

      case 'comparison_refused':
        return (
          <section className={styles.failureScreen} data-fv-screen="comparison-refused">
            <p className={styles.eyebrow}>COMPARISON UNAVAILABLE</p>
            <h1 data-stage-focus tabIndex={-1}>
              These scans cannot be compared.
            </h1>
            <p>Try again using the same capture setup.</p>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() =>
                dispatch({
                  type: 'BEGIN_CAPTURE',
                  kind: 'followup',
                  now: systemClock.now(),
                })
              }
            >
              TRY AGAIN
            </button>
          </section>
        );

      case 'archive':
        return (
          <Archive
            records={state.archive}
            onOpen={(record) => dispatch({ type: 'VIEW_RECORD', record })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'record':
        if (!state.record) return renderTrialIndex();
        return (
          <EvidenceRecord
            record={state.record}
            onArchive={() => dispatch({ type: 'VIEW_ARCHIVE' })}
            onBack={() => dispatch({ type: 'BACK' })}
            initialDisclosureState={evidenceRecordDisclosureStateForDemo(demoRuntime.startingPoint)}
          />
        );

      default:
        return renderTrialIndex();
    }
  };

  return (
    <EvidenceShell
      tone={tone}
      captureActive={state.stage === 'camera'}
      label="Face Value product trial"
    >
      {!firstTrialStage && (
        <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
          {state.announcement}
        </div>
      )}
      {renderContent()}
    </EvidenceShell>
  );
}
