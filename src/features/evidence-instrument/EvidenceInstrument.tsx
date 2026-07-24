import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Specimen } from '../../domain/model';
import styles from './EvidenceInstrument.module.css';

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

const statusCopy: Record<EvidenceHardwareState, string> = {
  dormant: 'STANDBY',
  indexed: 'INDEXED',
  selected: 'SELECTED',
  sealed: 'SEALED',
  active: 'ACTIVE OBSERVATION',
  disturbed: 'OBSERVATION DISTURBED',
  reviewDue: 'REVIEW DUE',
  classified: 'CLASSIFIED',
  archived: 'ARCHIVED',
};

const toProductLines = (productName: string) => {
  const words = productName.split(/\s+/);
  const split = Math.ceil(words.length / 2);
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
};

export interface EvidenceInstrumentProps {
  specimen?: Specimen;
  job?: string | null;
  state?: EvidenceHardwareState;
  status?: string;
  selected?: boolean;
  secondarySpecimen?: Specimen;
  outputReady?: boolean;
  onActivate?: () => void;
  actionLabel?: string;
  children?: ReactNode;
  compact?: boolean;
}

export function EvidenceInstrument({
  specimen,
  job,
  state = 'sealed',
  status,
  selected = false,
  secondarySpecimen,
  outputReady = false,
  onActivate,
  actionLabel,
  children,
  compact = false,
}: EvidenceInstrumentProps) {
  const productName = specimen?.product ?? 'AWAITING SPECIMEN';
  const [lineOne, lineTwo] = toProductLines(productName);
  const accession = specimen?.accession ?? 'A1–00';
  const resolvedJob = job ?? (specimen ? 'JOB UNASSIGNED' : 'READY FOR SPECIMEN');
  const resolvedStatus = status ?? statusCopy[state];
  const interactive = Boolean(onActivate);

  return (
    <section
      className={`${styles.instrument} ${compact ? styles.compact : ''}`}
      data-evidence-instrument
      data-hardware-state={state}
      data-selected={selected || undefined}
      aria-label={`Evidence cassette ${accession}. ${productName}. ${resolvedStatus}.`}
    >
      <div className={styles.housing} aria-hidden="true" />
      <div className={styles.structuralBezel} aria-hidden="true" />
      <div className={styles.opticalBay}>
        <div className={styles.rearPanel} aria-hidden="true" />
        <div className={styles.bayCeiling} aria-hidden="true" />
        <div className={styles.bayFloor} aria-hidden="true" />
        <div className={styles.specimenDock} aria-hidden="true" />
        {specimen ? (
          <figure className={styles.specimen} aria-label={`${specimen.product}, ${specimen.volume}`}>
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
        <div className={styles.identityRail}>
          <span>{accession}</span>
          <strong>{productName}</strong>
          <small>{resolvedJob}</small>
        </div>
        <div className={styles.smartGlass} aria-hidden="true" />
      </div>

      <div className={styles.cassettePerspective} aria-hidden="true">
        <div className={styles.cassetteModule}>
          <div className={styles.cassetteFace}>
            <div className={styles.cassetteLabel}>
              <span>{accession}</span>
              <strong>{resolvedStatus}</strong>
              <small>{resolvedJob}</small>
            </div>
            <i className={styles.evidenceSignal} />
            {state === 'disturbed' && secondarySpecimen && (
              <div className={styles.interferenceRail}>
                <span>{secondarySpecimen.accession}</span>
                <strong>INTERFERENCE REGISTERED</strong>
              </div>
            )}
          </div>
          <div className={styles.handleRecess}>
            <span className={styles.handleGrip} />
          </div>
        </div>
      </div>

      {interactive && (
        <button
          type="button"
          className={styles.activationTarget}
          onClick={onActivate}
          aria-label={actionLabel ?? `Inspect cassette ${accession}`}
        />
      )}

      <div className={styles.outputSlot} data-output-ready={outputReady || undefined} aria-hidden="true">
        {outputReady && <span>EVIDENCE RECORD READY</span>}
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

const SELECTOR_DRAG_THRESHOLD = 42;

export function EvidenceCassetteSelector({
  products,
  index,
  job,
  onPrevious,
  onNext,
  onInspect,
}: EvidenceCassetteSelectorProps) {
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const specimen = products[index];

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < SELECTOR_DRAG_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX > 0 && index > 0) onPrevious();
    if (deltaX < 0 && index < products.length - 1) onNext();
  };

  return (
    <section
      className={styles.selector}
      aria-label={`Evidence cassette selector. Cassette ${index + 1} of ${products.length}.`}
      data-cassette-selector
    >
      <div
        className={styles.selectorTarget}
        onPointerDown={startDrag}
        onPointerUp={finishDrag}
        onPointerCancel={() => { pointerStart.current = null; }}
      >
        <EvidenceInstrument
          specimen={specimen}
          job={job}
          state="selected"
          selected
          onActivate={onInspect}
          actionLabel={`Inspect cassette ${specimen.accession}`}
        />
      </div>
      <div className={styles.selectorControls}>
        <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous cassette">‹</button>
        <div className={styles.indexRegister} aria-live="polite">
          <strong>CASSETTE {String(index + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}</strong>
          <span>{specimen.product}</span>
          <div aria-hidden="true">
            {products.map((product, productIndex) => (
              <i key={product.id} data-active={productIndex === index || undefined} />
            ))}
          </div>
        </div>
        <button type="button" onClick={onNext} disabled={index === products.length - 1} aria-label="Next cassette">›</button>
      </div>
      <p>Drag the handle zone or use the indexed controls. Vertical scrolling remains available.</p>
      <button
        type="button"
        className={styles.inspectAction}
        onClick={onInspect}
        aria-label={`Inspect cassette ${specimen.accession}`}
      >
        INSPECT CASSETTE <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
