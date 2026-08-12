import { useEffect, useMemo, useState, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { FaceValueActuator } from '../../components/FaceValueActuator';
import {
  FOLLOW_UP_INTERVAL_DAYS,
  followUpIsEligible,
  trialDaySummary,
} from '../../domain/phaseB5';
import { CanonicalTrialChassis } from './CanonicalTrialChassis';
import styles from './SubmissionContinuityOverlay.module.css';
import { submissionContinuityEvidenceViewModel } from './submissionContinuityViewModel';

type PortalTargets = {
  oracleScene: HTMLElement | null;
  lowerDeck: HTMLElement | null;
  comparison: HTMLElement | null;
  trialDisplay: HTMLElement | null;
  baselineLocked: HTMLElement | null;
  trialTruthFirmware: HTMLElement | null;
};

const emptyTargets: PortalTargets = {
  oracleScene: null,
  lowerDeck: null,
  comparison: null,
  trialDisplay: null,
  baselineLocked: null,
  trialTruthFirmware: null,
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
        trialTruthFirmware: document.querySelector<HTMLElement>('[data-oracle-trial-truth-firmware]'),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.stage, state.oracleRevealState, state.demoTimelineAdvanced]);

  useEffect(() => {
    if (state.oracleRevealState !== 'verdict_revealed') setWhyOpen(false);
  }, [state.oracleRevealState]);

  useEffect(() => {
    if (state.oracleRevealState !== 'collected' || !state.record) return;
    const actions = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-result-actions] button'),
    );
    const viewEvidence = actions.find((button) => button.textContent?.trim() === 'VIEW EVIDENCE');
    if (!viewEvidence) return;
    const record = state.record;
    const openEvidenceRecord = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      dispatch({ type: 'VIEW_RECORD', record });
    };
    viewEvidence.addEventListener('click', openEvidenceRecord, true);
    viewEvidence.removeAttribute('aria-expanded');
    viewEvidence.removeAttribute('aria-controls');
    viewEvidence.setAttribute('aria-label', 'Open evidence record');
    return () => viewEvidence.removeEventListener('click', openEvidenceRecord, true);
  }, [dispatch, state.oracleRevealState, state.record]);

  const evidenceSummary = useMemo(
    () =>
      state.analysis
        ? submissionContinuityEvidenceViewModel(state.analysis, state.confidence)
        : null,
    [state.analysis, state.confidence],
  );

  const revealLead = (() => {
    if (state.oracleRevealState === 'sealed') {
      return { eyebrow: 'COMPARISON COMPLETE', headline: 'Your result is sealed.' };
    }
    if (state.oracleRevealState === 'dispensing' && state.oracleEvidenceDispensed) {
      return { eyebrow: 'EVIDENCE READY', headline: 'Take your record.' };
    }
    return null;
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
    const canonicalCommit = document.querySelector<HTMLButtonElement>(
      '[data-oracle-keep-action="hardware"]',
    );
    if (!canonicalCommit || canonicalCommit.disabled) return;
    canonicalCommit.click();
  };

  return (
    <>
      {state.stage === 'followup_context' && targets.trialTruthFirmware && (
        <Portal
          target={targets.trialTruthFirmware}
          as="span"
          className={styles.followupSecuredMarker}
          data-followup-secured-marker
        >
          FOLLOW-UP SECURED
        </Portal>
      )}

      {state.stage === 'analysis' && !state.analysis && state.registeredProduct && (
        <Portal
          target={targets.comparison}
          className={styles.machineReplacement}
          data-continuity-machine-replacement="comparison"
        >
          <CanonicalTrialChassis
            product={state.registeredProduct}
            mode="comparison"
            ariaLabel="Comparing baseline and follow-up measurements"
          >
            <div className={styles.machineStateFirmware} data-machine-state-firmware="comparison">
              <p>COMPARING</p>
              <h2 data-stage-focus tabIndex={-1}>Baseline ↔ follow-up</h2>
              <div className={styles.comparisonRail} role="status" aria-live="polite">
                <span>BASELINE</span>
                <i aria-hidden="true" />
                <span>FOLLOW-UP</span>
              </div>
              <small>Verifying repeat measurements.</small>
            </div>
          </CanonicalTrialChassis>
        </Portal>
      )}

      {state.stage === 'baseline_locked' && state.registeredProduct && (
        <Portal
          target={targets.baselineLocked}
          className={styles.machineReplacement}
          data-continuity-machine-replacement="baseline-locked"
        >
          <CanonicalTrialChassis
            product={state.registeredProduct}
            mode="baseline-locked"
            ariaLabel={`Baseline locked for ${state.registeredProduct.productName}`}
          >
            <div className={styles.machineStateFirmware} data-machine-state-firmware="baseline-locked">
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
            </div>
          </CanonicalTrialChassis>
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
              DAY {String(activeTrialSummary.day).padStart(2, '0')} OF{' '}
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
