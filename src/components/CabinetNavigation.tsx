import styles from '../styles/FaceValue.module.css';

export function CabinetNavigation({ onShelf, onCapture, onRecords }: { onShelf: () => void; onCapture: () => void; onRecords: () => void }) {
  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      <button type="button" onClick={onShelf}><span aria-hidden>▣</span><small>SHELF</small></button>
      <button type="button" onClick={onCapture}><span aria-hidden>○</span><small>CAPTURE</small></button>
      <button type="button" onClick={onRecords}><span aria-hidden>≡</span><small>RECORDS</small></button>
    </nav>
  );
}
