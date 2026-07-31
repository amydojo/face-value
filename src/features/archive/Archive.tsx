import type { EvidenceRecordData } from '../../domain/model';
import { oracleSpecimenIdentityFromEvidenceRecord } from '../../adapters/product/specimenFromRegisteredProduct';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { verdictProduct, verdictViewModelFromRecord } from '../verdict/verdictViewModel';
import styles from '../../styles/FaceValue.module.css';

const archiveDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const archiveDateFor = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : archiveDateFormatter.format(date).replaceAll(' ', '\u00a0').toUpperCase();
};

export function Archive({
  records,
  onOpen,
  onBack,
}: {
  records: EvidenceRecordData[];
  onOpen: (record: EvidenceRecordData) => void;
  onBack: () => void;
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
      <header className={styles.archiveHeading}>
        <p className={styles.eyebrow}>PREVIOUS TRIALS</p>
        <h1 id="previous-trials-heading">Previous trials</h1>
        <p className={styles.archiveSummary}>
          <span>
            {records.length} {records.length === 1 ? 'SAVED RESULT' : 'SAVED RESULTS'}
          </span>
          <span>NEWEST FIRST</span>
        </p>
      </header>
      {records.length === 0 ? (
        <p className={styles.archiveEmpty}>No saved results yet.</p>
      ) : (
        <div className={styles.archiveIndex} aria-label="Previous trials">
          {records.map((record) => {
            const identity = oracleTrialIdentityForRecord(record);
            const specimenIdentity = oracleSpecimenIdentityFromEvidenceRecord(record);
            const viewModel = verdictViewModelFromRecord(record);
            const optionalProductDetails = [specimenIdentity.strength, specimenIdentity.volume]
              .filter((value): value is string => Boolean(value))
              .join(' · ');
            return (
              <button
                className={styles.archiveRecord}
                type="button"
                key={record.id}
                data-archive-record
                data-record-id={record.id}
                data-specimen-id={specimenIdentity.productId ?? ''}
                data-specimen-accession={specimenIdentity.accession ?? ''}
                data-specimen-brand={specimenIdentity.brand}
                data-specimen-product={specimenIdentity.productName}
                data-specimen-strength={specimenIdentity.strength ?? ''}
                data-specimen-volume={specimenIdentity.volume ?? ''}
                onClick={() => onOpen(record)}
                aria-label={`Open saved result ${identity.folio} for ${record.product}`}
              >
                <span className={styles.archiveRecordMeta}>
                  <span className={styles.archiveAccession} data-oracle-trial-identity>
                    {identity.folio}
                  </span>
                  <time dateTime={record.createdAt}>{archiveDateFor(record.createdAt)}</time>
                </span>
                <strong className={styles.archiveProduct}>{verdictProduct(viewModel)}</strong>
                {optionalProductDetails && (
                  <span className={styles.archiveProductDetails}>{optionalProductDetails}</span>
                )}
                <span className={styles.archiveFinding}>{viewModel.headline}</span>
                <small className={styles.archiveSupport}>{viewModel.explanation}</small>
                <span className={styles.archiveRecordFooter}>
                  <b>{viewModel.nextStepLabel}</b>
                  <span>{viewModel.confidence}</span>
                  <i aria-hidden="true">→</i>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
