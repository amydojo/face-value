import styles from '../styles/FaceValue.module.css';

export function EvidenceNavigation({
  onIndex,
  onCapture,
  onRecords,
}: {
  onIndex: () => void;
  onCapture: () => void;
  onRecords: () => void;
}) {
  return (
    <nav className={styles.bottomNav} data-fv-part="primary-nav" aria-label="Primary">
      <button type="button" onClick={onIndex}><span aria-hidden="true">▦</span><small>INDEX</small></button>
      <button type="button" onClick={onCapture}><span aria-hidden="true">○</span><small>CAPTURE</small></button>
      <button type="button" onClick={onRecords}><span aria-hidden="true">≡</span><small>RECORDS</small></button>
    </nav>
  );
}
