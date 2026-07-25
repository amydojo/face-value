import { useState, type ReactNode } from 'react';
import type { Specimen } from '../../domain/model';
import { CassetteHandle } from '../evidence-cassette/CassetteHandle';
import type { CassetteMode } from '../evidence-cassette/cassetteContract';
import { cassetteModeStatus } from '../evidence-cassette/cassetteContract';
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
  actionLabel?: string;
  summary?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
}

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
  actionLabel,
  summary,
  children,
  compact = false,
}: EvidenceInstrumentProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const resolvedExpanded = expanded ?? summaryOpen;
  const productName = specimen?.product ?? 'AWAITING PRODUCT';
  const [lineOne, lineTwo] = toProductLines(productName);
  const accession = specimen?.accession ?? 'A1–00';
  const resolvedJob = job ?? (specimen ? 'JOB UNASSIGNED' : 'READY FOR PRODUCT');
  const resolvedState = state ?? (mode ? modeToHardwareState[mode] : 'sealed');
  const resolvedStatus = status ?? (state ? statusCopy[resolvedState] : mode ? cassetteModeStatus[mode] : statusCopy[resolvedState]);
  const interactive = Boolean(mode && (onActivate || summary));
  const hasSummary = Boolean(summary || expanded !== undefined);
  const summaryId = `trial-summary-${specimen?.id ?? 'empty'}`;
  const summaryContent = expanded !== undefined && mode === 'active'
    ? <strong>{resolvedJob}</strong>
    : summary ?? <strong>{resolvedJob}</strong>;
  const activate = () => {
    if (onActivate) onActivate();
    else if (hasSummary) setSummaryOpen((open) => !open);
  };

  return (
    <section
      className={`${styles.instrument} ${compact ? styles.compact : ''}`}
      data-evidence-instrument
      data-hardware-state={resolvedState}
      data-cassette-mode={mode}
      data-selected={selected || undefined}
      data-optics-layered="true"
      data-resting-identity={specimen ? 'true' : 'false'}
      aria-label={`Product trial ${accession}. ${productName}. ${resolvedStatus}.`}
    >
      <div className={styles.housing} aria-hidden="true" />
      <div className={styles.structuralBezel} aria-hidden="true" />
      <div className={styles.opticalBay}>
        <div className={styles.rearPanel} aria-hidden="true" />
        <div className={styles.bayCeiling} aria-hidden="true" />
        <div className={styles.bayFloor} aria-hidden="true" />
        <div className={styles.specimenDock} aria-hidden="true" />
        {specimen ? (
          <figure
            className={styles.specimen}
            data-fv-part="specimen-identity"
            aria-label={`${specimen.product}, ${specimen.volume}`}
          >
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
        <div className={styles.identityRail} data-fv-part="specimen-identity">
          <span>{accession}</span>
          <strong>{productName}</strong>
          <small>{resolvedJob}</small>
        </div>
        <div className={styles.smartGlass} data-fv-part="smart-glass" aria-hidden="true" />
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
            {resolvedState === 'disturbed' && secondarySpecimen && (
              <div className={styles.interferenceRail}>
                <span>{secondarySpecimen.accession}</span>
                <strong>TWO PRODUCTS ACTIVE</strong>
              </div>
            )}
          </div>
          {interactive && (
            <div className={styles.handleRecess}>
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
          expanded={resolvedExpanded}
          controls={hasSummary ? summaryId : undefined}
          className={styles.activationTarget}
          onActivate={activate}
          onEscape={() => {
            if (expanded === undefined && summaryOpen) setSummaryOpen(false);
            else onEscape?.();
          }}
        />
      )}

      {hasSummary && (
        <div
          id={summaryId}
          hidden={!resolvedExpanded}
          data-cassette-summary
          data-fv-part="trial-summary"
          style={{ marginTop: 10 }}
        >
          {summaryContent}
        </div>
      )}

      <div className={styles.outputSlot} data-output-ready={outputReady || undefined} aria-hidden="true">
        {outputReady && <span>SAVED RESULT READY</span>}
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

export function EvidenceCassetteSelector({
  products,
  index,
  job,
  onPrevious,
  onNext,
  onInspect,
}: EvidenceCassetteSelectorProps) {
  const specimen = products[index];

  return (
    <section
      className={styles.selector}
      aria-label={`Trial selector. Trial ${index + 1} of ${products.length}.`}
      data-cassette-selector
    >
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
            {products.map((product, productIndex) => (
              <i key={product.id} data-active={productIndex === index || undefined} />
            ))}
          </div>
        </div>
        <button type="button" onClick={onNext} disabled={index === products.length - 1} aria-label="Next trial">›</button>
      </div>
      <p>Pull to view trial</p>
    </section>
  );
}
