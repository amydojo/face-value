import type { EvidenceRecordData } from '../../domain/model';
import styles from '../../styles/FaceValue.module.css';

export function RecordFolio({ record }: { record: EvidenceRecordData }) {
  return (
    <div className={styles.recordFolio} aria-label={`Evidence Record ${record.id}`}>
      <span>FACE VALUE · EVIDENCE RECORD</span><strong>{record.accession}</strong><p>{record.product}</p><small>{record.job}</small>
    </div>
  );
}

export function EvidenceRecord({ record, onArchive, onCabinet, onBack }: { record: EvidenceRecordData; onArchive: () => void; onCabinet: () => void; onBack: () => void }) {
  const rows = [
    ['OBSERVATION WINDOW', record.observationWindow],
    ['COMPARISON', record.comparison.replaceAll('_', ' ')],
    ['PRIMARY FINDING', record.finding],
    ['NON-FINDING', record.nonFinding],
    ['IMPORTANT DISTURBANCE', record.disturbance.replaceAll('_', ' ')],
    ['CONFIDENCE', record.confidence],
    ['FINAL PLACEMENT', record.finalPlacement.replaceAll('_', ' ')],
  ];
  return (
    <section className={styles.recordScreen} aria-labelledby="record-heading">
      <button type="button" className={styles.textButton} onClick={onBack}>← Back</button>
      <div className={styles.recordHeading}><h1 id="record-heading">EVIDENCE RECORD</h1><span>{record.id}</span></div>
      <RecordFolio record={record} />
      <dl className={styles.recordRows}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className={styles.claimBoundary}>{record.claimBoundary}</p>
      <div className={styles.privacyBadge}>PRIVATE BY DEFAULT · FACE IMAGE EXCLUDED</div>
      <button type="button" className={styles.primaryAction} onClick={onArchive}>View archive</button>
      <button type="button" className={styles.secondaryAction} onClick={onCabinet}>Return to cabinet</button>
    </section>
  );
}
