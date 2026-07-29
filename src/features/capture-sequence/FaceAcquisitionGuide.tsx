import type { CapturePhase } from './types';
import styles from './CaptureSequence.module.css';

export function FaceAcquisitionGuide({ phase }: { phase: CapturePhase }) {
  return (
    <div
      className={styles.guideField}
      data-face-acquisition-guide
      data-guide-phase={phase}
      aria-hidden="true"
    >
      <svg viewBox="0 0 330 450" preserveAspectRatio="none">
        <ellipse
          className={styles.guideOval}
          data-capture-guide-oval
          cx="165"
          cy="225"
          rx="156"
          ry="216"
          pathLength="100"
        />
        {(phase === 'locking' || phase === 'scanning') && (
          <ellipse
            className={styles.lockTrace}
            data-capture-lock-trace
            cx="165"
            cy="225"
            rx="156"
            ry="216"
            pathLength="100"
          />
        )}
      </svg>
    </div>
  );
}
