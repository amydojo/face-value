import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Specimen } from '../../domain/model';
import { CassetteHandle } from '../evidence-cassette/CassetteHandle';
import type { CassetteMode } from '../evidence-cassette/cassetteContract';
import { cassetteModeStatus } from '../evidence-cassette/cassetteContract';
import styles from './EvidenceInstrument.module.css';
import cassetteStyles from './EvidenceCassette.module.css';

export type EvidenceHardwareState =
  | 'dormant'
  | 'indexed'
  | 'selected'
  | 'sealed'
  | 'active'
  | 'disturbed'
  | 'reviewDue'
  | 'classified'
  | 'archived';

export type EvidenceCassettePhase =
  | 'followUpReady'
  | 'processing'
  | 'verdictReady'
  | 'verdictRevealed';

export type EvidenceCassetteDoorState = 'closed' | 'pressed' | 'released' | 'open';
export type EvidenceCassetteGlassState = 'fogged' | 'opaque' | 'clearing' | 'clear';

const statusCopy: Record<EvidenceHardwareState, string> = {
  dormant: 'STANDBY',
  indexed: 'TRIAL SELECTED',
  selected: 'SELECTED',
  sealed: 'SEALED',
  active: 'TRIAL IN PROGRESS',
  disturbed: 'TWO PRODUCTS ACTIVE',
  reviewDue: 'READY TO COMPARE',
  classified: 'SAVED RESULT',
  archived: 'PAST RESULT',
};

const modeToHardwareState: Record<CassetteMode, EvidenceHardwareState> = {
  index: 'indexed',
  active: 'active',
  'review-due': 'reviewDue',
  verdict: 'reviewDue',
  classified: 'classified',
};

const toProductLines = (productName: string) => {
  const words = productName.split(/\s+/);
  const split = Math.ceil(words.length / 2);
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
};

const phaseFor = (mode: CassetteMode | undefined, state: EvidenceHardwareState, expanded: boolean): EvidenceCassettePhase => {
  if (expanded && (mode === 'verdict' || state === 'classified' || state === 'archived')) return 'verdictRevealed';
  if (mode === 'verdict' || state === 'reviewDue') return 'verdictReady';
  if (state === 'sealed' || state === 'selected') return 'processing';
  return 'followUpReady';
};

const glassFor = (phase: EvidenceCassettePhase, doorState: EvidenceCassetteDoorState): EvidenceCassetteGlassState => {
  if (phase === 'verdictRevealed' || doorState === 'open') return 'clear';
  if (doorState === 'released') return 'clearing';
  if (phase === 'verdictReady' || phase === 'processing') return 'opaque';
  return 'fogged';
};

