import type { DemoRuntime } from '../../domain/demoLab';
import styles from './DemoLab.module.css';

export function DemoRuntimeBanner({ runtime }: { runtime: DemoRuntime }) {
  if (runtime.mode === 'ordinary') return null;

  return (
    <a
      className={styles.runtimeBanner}
      href="/demo"
      aria-label="Synthetic demo state. Open Demo Lab controls."
      data-demo-runtime-pill
      data-demo-runtime-mode={runtime.mode}
    >
      LAB <span aria-hidden="true">·</span> SYNTHETIC
    </a>
  );
}
