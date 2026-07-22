import type { EvidenceRecordData } from '../../domain/model';
import { ScreenHeader } from '../../components/hardware';
import styles from '../../styles/FaceValue.module.css';

export function RecordFolio({ record }: { record: EvidenceRecordData }) {
  return (
    <div className={styles.recordFolio} data-fv-part="record-folio" aria-label={`Evidence Record ${record.id}`}>
      <div data-fv-part="folio-tab">{record.accession}</div>
      <div data-fv-part="folio-specimen-field"><i aria-hidden /><span aria-hidden /></div>
      <strong>{record.product}</strong>
      <small>{record.observationWindow}</small>
      <p>{record.finding}<br />{record.nonFinding}</p>
      <em>{record.finalPlacement.replaceAll('_', ' ').toUpperCase()}</em>
      <div data-fv-part="confidence-rail"><i /></div>
      <b>{record.confidence.toUpperCase()}</b>
    </div>
  );
}

export function EvidenceRecord({ record, onArchive, onCabinet, onBack }: { record: EvidenceRecordData; onArchive: () => void; onCabinet: () => void; onBack: () => void }) {
  const rows = [
    ['OBSERVATION WINDOW', record.observationWindow],
    ['COMPARISON', record.comparison.replaceAll('_', ' ')],
    ['PRIMARY FINDING', record.finding],
    ['USAGE CONSISTENCY', '10 of 12 planned uses logged'],
    ['IMPORTANT DISTURBANCE', record.disturbance === 'none' || record.disturbance === 'returned_to_cooling' ? 'None during comparable window' : record.disturbance.replaceAll('_', ' ')],
    ['CONFIDENCE', record.confidence],
    ['FINAL PLACEMENT', record.finalPlacement.replaceAll('_', ' ')],
  ];

  return (
    <>
      <ScreenHeader />
      <section className={styles.recordScreen} data-fv-screen="record" aria-labelledby="record-heading">
        <div className={styles.recordHeading} data-fv-part="record-heading"><button type="button" className={styles.textButton} onClick={onBack}>←</button><h1 id="record-heading">EVIDENCE RECORD</h1><span>{record.accession}</span></div>
        <RecordFolio record={record} />
        <dl className={styles.recordRows} data-fv-part="record-rows">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === 'CONFIDENCE' ? styles.eyebrow : undefined}>{value}</dd></div>)}</dl>
        <p className={styles.claimBoundary} data-fv-part="record-claim-boundary">{record.claimBoundary}</p>
        <div className={styles.privacyBadge} data-fv-part="record-privacy">PRIVATE BY DEFAULT · FACE IMAGE EXCLUDED</div>
        <button type="button" className={styles.primaryAction} data-fv-action="view-full-record" aria-label="View archive" onClick={onArchive}>VIEW FULL RECORD <span aria-hidden>→</span></button>
        <button type="button" className={styles.secondaryAction} onClick={onCabinet}>Return to cabinet</button>
      </section>
    </>
  );
}
