import type { EvidenceRecordData } from '../../domain/model';
import { RecordFolio } from '../evidence-record/EvidenceRecord';
import styles from '../../styles/FaceValue.module.css';

export function Archive({ records, onOpen, onBack, onClear }: { records: EvidenceRecordData[]; onOpen: (record: EvidenceRecordData) => void; onBack: () => void; onClear: () => void }) {
  return (
    <section className={styles.archive} aria-labelledby="archive-heading">
      <button type="button" className={styles.textButton} onClick={onBack}>← Back</button>
      <p className={styles.eyebrow}>STORED EVIDENCE</p>
      <h1 id="archive-heading">The archive keeps what survived observation.</h1>
      {records.length === 0 ? <p>No Evidence Records yet.</p> : records.map((record) => <button className={styles.archiveRecord} type="button" key={record.id} onClick={() => onOpen(record)}><RecordFolio record={record} /></button>)}
      <button type="button" className={styles.dangerAction} onClick={onClear}>Clear demo data</button>
    </section>
  );
}
