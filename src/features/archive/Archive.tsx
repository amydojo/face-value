import type { EvidenceRecordData } from '../../domain/model';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { RecordFolio } from '../evidence-record/EvidenceRecord';
import styles from '../../styles/FaceValue.module.css';

const showDemoControls = import.meta.env.VITE_SHOW_DEMO_CONTROLS === 'true';

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
    <section
      className={styles.archive}
      aria-labelledby="previous-trials-heading"
      data-fv-screen="previous-trials"
    >
      <button type="button" className={styles.textButton} onClick={onBack}>
        ← Back
      </button>
      <p className={styles.eyebrow}>PREVIOUS TRIALS</p>
      <h1 id="previous-trials-heading">Previous trials</h1>
      <p>
        Each saved result keeps the product, job, scans, note, trial conditions, confidence, and
        next step together.
      </p>
      {records.length === 0 ? (
        <p>No saved results yet.</p>
      ) : (
        <div className={styles.archiveIndex} aria-label="Previous trials">
          {records.map((record) => {
            const identity = oracleTrialIdentityForRecord(record);
            return (
              <button
                className={styles.archiveRecord}
                type="button"
                key={record.id}
                onClick={() => onOpen(record)}
                aria-label={`Open saved result ${identity.folio} for ${record.product}`}
              >
                <span className={styles.archiveAccession} data-oracle-trial-identity>
                  {identity.folio}
                </span>
                <RecordFolio record={record} />
              </button>
            );
          })}
        </div>
      )}
      {showDemoControls && (
        <details>
          <summary>Demo controls</summary>
          <button type="button" className={styles.dangerAction} onClick={onClear}>
            Clear demo data
          </button>
        </details>
      )}
    </section>
  );
}
