import styles from './CaptureSequence.module.css';

export function CapturedSpecimenTransition() {
  return (
    <div
      className={styles.capturedVeil}
      style={{ zIndex: 4 }}
      data-captured-specimen-transition
      data-capture-layer="captured-veil"
      aria-hidden="true"
    />
  );
}
