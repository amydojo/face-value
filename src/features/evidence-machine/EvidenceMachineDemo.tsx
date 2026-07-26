import { useEffect, useMemo, useState } from 'react';
import { ANALYSIS_SCENARIOS } from '../../fixtures/analysis-scenarios';
import { PRODUCTS } from '../../fixtures/products';
import { EvidenceMachine } from './EvidenceMachine';
import { EvidenceRecordArtifact, EvidenceRecordDetail } from './EvidenceRecordArtifact';
import {
  createEvidenceRecordForTrial,
  createInitialEvidenceTrial,
  restoreStableTrial,
  transitionTrial,
  type EvidenceTrialState,
} from './evidenceTrial';
import styles from './EvidenceMachineDemo.module.css';

const STORAGE_KEY = 'face-value:evidence-machine-signature-demo:v1';

const createVerdictReadyState = (): EvidenceTrialState => {
  let state = createInitialEvidenceTrial();
  state = transitionTrial(state, { type: 'PRODUCT_REGISTERED', product: PRODUCTS[1] });
  state = transitionTrial(state, { type: 'JOB_SELECTED', job: 'Visible tone consistency' });
  state = transitionTrial(state, { type: 'JOB_ASSIGNED', job: 'Visible tone consistency' });
  state = transitionTrial(state, { type: 'BASELINE_CAPTURE_STARTED' });
  state = transitionTrial(state, {
    type: 'BASELINE_CAPTURED',
    scan: {
      id: 'baseline-hydrating-drops',
      kind: 'baseline',
      source: 'file',
      mimeType: 'image/jpeg',
      createdAt: '2026-07-15T19:00:00.000Z',
      orientationRule: 'analysis-unmirrored',
    },
    startedAt: '15 JUL',
    targetAt: '27 JUL',
  });
  state = transitionTrial(state, { type: 'TRIAL_STARTED' });
  state = transitionTrial(state, { type: 'FOLLOW_UP_CAPTURE_STARTED' });
  state = transitionTrial(state, {
    type: 'FOLLOW_UP_CAPTURED',
    scan: {
      id: 'followup-hydrating-drops',
      kind: 'followup',
      source: 'file',
      mimeType: 'image/jpeg',
      createdAt: '2026-07-27T19:00:00.000Z',
      orientationRule: 'analysis-unmirrored',
    },
  });
  state = transitionTrial(state, { type: 'PROCESSING_STARTED' });
  return transitionTrial(state, { type: 'PROCESSING_COMPLETED', verdict: ANALYSIS_SCENARIOS.likely_change });
};

const hydrate = (): EvidenceTrialState => {
  if (typeof localStorage === 'undefined') return createVerdictReadyState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createVerdictReadyState();
  try {
    return restoreStableTrial(JSON.parse(raw) as EvidenceTrialState);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return createVerdictReadyState();
  }
};

export function EvidenceMachineDemo() {
  const [state, setState] = useState<EvidenceTrialState>(hydrate);
  const [detailOpen, setDetailOpen] = useState(false);
  const record = state.evidenceRecord;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const machineAction = () => {
    setState((current) => {
      if (current.phase !== 'verdict-ready') return current;
      const revealing = transitionTrial(current, { type: 'VERDICT_RELEASE_STARTED' });
      const evidenceRecord = createEvidenceRecordForTrial(revealing, '27 JUL');
      return transitionTrial(revealing, { type: 'RECORD_GENERATED', record: evidenceRecord });
    });
  };

  const recordPresented = () => {
    setState((current) => current.phase === 'verdict-revealed' ? transitionTrial(current, { type: 'RECORD_PRESENTED' }) : current);
  };

  const collect = () => {
    setState((current) => current.phase === 'record-presented' ? transitionTrial(current, { type: 'RECORD_COLLECTED' }) : current);
  };

  const collected = state.phase === 'record-collected' || state.phase === 'disposition-required' || state.phase === 'complete' || state.phase === 'archived';
  const heading = useMemo(() => collected ? 'Your evidence.' : 'The product has an answer.', [collected]);

  return (
    <main className={styles.screen} data-fv-screen="signature-release">
      <header>
        <span>FACE VALUE</span>
        <span>FV–035</span>
      </header>
      <div className={styles.rule} />
      <section className={styles.intro}>
        <p>{collected ? 'RESULT RECORDED' : 'HONEST VERDICT · ONE PRODUCT · ONE JOB'}</p>
        <h1>{heading}</h1>
        <p>{collected ? 'Visible evenness appears slightly improved.' : 'Press the amber actuator. The machine will release one Evidence Record.'}</p>
      </section>

      {!collected && (
        <EvidenceMachine
          state={state}
          specimen={PRODUCTS[1]}
          record={record}
          onMachineAction={machineAction}
          onRecordPresented={recordPresented}
          onCollect={collect}
        />
      )}

      {collected && record && (
        <section className={styles.collected}>
          <p>YOUR EVIDENCE</p>
          <div className={styles.collectedArtifact}>
            <EvidenceRecordArtifact record={record} mode="collected" />
          </div>
          <p>Visible evenness appears slightly improved.</p>
          <button type="button" className={styles.primary} onClick={() => setDetailOpen((open) => !open)} aria-expanded={detailOpen}>
            {detailOpen ? 'CLOSE EVIDENCE DETAIL' : 'VIEW EVIDENCE DETAIL'}
          </button>
          <div className={styles.secondaryActions}>
            <button type="button" onClick={() => window.print()}>Save image</button>
            <button type="button" onClick={() => navigator.share?.({ title: 'Face Value Evidence Record', text: record.finding.summary })}>Share</button>
            <button type="button" onClick={() => { localStorage.removeItem(STORAGE_KEY); setState(createVerdictReadyState()); setDetailOpen(false); }}>Return to trials</button>
          </div>
        </section>
      )}

      {detailOpen && record && <EvidenceRecordDetail record={record} />}
    </main>
  );
}
