import { oracleSpecimenIdentityFromEvidenceRecord } from '../../adapters/product/specimenFromRegisteredProduct';
import type { EvidenceRecordData } from '../../domain/model';
import { resultExperienceViewModelFromRecord } from '../evidence-record/resultExperienceViewModel';
import { verdictViewModelFromRecord } from '../verdict/verdictViewModel';
import styles from './Archive.module.css';

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

const productMeta = (record: EvidenceRecordData): string => {
  const specimen = oracleSpecimenIdentityFromEvidenceRecord(record);
  return [specimen.brand, specimen.productName].filter(Boolean).join(' · ');
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
      <button type="button" className={styles.back} onClick={onBack}>
        ← Your trials
      </button>
      <header className={styles.heading}>
        <p>PREVIOUS TRIALS · COLD STORAGE</p>
        <h1 id="previous-trials-heading">Previous trials</h1>
        <p className={styles.summary}>
          <span>
            {records.length} {records.length === 1 ? 'SAVED SPECIMEN' : 'SAVED SPECIMENS'}
          </span>
          <span>NEWEST FIRST</span>
        </p>
      </header>
      {records.length === 0 ? (
        <p className={styles.empty}>No preserved trials yet.</p>
      ) : (
        <div className={styles.storage} aria-label="Previous trials">
          {records.map((record) => {
            const specimen = oracleSpecimenIdentityFromEvidenceRecord(record);
            const viewModel = resultExperienceViewModelFromRecord(record);
            const legacyViewModel = verdictViewModelFromRecord(record);
            const resultSummary =
              viewModel.changeCompact === 'Not available'
                ? viewModel.directionLabel.toLocaleUpperCase('en-US')
                : `${viewModel.changeCompact} · ${viewModel.directionLabel.toLocaleUpperCase('en-US')}`;
            return (
              <button
                className={styles.record}
                type="button"
                key={record.id}
                data-archive-record
                data-record-id={record.id}
                data-specimen-id={specimen.productId ?? ''}
                data-specimen-accession={specimen.accession ?? ''}
                data-specimen-brand={specimen.brand}
                data-specimen-product={specimen.productName}
                data-specimen-strength={specimen.strength ?? ''}
                data-specimen-volume={specimen.volume ?? ''}
                onClick={() => onOpen(record)}
                aria-label={`Open saved result ${viewModel.folio} for ${record.product}`}
              >
                <span className={styles.shelf} aria-hidden="true">
                  <i className={styles.bottle}>
                    <span className={styles.bottleLabel}>
                      <small>{specimen.brand}</small>
                      <strong>{specimen.strength ?? 'FV'}</strong>
                    </span>
                  </i>
                </span>
                <span className={styles.meta}>
                  <span className={styles.folio} data-oracle-trial-identity>
                    {viewModel.folio}
                  </span>
                  <strong className={styles.product}>{productMeta(record)}</strong>
                  <span className={styles.concern}>
                    {[viewModel.concern.toLocaleUpperCase('en-US'), specimen.strength]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className={styles.result} data-direction={viewModel.direction}>
                    {resultSummary}
                  </span>
                  <time className={styles.date} dateTime={record.createdAt}>
                    {archiveDateFor(record.createdAt)}
                  </time>
                </span>
                <span className={styles.compatibility} aria-hidden="true">
                  <span>{record.finding}</span>
                  <span>{legacyViewModel.explanation}</span>
                  <span>{legacyViewModel.confidence}</span>
                  <span>{legacyViewModel.nextStepLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
