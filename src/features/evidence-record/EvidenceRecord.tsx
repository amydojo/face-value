import type { EvidenceRecordData } from '../../domain/model';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { ScreenHeader } from '../../components/hardware';
import { verdictProduct, verdictViewModelFromRecord } from '../verdict/verdictViewModel';
import styles from '../../styles/FaceValue.module.css';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const validDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameLocalDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const observationWindowFor = (record: EvidenceRecordData) => {
  if (record.observationWindow.includes('fixture timeline')) return '15 JUL — 27 JUL 2025';

  const [startValue, endValue] = record.observationWindow.split(' to ');
  const start = validDate(startValue);
  const end = validDate(endValue);
  if (!start || !end) return record.observationWindow;

  if (sameLocalDay(start, end)) {
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
  }

  return `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)}`;
};

const timestampFor = (value: string) => {
  const date = validDate(value);
  return date ? dateTimeFormatter.format(date) : value;
};

export function RecordFolio({ record }: { record: EvidenceRecordData }) {
  const observationWindow = observationWindowFor(record);
  const identity = oracleTrialIdentityForRecord(record);
  const viewModel = verdictViewModelFromRecord(record);
  return (
    <div
      className={styles.recordFolio}
      data-fv-part="record-folio"
      aria-label={`Saved result ${record.id}`}
    >
      <div data-fv-part="folio-tab" data-oracle-trial-identity>
        {identity.folio}
      </div>
      <div data-fv-part="folio-specimen-field">
        <i aria-hidden="true" />
        <span aria-hidden="true" />
      </div>
      <strong>{verdictProduct(viewModel)}</strong>
      <small>{observationWindow}</small>
      <p>
        {record.finding}
        <br />
        {record.nonFinding}
      </p>
      <em>{viewModel.nextStepLabel}</em>
      <div data-fv-part="confidence-rail">
        <i />
      </div>
      <b>{record.confidence.toUpperCase()}</b>
    </div>
  );
}

export function EvidenceRecord({
  record,
  onArchive,
  onIndex,
  onBack,
}: {
  record: EvidenceRecordData;
  onArchive: () => void;
  onIndex: () => void;
  onBack: () => void;
}) {
  const identity = oracleTrialIdentityForRecord(record);
  const viewModel = verdictViewModelFromRecord(record);
  const anotherProduct =
    record.disturbance === 'none' || record.disturbance === 'returned_to_cooling'
      ? 'No second product remained during the comparison'
      : 'Two products shared this trial';
  const rows = [
    ['TRIAL', identity.folio],
    ['TRIAL WINDOW', observationWindowFor(record)],
    [
      'COMPARISON',
      record.comparison === 'comparable'
        ? 'Comparable across two scans'
        : record.comparison.replaceAll('_', ' '),
    ],
    ['FINDING', record.finding],
    ['WHAT WAS NOT CONCLUDED', record.nonFinding],
    ['NOTE', record.note ?? 'No note added'],
    ['ANOTHER PRODUCT', anotherProduct],
    ['CONFIDENCE', record.confidence],
    ['NEXT STEP', viewModel.nextStepLabel],
    ['SAVED', timestampFor(record.createdAt)],
  ];

  return (
    <>
      <ScreenHeader code={identity.folio} />
      <section
        className={styles.recordScreen}
        data-fv-screen="saved-result"
        aria-labelledby="saved-result-heading"
      >
        <div className={styles.recordHeading} data-fv-part="record-heading">
          <button type="button" className={styles.textButton} onClick={onBack}>
            ←
          </button>
          <h1 id="saved-result-heading">SAVED RESULT</h1>
          <span data-oracle-trial-identity>{identity.folio}</span>
        </div>
        <p>Saved to your evidence.</p>
        <div className={styles.recordOutputAssembly} aria-label="Preserved trial result">
          <div aria-hidden="true" />
          <RecordFolio record={record} />
        </div>
        <dl className={styles.recordRows} data-fv-part="record-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={label === 'CONFIDENCE' ? styles.eyebrow : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.claimBoundary} data-fv-part="record-claim-boundary">
          {record.claimBoundary}
        </p>
        <div className={styles.privacyBadge} data-fv-part="record-privacy">
          PRIVATE BY DEFAULT · FACE EXCLUDED
        </div>
        <button
          type="button"
          className={styles.primaryAction}
          aria-label="View previous trials"
          onClick={onArchive}
        >
          <span>PREVIOUS TRIALS</span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className={styles.textButton} onClick={onIndex}>
          Your trials
        </button>
      </section>
    </>
  );
}
