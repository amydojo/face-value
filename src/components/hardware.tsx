import { useEffect, useState, type ReactNode } from 'react';
import type { ProductPlacement, Specimen } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

export function CabinetShell({ tone = 'light', children, label }: { tone?: 'light' | 'dark'; children: ReactNode; label: string }) {
  return <main className={`${styles.appShell} ${tone === 'dark' ? styles.darkShell : ''}`} data-fv-tone={tone} aria-label={label}>{children}</main>;
}

export function ScreenHeader({ code = 'FV–014', dark = false }: { code?: string; dark?: boolean }) {
  return (
    <header className={`${styles.header} ${dark ? styles.headerDark : ''}`} data-fv-part="screen-header">
      <div data-fv-part="status-bar" aria-hidden="true"><span>9:41</span><span>•••</span></div>
      <div data-fv-part="brand-bar"><strong>FACE VALUE</strong><span>{code}</span></div>
    </header>
  );
}

export function DrawerShell({ state = 'selected', children }: { state?: 'selected' | 'open' | 'disturbed' | 'focused' | 'transfer' | 'closed'; children?: ReactNode }) {
  return (
    <section className={`${styles.drawerShell} ${styles[`drawer_${state}`] ?? ''}`} data-fv-drawer-state={state} aria-label={`Drawer hardware state: ${state}`}>
      <div className={styles.chassis} data-fv-part="chassis" aria-hidden />
      <div className={styles.innerBezel} data-fv-part="inner-bezel" aria-hidden />
      <div className={styles.drawerInterior} data-fv-part="interior" aria-hidden />
      <div className={styles.railLeft} data-fv-part="rail-left" aria-hidden />
      <div className={styles.railRight} data-fv-part="rail-right" aria-hidden />
      <div data-fv-part="rail-highlight-left" aria-hidden />
      <div data-fv-part="rail-highlight-right" aria-hidden />
      <div className={styles.tray} data-fv-part="tray" aria-hidden />
      <div data-fv-part="tray-edge" aria-hidden />
      <div className={styles.drawerFront} data-fv-part="drawer-front" aria-hidden />
      <DrawerPull />
      <div data-fv-part="latch-light" aria-hidden />
      <div data-fv-part="interior-light" aria-hidden />
      <div data-fv-part="label-mount" aria-hidden />
      <div data-fv-part="state-tab" aria-hidden />
      <div data-fv-part="carousel-peek-left" aria-hidden />
      <div data-fv-part="carousel-peek-right" aria-hidden />
      <div data-fv-part="focus-curtain-left" aria-hidden />
      <div data-fv-part="focus-curtain-right" aria-hidden />
      <div data-fv-part="split-light-left" aria-hidden />
      <div data-fv-part="split-light-right" aria-hidden />
      <div data-fv-part="intruding-drawer" aria-hidden />
      <div data-fv-part="transfer-track-hardware" aria-hidden />
      {children}
    </section>
  );
}

export function DrawerPull() {
  return <div className={styles.pullAssembly} data-fv-part="pull-recess" aria-hidden><span data-fv-part="pull" /></div>;
}

export function ProductSpecimen({ specimen, compact = false }: { specimen: Specimen; compact?: boolean }) {
  return (
    <figure className={`${styles.specimen} ${compact ? styles.specimenCompact : ''}`} data-fv-part="specimen" data-fv-compact={compact || undefined} aria-label={`${specimen.product}, ${specimen.volume}`}>
      <div data-fv-part="contact-shadow" aria-hidden />
      <div className={styles.specimenCap} data-fv-part="specimen-cap" aria-hidden />
      <div className={styles.specimenNeck} data-fv-part="specimen-neck" aria-hidden />
      <div className={styles.specimenBody} data-fv-part="specimen-body" aria-hidden />
      <figcaption className={styles.specimenLabel} data-fv-part="specimen-label">
        <span>{specimen.brand}</span><strong>{specimen.product}</strong><small>{specimen.volume}</small>
      </figcaption>
      <span className={styles.accession} data-fv-part="specimen-accession">{specimen.accession}</span>
    </figure>
  );
}

export function DrawerLabelPlate({ specimen, job, state }: { specimen: Specimen; job: string | null; state: 'settling' | 'disturbed' | 'sealed' }) {
  return (
    <div className={`${styles.labelPlate} ${styles[`label_${state}`]}`} data-fv-part="label-plate" data-fv-label-state={state} aria-label={`${specimen.accession}. ${specimen.product}. ${job ?? 'No job assigned'}. State ${state}.`}>
      <strong data-fv-part="plate-accession">{specimen.accession}</strong>
      <span data-fv-part="plate-product">{specimen.product}</span>
      <small data-fv-part="plate-day">DAY 12</small>
      <small data-fv-part="plate-job">{job ?? 'JOB UNASSIGNED'}</small>
    </div>
  );
}

