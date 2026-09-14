import { useEffect, useMemo, useState } from 'react';
import { FaceValueBrandLockup } from '../../components/FaceValueBrandLockup';
import { getBrowserTerminalHardware } from '../../adapters/terminal/TerminalHardware';
import { EvidenceReceipt } from '../evidence-receipt/EvidenceReceipt';
import {
  SYNTHETIC_EVIDENCE_RECORD,
  terminalStageLabel,
  type TerminalStage,
} from './terminalModel';
import styles from './Terminal.module.css';

const record = SYNTHETIC_EVIDENCE_RECORD;

const stageLight = {
  standby: 'standby',
  specimen: 'active',
  active: 'active',
  verdict: 'ready',
  printing: 'printing',
  sealed: 'ready',
} as const;

function nextStage(stage: TerminalStage): TerminalStage {
  if (stage === 'standby') return 'specimen';
  if (stage === 'specimen') return 'active';
  if (stage === 'active') return 'verdict';
  if (stage === 'sealed') return 'standby';
  return stage;
}

export function TerminalApp() {
  const [stage, setStage] = useState<TerminalStage>('standby');
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [cassetteId, setCassetteId] = useState<string | null>(null);
  const hardware = useMemo(() => getBrowserTerminalHardware(), []);

  const sealRecord = async () => {
    if (stage !== 'verdict') return;
    setStage('printing');
    await hardware.setStatusLight('printing');
    const result = await hardware.printEvidenceRecord(record.id);
    if (!result.ok) {
      await hardware.setStatusLight('error');
      return;
    }
    setReceiptVisible(true);
    setStage('sealed');
    await hardware.setStatusLight('ready');
  };

  useEffect(() => {
    const stopCassette = hardware.onCassetteDetected((productId) => {
      setCassetteId(productId);
      setStage('specimen');
    });
    const stopActuator = hardware.onActuatorPressed(() => {
      void sealRecord();
    });
    return () => {
      stopCassette();
      stopActuator();
    };
  }, [hardware, stage]);

  useEffect(() => {
    void hardware.setStatusLight(stageLight[stage]);
  }, [hardware, stage]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key.toLowerCase() === 'a') setStage((current) => nextStage(current));
      if (event.key.toLowerCase() === 'p') setReceiptVisible((current) => !current);
      if (event.key === 'Escape') setReceiptVisible(false);
    };
    globalThis.addEventListener?.('keydown', handleKeydown);
    return () => globalThis.removeEventListener?.('keydown', handleKeydown);
  }, []);

  const advance = () => setStage((current) => nextStage(current));

  return (
    <main className={styles.terminal} data-terminal-stage={stage}>
      <header className={styles.header}>
        <FaceValueBrandLockup
          tone="reverse"
          variant="compact"
          state={stage === 'printing' ? 'scanning' : stage === 'verdict' || stage === 'sealed' ? 'ready' : 'rest'}
        />
        <div className={styles.headerMeta}>
          <span>FV–01 · EVIDENCE TERMINAL</span>
          <strong>LAB · SYNTHETIC</strong>
        </div>
      </header>

      <section className={styles.instrument} aria-live="polite">
        <div className={styles.primaryPanel}>
          <p className={styles.eyebrow}>{terminalStageLabel[stage]}</p>
          <StageHeadline stage={stage} />
          <StageBody stage={stage} cassetteId={cassetteId} />
        </div>

        <aside className={styles.statusPanel}>
          <SpecimenCard stage={stage} />
          <StatusRail stage={stage} />
        </aside>
      </section>

      <footer className={styles.footer}>
        <div>
          <span>ONE PRODUCT · ONE JOB · ONE HONEST RESULT</span>
          <span>PRIVATE BY DEFAULT · FACE IMAGES STAY IN MEMORY</span>
        </div>
        <div className={styles.controlState} data-control-armed={stage === 'verdict' || undefined}>
          <i />
          <span>{stage === 'verdict' ? 'ORANGE CONTROL ARMED' : stage === 'printing' ? 'PRINTING' : 'CONTROL STANDBY'}</span>
        </div>
      </footer>

      <nav className={styles.demoRail} aria-label="Synthetic terminal controls">
        <span>DEMO INPUTS · NOT PART OF HARDWARE UI</span>
        <button type="button" onClick={() => { setCassetteId('FV-P-ONE-THING-10'); setStage('specimen'); }}>N · LOAD</button>
        <button type="button" onClick={advance} disabled={stage === 'verdict' || stage === 'printing'}>A · ADVANCE</button>
        <button type="button" onClick={() => void sealRecord()} disabled={stage !== 'verdict'}>SPACE · SEAL</button>
        <button type="button" onClick={() => setReceiptVisible((current) => !current)}>P · RECEIPT</button>
      </nav>

      {receiptVisible && (
        <div className={styles.receiptOverlay} role="dialog" aria-modal="true" aria-label="Evidence receipt preview">
          <button className={styles.closeReceipt} type="button" onClick={() => setReceiptVisible(false)}>CLOSE ×</button>
          <EvidenceReceipt record={record} />
        </div>
      )}
    </main>
  );
}

