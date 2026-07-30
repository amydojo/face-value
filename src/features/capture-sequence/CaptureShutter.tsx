import styles from './CaptureSequence.module.css';

export function CaptureShutter() {
  return <div className={styles.captureShutter} data-capture-shutter aria-hidden="true" />;
}
