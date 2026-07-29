import styles from './CaptureSequence.module.css';

export function CaptureScanBand() {
  return (
    <div className={styles.scanField} data-capture-scan-band aria-hidden="true">
      <div className={styles.scanBand} data-capture-scan-optic />
    </div>
  );
}
