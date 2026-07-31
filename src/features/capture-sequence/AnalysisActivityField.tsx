import styles from './CaptureSequence.module.css';

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

/** Decorative system activity only; these authored points are not image-derived geometry. */
export function AnalysisActivityField() {
  return (
    <svg
      className={styles.analysisActivityField}
      data-analysis-activity-field
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 330 450"
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id="fv-analysis-activity-clip">
          <ellipse cx="165" cy="225" rx="156" ry="216" />
        </clipPath>
      </defs>
      <g clipPath="url(#fv-analysis-activity-clip)">
        {connections.map(([x1, y1, x2, y2], index) => (
          <line
            key={`${x1}-${y1}`}
            className={styles.analysisActivityConnection}
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
            cx={cx}
            cy={cy}
            r="1.65"
            style={{ animationDelay: `${index * -133}ms` }}
          />
        ))}
      </g>
    </svg>
  );
}