function StageHeadline({ stage }: { stage: TerminalStage }) {
  if (stage === 'standby') return <h1>NO SPECIMEN LOADED</h1>;
  if (stage === 'specimen') return <h1>ONE THING 10%<br />REGISTERED.</h1>;
  if (stage === 'active') return <h1>EVIDENCE IS<br />ACCUMULATING.</h1>;
  if (stage === 'verdict') return <h1>{record.observation}</h1>;
  if (stage === 'printing') return <h1>SEALING<br />{record.id}</h1>;
  return <h1>TAKE YOUR RECORD.</h1>;
}

function StageBody({ stage, cassetteId }: { stage: TerminalStage; cassetteId: string | null }) {
  if (stage === 'standby') {
    return <p>Tap a product cassette to begin. The instrument will keep one product tied to one measurable job.</p>;
  }
  if (stage === 'specimen') {
    return <p>Product identity secured{cassetteId ? ` · ${cassetteId}` : ''}. Job assigned: visible redness.</p>;
  }
  if (stage === 'active') {
    return <p>Baseline secured. Repeat observation window: {record.durationDays} days. Keep the test conditions stable.</p>;
  }
  if (stage === 'verdict') {
    return <p>Comparison verified · {record.checks} checks passed. Next: <strong>{record.next}</strong>. Press the physical orange control to seal the evidence.</p>;
  }
  if (stage === 'printing') {
    return <p>Permanent evidence ID assigned. Rendering a 58 mm thermal record from the sealed trial.</p>;
  }
  return <p>{record.id} is sealed. The physical printer has finished the evidence ticket.</p>;
}

function SpecimenCard({ stage }: { stage: TerminalStage }) {
  const loaded = stage !== 'standby';
  return (
    <div className={styles.specimenCard} data-loaded={loaded || undefined}>
      <div className={styles.specimenHeader}>
        <span>{loaded ? 'SPECIMEN' : 'CASE STATUS'}</span>
        <span>{loaded ? record.id : 'READY'}</span>
      </div>
      <div className={styles.specimenBody}>
        <div className={styles.productCopy}>
          <span>PRODUCT</span>
          <strong>{loaded ? `${record.product} ${record.productDetail}` : '—'}</strong>
          <span>JOB</span>
          <strong>{loaded ? record.job : 'AWAITING INPUT'}</strong>
        </div>
        <div className={styles.bottle} data-loaded={loaded || undefined} aria-hidden="true">
          <i className={styles.cap} />
          <i className={styles.body} />
          <i className={styles.label}><b>{loaded ? 'ONE\nTHING\n10%' : ''}</b></i>
        </div>
      </div>
    </div>
  );
}

function StatusRail({ stage }: { stage: TerminalStage }) {
  const index = ['standby', 'specimen', 'active', 'verdict', 'printing', 'sealed'].indexOf(stage);
  return (
    <div className={styles.statusRail}>
      <div><span>BASELINE</span><strong>{index >= 2 ? 'SECURED' : 'WAITING'}</strong></div>
      <div><span>COMPARISON</span><strong>{index >= 3 ? 'VERIFIED' : 'PENDING'}</strong></div>
      <div><span>RECORD</span><strong>{stage === 'sealed' ? 'SEALED' : stage === 'printing' ? 'PRINTING' : 'OPEN'}</strong></div>
    </div>
  );
}
