import {
  FaceValueActuator,
  type FaceValueActuatorState,
} from './FaceValueActuator';
import styles from './FaceValueBrandLockup.module.css';

export type FaceValueBrandLockupProps = {
  state?: FaceValueActuatorState;
  tone?: 'ink' | 'reverse';
  variant?: 'standard' | 'compact';
  className?: string;
};

export function FaceValueBrandLockup({
  state = 'rest',
  tone = 'ink',
  variant = 'standard',
  className,
}: FaceValueBrandLockupProps) {
  const toneClassName = tone === 'reverse' ? styles.reverse : styles.ink;
  const variantClassName = variant === 'compact' ? styles.compact : styles.standard;
  const rootClassName = [styles.lockup, toneClassName, variantClassName, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={rootClassName}
      data-face-value-brand-lockup
      data-brand-lockup-state={state}
      data-brand-lockup-tone={tone}
      data-brand-lockup-variant={variant}
      role="img"
      aria-label="face value"
    >
      <FaceValueActuator className={styles.actuator} state={state} />
      <span className={styles.wordmark} aria-hidden="true">
        <span className={styles.face}>face</span>
        <span className={styles.wordSpace} />
        <span className={styles.customV}>
          <span>v</span>
          <i data-face-value-wordmark-foot />
        </span>
        <span>alue</span>
      </span>
    </span>
  );
}
