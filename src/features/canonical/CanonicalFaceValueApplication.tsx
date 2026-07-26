import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CaptureKind, CaptureMetadata, ProductPlacement } from '../../domain/model';
import { PRODUCTS } from '../../fixtures/products';
import { ANALYSIS_SCENARIOS } from '../../fixtures/analysis-scenarios';
import { CanonicalCamera, CanonicalCaptureContract } from './CanonicalCaptureFlow';
import { EvidenceMachine } from '../evidence-machine/EvidenceMachine';
import { EvidenceRecordArtifact } from '../evidence-machine/EvidenceRecordArtifact';
import {
  assertSinglePrimaryAction,
  createInitialEvidenceTrial,
  productFromSpecimen,
  resolveMachineConfiguration,
  restoreInterruptedTrial,
  transitionTrial,
  type EvidenceRecord,
  type EvidenceTrialState,
  type MachineActionId,
  type TrialEvent,
} from '../evidence-machine/evidenceTrial';
import styles from './CanonicalFaceValueApplication.module.css';

const STORAGE_KEY = 'face-value:evidence-machine:v2';

type Overlay = null | { type: 'capture-contract' | 'camera'; kind: CaptureKind } | { type: 'detail' } | { type: 'archive' };

interface PersistedState {
  trial: EvidenceTrialState;
  archive: EvidenceRecord[];
  selectedProductId: string;
}

function readPersisted(): PersistedState {
  const fallback = { trial: createInitialEvidenceTrial(), archive: [], selectedProductId: 'hydrating-drops' };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.trial?.trialId || !Array.isArray(parsed.archive)) return fallback;
    return { ...parsed, trial: restoreInterruptedTrial(parsed.trial) };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return fallback;
  }
}

const isoAfterDays = (value: string, days: number) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

function ownerInvariant(trial: EvidenceTrialState, pagePrimary: boolean, artifactPrimary = false) {
  const machine = resolveMachineConfiguration(trial);
  assertSinglePrimaryAction({
    machinePrimary: machine.primaryActionOwner === 'machine',
    artifactPrimary: artifactPrimary || machine.primaryActionOwner === 'artifact',
    pagePrimary,
  });
}

