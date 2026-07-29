import { getCaptureRailStates } from './guidance';
import type { CaptureSequenceState } from './types';
import styles from './CaptureSequence.module.css';

const railItems = [
  ['light', 'LIGHT'],
  ['alignment', 'ALIGNMENT'],
  ['stillness', 'STILLNESS'],
] as const;

export function CaptureQualityRail({ state }: { state: CaptureSequenceState }) {
  const statuses = getCaptureRailStates(state);
  return (
    <div
      className={styles.qualityRail}
      data-capture-quality-rail
      role="group"
      aria-label="Capture quality"
    >
      {railItems.map(([key, label]) => (
        <span
          key={key}
          data-quality-category={key}
          data-quality-state={statuses[key]}
          aria-label={`${label.toLowerCase()}: ${statuses[key]}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