export function AvailableDrawerPlate() {
  return <div data-fv-part="available-plate" aria-label="A1 available">A1 · AVAILABLE</div>;
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

const placementRows: Array<{ value: ProductPlacement; code: string; label: string; note: string }> = [
  { value: 'established', code: 'S4', label: 'ESTABLISHED', note: 'Useful with confidence' },
  { value: 'useful_elsewhere', code: 'U2', label: 'USEFUL ELSEWHERE', note: 'Works for another role' },
  { value: 'paused', code: 'P1', label: 'PAUSED', note: 'Not needed right now' },
  { value: 'retry_alone', code: 'R3', label: 'RETRY ALONE', note: 'Needs a cleaner window' },
  { value: 'released', code: 'E7', label: 'RELEASED', note: 'Close and archive' },
];

type TransferPhase = 'choosing' | 'moving' | 'sealed';

const placementLabel = (placement: ProductPlacement) => {
  const row = placementRows.find((item) => item.value === placement);
  return row ? `${row.code} · ${row.label.toLowerCase()}` : placement.replaceAll('_', ' ');
};

export function TransferTrack({ placement, sealed, onSelect, onSeal, onGenerate }: { placement: ProductPlacement; sealed: boolean; onSelect: (placement: ProductPlacement) => void; onSeal: () => void; onGenerate: () => void }) {
  const [phase, setPhase] = useState<TransferPhase>(sealed ? 'sealed' : 'choosing');
  const holdMotion = import.meta.env.DEV && new URLSearchParams(window.location.search).get('holdPlacementMotion') === '1';

  useEffect(() => {
    if (sealed) setPhase('sealed');
  }, [sealed]);

  useEffect(() => {
    if (phase !== 'moving' || holdMotion) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timeout = window.setTimeout(onSeal, reduced ? 0 : 800);
    return () => window.clearTimeout(timeout);
  }, [holdMotion, onSeal, phase]);

  const activate = () => {
    if (phase === 'sealed' || sealed) {
      onGenerate();
      return;
    }
    if (phase === 'moving') {
      if (holdMotion) onSeal();
      return;
    }
    setPhase('moving');
  };

  const heading = phase === 'sealed' ? 'PLACEMENT SEALED' : phase === 'moving' ? 'MOVE TO SHELF' : 'MOVE TO SHELF';
  const description = phase === 'sealed'
    ? placementLabel(placement)
    : phase === 'moving'
      ? `Drawer moving to ${placementLabel(placement)}`
      : 'Select one destination. Placement becomes the conclusion.';
  const actionLabel = phase === 'sealed'
    ? 'Generate Evidence Record'
    : phase === 'moving'
      ? holdMotion ? 'Complete placement transfer' : 'Placement transfer in progress'
      : 'Seal placement';
  const actionText = phase === 'sealed'
    ? 'EVIDENCE FOLIO CREATED · FV–014'
    : phase === 'moving'
      ? `DRAWER MOVING TO ${placementLabel(placement).toUpperCase()}`
      : 'DRAWER REMAINS REVERSIBLE UNTIL PLACED';

  return (
    <section className={styles.transferTrack} data-fv-part="transfer-machine" data-fv-transfer-state={phase} data-fv-motion-held={phase === 'moving' && holdMotion || undefined} data-fv-selected-placement={placement} aria-labelledby="transfer-heading" aria-live="polite">
      <h2 id="transfer-heading">{heading}</h2>
      <p>{description}</p>
      <div data-fv-part="transfer-vertical-track" aria-hidden />
      <div data-fv-part="transfer-drawer-object" aria-hidden><i /></div>
      <fieldset aria-label="Choose final shelf placement" disabled={phase !== 'choosing'}>
        <legend>Choose final shelf placement</legend>
        {placementRows.map((row) => (
          <label key={row.value} data-fv-placement-row={row.value} data-selected={placement === row.value || undefined}>
            <input type="radio" name="placement" value={row.value} checked={placement === row.value} onChange={() => onSelect(row.value)} />
            <span data-fv-part="placement-slot" aria-hidden />
            <b>{row.code}</b>
            <strong>{row.label}</strong>
            <small>{row.note}</small>
          </label>
        ))}
      </fieldset>
      <button type="button" data-fv-action={phase === 'sealed' ? 'generate-record' : phase === 'moving' ? 'complete-transfer' : 'seal-placement'} aria-label={actionLabel} onClick={activate} disabled={phase === 'moving' && !holdMotion}>
        {actionText}
      </button>
    </section>
  );
}
