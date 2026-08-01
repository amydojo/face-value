import type { CaptureIssue, CapturePhase } from './types';
import styles from './CaptureSequence.module.css';

const guideSegments = [
  ['upper-left', 'M 118 20 C 80 32, 55 60, 40 100'],
  ['upper-right', 'M 212 20 C 250 32, 275 60, 290 100'],
  ['lower-left', 'M 40 350 C 55 390, 80 418, 118 430'],
  ['lower-right', 'M 290 350 C 275 390, 250 418, 212 430'],
] as const;

const guideConnectors = [
  ['top', 'M 118 20 C 147 10, 183 10, 212 20'],
  ['right', 'M 290 100 C 310 158, 310 292, 290 350'],
  ['bottom', 'M 212 430 C 183 440, 147 440, 118 430'],
  ['left', 'M 40 350 C 20 292, 20 158, 40 100'],
] as const;

const guideAnchors = [
  ['upper-left', 118, 20],
  ['upper-right', 290, 100],
  ['lower-right', 212, 430],
  ['lower-left', 40, 350],
] as const;

export function FaceAcquisitionGuide({
  phase,
  activeIssue,
}: {
  phase: CapturePhase;
  activeIssue: CaptureIssue | null;
}) {
  const stable = phase === 'aligning' && activeIssue === null;

  return (
    <div
      className={styles.guideField}
      style={{ zIndex: 6 }}
      data-face-acquisition-guide
      data-capture-layer="acquisition-guide"
      data-guide-phase={phase}
      data-guide-issue={activeIssue ?? 'none'}
      data-guide-stable={stable}
      aria-hidden="true"
    >
      <svg viewBox="0 0 330 450" preserveAspectRatio="none">
        <g className={styles.guideSegments} data-capture-guide-segments>
          {guideSegments.map(([segment, path]) => (
            <path key={segment} d={path} data-guide-segment={segment} />
          ))}
        </g>
        <g className={styles.guideConnectors} data-capture-guide-connectors>
          {guideConnectors.map(([connector, path]) => (
            <path
              key={connector}
              d={path}
              pathLength="100"
              data-guide-connector={connector}
            />
          ))}
        </g>
        <g className={styles.guideAnchors} data-capture-guide-anchors>
          {guideAnchors.map(([anchor, cx, cy]) => (
            <circle
              key={anchor}
              cx={cx}
              cy={cy}
              r="1.8"
              data-capture-guide-anchor={anchor}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
