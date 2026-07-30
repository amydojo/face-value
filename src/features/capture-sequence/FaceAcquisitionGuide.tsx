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
        <g className={styles.guideSegments} data-capture-guide-segments>
          <path d="M 118 20 C 80 32, 55 60, 40 100" />
          <path d="M 212 20 C 250 32, 275 60, 290 100" />
          <path d="M 40 350 C 55 390, 80 418, 118 430" />
          <path d="M 290 350 C 275 390, 250 418, 212 430" />
        </g>
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
          <path
            className={styles.lockTrace}
            data-capture-lock-trace
            d="M 294 103 C 307 139, 315 178, 320 218"
          />
        )}
      </svg>
    </div>
  );
}
