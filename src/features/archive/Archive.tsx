import type { EvidenceRecordData } from '../../domain/model';
import { RecordFolio } from '../evidence-record/EvidenceRecord';
import styles from '../../styles/FaceValue.module.css';

export function Archive({
  records,
  onOpen,
  onBack,
  onClear,
}: {
  records: EvidenceRecordData[];
  onOpen: (record: EvidenceRecordData) => void;
  onBack: () => void;
  onClear: () => void;
}) {
  return (
    <section className={styles.archive} aria-labelledby="archive-heading" data-fv-screen="archive">
      <button type="button" className={styles.textButton} onClick={onBack}>← Back</button>
      <p className={styles.eyebrow}>EVIDENCE ARCHIVE</p>
      <h1 id="archive-heading">Every cassette leaves a durable record.</h1>
      <p>Archived observations remain readable without reopening the original capture.</p>
      {records.length === 0 ? (
        <p>No Evidence Records yet.</p>
      ) : (
        <div className={styles.archiveIndex} aria-label="Archived evidence records">
          {records.map((record) => (
            <button className={styles.archiveRecord} type="button" key={record.id} onClick={() => onOpen(record)}>
              <span className={styles.archiveAccession}>{record.accession}</span>
              <RecordFolio record={record} />
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.dangerAction} onClick={onClear}>Clear demo data</button>
    </section>
  );
}
