import { useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  evidenceCassetteReducer,
  isCassetteBusy,
  isMechanicallySettled,
  nextCassetteStep,
  type EvidenceCassetteState,
} from './evidenceCassetteMachine';
import styles from './EvidenceCassette.module.css';

const DRAG_ACTIVATION_PX = 28;

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

export interface EvidenceCassetteProps {
  accessionCode: string;
  productName: string;
  job: string;
  verdict?: string;
  initialState?: EvidenceCassetteState;
  onEdit?: () => void;
}

export function EvidenceCassette({
  accessionCode,
  productName,
  job,
  verdict = 'EARNING ITS PLACE',
  initialState = 'sealed',
  onEdit,
}: EvidenceCassetteProps) {
  const [state, dispatch] = useReducer(evidenceCassetteReducer, initialState);
  const [announcement, setAnnouncement] = useState('Cassette sealed');
  const reducedMotion = usePrefersReducedMotion();
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    activated: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const step = nextCassetteStep(state, reducedMotion);
    if (!step) return;

    const timer = window.setTimeout(() => dispatch(step.event), step.delay);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state]);

  useEffect(() => {
    if (state === 'sealed') {
      setAnnouncement('Cassette sealed');
      return;
    }
    if (state === 'released') {
      setAnnouncement('Cassette released');
      return;
    }
    if (state !== 'presented') return;

    setAnnouncement('Specimen presented');
    const timer = window.setTimeout(() => setAnnouncement('Evidence record ready'), 120);
    return () => window.clearTimeout(timer);
  }, [state]);

  const activate = () => dispatch({ type: 'ACTIVATE' });
  const presented = state === 'presented';
  const busy = isCassetteBusy(state);
  const mechanicallySettled = isMechanicallySettled(state);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || busy) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      activated: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.activated) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) < DRAG_ACTIVATION_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    drag.activated = true;
    suppressClickRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    activate();
  };

  const clearPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    activate();
  };

  const accessibleDescription = presented
    ? 'Evidence cassette open. Barrier Water Serum specimen presented.'
    : 'Evidence cassette sealed. Specimen protected behind smart glass.';

  return (
    <section
      className={styles.instrument}
      data-cassette-state={state}
      data-mechanics-settled={mechanicallySettled ? 'true' : 'false'}
      data-glass-cleared={presented ? 'true' : 'false'}
      data-identity-visible={presented ? 'true' : 'false'}
      aria-label="Evidence cassette instrument"
    >
      <div className={styles.housing} aria-hidden="true">
        <div className={styles.chamber}>
          <div className={styles.rearPanel} />
          <div className={styles.identityRail}>
            <span className={styles.identityCode}>{accessionCode}</span>
            <strong className={styles.identityName}>{productName}</strong>
            <span className={styles.identityJob}>{job}</span>
            <span className={styles.identityEditLabel}>EDIT</span>
          </div>
          <div className={styles.specimenPresentation}>
            <div className={styles.bottleCap} />
            <div className={styles.bottleBody}>
              <span>FACE VALUE</span>
              <strong>BARRIER</strong>
              <strong>WATER SERUM</strong>
              <small>30 ML</small>
            </div>
          </div>
          <div className={styles.specimenDock} />
          <div className={styles.smartGlass} />
          <div className={styles.structuralBezel} />
        </div>
      </div>

      <div className={styles.cassettePerspective}>
        <div className={styles.cassetteModule}>
          <div className={styles.cassetteFace} aria-hidden="true">
            <div className={styles.cassetteLabel}>
              <span>{accessionCode}</span>
              <strong>{presented ? 'VERDICT' : 'ACTIVE'}</strong>
              <small>{presented ? verdict : job}</small>
            </div>
            <i className={styles.evidenceMark} />
          </div>
          <button
            type="button"
            className={styles.handleTarget}
            aria-label={presented ? 'Close evidence cassette' : 'Open evidence cassette'}
            aria-describedby="evidence-cassette-description"
            aria-disabled={busy}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={clearPointer}
            onPointerCancel={clearPointer}
          >
            <span className={styles.handleRecess} aria-hidden="true">
              <span className={styles.handleGrip} />
            </span>
          </button>
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
          <span>EVIDENCE RECORD</span>
          <strong>{accessionCode}</strong>
        </div>
      </div>

      <p id="evidence-cassette-description" className={styles.srOnly}>
        {accessibleDescription}
      </p>
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
