import { useEffect, useState, type ReactNode } from 'react';
import type { ProductPlacement } from '../domain/model';
import styles from '../styles/FaceValue.module.css';

export function EvidenceShell({
  tone = 'light',
  children,
  label,
}: {
  tone?: 'light' | 'dark';
  children: ReactNode;
  label: string;
}) {
  return (
    <main
      className={`${styles.appShell} ${tone === 'dark' ? styles.darkShell : ''}`}
      data-fv-tone={tone}
      aria-label={label}
    >
      {children}
    </main>
  );
}

export function ScreenHeader({ code = 'FV–014', dark = false }: { code?: string; dark?: boolean }) {
  return (
    <header className={`${styles.header} ${dark ? styles.headerDark : ''}`} data-fv-part="screen-header">
      <div data-fv-part="status-bar" aria-hidden="true"><span>9:41</span><span>•••</span></div>
      <div data-fv-part="brand-bar"><strong>FACE VALUE</strong><span>{code}</span></div>
    </header>
  );
}

export function ObservationStatus({
  observation,
  comparison,
  confidence,
}: {
  observation: string;
  comparison: string;
  confidence: string;
}) {
  return (
    <dl className={styles.statusGrid} aria-label="Observation status">
      <div><dt>OBSERVATION</dt><dd>{observation.replaceAll('_', ' ')}</dd></div>
      <div><dt>COMPARISON</dt><dd>{comparison.replaceAll('_', ' ')}</dd></div>
      <div><dt>CONFIDENCE</dt><dd>{confidence}</dd></div>
    </dl>
  );
}

const dispositionRows: Array<{
  value: ProductPlacement;
  code: string;
  label: string;
  note: string;
}> = [
  { value: 'established', code: 'S4', label: 'ESTABLISHED', note: 'Useful with confidence' },
  { value: 'useful_elsewhere', code: 'U2', label: 'USEFUL ELSEWHERE', note: 'Useful for another role' },
  { value: 'paused', code: 'P1', label: 'PAUSED', note: 'Not needed right now' },
  { value: 'retry_alone', code: 'R3', label: 'RETRY ALONE', note: 'Needs a cleaner window' },
  { value: 'released', code: 'E7', label: 'RELEASED', note: 'Close and archive' },
];

type DispositionPhase = 'choosing' | 'committing' | 'classified';

const dispositionLabel = (placement: ProductPlacement) => {
  const row = dispositionRows.find((item) => item.value === placement);
  return row ? `${row.code} · ${row.label.toLowerCase()}` : placement.replaceAll('_', ' ');
};

export function EvidenceDisposition({
  placement,
  classified,
  onSelect,
  onClassify,
  onGenerate,
}: {
  placement: ProductPlacement;
  classified: boolean;
  onSelect: (placement: ProductPlacement) => void;
  onClassify: () => void;
  onGenerate: () => void;
}) {
  const [phase, setPhase] = useState<DispositionPhase>(classified ? 'classified' : 'choosing');
  const holdMotion = import.meta.env.DEV && new URLSearchParams(window.location.search).get('holdClassificationMotion') === '1';

  useEffect(() => {
    if (classified) setPhase('classified');
  }, [classified]);

  useEffect(() => {
    if (phase !== 'committing' || holdMotion) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timeout = window.setTimeout(onClassify, reduced ? 80 : 520);
    return () => window.clearTimeout(timeout);
  }, [holdMotion, onClassify, phase]);

  const activate = () => {
    if (phase === 'classified' || classified) {
      onGenerate();
      return;
    }
    if (phase === 'committing') {
      if (holdMotion) onClassify();
      return;
    }
    setPhase('committing');
  };

  const heading = phase === 'classified' ? 'EVIDENCE DISPOSITION COMMITTED' : 'CLASSIFY THE CASSETTE';
  const description = phase === 'classified'
    ? dispositionLabel(placement)
    : phase === 'committing'
      ? `Committing ${dispositionLabel(placement)}`
      : 'Choose what the evidence means for this product in your routine.';
  const actionLabel = phase === 'classified'
    ? 'Generate Evidence Record'
    : phase === 'committing'
      ? holdMotion ? 'Complete evidence classification' : 'Evidence classification in progress'
      : 'Commit evidence disposition';

  return (
    <section
      className={styles.disposition}
      data-fv-part="evidence-disposition"
      data-fv-disposition-state={phase}
      data-fv-selected-placement={placement}
      aria-labelledby="disposition-heading"
      aria-live="polite"
    >
      <h2 id="disposition-heading">{heading}</h2>
      <p>{description}</p>
      <div className={styles.dispositionCommit} data-phase={phase} aria-hidden="true">
        <span>{dispositionLabel(placement)}</span>
      </div>
      <fieldset aria-label="Choose final evidence disposition" disabled={phase !== 'choosing'}>
        <legend>Choose final evidence disposition</legend>
        {dispositionRows.map((row) => (
          <label key={row.value} data-selected={placement === row.value || undefined}>
            <input
              type="radio"
              name="placement"
              value={row.value}
              checked={placement === row.value}
              onChange={() => onSelect(row.value)}
            />
            <b>{row.code}</b>
            <strong>{row.label}</strong>
            <small>{row.note}</small>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        data-fv-action={phase === 'classified' ? 'generate-record' : 'commit-disposition'}
        aria-label={actionLabel}
        onClick={activate}
        disabled={phase === 'committing' && !holdMotion}
      >
        <span>{phase === 'classified' ? 'EVIDENCE RECORD READY' : phase === 'committing' ? 'COMMITTING EVIDENCE DISPOSITION' : 'COMMIT DISPOSITION'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
