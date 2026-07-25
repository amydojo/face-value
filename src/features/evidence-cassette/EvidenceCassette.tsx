import { useEffect, useReducer, useState } from 'react';
import {
  evidenceCassetteReducer,
  isCassetteBusy,
  isMechanicallySettled,
  nextCassetteStep,
  type EvidenceCassetteState,
} from './evidenceCassetteMachine';
import { CassetteHandle } from './CassetteHandle';
import styles from './EvidenceCassette.module.css';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function toDisplayName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());
}

export interface EvidenceCassetteProps {
  accessionCode: string;
  productName: string;
  volume: string;
  job: string;
  verdict?: string;
  initialState?: EvidenceCassetteState;
  onEdit?: () => void;
}

export function EvidenceCassette({
  accessionCode,
  productName,
  volume,
  job,
  verdict = 'EARNING ITS PLACE',
  initialState = 'sealed',
  onEdit,
}: EvidenceCassetteProps) {
  const [state, dispatch] = useReducer(evidenceCassetteReducer, initialState);
  const [announcement, setAnnouncement] = useState('Result sealed');
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const step = nextCassetteStep(state, reducedMotion);
    if (!step) return;

    const timer = window.setTimeout(() => dispatch(step.event), step.delay);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state]);

  useEffect(() => {
    if (state === 'sealed') {
      setAnnouncement('Result sealed');
      return;
    }
    if (state === 'released') {
      setAnnouncement('Latch released');
      return;
    }
    if (state !== 'presented') return;

    setAnnouncement('Result revealed');
    const timer = window.setTimeout(() => setAnnouncement('Product identity and result ready'), 120);
    return () => window.clearTimeout(timer);
  }, [state]);

  const activate = () => dispatch({ type: 'ACTIVATE' });
  const presented = state === 'presented';
  const busy = isCassetteBusy(state);
  const mechanicallySettled = isMechanicallySettled(state);
  const productWords = productName.split(/\s+/);
  const lineBreak = Math.ceil(productWords.length / 2);
  const productLineOne = productWords.slice(0, lineBreak).join(' ');
  const productLineTwo = productWords.slice(lineBreak).join(' ');

  const accessibleDescription = presented
    ? `Result open. ${toDisplayName(productName)} is presented with a crisp live identity.`
    : `Result sealed. ${toDisplayName(productName)} remains identifiable behind smart glass.`;

  return (
    <section
      className={styles.instrument}
      data-cassette-state={state}
      data-cassette-mode="verdict"
      data-mechanics-settled={mechanicallySettled ? 'true' : 'false'}
      data-glass-cleared={presented ? 'true' : 'false'}
      data-identity-visible={presented ? 'true' : 'false'}
      data-optics-layered="true"
      aria-label="Product trial result"
    >
      <div className={styles.housing} aria-hidden="true">
        <div className={styles.chamber}>
          <div className={styles.rearPanel} />
          <div className={styles.identityRail} data-fv-part="specimen-identity">
            <span className={styles.identityCode}>{accessionCode}</span>
            <strong className={styles.identityName}>{productName}</strong>
            <span className={styles.identityJob}>{job}</span>
            <span className={styles.identityEditLabel}>EDIT</span>
          </div>
          <div className={styles.specimenPresentation} data-fv-part="specimen-identity">
            <div className={styles.bottleCap} />
            <div className={styles.bottleBody}>
              <span>FACE VALUE</span>
              <strong>{productLineOne}</strong>
              {productLineTwo && <strong>{productLineTwo}</strong>}
              <small>{volume}</small>
            </div>
          </div>
          <div className={styles.specimenDock} />
          <div className={styles.smartGlass} data-fv-part="smart-glass" />
          <div className={styles.structuralBezel} />
        </div>
      </div>

      <div className={styles.cassettePerspective}>
        <div className={styles.cassetteModule}>
          <div className={styles.cassetteFace} aria-hidden="true">
            <div className={styles.cassetteLabel}>
              <span>{accessionCode}</span>
              <strong>{presented ? 'RESULT' : 'TRIAL'}</strong>
              <small>{presented ? verdict : job}</small>
            </div>
            <i className={styles.evidenceMark} />
          </div>
          <CassetteHandle
            mode="verdict"
            accession={accessionCode}
            product={productName}
            expanded={presented}
            busy={busy}
            describedBy="trial-result-description"
            className={styles.handleTarget}
            onActivate={activate}
            onEscape={() => {
              if (presented) activate();
              else onEdit?.();
            }}
          >
            <span className={styles.handleRecess} aria-hidden="true">
              <span className={styles.handleGrip} />
            </span>
          </CassetteHandle>
        </div>
      </div>

      <button
        type="button"
        className={styles.editControl}
        onClick={onEdit}
        aria-label="Edit product trial details"
        tabIndex={presented ? 0 : -1}
        aria-hidden={!presented}
      >
        EDIT
      </button>

      <div className={styles.outputSlot} aria-hidden="true">
        <div className={styles.outputRecord}>
          <span>SAVED RESULT</span>
          <strong>{accessionCode}</strong>
        </div>
      </div>

      <p id="trial-result-description" className={styles.srOnly}>
        {accessibleDescription}
      </p>
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
