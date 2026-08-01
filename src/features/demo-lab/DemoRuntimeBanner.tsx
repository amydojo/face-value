import type { DemoRuntime } from '../../domain/demoLab';
import styles from './DemoLab.module.css';

export function DemoRuntimeBanner({ runtime }: { runtime: DemoRuntime }) {
  if (runtime.mode === 'ordinary') return null;

  return (
    <>
      <div className={styles.runtimeBannerClearance} aria-hidden="true" />
      <aside className={styles.runtimeBanner} aria-label="Synthetic demo state">
        <span>
          <strong>SYNTHETIC DEMO DATA</strong>
          <small>
            {runtime.mode === 'preview' ? 'PREVIEW · RESETS ON RELOAD' : 'LOADED DEMO JOURNEY'}
          </small>
        </span>
        <a href="/demo">LAB</a>
      </aside>
    </>
  );
}
