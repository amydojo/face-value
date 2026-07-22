import type { ReactNode } from 'react';
import type { ProductPlacement, Specimen } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

export function CabinetShell({ tone = 'light', children, label }: { tone?: 'light' | 'dark'; children: ReactNode; label: string }) {
  return <main className={`${styles.appShell} ${tone === 'dark' ? styles.darkShell : ''}`} aria-label={label}>{children}</main>;
}

export function DrawerShell({ state = 'selected', children }: { state?: 'selected' | 'open' | 'disturbed' | 'focused' | 'transfer'; children?: ReactNode }) {
  return (
    <section className={`${styles.drawerShell} ${styles[`drawer_${state}`]}`} aria-label={`Drawer hardware state: ${state}`}>
      <div className={styles.chassis} aria-hidden />
      <div className={styles.innerBezel} aria-hidden />
      <div className={styles.drawerInterior} aria-hidden />
      <div className={styles.railLeft} aria-hidden />
      <div className={styles.railRight} aria-hidden />
      <div className={styles.tray} aria-hidden />
      <div className={styles.drawerFront} aria-hidden />
      <DrawerPull />
      {children}
    </section>
  );
}

export function DrawerPull() {
  return <div className={styles.pullAssembly} aria-hidden><span /></div>;
}

export function ProductSpecimen({ specimen, compact = false }: { specimen: Specimen; compact?: boolean }) {
  return (
    <figure className={`${styles.specimen} ${compact ? styles.specimenCompact : ''}`} aria-label={`${specimen.product}, ${specimen.volume}`}>
      <div className={styles.specimenCap} aria-hidden />
      <div className={styles.specimenNeck} aria-hidden />
      <div className={styles.specimenBody} aria-hidden />
      <figcaption className={styles.specimenLabel}>
        <span>{specimen.brand}</span><strong>{specimen.product}</strong><small>{specimen.volume}</small>
      </figcaption>
      <span className={styles.accession}>{specimen.accession}</span>
    </figure>
  );
}

export function DrawerLabelPlate({ specimen, job, state }: { specimen: Specimen; job: string | null; state: 'settling' | 'disturbed' | 'sealed' }) {
  return (
    <div className={`${styles.labelPlate} ${styles[`label_${state}`]}`} aria-label={`${specimen.accession}. ${specimen.product}. ${job ?? 'No job assigned'}. State ${state}.`}>
      <strong>{specimen.accession}</strong>
      <span>{specimen.product}</span>
      <small>{job ?? 'JOB UNASSIGNED'}</small>
    </div>
  );
}

export function ObservationStatus({ observation, comparison, confidence }: { observation: string; comparison: string; confidence: string }) {
  return (
    <dl className={styles.statusGrid} aria-label="Observation status">
      <div><dt>OBSERVATION</dt><dd>{observation.replaceAll('_', ' ')}</dd></div>
      <div><dt>COMPARISON</dt><dd>{comparison.replaceAll('_', ' ')}</dd></div>
      <div><dt>CONFIDENCE</dt><dd>{confidence}</dd></div>
    </dl>
  );
}

export function TransferTrack({ placement }: { placement: ProductPlacement }) {
  return <div className={styles.transferTrack} role="status">TRANSFER TRACK · destination {placement.replaceAll('_', ' ')}</div>;
}