export interface EvidenceInstrumentProps {
  specimen?: Specimen;
  job?: string | null;
  state?: EvidenceHardwareState;
  mode?: CassetteMode;
  status?: string;
  selected?: boolean;
  secondarySpecimen?: Specimen;
  outputReady?: boolean;
  expanded?: boolean;
  onActivate?: () => void;
  onEscape?: () => void;
  onEditProduct?: () => void;
  actionLabel?: string;
  summary?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

const timing = {
  press: 90,
  latch: 80,
  pop: 120,
  pause: 80,
} as const;

export function EvidenceInstrument({
  specimen,
  job,
  state,
  mode,
  status,
  selected = false,
  secondarySpecimen,
  outputReady = false,
  expanded,
  onActivate,
  onEscape,
  onEditProduct,
  actionLabel,
  summary,
  children,
  compact = false,
}: EvidenceInstrumentProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [doorState, setDoorState] = useState<EvidenceCassetteDoorState>('closed');
  const [transitioning, setTransitioning] = useState(false);
  const timers = useRef<number[]>([]);
  const resolvedExpanded = expanded ?? summaryOpen;
  const productName = specimen?.product ?? 'AWAITING PRODUCT';
  const [lineOne, lineTwo] = toProductLines(productName);
  const accession = specimen?.accession ?? 'A1–00';
  const resolvedJob = job ?? (specimen ? 'JOB UNASSIGNED' : 'READY FOR PRODUCT');
  const resolvedState = state ?? (mode ? modeToHardwareState[mode] : 'sealed');
  const resolvedStatus = status ?? (state ? statusCopy[resolvedState] : mode ? cassetteModeStatus[mode] : statusCopy[resolvedState]);
  const interactive = Boolean(mode && (onActivate || summary || expanded !== undefined));
  const hasSummary = Boolean(summary || expanded !== undefined);
  const phase = phaseFor(mode, resolvedState, resolvedExpanded);
  const glassState = glassFor(phase, doorState);
  const summaryId = `trial-summary-${specimen?.id ?? 'empty'}`;
  const summaryContent = expanded !== undefined && mode === 'active' ? <strong>{resolvedJob}</strong> : summary ?? <strong>{resolvedJob}</strong>;

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (resolvedExpanded && doorState === 'closed') setDoorState('open');
    if (!resolvedExpanded && !transitioning) setDoorState('closed');
  }, [resolvedExpanded, doorState, transitioning]);

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  };

  const activate = () => {
    if (transitioning) return;

    if (doorState === 'open') {
      setDoorState('closed');
      if (expanded === undefined && hasSummary) setSummaryOpen(false);
      onEscape?.();
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTransitioning(true);

    if (reducedMotion) {
      setDoorState('open');
      if (expanded === undefined && hasSummary) setSummaryOpen(true);
      onActivate?.();
      setTransitioning(false);
      return;
    }

    setDoorState('pressed');
    schedule(() => setDoorState('released'), timing.press + timing.latch);
    schedule(() => {
      setDoorState('open');
      if (expanded === undefined && hasSummary) setSummaryOpen(true);
      onActivate?.();
      setTransitioning(false);
    }, timing.press + timing.latch + timing.pop + timing.pause);
  };

  const faceplateHidden = doorState !== 'open';

  return (
    <section
      className={`${styles.instrument} ${compact ? styles.compact : ''} ${cassetteStyles.canonicalCassette}`}
      data-evidence-instrument
      data-evidence-cassette
      data-hardware-state={resolvedState}
      data-cassette-mode={mode}
      data-cassette-phase={phase}
      data-door-state={doorState}
      data-glass-state={glassState}
      data-output-ready={outputReady || undefined}
      data-selected={selected || undefined}
      data-optics-layered="true"
      aria-label={`Product trial ${accession}. ${productName}. ${resolvedStatus}.`}
    >
      <div className={styles.housing} data-cassette-part="chassis" aria-hidden="true" />
      <div className={styles.structuralBezel} data-cassette-part="structural-bezel" aria-hidden="true" />

      <div className={styles.opticalBay} data-cassette-part="specimen-bay">
        <div className={styles.rearPanel} aria-hidden="true" />
        <div className={styles.bayCeiling} aria-hidden="true" />
        <div className={styles.bayFloor} aria-hidden="true" />
        <div className={styles.specimenDock} data-cassette-part="bottle-pedestal" aria-hidden="true" />
        {specimen ? (
          <figure className={styles.specimen} data-cassette-part="bottle-specimen" aria-label={`${specimen.product}, ${specimen.volume}`}>
            <div className={styles.specimenCap} aria-hidden="true" />
            <div className={styles.specimenBody} aria-hidden="true">
              <span>FACE VALUE</span>
              <strong>{lineOne}</strong>
              {lineTwo && <strong>{lineTwo}</strong>}
              <small>{specimen.volume}</small>
            </div>
          </figure>
        ) : (
          <div className={styles.emptyDock} aria-hidden="true">+</div>
        )}
        <div className={styles.smartGlass} data-cassette-part="smart-glass" aria-hidden="true" />
      </div>

      <div
        id={summaryId}
        className={cassetteStyles.faceplate}
        data-cassette-part="registered-product-faceplate"
        aria-hidden={faceplateHidden}
        inert={faceplateHidden ? '' : undefined}
      >
        <div className={cassetteStyles.faceplateHeader}>
          <span>SAMPLE REGISTERED</span>
          <span>{accession}</span>
        </div>
        <strong>{productName}</strong>
        <small>JOB · {resolvedJob}</small>
        {summary && <div className={cassetteStyles.faceplateSummary}>{summaryContent}</div>}
        <button type="button" tabIndex={faceplateHidden ? -1 : 0} onClick={onEditProduct} disabled={faceplateHidden}>
          EDIT / REPLACE
        </button>
      </div>

      <div className={`${styles.cassettePerspective} ${cassetteStyles.doorPerspective}`} data-cassette-part="hinge-recess">
        <div className={`${styles.cassetteModule} ${cassetteStyles.door}`} data-cassette-part="cassette-door">
          <div className={`${styles.cassetteFace} ${cassetteStyles.doorFront}`}>
            <div className={styles.cassetteLabel}>
              <span>{accession}</span>
              <strong>{resolvedStatus}</strong>
              <small>{resolvedJob}</small>
            </div>
            <i className={styles.evidenceSignal} />
            {resolvedState === 'disturbed' && secondarySpecimen && (
              <div className={styles.interferenceRail}>
                <span>{secondarySpecimen.accession}</span>
                <strong>TWO PRODUCTS ACTIVE</strong>
              </div>
            )}
          </div>
          <div className={cassetteStyles.doorThickness} aria-hidden="true" />
          <div className={cassetteStyles.doorRear} aria-hidden="true" />
          {interactive && (
            <div className={styles.handleRecess} data-cassette-part="handle" aria-hidden="true">
              <span className={styles.handleGrip} />
            </div>
          )}
        </div>
      </div>

      {interactive && mode && (
        <CassetteHandle
          mode={mode}
          accession={accession}
          product={productName}
          label={actionLabel}
          expanded={doorState === 'open'}
          controls={hasSummary ? summaryId : undefined}
          className={styles.activationTarget}
          onActivate={activate}
          onEscape={() => {
            if (transitioning) return;
            setDoorState('closed');
            if (expanded === undefined && summaryOpen) setSummaryOpen(false);
            onEscape?.();
          }}
        />
      )}

      <div className={styles.outputSlot} data-cassette-part="bottom-rail" aria-hidden="true">
        {outputReady && (
          <span className={styles.outputRecord}>
            <b>RESULT</b>
            <small>{accession}</small>
            <em>SAVED RESULT READY</em>
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export interface EvidenceCassetteSelectorProps {
  products: Specimen[];
  index: number;
  job?: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onInspect: () => void;
}

export function EvidenceCassetteSelector({ products, index, job, onPrevious, onNext, onInspect }: EvidenceCassetteSelectorProps) {
  const specimen = products[index];

  return (
    <section className={styles.selector} aria-label={`Trial selector. Trial ${index + 1} of ${products.length}.`} data-cassette-selector>
      <div className={styles.selectorTarget}>
        <EvidenceInstrument
          specimen={specimen}
          job={job}
          mode="index"
          selected
          onActivate={onInspect}
          actionLabel={`View trial for ${specimen.product}`}
        />
      </div>
      <div className={styles.selectorControls}>
        <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous trial">‹</button>
        <div className={styles.indexRegister} aria-live="polite">
          <strong>TRIAL {String(index + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</strong>
          <span>{specimen.product}</span>
          <div aria-hidden="true">
            {products.map((product, productIndex) => <i key={product.id} data-active={productIndex === index || undefined} />)}
          </div>
        </div>
        <button type="button" onClick={onNext} disabled={index === products.length - 1} aria-label="Next trial">›</button>
      </div>
      <p>Pull to view trial</p>
    </section>
  );
}
