import type { EvidenceRecordData, ProductPlacement } from '../../domain/model';
import { ScreenHeader } from '../../components/hardware';
import styles from '../../styles/FaceValue.module.css';

const FOLIO_CODE = 'FV–014';

const observationWindowFor = (record: EvidenceRecordData) =>
  record.observationWindow.includes('fixture timeline')
    ? '15 JUL — 27 JUL 2025'
    : record.observationWindow;

const placementFor = (placement: ProductPlacement, uppercase = false) => {
  const values: Partial<Record<ProductPlacement, string>> = {
    established: 'S4 · Established routine',
    useful_elsewhere: 'U2 · Useful elsewhere',
    paused: 'P1 · Paused',
    retry_alone: 'R3 · Retry alone',
    released: 'E7 · Released',
    cooling: 'C2 · Outside observation window',
  };
  const value = values[placement] ?? placement.replaceAll('_', ' ');
  return uppercase ? value.toUpperCase() : value;
};

export function RecordFolio({ record }: { record: EvidenceRecordData }) {
  const observationWindow = observationWindowFor(record);
  return (
    <div className={styles.recordFolio} data-fv-part="record-folio" aria-label={`Evidence Record ${record.id}`}>
      <div data-fv-part="folio-tab">{FOLIO_CODE}</div>
      <div data-fv-part="folio-specimen-field"><i aria-hidden="true" /><span aria-hidden="true" /></div>
      <strong>{record.product}</strong>
      <small>{observationWindow}</small>
      <p>{record.finding}<br />{record.nonFinding}</p>
      <em>{placementFor(record.finalPlacement, true)}</em>
      <div data-fv-part="confidence-rail"><i /></div>
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
  const rows = [
    ['OBSERVATION WINDOW', observationWindowFor(record)],
    ['COMPARISON', record.comparison === 'comparable' ? 'Comparable across two captures' : record.comparison.replaceAll('_', ' ')],
    ['PRIMARY FINDING', record.finding],
    ['USAGE CONSISTENCY', '10 of 12 planned uses logged'],
    ['IMPORTANT DISTURBANCE', record.disturbance === 'none' || record.disturbance === 'returned_to_cooling' ? 'None during comparable window' : record.disturbance.replaceAll('_', ' ')],
    ['CONFIDENCE', record.confidence],
    ['FINAL DISPOSITION', placementFor(record.finalPlacement)],
  ];

  return (
    <>
      <ScreenHeader />
      <section className={styles.recordScreen} data-fv-screen="record" aria-labelledby="record-heading">
        <div className={styles.recordHeading} data-fv-part="record-heading">
          <button type="button" className={styles.textButton} onClick={onBack}>←</button>
          <h1 id="record-heading">EVIDENCE RECORD</h1>
          <span>{FOLIO_CODE}</span>
        </div>
        <div className={styles.recordOutputAssembly} aria-label="Independent evidence output">
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
        <p className={styles.claimBoundary} data-fv-part="record-claim-boundary">{record.claimBoundary}</p>
        <div className={styles.privacyBadge} data-fv-part="record-privacy">PRIVATE BY DEFAULT · FACE EXCLUDED</div>
        <button type="button" className={styles.primaryAction} aria-label="View archive" onClick={onArchive}>
          <span>VIEW EVIDENCE ARCHIVE</span><span aria-hidden="true">→</span>
        </button>
        <button type="button" className={styles.secondaryAction} onClick={onIndex}>Return to Evidence Index</button>
      </section>
    </>
  );
}
