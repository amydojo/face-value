import styles from './CaptureSequence.module.css';

export function CapturedSpecimenTransition() {
  return (
    <div className={styles.capturedVeil} data-captured-specimen-transition aria-hidden="true" />
  );
}
