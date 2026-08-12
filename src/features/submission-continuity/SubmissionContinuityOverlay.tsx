import { useEffect, useMemo, useState, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { browserHaptics } from '../../adapters/haptics/haptics';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { FaceValueActuator } from '../../components/FaceValueActuator';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  followUpIsEligible,
  trialDaySummary,
} from '../../domain/phaseB5';
import styles from './SubmissionContinuityOverlay.module.css';
import { submissionContinuityEvidenceViewModel } from './submissionContinuityViewModel';

type PortalTargets = {
  oracleScene: HTMLElement | null;
  lowerDeck: HTMLElement | null;
  comparison: HTMLElement | null;
  trialDisplay: HTMLElement | null;
  baselineLocked: HTMLElement | null;
};

const emptyTargets: PortalTargets = {
  oracleScene: null,
  lowerDeck: null,
  comparison: null,
  trialDisplay: null,
  baselineLocked: null,
};

const formatDate = (value: string | null): string => {
  if (!value) return 'After the trial interval';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'After the trial interval';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
    .format(date)
    .toLocaleUpperCase('en-US');
};

function Portal({ target, as: Component = 'div', children, ...props }: {
  target: HTMLElement | null;
  as?: ElementType;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  if (!target) return null;
  return createPortal(<Component {...props}>{children}</Component>, target);
}

export function SubmissionContinuityOverlay() {
  const { state, dispatch, demoRuntime } = useFaceValue();
  const [targets, setTargets] = useState<PortalTargets>(emptyTargets);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTargets({
        oracleScene: document.querySelector<HTMLElement>('[data-fv-screen="oracle-reveal"]'),
        lowerDeck: document.querySelector<HTMLElement>('[data-oracle-lower-deck]'),
        comparison: document.querySelector<HTMLElement>('[data-fv-screen="comparing"]'),
        trialDisplay: document.querySelector<HTMLElement>('[data-oracle-trial-display]'),
        baselineLocked: document.querySelector<HTMLElement>('[data-fv-screen="baseline-locked"]'),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.stage, state.oracleRevealState, state.demoTimelineAdvanced]);

  useEffect(() => {
    if (state.oracleRevealState !== 'verdict_revealed') setWhyOpen(false);
  }, [state.oracleRevealState]);

  const evidenceSummary = useMemo(
    () =>
      state.analysis
        ? submissionContinuityEvidenceViewModel(state.analysis, state.confidence)
        : null,
    [state.analysis, state.confidence],
  );

  const revealLead = (() => {
    switch (state.oracleRevealState) {
      case 'sealed':
        return { eyebrow: 'COMPARISON COMPLETE', headline: 'Your result is sealed.' };
      case 'opening':
      case 'transmitting':
        return null;
      case 'verdict_revealed':
        return { eyebrow: 'RESULT', headline: 'The result is in.' };
      case 'committing':
        return { eyebrow: 'SAVING RESULT', headline: 'Converting experiment to evidence.' };
      case 'dispensing':
        return state.oracleEvidenceDispensed
          ? { eyebrow: 'EVIDENCE READY', headline: 'TAKE YOUR RECORD' }
          : { eyebrow: 'SAVING RESULT', headline: 'Preparing evidence record.' };
      default:
        return null;
    }
  })();

  const activeTrialSummary = useMemo(() => {
    if (!state.registeredProduct || !state.baselineLockedAt || !state.followUpEligibleAt) return null;
    const now = demoRuntime.fixtureNow ?? systemClock.now();
    const eligible = followUpIsEligible({
      followUpEligibleAt: state.followUpEligibleAt,
      demoTimelineAdvanced: state.demoTimelineAdvanced,
      now,
    });
    const summary = trialDaySummary(state.baselineLockedAt, state.followUpEligibleAt, now);
    return { ...summary, eligible };
  }, [
    demoRuntime.fixtureNow,
    state.baselineLockedAt,
    state.demoTimelineAdvanced,
    state.followUpEligibleAt,
    state.registeredProduct,
  ]);

  const canShowTrialDisplay =
    Boolean(targets.trialDisplay && state.registeredProduct && activeTrialSummary) &&
    ['cabinet', 'waiting_for_followup', 'followup_ready'].includes(state.stage);

  const saveResult = () => {
    if (state.oracleRevealState !== 'verdict_revealed') return;
    dispatch({
      type: 'RECOMMENDATION_ACCEPTED',
      placement: state.placement,
      now: systemClock.now(),
    });
    browserHaptics.confirm();
  };

  return (
    <>
      {state.stage === 'analysis' && !state.analysis && (
        <Portal
          target={targets.comparison}
          className={styles.comparison}
          data-continuity-comparison
        >
          <p>COMPARING</p>
          <h1 data-stage-focus tabIndex={-1}>
            Baseline ↔ follow-up
          </h1>
          <div role="status" aria-live="polite">
            <span>BASELINE</span>
            <i aria-hidden="true" />
            <span>FOLLOW-UP</span>
          </div>
          <small>Checking repeat measurements before sealing the result.</small>
        </Portal>
      )}

      {state.stage === 'baseline_locked' && state.registeredProduct && (
        <Portal
          target={targets.baselineLocked}
          className={styles.baselineLocked}
          data-continuity-baseline-locked
        >
          <p>BASELINE LOCKED</p>
          <h2>That’s everything for today.</h2>
          <dl>
            <div>
              <dt>NOW</dt>
              <dd>KEEP USING {state.registeredProduct.productName.toLocaleUpperCase('en-US')}</dd>
            </div>
            <div>
              <dt>NEXT SCAN</dt>
              <dd>{formatDate(state.followUpEligibleAt)}</dd>
            </div>
          </dl>
        </Portal>
      )}

      {canShowTrialDisplay && state.registeredProduct && activeTrialSummary && (
        <Portal
          target={targets.trialDisplay}
          className={styles.trialDisplay}
          data-continuity-trial-display
        >
          <header>
            <span>
              DAY {String(activeTrialSummary.day).padStart(2, '0')} /{' '}
              {String(activeTrialSummary.intervalDays || FOLLOW_UP_INTERVAL_DAYS).padStart(2, '0')}
            </span>
            <strong>{activeTrialSummary.eligible ? 'FOLLOW-UP READY' : 'IN PROGRESS'}</strong>
          </header>
          <div>
            <span>NOW</span>
            <strong>
              {activeTrialSummary.eligible
                ? 'TAKE YOUR FOLLOW-UP SCAN'
                : `KEEP USING ${state.registeredProduct.productName.toLocaleUpperCase('en-US')}`}
            </strong>
            <span>NEXT SCAN</span>
            <b>
              {activeTrialSummary.eligible
                ? 'READY'
                : `IN ${activeTrialSummary.daysRemaining} DAY${
                    activeTrialSummary.daysRemaining === 1 ? '' : 'S'
                  }`}
            </b>
          </div>
        </Portal>
      )}

      {state.stage === 'analysis' && state.analysis && revealLead && (
        <Portal
          target={targets.oracleScene}
          className={styles.revealLead}
          data-continuity-oracle-lead
          data-continuity-phase={state.oracleRevealState}
        >
          <p>{revealLead.eyebrow}</p>
          <h1 data-stage-focus tabIndex={-1}>
            {revealLead.headline}
          </h1>
        </Portal>
      )}

      {state.stage === 'analysis' &&
        state.analysis &&
        evidenceSummary &&
        state.oracleRevealState === 'verdict_revealed' && (
          <>
            <Portal
              target={targets.lowerDeck}
              as="button"
              type="button"
              className={styles.saveControl}
              data-submission-save-result
              aria-label="Save result"
              onClick={saveResult}
            >
              <span>SAVE RESULT</span>
              <FaceValueActuator state="ready" />
            </Portal>
            <Portal
              target={targets.oracleScene}
              as="section"
              className={styles.resultActions}
              data-continuity-result-actions
              aria-label="Why this result"
            >
              <button
                type="button"
                aria-expanded={whyOpen}
                aria-controls="continuity-why-result"
                onClick={() => setWhyOpen((open) => !open)}
              >
                <span>WHY THIS RESULT</span>
                <span aria-hidden="true">{whyOpen ? '−' : '+'}</span>
              </button>
              {whyOpen && (
                <div id="continuity-why-result" className={styles.whyPanel}>
                  <dl>
                    <div>
                      <dt>CHANGE</dt>
                      <dd>{evidenceSummary.change}</dd>
                    </div>
                    <div>
                      <dt>COMPARISON</dt>
                      <dd>{evidenceSummary.comparison}</dd>
                    </div>
                    <div>
                      <dt>EVIDENCE</dt>
                      <dd>{evidenceSummary.evidence}</dd>
                    </div>
                  </dl>
                  <p>{evidenceSummary.interpretation}</p>
                  <small>
                    Visible redness only. Face Value does not establish clinical efficacy or prove product
                    causation. {evidenceSummary.claimBoundary}
                  </small>
                </div>
              )}
            </Portal>
          </>
        )}
    </>
  );
}
