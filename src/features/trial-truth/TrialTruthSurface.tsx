import { useEffect, useMemo, useRef, type Dispatch } from 'react';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import {
  normalizeTrialTruthState,
  trialTruthGenerationFor,
  trialTruthMatchesCurrentTrial,
  type TrialTruthFaceValueEvent,
} from '../../app/trialTruthMachine';
import { EvidenceShell, ScreenHeader } from '../../components/hardware';
import {
  IRRITATION_SIGNALS,
  validateTrialTruthDraft,
  type TrialTruthGroup,
} from '../../domain/trialTruth';
import styles from './TrialTruthSurface.module.css';

const symptomLabels = {
  burning: 'Burning',
  stinging: 'Stinging',
  itching: 'Itching',
  heat: 'Heat',
  swelling: 'Swelling',
  peeling: 'Peeling',
  blistering: 'Blistering',
  eye_involvement: 'Eye involvement',
  rapid_escalation: 'Rapid escalation',
  unusual_sensitivity: 'Unusual sensitivity',
} as const;

const groupId = (group: TrialTruthGroup) => `trial-truth-${group}`;

export function TrialTruthSurface() {
  const context = useFaceValue();
  const state = normalizeTrialTruthState(context.state);
  const dispatch =
    context.dispatchTrialTruth ?? (context.dispatch as Dispatch<TrialTruthFaceValueEvent>);
  const validation = state.trialTruthValidation;
  const summaryRef = useRef<HTMLDivElement>(null);
  const draftValidation = useMemo(
    () => validateTrialTruthDraft(state.trialTruthDraft),
    [state.trialTruthDraft],
  );
  const generationId = trialTruthGenerationFor(state);
  const symptomsVisible =
    state.trialTruthDraft.tolerance !== null && state.trialTruthDraft.tolerance !== 'none';

  useEffect(() => {
    if (!validation || validation.valid || !validation.firstInvalidGroup) return;
    summaryRef.current?.focus();
    const target = document.getElementById(groupId(validation.firstInvalidGroup));
    target?.focus();
  }, [validation]);

  if (trialTruthMatchesCurrentTrial(state)) return null;

  return (
    <EvidenceShell tone="dark" label="Face Value trial truth">
      <ScreenHeader dark />
      <main className={styles.screen} data-fv-screen="trial-truth">
        <header className={styles.heading}>
          <p>FOLLOW-UP SECURED</p>
          <h1 data-stage-focus tabIndex={-1}>
            Three things the camera cannot know.
          </h1>
          <span>Short evidence checkpoint. No favorable answer is assumed.</span>
        </header>

        {validation && !validation.valid && (
          <div
            ref={summaryRef}
            className={styles.errorSummary}
            role="alert"
            tabIndex={-1}
            aria-labelledby="trial-truth-error-title"
          >
            <strong id="trial-truth-error-title">Complete the missing evidence.</strong>
            <ul>
              {validation.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!generationId) return;
            dispatch({
              type: 'TRIAL_TRUTH_SUBMITTED',
              generationId,
              now: systemClock.now(),
            });
          }}
        >
          <fieldset
            id={groupId('adherence')}
            className={styles.group}
            tabIndex={-1}
            aria-invalid={validation?.firstInvalidGroup === 'adherence' || undefined}
          >
            <legend>USED AS PLANNED?</legend>
            <div className={styles.optionGrid}>
              {[
                ['yes', 'Yes'],
                ['mostly', 'Mostly'],
                ['no', 'No'],
              ].map(([value, label]) => (
                <label key={value} className={styles.option}>
                  <input
                    type="radio"
                    name="trial-truth-adherence"
                    value={value}
                    checked={state.trialTruthDraft.adherence === value}
                    onChange={() =>
                      dispatch({
                        type: 'TRIAL_TRUTH_ADHERENCE_SELECTED',
                        answer: value as 'yes' | 'mostly' | 'no',
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset
            id={groupId('tolerance')}
            className={styles.group}
            tabIndex={-1}
            aria-invalid={validation?.firstInvalidGroup === 'tolerance' || undefined}
          >
            <legend>SKIN RESPONSE?</legend>
            <div className={styles.optionGrid}>
              {['none', 'mild', 'moderate', 'severe'].map((value) => (
                <label key={value} className={styles.option}>
                  <input
                    type="radio"
                    name="trial-truth-tolerance"
                    value={value}
                    checked={state.trialTruthDraft.tolerance === value}
                    onChange={() =>
                      dispatch({
                        type: 'TRIAL_TRUTH_TOLERANCE_SELECTED',
                        answer: value as 'none' | 'mild' | 'moderate' | 'severe',
                      })
                    }
                  />
                  <span>{value[0].toUpperCase() + value.slice(1)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {symptomsVisible && (
            <fieldset
              id={groupId('symptoms')}
              className={`${styles.group} ${styles.symptoms}`}
              tabIndex={-1}
              aria-invalid={validation?.firstInvalidGroup === 'symptoms' || undefined}
            >
              <legend>WHAT DID YOU NOTICE?</legend>
              <p>Choose every canonical signal that applies.</p>
              <div className={styles.symptomGrid}>
                {IRRITATION_SIGNALS.map((symptom) => (
                  <label key={symptom} className={styles.symptom}>
                    <input
                      type="checkbox"
                      checked={state.trialTruthDraft.symptoms.includes(symptom)}
                      onChange={() => dispatch({ type: 'TRIAL_TRUTH_SYMPTOM_TOGGLED', symptom })}
                    />
                    <span>{symptomLabels[symptom]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset
            id={groupId('visibleChange')}
            className={styles.group}
            tabIndex={-1}
            aria-invalid={validation?.firstInvalidGroup === 'visibleChange' || undefined}
          >
            <legend>VISIBLE REDNESS TO YOU?</legend>
            <div className={styles.optionGrid}>
              {[
                ['less', 'Less'],
                ['same', 'Same'],
                ['more', 'More'],
              ].map(([value, label]) => (
                <label key={value} className={styles.option}>
                  <input
                    type="radio"
                    name="trial-truth-visible-change"
                    value={value}
                    checked={state.trialTruthDraft.visibleChange === value}
                    onChange={() =>
                      dispatch({
                        type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED',
                        answer: value as 'less' | 'same' | 'more',
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className={styles.boundary}>Face Value cannot diagnose a reaction.</p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.back}
              onClick={() => dispatch({ type: 'TRIAL_TRUTH_BACK' })}
            >
              BACK
            </button>
            <button
              type="submit"
              className={styles.continue}
              data-form-valid={draftValidation.valid || undefined}
            >
              <span>CONTINUE TO RESULT</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </main>
    </EvidenceShell>
  );
}
