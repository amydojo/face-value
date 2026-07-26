import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import type { EvidenceRecord } from './evidenceTrial';
import { confidenceSeal } from './evidenceTrial';
import styles from './EvidenceMachine.module.css';

export interface EvidenceRecordArtifactProps {
  record: EvidenceRecord;
  mode: 'dispensed' | 'collected';
  collectible?: boolean;
  onCollect?: () => void;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(value))
    .toUpperCase();

export function EvidenceRecordArtifact({
  record,
  mode,
  collectible = false,
  onCollect,
}: EvidenceRecordArtifactProps) {
  const startY = useRef<number | null>(null);
  const collected = useRef(false);
  const seal = confidenceSeal(record.confidence);
  const summary = `${record.productName}. ${record.finding.metric}. ${record.finding.summary}. Confidence ${record.confidence}. Next step ${record.nextStep}.`;
  const style = { viewTransitionName: `evidence-record-${record.id}` } as CSSProperties;

  const collectOnce = () => {
    if (!collectible || collected.current) return;
    collected.current = true;
    onCollect?.();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const delta = startY.current === null ? 0 : startY.current - event.clientY;
    startY.current = null;
    if (delta >= 18) collectOnce();
  };

  const contents = (
    <span
      className={`${styles.recordArtifact} ${mode === 'collected' ? styles.recordCollected : styles.recordDispensed}`}
      data-record-id={record.id}
      data-record-mode={mode}
      style={style}
    >
      <span className={styles.recordSubstrate} aria-hidden="true" />
      <span className={styles.recordFace}>
        <span className={styles.recordIndexFeature} aria-hidden="true" />
        <span className={styles.recordNotch} aria-hidden="true" />
        <span className={styles.recordBrand}>FACE VALUE</span>
        <span className={styles.recordNumber}>EVIDENCE RECORD {record.recordNumber}</span>
        <strong className={styles.recordProduct}>{record.productName}</strong>
        <span className={styles.recordDates}>{formatDate(record.trialWindow.startedAt)} — {formatDate(record.trialWindow.endedAt)}</span>
        <span className={styles.recordMetric}>{record.finding.metric}</span>
        <strong className={styles.recordFinding}>{record.finding.summary}</strong>
        <span className={styles.recordConfidenceRow}>
          <i className={styles.confidenceSeal} data-seal={seal} aria-hidden="true" />
          <span>{record.confidence.toUpperCase()}</span>
        </span>
        <span className={styles.recordDisposition}>S4</span>
        <strong className={styles.recordNextStep}>{record.nextStep.toUpperCase()}</strong>
      </span>
    </span>
  );

  if (!collectible) {
    return <div className={styles.recordStatic} aria-label={summary}>{contents}</div>;
  }

  return (
    <button
      type="button"
      className={styles.recordCollectionTarget}
      aria-label={`Collect Evidence Record. ${summary}`}
      onClick={collectOnce}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { startY.current = null; }}
    >
      {contents}
    </button>
  );
}
