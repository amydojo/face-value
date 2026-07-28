import { useEffect, useMemo, useState } from 'react';
import { systemClock } from '../../adapters/clock/clock';
import { specimenFromRegisteredProduct } from '../../adapters/product/specimenFromRegisteredProduct';
import { useFaceValue } from '../../app/faceValueContext';
import { EvidenceShell, ScreenHeader } from '../../components/hardware';
import type { ProductPlacement } from '../../domain/model';
import { formatRawScore } from '../../domain/youcamEvidence';
import { legacySpecimenFor } from '../../fixtures/products';
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
  const specimen = state.registeredProduct
    ? specimenFromRegisteredProduct(state.registeredProduct)
    : legacySpecimenFor(
        state.selectedSpecimenId,
        state.selectedDrawerIndex,
      );
  const [nextStepOverrideOpen, setNextStepOverrideOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [recordPresented, setRecordPresented] = useState(
    state.placementSealed && Boolean(state.record),
  );
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
    if (state.stage !== 'placement') setWhyOpen(false);
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
        data-fv-screen="result-revealed"
        data-fv-part="result-revealed"
        data-fv-selected-placement={state.placement}
      >
        <ScreenHeader dark />
        <main className={styles.content}>
          <div className={styles.directory}>
            <p>RESULT</p>
            <p>{state.placementSealed ? 'RELEASING' : 'SAVE READY'}</p>
          </div>
          <section className={styles.intro}>
            <p>
              {state.placementSealed
                ? recordPresented
                  ? 'EVIDENCE PRODUCED'
                  : 'DECISION COMMITTED'
                : 'YOUR TRIAL HAS AN ANSWER.'}
            </p>
            <h1 data-stage-focus tabIndex={-1}>
              {state.placementSealed
                ? recordPresented
                  ? 'Take your evidence.'
                  : 'Keeping your evidence.'
                : state.analysis?.finding ?? 'Your result.'}
            </h1>
            <p>
              {state.placementSealed
                ? recordPresented
                  ? 'Collect the record the machine produced. Nothing changes until you take it.'
                  : 'Your decision is committed. The machine is producing one durable record.'
                : state.analysis?.nonFinding}
            </p>
          </section>

          {!state.placementSealed && state.analysis && (
            <section className={styles.decision} aria-label="Selected next step">
              <p className={styles.limitation}>
                {state.analysis.relevantContext}
              </p>
              <p>Face Value recommends:</p>
              <h2>TEST LONGER</h2>
              <p>{nextStep.guidance}</p>
              <button
                type="button"
                className={styles.secondaryAction}
                aria-expanded={whyOpen}
                aria-controls="human-butter-result-detail"
                onClick={() => setWhyOpen((open) => !open)}
              >
                SEE WHY
              </button>
              <div
                id="human-butter-result-detail"
                className={styles.technicalDetail}
                hidden={!whyOpen}
              >
                <dl>
                  <div>
                    <dt>BASELINE RAW SCORE</dt>
                    <dd>
                      {typeof state.analysis.baselineRawScore === 'number'
                        ? formatRawScore(state.analysis.baselineRawScore)
                        : 'Unavailable'}
                    </dd>
                  </div>
                  <div>
                    <dt>FOLLOW-UP RAW SCORE</dt>
                    <dd>
                      {typeof state.analysis.followUpRawScore === 'number'
                        ? formatRawScore(state.analysis.followUpRawScore)
                        : 'Unavailable'}
                    </dd>
                  </div>
                  <div>
                    <dt>DIRECTION</dt>
                    <dd>
                      {state.analysis.direction?.toUpperCase() ?? 'UNAVAILABLE'}
                    </dd>
                  </div>
                  <div>
                    <dt>CONFIDENCE</dt>
                    <dd>{state.confidence.toUpperCase()}</dd>
                  </div>
                </dl>
                <p>YouCam Skin Analysis v2.1 · calibration pending</p>
                <small>{state.analysis.claimBoundary}</small>
              </div>
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
                  dispatch({
                    type: 'COMMIT_RESULT_AND_RELEASE',
                    placement: state.placement,
                    now: systemClock.now(),
                  });
                }
              }}
              onRecordPresented={() => setRecordPresented(true)}
              onCollect={() => dispatch({ type: 'OPEN_SAVED_RESULT' })}
            />
          </div>
          <p className={styles.releaseNote}>
            {state.placementSealed
              ? recordPresented
                ? 'THE ARTIFACT IS NOW THE ONLY PRIMARY ACTION'
                : 'PRODUCING ONE EVIDENCE RECORD'
              : 'PRESS AMBER TO KEEP THIS EVIDENCE'}
          </p>
        </main>
        <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
          {state.announcement}
        </div>
      </div>
    </EvidenceShell>
  );
}
