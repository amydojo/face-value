import { useEffect, useMemo, useRef, useState } from 'react';
import { specimenFromRegisteredProduct } from '../adapters/product/specimenFromRegisteredProduct';
import { systemClock } from '../adapters/clock/clock';
import { useFaceValue } from '../app/faceValueContext';
import { EvidenceShell, ScreenHeader } from '../components/hardware';
import {
  createRegisteredProduct,
  emptyCaptureContext,
  followUpIsEligible,
  trialDaySummary,
} from '../domain/phaseB5';
import { oracleTrialIdentityForRecord } from '../domain/oracleTrialIdentity';
import styles from '../styles/FaceValue.module.css';
import { Archive } from './archive/Archive';
import { CaptureContextSurface } from './capture-context/CaptureContextSurface';
import { CameraViewport } from './capture-contract/CameraViewport';
import { EvidenceRecord } from './evidence-record/EvidenceRecord';
import { OracleRevealScene } from './oracle-reveal/OracleRevealScene';
import { oracleNextStep } from './oracle-reveal/oraclePresentation';
import { ProductRegistration } from './product-registration/ProductRegistration';

const showDemoControls = import.meta.env.VITE_SHOW_DEMO_CONTROLS === 'true';

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

export function FaceValueApplication() {
  const { state, dispatch } = useFaceValue();
  const registeredSpecimen = useMemo(
    () => (state.registeredProduct ? specimenFromRegisteredProduct(state.registeredProduct) : null),
    [state.registeredProduct],
  );
  const comparisonRequestRef = useRef<string | null>(null);
  const [baselineNoteEditing, setBaselineNoteEditing] = useState(false);
  const [baselineNoteDraft, setBaselineNoteDraft] = useState(state.baselineContext?.note ?? '');
  const tone = state.stage === 'camera' || state.stage === 'analysis' ? 'dark' : 'light';

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
        now: systemClock.now(),
      });
    check();
    const interval = window.setInterval(check, 60_000);
    return () => window.clearInterval(interval);
  }, [
    dispatch,
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
    const now = systemClock.now();
    const eligible = followUpIsEligible({
      followUpEligibleAt: state.followUpEligibleAt,
      demoTimelineAdvanced: state.demoTimelineAdvanced,
      now,
    });
    const summary =
      hasActiveTrial && state.baselineLockedAt && state.followUpEligibleAt
        ? trialDaySummary(state.baselineLockedAt, state.followUpEligibleAt, now)
        : null;

    return (
      <>
        <ScreenHeader code={latestIdentity?.folio} />
        <section
          className={styles.indexScreen}
          data-fv-screen={eligible ? 'followup-ready' : 'trials'}
        >
          <div className={styles.directory}>
            <p>YOUR TRIALS</p>
            <p>
              {eligible
                ? 'FOLLOW-UP READY'
                : hasActiveTrial
                  ? 'ACTIVE'
                  : latestEvidence
                    ? 'EVIDENCE READY'
                    : 'EMPTY'}
            </p>
          </div>
          <h1 data-stage-focus tabIndex={-1}>
            {eligible ? 'Let’s see what changed.' : 'Your trials'}
          </h1>

          {hasActiveTrial && state.registeredProduct ? (
            <article
              className={styles.trialCard}
              aria-label={`Active trial for ${state.registeredProduct.brand} ${state.registeredProduct.productName}`}
            >
              <p>{state.registeredProduct.brand}</p>
              <h2>{state.registeredProduct.productName}</h2>
              {state.registeredProduct.strength && <p>{state.registeredProduct.strength}</p>}
              <dl>
                <div>
                  <dt>ITS JOB</dt>
                  <dd>REDUCE VISIBLE REDNESS</dd>
                </div>
                <div>
                  <dt>STATUS</dt>
                  <dd>
                    {eligible
                      ? 'FOLLOW-UP READY'
                      : summary
                        ? `DAY ${summary.day} OF ${summary.intervalDays}`
                        : 'TRIAL ACTIVE'}
                  </dd>
                </div>
              </dl>
              <p className={styles.trialCountdown}>
                {eligible
                  ? 'Let’s see what changed.'
                  : summary
                    ? `FOLLOW-UP IN ${summary.daysRemaining} DAY${summary.daysRemaining === 1 ? '' : 'S'}`
                    : `FOLLOW-UP READY ${formatLocalDate(state.followUpEligibleAt)}`}
              </p>
              {state.demoTimelineAdvanced && (
                <p className={styles.demoMarker}>
                  DEMO TIMELINE ADVANCED · BASELINE DATE UNCHANGED
                </p>
              )}
            </article>
          ) : (
            <div className={styles.emptyTrials}>
              <p>No active trial</p>
              {latestEvidence && (
                <article
                  className={styles.latestEvidence}
                  aria-labelledby="latest-evidence-heading"
                  tabIndex={-1}
                >
                  <p>LATEST EVIDENCE</p>
                  <span data-oracle-trial-identity>{latestIdentity?.folio}</span>
                  <h2 id="latest-evidence-heading">
                    {latestEvidence.productBrand
                      ? `${latestEvidence.productBrand} · ${latestEvidence.product}`
                      : latestEvidence.product}
                  </h2>
                  <strong>{latestEvidence.finding}</strong>
                  <span>{oracleNextStep(latestEvidence.finalPlacement)}</span>
                </article>
              )}
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => dispatch({ type: 'START_PRODUCT_REGISTRATION' })}
              >
                <span>{latestEvidence ? 'START ANOTHER TRIAL' : 'START A PRODUCT TRIAL'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {eligible && hasActiveTrial && (
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
              <span>TAKE FOLLOW-UP</span>
              <span aria-hidden="true">→</span>
            </button>
          )}

          {!eligible && hasActiveTrial && showDemoControls && (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() =>
                dispatch({
                  type: 'ADVANCE_DEMO_TIMELINE',
                  now: systemClock.now(),
                })
              }
            >
              ADVANCE DEMO TIMELINE
            </button>
          )}

          <button
            type="button"
            className={styles.textButton}
            onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}
          >
            Past results
          </button>
        </section>
      </>
    );
  };

  const renderContent = () => {
    switch (state.stage) {
      case 'welcome':
        return (
          <section className={styles.welcome} data-fv-screen="welcome">
            <div>
              <p className={styles.eyebrow}>ONE PRODUCT · ONE JOB · ONE HONEST RESULT</p>
              <h1 data-stage-focus tabIndex={-1}>
                Is your skincare actually doing anything?
              </h1>
              <p>
                Put one product on trial. Face Value compares repeat scans and tells you whether it
                is earning its place.
              </p>
            </div>
            <div className={styles.welcomeSpecimen} aria-hidden="true">
              <span />
              <strong>FACE VALUE</strong>
              <small>ONE HONEST TRIAL</small>
            </div>
            <button
              className={styles.primaryAction}
              type="button"
              onClick={() => dispatch({ type: 'START_PRODUCT_REGISTRATION' })}
            >
              <span>START A PRODUCT TRIAL</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => dispatch({ type: 'OPEN_CABINET' })}
            >
              Your trials
            </button>
            <div className={styles.privacyBadge}>
              PRIVATE BY DEFAULT · FACE IMAGES STAY IN MEMORY
            </div>
          </section>
        );

      case 'product_registration':
        return (
          <>
            <ScreenHeader />
            <ProductRegistration
              existingProduct={state.registeredProduct}
              onBack={() => dispatch({ type: 'BACK' })}
              onRegister={(input) =>
                dispatch({
                  type: 'REGISTER_PRODUCT',
                  product: createRegisteredProduct(input, systemClock.now()),
                })
              }
            />
          </>
        );

      case 'job':
        if (!state.registeredProduct) return renderTrialIndex();
        return (
          <>
            <ScreenHeader />
            <section className={styles.registeredScreen} data-fv-screen="registered-product">
              <button
                type="button"
                className={styles.textButton}
                onClick={() => dispatch({ type: 'BACK' })}
              >
                ← Edit product
              </button>
              <p className={styles.eyebrow}>PRODUCT REGISTERED</p>
              <h1 data-stage-focus tabIndex={-1}>
                Your product is ready.
              </h1>
              <article className={styles.registeredSpecimen}>
                <span>SPECIMEN 01</span>
                <b>REGISTERED</b>
                <p>{state.registeredProduct.brand}</p>
                <h2>{state.registeredProduct.productName}</h2>
                {state.registeredProduct.strength && <p>{state.registeredProduct.strength}</p>}
                {state.registeredProduct.volume && <small>{state.registeredProduct.volume}</small>}
                <div>
                  <span>ASSIGNED JOB</span>
                  <strong>REDUCE VISIBLE REDNESS</strong>
                </div>
              </article>
              <p>
                Face Value will guide one starting scan and do the technical work automatically.
              </p>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() =>
                  dispatch({
                    type: 'BEGIN_CAPTURE',
                    kind: 'baseline',
                    now: systemClock.now(),
                  })
                }
              >
                <span>TAKE GUIDED BASELINE</span>
                <span aria-hidden="true">→</span>
              </button>
            </section>
          </>
        );

      case 'camera':
        if (!registeredSpecimen) {
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
            accession={registeredSpecimen.accession}
            product={registeredSpecimen.product}
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
        if (!registeredSpecimen) {
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
            onClear={() => dispatch({ type: 'CLEAR_DEMO_DATA' })}
          />
        );

      case 'record':
        if (!state.record) return renderTrialIndex();
        return (
          <EvidenceRecord
            record={state.record}
            onArchive={() => dispatch({ type: 'VIEW_ARCHIVE' })}
            onIndex={() => dispatch({ type: 'RETURN_TO_CABINET' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      default:
        return renderTrialIndex();
    }
  };

  return (
    <EvidenceShell tone={tone} label="Face Value product trial">
      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        {state.announcement}
      </div>
      {renderContent()}
    </EvidenceShell>
  );
}
