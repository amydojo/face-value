import { useEffect, useMemo, useState } from 'react';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { EvidenceShell, ScreenHeader } from '../../components/hardware';
import type { ProductPlacement } from '../../domain/model';
import { PRODUCTS } from '../../fixtures/products';
import { EvidenceMachine } from './EvidenceMachine';
import { EvidenceRecordArtifact, EvidenceRecordDetail } from './EvidenceRecordArtifact';
import {
  deriveHumanButterMachineState,
  evidenceRecordFromHumanButter,
  getNextStepPresentation,
} from './humanButterMachineAdapter';
import styles from './HumanButterEvidenceMachineScreen.module.css';

const NEXT_STEP_OPTIONS: ProductPlacement[] = [
  'established',
  'useful_elsewhere',
  'paused',
  'retry_alone',
  'released',
];

export function HumanButterEvidenceMachineScreen() {
  const { state, dispatch } = useFaceValue();
  const specimen = PRODUCTS[state.selectedDrawerIndex] ?? PRODUCTS[0];
  const [nextStepOverrideOpen, setNextStepOverrideOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const machineState = useMemo(
    () => deriveHumanButterMachineState(state, specimen),
    [specimen, state],
  );
  const record = useMemo(
    () => (state.record ? evidenceRecordFromHumanButter(state.record) : null),
    [state.record],
  );
  const nextStep = getNextStepPresentation(state.placement);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'BACK' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  useEffect(() => {
    if (state.stage !== 'placement') setNextStepOverrideOpen(false);
    if (state.stage !== 'record') setDetailOpen(false);
  }, [state.stage]);

  if (state.stage === 'record') {
    if (!record) return null;
    return (
      <EvidenceShell tone="dark" label="Face Value collected Evidence Record">
        <div className={styles.screen} data-fv-screen="collected-evidence" data-record-id={record.id}>
          <ScreenHeader dark />
          <main className={styles.content}>
            <div className={styles.directory}>
              <p>YOUR EVIDENCE</p>
              <p>{record.id}</p>
            </div>
            <section className={styles.intro}>
              <p>RESULT RECORDED</p>
              <h1 data-stage-focus tabIndex={-1}>Your evidence.</h1>
              <p>The machine returned one durable record of what this trial supports.</p>
            </section>
            <section className={styles.collected}>
              <div className={styles.collectedArtifact}>
                <EvidenceRecordArtifact record={record} mode="collected" />
              </div>
              <p className={styles.collectedFinding}>{record.finding.summary}</p>
              <button
                type="button"
                className={styles.primaryAction}
                aria-expanded={detailOpen}
                onClick={() => setDetailOpen((open) => !open)}
              >
                {detailOpen ? 'CLOSE EVIDENCE DETAIL' : 'VIEW EVIDENCE DETAIL'}
              </button>
              <div className={styles.secondaryActions}>
                <button
                  type="button"
                  className={styles.textAction}
                  onClick={() => dispatch({ type: 'VIEW_ARCHIVE' })}
                >
                  Past results
                </button>
                <button
                  type="button"
                  className={styles.textAction}
                  onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}
                >
                  Your trials
                </button>
              </div>
            </section>
            {detailOpen && <EvidenceRecordDetail record={record} />}
          </main>
        </div>
      </EvidenceShell>
    );
  }

  if (state.stage !== 'placement') return null;

  return (
    <EvidenceShell tone="dark" label="Face Value Evidence Machine save and release">
      <div
        className={styles.screen}
        data-fv-screen="next-step"
        data-fv-part="next-step"
        data-fv-selected-placement={state.placement}
      >
        <ScreenHeader dark />
        <main className={styles.content}>
          <div className={styles.directory}>
            <p>NEXT STEP</p>
            <p>{state.placementSealed ? 'RELEASING' : 'SAVE READY'}</p>
          </div>
          <section className={styles.intro}>
            <p>{state.placementSealed ? 'EVIDENCE PRODUCED' : 'ONE PRODUCT · ONE DECISION'}</p>
            <h1 data-stage-focus tabIndex={-1}>
              {state.placementSealed ? 'Take your evidence.' : 'One clear next step.'}
            </h1>
            <p>
              {state.placementSealed
                ? 'Collect the record the machine produced. Nothing changes until you take it.'
                : 'Confirm the next step, then press the amber actuator to save this result.'}
            </p>
          </section>

          {!state.placementSealed && (
            <section className={styles.decision} aria-label="Selected next step">
              <p>Face Value recommends:</p>
              <h2>{nextStep.code} · {nextStep.label}</h2>
              <p>{nextStep.guidance}</p>
              <button
                type="button"
                className={styles.secondaryAction}
                aria-expanded={nextStepOverrideOpen}
                aria-controls="human-butter-next-step-options"
                onClick={() => setNextStepOverrideOpen((open) => !open)}
              >
                Choose a different next step
              </button>
              <fieldset
                id="human-butter-next-step-options"
                className={styles.options}
                hidden={!nextStepOverrideOpen}
              >
                <legend>Choose a different next step</legend>
                {NEXT_STEP_OPTIONS.map((placement) => {
                  const option = getNextStepPresentation(placement);
                  return (
                    <label key={placement}>
                      <input
                        type="radio"
                        name="next-step"
                        value={placement}
                        checked={state.placement === placement}
                        onChange={() => dispatch({ type: 'SELECT_PLACEMENT', placement })}
                      />
                      <span>
                        {option.code} · {option.label}
                        <small>{option.guidance}</small>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </section>
          )}

          <div className={styles.machineFrame}>
            <EvidenceMachine
              state={machineState}
              specimen={specimen}
              record={record}
              restorePresented={state.placementSealed && Boolean(record)}
              onMachineAction={() => {
                if (!state.placementSealed) {
                  dispatch({ type: 'SAVE_RESULT', now: systemClock.now() });
                }
              }}
              onCollect={() => dispatch({ type: 'OPEN_SAVED_RESULT' })}
            />
          </div>
          <p className={styles.releaseNote}>
            {state.placementSealed
              ? 'THE ARTIFACT IS NOW THE ONLY PRIMARY ACTION'
              : 'PRESS AMBER TO SAVE AND RELEASE ONE RECORD'}
          </p>
        </main>
        <div aria-live="polite" aria-atomic="true">{state.announcement}</div>
      </div>
    </EvidenceShell>
  );
}
