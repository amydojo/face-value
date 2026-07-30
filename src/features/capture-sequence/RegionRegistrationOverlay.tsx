import type { CaptureRegion } from './types';
import styles from './CaptureSequence.module.css';

export function RegionRegistrationOverlay({ regions }: { regions: readonly CaptureRegion[] }) {
  if (regions.length === 0) return null;
  return (
    <div className={styles.regionOverlay} data-region-registration-overlay aria-hidden="true">
      {regions.map((region) => (
        <i key={region} data-region={region} />
      ))}
    </div>
  );
}
