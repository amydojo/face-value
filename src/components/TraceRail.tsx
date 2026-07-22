import type { TraceEntry } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

export function TraceRail({ trace, disturbed = false }: { trace: TraceEntry | null; disturbed?: boolean }) {
  return (
    <section className={`${styles.traceRail} ${disturbed ? styles.traceDisturbed : ''}`} aria-label="Trace Rail">
      <div className={styles.traceLine} aria-hidden />
      <button type="button" aria-label={trace ? `Trace: ${trace.label}. ${trace.detail}` : 'No trace recorded'}>
        <span aria-hidden />
        <strong>{trace?.label ?? 'NO TRACE'}</strong>
        <small>{trace?.detail ?? 'Add one lightweight observation'}</small>
      </button>
    </section>
  );
}
