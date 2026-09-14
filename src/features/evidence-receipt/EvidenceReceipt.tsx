import type { EvidenceRecord } from '../terminal/terminalModel';
import { SYNTHETIC_EVIDENCE_RECORD } from '../terminal/terminalModel';
import styles from './EvidenceReceipt.module.css';

const qrBits = [
  '111010111',
  '101110101',
  '111010111',
  '000111000',
  '101001101',
  '011110010',
  '111010111',
  '101111101',
  '111010111',
];

export function EvidenceReceipt({ record }: { record: EvidenceRecord }) {
  return (
    <article className={styles.ticket} aria-label={`Evidence record ${record.id}`}>
      <header className={styles.header}>
        <div>
          <strong>FACE VALUE</strong>
          <span>EVIDENCE RECORD</span>
        </div>
        <div className={styles.recordMeta}>
          <span>{record.id}</span>
          <span>{record.dateLabel}</span>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.productLine}>
          <strong>{record.product}</strong>
          <strong>{record.productDetail}</strong>
        </div>
        <p className={styles.micro}>JOB · {record.job}</p>
      </section>

      <section className={`${styles.section} ${styles.observation}`}>
        <p className={styles.micro}>OBSERVED</p>
        <h1>{record.observation}</h1>
      </section>

      <section className={`${styles.section} ${styles.metrics}`}>
        <div><span>BASELINE</span><strong>{record.baseline}</strong></div>
        <div><span>FOLLOW-UP</span><strong>{record.followup}</strong></div>
        <div><span>CHANGE</span><strong>+{record.change}</strong></div>
        <div><span>COMPARABILITY</span><strong>{record.comparability}</strong></div>
        <div><span>CHECKS</span><strong>{record.checks}</strong></div>
        <div><span>DURATION</span><strong>{record.durationDays} DAYS</strong></div>
      </section>

      <section className={`${styles.section} ${styles.next}`}>
        <p className={styles.micro}>NEXT</p>
        <strong>{record.next}</strong>
      </section>

      <footer className={styles.footer}>
        <div className={styles.qr} aria-hidden="true">
          {qrBits.flatMap((row, rowIndex) =>
            [...row].map((bit, columnIndex) => (
              <i
                key={`${rowIndex}-${columnIndex}`}
                className={bit === '1' ? styles.qrOn : undefined}
              />
            )),
          )}
        </div>
        <div>
          <strong>OPEN FULL EVIDENCE RECORD</strong>
          <span>{record.id} · PRIVATE BY DEFAULT</span>
          <span className={styles.synthetic}>LAB · SYNTHETIC</span>
        </div>
      </footer>
    </article>
  );
}

export function EvidenceReceiptPreview() {
  return (
    <main className={styles.previewPage}>
      <div className={styles.previewToolbar} data-print-hidden>
        <span>58 MM · 384 PX THERMAL PREVIEW</span>
        <button type="button" onClick={() => globalThis.print?.()}>
          PRINT PREVIEW
        </button>
      </div>
      <EvidenceReceipt record={SYNTHETIC_EVIDENCE_RECORD} />
    </main>
  );
}
