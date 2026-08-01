import styles from './CaptureSequence.module.css';

const ACTIVITY_FIELD_CYCLE_MS = 2_800;
const POINT_RADIUS = 2.15;

const points = [
  [126, 42],
  [174, 34],
  [214, 58],
  [94, 91],
  [150, 82],
  [202, 105],
  [245, 126],
  [78, 148],
  [126, 137],
  [179, 151],
  [226, 174],
  [99, 204],
  [151, 193],
  [206, 218],
  [244, 243],
  [83, 269],
  [133, 257],
  [181, 282],
  [222, 310],
  [119, 335],
  [177, 366],
] as const;

const connections = [
  [126, 137, 179, 151],
  [151, 193, 206, 218],
  [133, 257, 181, 282],
] as const;

const visibleActivityFieldCss = `
  [data-analysis-activity-field] [data-analysis-activity-point] {
    fill: #ffad70;
    opacity: 0.12;
    filter: drop-shadow(0 0 2.4px rgba(255, 106, 0, 0.38));
    animation: fvAnalysisPointVisibility ${ACTIVITY_FIELD_CYCLE_MS}ms linear infinite;
  }

  [data-analysis-activity-field] [data-analysis-activity-connection] {
    stroke: rgba(255, 161, 84, 0.62);
    stroke-linecap: round;
    stroke-width: 0.7;
    opacity: 0;
    vector-effect: non-scaling-stroke;
    animation: fvAnalysisConnectionVisibility ${ACTIVITY_FIELD_CYCLE_MS}ms ease-in-out infinite;
  }

  @keyframes fvAnalysisPointVisibility {
    0%,
    39%,
    60%,
    100% {
      opacity: 0.12;
    }

    46%,
    53% {
      opacity: 0.72;
    }
  }

  @keyframes fvAnalysisConnectionVisibility {
    0%,
    28%,
    72%,
    100% {
      opacity: 0;
    }

    44%,
    56% {
      opacity: 0.36;
    }
  }

  [data-capture-sequence][data-reduced-motion='true']
    [data-analysis-activity-field]
    [data-analysis-activity-point] {
    animation: none;
    opacity: 0.16;
    filter: none;
  }

  [data-capture-sequence][data-reduced-motion='true']
    [data-analysis-activity-field]
    [data-analysis-activity-connection] {
    animation: none;
    opacity: 0.08;
  }
`;

/** Decorative system activity only; these authored points are not image-derived geometry. */
export function AnalysisActivityField() {
  return (
    <svg
      className={styles.analysisActivityField}
      style={{ zIndex: 5 }}
      data-analysis-activity-field
      data-capture-layer="analysis-activity"
      data-activity-layer="above-veil-below-guide"
      data-activity-coordinate-source="authored-static"
      data-activity-scientific-meaning="none"
      data-activity-reduced-motion="static"
      data-activity-point-radius={POINT_RADIUS}
      data-activity-point-rest-opacity="0.12"
      data-activity-point-active-opacity="0.72"
      data-activity-connection-peak-opacity="0.36"
      data-activity-active-point-target="3-5"
      data-activity-cycle-ms={ACTIVITY_FIELD_CYCLE_MS}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 330 450"
      preserveAspectRatio="none"
    >
      <defs>
        <style>{visibleActivityFieldCss}</style>
        <clipPath id="fv-analysis-activity-clip">
          <ellipse cx="165" cy="225" rx="156" ry="216" />
        </clipPath>
      </defs>
      <g clipPath="url(#fv-analysis-activity-clip)">
        {connections.map(([x1, y1, x2, y2], index) => (
          <line
            key={`${x1}-${y1}`}
            className={styles.analysisActivityConnection}
            data-analysis-activity-connection
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            style={{ animationDelay: `${index * -930}ms` }}
          />
        ))}
        {points.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            className={styles.analysisActivityPoint}
            data-analysis-activity-point
            cx={cx}
            cy={cy}
            r={POINT_RADIUS}
            style={{ animationDelay: `${index * -133}ms` }}
          />
        ))}
      </g>
    </svg>
  );
}