export function CanonicalFaceValueApplication() {
  const initial = useRef(readPersisted());
  const [trial, setTrial] = useState<EvidenceTrialState>(initial.current.trial);
  const trialRef = useRef(trial);
  const [archive, setArchive] = useState<EvidenceRecord[]>(initial.current.archive);
  const [selectedProductId, setSelectedProductId] = useState(initial.current.selectedProductId);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [announcement, setAnnouncement] = useState('Face Value is ready.');
  const processingRun = useRef(false);
  const processingFailedOnce = useRef(false);
  const historyInitialized = useRef(false);
  const [shareState, setShareState] = useState('');

  const commitTrial = useCallback((event: TrialEvent): EvidenceTrialState => {
    try {
      const next = transitionTrial(trialRef.current, event);
      trialRef.current = next;
      setTrial(next);
      return next;
    } catch {
      return trialRef.current;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trial, archive, selectedProductId } satisfies PersistedState));
  }, [archive, selectedProductId, trial]);

  useEffect(() => {
    if (!historyInitialized.current) {
      window.history.replaceState({ phase: trialRef.current.phase }, '');
      historyInitialized.current = true;
    }
    const onPopState = (event: PopStateEvent) => {
      setOverlay(null);
      const requestedPhase = event.state?.phase as EvidenceTrialState['phase'] | undefined;
      if (requestedPhase) {
        const restored = restoreInterruptedTrial({ ...trialRef.current, phase: requestedPhase });
        trialRef.current = restored;
        setTrial(restored);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showOverlay = (next: Exclude<Overlay, null>) => {
    window.history.pushState({ phase: trialRef.current.phase, overlay: next.type }, '');
    setOverlay(next);
  };


  useEffect(() => {
    if (trial.phase !== 'trial-active') return;
    const timer = window.setTimeout(() => {
      try {
        commitTrial({ type: 'FOLLOW_UP_DUE' });
        setAnnouncement('Follow-up ready.');
      } catch { /* already advanced */ }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [commitTrial, trial.phase]);

  useEffect(() => {
    if (trial.phase !== 'processing' || processingRun.current) return;
    processingRun.current = true;
    setAnnouncement('Comparing scans. The latch is locked.');
    const timer = window.setTimeout(() => {
      try {
        if (new URLSearchParams(window.location.search).get('processingFailure') === '1' && !processingFailedOnce.current) {
          processingFailedOnce.current = true;
          commitTrial({ type: 'PROCESSING_FAILED' });
          setAnnouncement('Process interrupted. Your evidence was preserved.');
        } else {
          commitTrial({ type: 'PROCESSING_COMPLETED', result: ANALYSIS_SCENARIOS.likely_change });
          setAnnouncement('Verdict ready.');
        }
      } finally {
        processingRun.current = false;
      }
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 720);
    return () => {
      window.clearTimeout(timer);
      processingRun.current = false;
    };
  }, [commitTrial, trial.phase]);

  const machineConfig = resolveMachineConfiguration(trial);

  const openCapture = (kind: CaptureKind) => {
    commitTrial({ type: kind === 'baseline' ? 'BASELINE_CAPTURE_REQUESTED' : 'FOLLOW_UP_CAPTURE_REQUESTED' });
    showOverlay({ type: 'capture-contract', kind });
    setAnnouncement(`${kind === 'baseline' ? 'Baseline' : 'Follow-up'} capture conditions opened.`);
  };

  const machineAction = (action: MachineActionId) => {
    if (action === 'start-baseline-scan') openCapture('baseline');
    if (action === 'start-follow-up-scan') openCapture('followup');
    if (action === 'retry-processing') {
      commitTrial({ type: 'PROCESSING_RETRIED' });
      processingRun.current = false;
      setAnnouncement('Comparing scans again.');
    }
    if (action === 'release-record') {
      if (['verdict-ready', 'release-error'].includes(trialRef.current.phase)) {
        commitTrial({ type: 'VERDICT_REVEAL_STARTED' });
        setAnnouncement('Actuator pressed. Releasing Evidence Record.');
      }
    }
  };

  const generateRecord = () => {
    const current = trialRef.current;
    if (current.evidenceRecord) return current.evidenceRecord;
    const generatedAt = new Date().toISOString();
    const next = transitionTrial(current, { type: 'RECORD_GENERATED', generatedAt });
    trialRef.current = next;
    setTrial(next);
    return next.evidenceRecord;
  };

  const recordPresented = () => {
    if (trialRef.current.phase !== 'verdict-revealing') return;
    commitTrial({ type: 'RECORD_PRESENTED' });
    setAnnouncement('Record released. Take your evidence.');
  };

  const recordCollected = () => {
    if (trialRef.current.phase !== 'record-presented') return;
    const next = commitTrial({ type: 'RECORD_COLLECTED' });
    if (next.evidenceRecord) {
      setArchive((records) => records.some((record) => record.id === next.evidenceRecord?.id) ? records : [next.evidenceRecord!, ...records]);
    }
    setAnnouncement('Evidence collected.');
  };

  const onCaptureAccepted = (metadata: CaptureMetadata) => {
    commitTrial({ type: metadata.kind === 'baseline' ? 'BASELINE_CAPTURED' : 'FOLLOW_UP_CAPTURED', scan: metadata });
    setOverlay(null);
    setAnnouncement(metadata.kind === 'baseline' ? 'Baseline recorded.' : 'Follow-up received. Comparing evidence.');
  };

  const registerProduct = () => {
    const specimen = PRODUCTS.find((item) => item.id === selectedProductId) ?? PRODUCTS[1];
    const registered = productFromSpecimen(specimen);
    commitTrial({ type: 'PRODUCT_REGISTERED', product: registered });
    window.history.pushState({ phase: 'job-selection' }, '');
    setAnnouncement(`Product registered. Specimen ${registered.specimenCode}.`);
  };

  const startOver = () => {
    const fresh = createInitialEvidenceTrial(`trial-face-value-${Date.now()}`);
    trialRef.current = fresh;
    setTrial(fresh);
    setOverlay(null);
    setAnnouncement('Evidence Machine reset. Past Evidence Records remain saved.');
  };

  const shareRecord = async () => {
    if (!trial.evidenceRecord) return;
    const text = `${trial.evidenceRecord.productName}: ${trial.evidenceRecord.finding.summary}. Confidence: ${trial.evidenceRecord.confidence}.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Face Value Evidence Record', text });
      else await navigator.clipboard.writeText(text);
      setShareState('Evidence summary ready to share.');
    } catch {
      setShareState('Sharing was cancelled. Your record is unchanged.');
    }
  };

  const saveRecord = () => {
    if (!trial.evidenceRecord) return;
    const blob = new Blob([JSON.stringify(trial.evidenceRecord, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `face-value-${trial.evidenceRecord.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setShareState('Evidence Record saved.');
  };

  if (overlay?.type === 'capture-contract') {
    return (
      <CanonicalCaptureContract
        trial={trial}
        kind={overlay.kind}
        onCancel={() => { commitTrial({ type: 'CAPTURE_CANCELLED' }); setOverlay(null); }}
        onContinue={() => setOverlay({ type: 'camera', kind: overlay.kind })}
      />
    );
  }

  if (overlay?.type === 'camera') {
    return (
      <CanonicalCamera
        trial={trial}
        kind={overlay.kind}
        onAccepted={onCaptureAccepted}
        onBack={() => setOverlay({ type: 'capture-contract', kind: overlay.kind })}
      />
    );
  }


  if (overlay?.type === 'detail' && trial.evidenceRecord) {
    const detail = trial.evidenceRecord.detail;
    return (
      <main className={styles.shell} data-fv-screen="evidence-detail">
        <header className={styles.header}><b>FACE VALUE</b><span>{trial.evidenceRecord.id}</span></header>
        <button className={styles.textButton} type="button" onClick={() => setOverlay(null)}>← Your evidence</button>
        <section className={styles.detail} aria-labelledby="evidence-detail-heading">
          <p className={styles.eyebrow}>EVIDENCE DETAIL</p>
          <h1 id="evidence-detail-heading">What this record can honestly say.</h1>
          <h2>OBSERVED</h2><p>{detail.observed}</p>
          <h2>NOT ESTABLISHED</h2><p>{detail.notEstablished}</p>
          <h2>CONTEXT</h2><p>{detail.context}</p>
          <h2>CONFIDENCE</h2><p>{detail.confidence}</p>
          <h2>NEXT STEP</h2><p>{detail.nextStep}</p>
          <details><summary>Technical metadata</summary><pre>{JSON.stringify(detail.technical, null, 2)}</pre></details>
        </section>
      </main>
    );
  }

  if (overlay?.type === 'archive') {
    return (
      <main className={styles.shell} data-fv-screen="archive">
        <header className={styles.header}><b>FACE VALUE</b><span>EVIDENCE ARCHIVE</span></header>
        <button className={styles.textButton} type="button" onClick={() => setOverlay(null)}>← Active trial</button>
        <section className={styles.archive}>
          <p className={styles.eyebrow}>PAST EVIDENCE</p>
          <h1>Objects worth keeping.</h1>
          {archive.length === 0 ? <p>No collected Evidence Records yet.</p> : archive.map((record) => (
            <button key={record.id} type="button" onClick={() => {
              trialRef.current = { ...trialRef.current, evidenceRecord: record, phase: 'record-collected' };
              setTrial(trialRef.current);
              setOverlay(null);
            }}>
              <EvidenceRecordArtifact record={record} mode="collected" />
            </button>
          ))}
        </section>
      </main>
    );
  }

  let content: ReactNode;

  if (trial.phase === 'empty') {
    ownerInvariant(trial, true);
    content = (
      <section className={styles.hero} data-fv-screen="landing">
        <div><p className={styles.eyebrow}>ONE PRODUCT · ONE JOB · ONE HONEST VERDICT</p><h1>Is your skincare actually doing anything?</h1><p>Put one product on trial. Face Value compares repeat scans and returns one useful object.</p></div>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} compact />
        <button className={styles.pagePrimary} type="button" onClick={() => {
          commitTrial({ type: 'REGISTRATION_STARTED' });
          setAnnouncement('Registration started.');
        }}>START A PRODUCT TRIAL <span>→</span></button>
      </section>
    );
  } else if (trial.phase === 'registering') {
    ownerInvariant(trial, true);
    content = (
      <section className={styles.registration} data-fv-screen="registration">
        <p className={styles.eyebrow}>REGISTER ONE PRODUCT</p><h1>What are we putting on trial?</h1>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} compact />
        <fieldset className={styles.choiceList}><legend>CHOOSE A SPECIMEN</legend>{PRODUCTS.map((item) => (
          <label key={item.id}><input type="radio" name="product" checked={selectedProductId === item.id} onChange={() => setSelectedProductId(item.id)} /><span><b>{item.product}</b><small>{item.accession} · {item.volume}</small></span></label>
        ))}</fieldset>
        <button className={styles.pagePrimary} type="button" onClick={registerProduct}>REGISTER PRODUCT <span>→</span></button>
      </section>
    );
  } else if (trial.phase === 'job-selection') {
    ownerInvariant(trial, true);
    content = (
      <section className={styles.job} data-fv-screen="job-selection">
        <p className={styles.eyebrow}>{trial.specimenCode} · ONE JOB</p><h1>What should this product change?</h1>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} compact />
        <fieldset className={styles.choiceList}><legend>GIVE THIS PRODUCT ONE JOB</legend>{trial.product?.jobOptions.map((job) => (
          <label key={job}><input type="radio" name="job" checked={trial.assignedJob === job} onChange={() => {
            commitTrial({ type: 'JOB_SELECTED', job });
            setAnnouncement(`Job selected. ${job}.`);
          }} /><span><b>{job}</b><small>One observable question</small></span></label>
        ))}</fieldset>
        <button className={styles.pagePrimary} type="button" disabled={!trial.assignedJob} onClick={() => {
          commitTrial({ type: 'JOB_ASSIGNED' });
          window.history.pushState({ phase: 'baseline-required' }, '');
          setAnnouncement(`Job accepted. ${trialRef.current.assignedJob}.`);
        }}>ASSIGN THIS JOB <span>→</span></button>
      </section>
    );
  } else if (trial.phase === 'baseline-recorded') {
    ownerInvariant(trial, true);
    content = (
      <section className={styles.centerScreen} data-fv-screen="baseline-recorded">
        <p className={styles.eyebrow}>PRODUCT REGISTERED · JOB ACCEPTED</p><h1>Baseline recorded.</h1>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} />
        <p>Day 0 is locked. Start the trial when the product enters your routine.</p>
        <button className={styles.pagePrimary} type="button" onClick={() => {
          const now = new Date().toISOString();
          commitTrial({ type: 'TRIAL_STARTED', startedAt: now, targetAt: isoAfterDays(now, 12) });
          setAnnouncement('Trial active. Evidence will align over time.');
        }}>BEGIN TRIAL <span>→</span></button>
      </section>
    );
  } else if (['record-collected', 'disposition-required', 'complete'].includes(trial.phase) && trial.evidenceRecord) {
    ownerInvariant(trial, true);
    content = (
      <section className={styles.collected} data-fv-screen="record-collected">
        <p className={styles.eyebrow}>YOUR EVIDENCE</p><h1>One useful object out.</h1>
        <EvidenceMachine key={`machine-${trial.trialId}`} trial={trial} onRecordCollected={recordCollected} />
        <p>{trial.evidenceRecord.finding.metric.toLowerCase()} appears {trial.evidenceRecord.finding.summary.toLowerCase()}.</p>
        <div className={styles.actionStack}>
          <button className={styles.pagePrimary} type="button" onClick={() => showOverlay({ type: 'detail' })}>VIEW EVIDENCE DETAIL <span>→</span></button>
          <button type="button" onClick={saveRecord}>Save record</button>
          <button type="button" onClick={() => void shareRecord()}>Share</button>
          <button type="button" onClick={() => showOverlay({ type: 'archive' })}>Past evidence</button>
        </div>
        {trial.phase !== 'complete' && (
          <fieldset className={styles.disposition}><legend>WHAT HAPPENS NEXT?</legend>
            {([['established','S4 · Established routine'], ['paused','P1 · Test longer'], ['retry_alone','R3 · Retry alone'], ['released','E7 · Re-shelve']] as Array<[ProductPlacement,string]>).map(([value,label]) => (
              <label key={value}><input type="radio" name="disposition" onChange={() => {
                commitTrial({ type: 'DISPOSITION_SELECTED', disposition: value });
                setAnnouncement('Result recorded.');
              }} /><span>{label}</span></label>
            ))}
          </fieldset>
        )}
        {shareState && <p role="status">{shareState}</p>}
        <button className={styles.textButton} type="button" onClick={startOver}>Start another product trial</button>
      </section>
    );
  } else {
    ownerInvariant(trial, false, machineConfig.primaryActionOwner === 'artifact');
    content = (
      <section className={styles.machineScreen} data-fv-screen={trial.phase}>
        <div className={styles.machineCopy}>
          <p className={styles.eyebrow}>{trial.specimenCode ?? 'FACE VALUE'} · {trial.assignedJob ?? 'EVIDENCE MACHINE'}</p>
          <h1>{trial.phase === 'verdict-ready' ? 'The product has an answer.' : trial.phase === 'record-presented' ? 'Take your evidence.' : machineConfig.status.primary.replaceAll('-', ' ').toLowerCase()}.</h1>
          <p>{machineConfig.status.secondary}</p>
        </div>
        <EvidenceMachine
          key={`machine-${trial.trialId}`}
          trial={trial}
          onMachineAction={machineAction}
          onRecordGenerated={generateRecord}
          onRecordPresented={recordPresented}
          onRecordCollected={recordCollected}
          onReleaseFailed={() => {
            if (trialRef.current.phase === 'verdict-revealing') commitTrial({ type: 'RELEASE_FAILED' });
            setAnnouncement('Release interrupted. Your evidence was preserved.');
          }}
          simulateReleaseFailure={new URLSearchParams(window.location.search).get('releaseFailure') === '1'}
        />
        {trial.phase === 'trial-active' && <p className={styles.waiting}>Evidence aligns over time. Follow-up readiness will appear here.</p>}
        {trial.recoverableError && <p className={styles.errorCopy} role="status">{trial.recoverableError.message} Evidence preserved.</p>}
      </section>
    );
  }

  return (
    <main className={styles.shell} data-app-phase={trial.phase}>
      <header className={styles.header}><b>FACE VALUE</b><span>{trial.specimenCode ?? 'FV–014'}</span></header>
      <div className={styles.rule} />
      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">{announcement}</div>
      {content}
    </main>
  );
}
