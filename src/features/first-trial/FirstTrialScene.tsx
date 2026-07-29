import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { browserHaptics } from '../../adapters/haptics/haptics';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { ScreenHeader } from '../../components/hardware';
import type { RegisteredProduct } from '../../domain/model';
import { createRegisteredProduct, type ProductRegistrationInput } from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';
import {
  OracleTrialStateMachine,
  type OracleSpecimenIdentity,
  type OracleTrialStateMachineProps,
  type SpecimenIngestionPhase,
} from '../oracle-reveal/OracleRevealScene';
import { ProductRegistration } from '../product-registration/ProductRegistration';

// eslint-disable-next-line react-refresh/only-export-components
export const specimenIngestionTiming = {
  formExit: 140,
  materializeStart: 0,
  loadingStart: 160,
  lockingStart: 540,
  confirmingStart: 720,
  readyStart: 900,
  fallback: 1050,
} as const;

type SpecimenTimingProperties = CSSProperties & {
  '--fv-form-exit-duration': string;
  '--fv-materialize-duration': string;
  '--fv-loading-duration': string;
  '--fv-locking-duration': string;
  '--fv-confirming-duration': string;
  '--fv-reduced-ingestion-duration': string;
};

const specimenTimingProperties: SpecimenTimingProperties = {
  '--fv-form-exit-duration': `${specimenIngestionTiming.formExit}ms`,
  '--fv-materialize-duration': `${
    specimenIngestionTiming.loadingStart - specimenIngestionTiming.materializeStart
  }ms`,
  '--fv-loading-duration': `${
    specimenIngestionTiming.lockingStart - specimenIngestionTiming.loadingStart
  }ms`,
  '--fv-locking-duration': `${
    specimenIngestionTiming.confirmingStart - specimenIngestionTiming.lockingStart
  }ms`,
  '--fv-confirming-duration': `${
    specimenIngestionTiming.readyStart - specimenIngestionTiming.confirmingStart
  }ms`,
  '--fv-reduced-ingestion-duration': '80ms',
};

const blankDraft = (): ProductRegistrationInput => ({
  brand: '',
  productName: '',
  strength: '',
  volume: '',
});

const draftFromRegisteredProduct = (product: RegisteredProduct): ProductRegistrationInput => ({
  brand: product.brand,
  productName: product.productName,
  strength: product.strength ?? '',
  volume: product.volume ?? '',
});

const draftSpecimenIdentity = (draft: ProductRegistrationInput): OracleSpecimenIdentity => ({
  brand: draft.brand.trim() || 'UNNAMED BRAND',
  productName: draft.productName.trim() || 'UNNAMED PRODUCT',
  strength: draft.strength?.trim() || null,
  volume: draft.volume?.trim() || null,
  assignedJob: 'Reduce visible redness',
});

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function FirstTrialScene() {
  const { state, dispatch } = useFaceValue();
  const [draft, setDraft] = useState<ProductRegistrationInput>(() =>
    state.stage !== 'welcome' && state.registeredProduct
      ? draftFromRegisteredProduct(state.registeredProduct)
      : blankDraft(),
  );
  const [phase, setPhase] = useState<SpecimenIngestionPhase>(() =>
    state.stage === 'job' && state.registeredProduct ? 'ready' : 'idle',
  );
  const [registrationPanelMounted, setRegistrationPanelMounted] = useState(
    state.stage === 'product_registration',
  );
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [baselineRequested, setBaselineRequested] = useState(false);
  const [readyAnnouncement, setReadyAnnouncement] = useState('');
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const baselineRequestedRef = useRef(false);
  const runIdRef = useRef(0);
  const activeRunRef = useRef<number | null>(null);
  const timersRef = useRef<Set<number>>(new Set());

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  const cancelIngestion = useCallback(() => {
    runIdRef.current += 1;
    activeRunRef.current = null;
    clearTimers();
  }, [clearTimers]);

  const completeIngestion = useCallback(
    (runId: number, haptic: boolean) => {
      if (activeRunRef.current !== runId || runIdRef.current !== runId) return;
      clearTimers();
      activeRunRef.current = null;
      setRegistrationPanelMounted(false);
      setRegistrationSubmitting(false);
      setPhase('ready');
      setReadyAnnouncement('Specimen loaded. Ready to take the baseline scan.');
      if (haptic) browserHaptics.confirm();
    },
    [clearTimers],
  );

  const schedule = useCallback((runId: number, delay: number, action: () => void) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (activeRunRef.current === runId && runIdRef.current === runId) {
        action();
      }
    }, delay);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      const activeRun = activeRunRef.current;
      if (activeRun !== null) {
        clearTimers();
        completeIngestion(activeRun, false);
      }
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [clearTimers, completeIngestion]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const activeRun = activeRunRef.current;
      if (!document.hidden && activeRun !== null) {
        completeIngestion(activeRun, false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [completeIngestion]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      activeRunRef.current = null;
      clearTimers();
    },
    [clearTimers],
  );

  useEffect(() => {
    if (state.stage === 'welcome') {
      cancelIngestion();
      setRegistrationPanelMounted(false);
      setRegistrationSubmitting(false);
      baselineRequestedRef.current = false;
      setBaselineRequested(false);
      setReadyAnnouncement('');
      setPhase('idle');
    } else if (state.stage === 'product_registration') {
      cancelIngestion();
      setRegistrationPanelMounted(true);
      setRegistrationSubmitting(false);
      baselineRequestedRef.current = false;
      setBaselineRequested(false);
      setReadyAnnouncement('');
      setPhase('idle');
    }
  }, [cancelIngestion, state.stage]);

  const identity = useMemo(() => draftSpecimenIdentity(draft), [draft]);

  const oracleProps: OracleTrialStateMachineProps =
    state.stage === 'welcome'
      ? { state: 'empty' }
      : state.stage === 'product_registration'
        ? { state: 'registration-preview', identity }
        : state.registeredProduct
          ? {
              state: 'baseline-ready',
              product: state.registeredProduct,
              phase,
            }
          : { state: 'empty' };

  const onLoadProduct = () => {
    setRegistrationPanelMounted(true);
    dispatch({ type: 'START_PRODUCT_REGISTRATION' });
  };

  const onBack = () => {
    cancelIngestion();
    setRegistrationPanelMounted(false);
    setRegistrationSubmitting(false);
    setReadyAnnouncement('');
    setPhase('idle');
    dispatch({ type: 'BACK' });
  };

  const onRegister = (value: ProductRegistrationInput) => {
    const product = createRegisteredProduct(value, systemClock.now());
    cancelIngestion();
    const runId = runIdRef.current;
    activeRunRef.current = runId;
    setRegistrationSubmitting(true);
    baselineRequestedRef.current = false;
    setBaselineRequested(false);
    setReadyAnnouncement('');
    setPhase('materializing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    dispatch({ type: 'REGISTER_PRODUCT', product });
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });

    if (reducedMotion) {
      schedule(runId, 80, () => completeIngestion(runId, false));
      return;
    }

    schedule(runId, specimenIngestionTiming.formExit, () => setRegistrationPanelMounted(false));
    schedule(runId, specimenIngestionTiming.loadingStart, () => setPhase('loading'));
    schedule(runId, specimenIngestionTiming.lockingStart, () => setPhase('locking'));
    schedule(runId, specimenIngestionTiming.confirmingStart, () => setPhase('confirming'));
    schedule(runId, specimenIngestionTiming.readyStart, () => completeIngestion(runId, true));
    schedule(runId, specimenIngestionTiming.fallback, () => completeIngestion(runId, false));
  };

  const onEditProduct = () => {
    if (!state.registeredProduct) return;
    cancelIngestion();
    setDraft(draftFromRegisteredProduct(state.registeredProduct));
    setRegistrationPanelMounted(true);
    setRegistrationSubmitting(false);
    baselineRequestedRef.current = false;
    setBaselineRequested(false);
    setReadyAnnouncement('');
    setPhase('idle');
    dispatch({ type: 'BACK' });
  };

  const onBeginBaseline = () => {
    if (
      phase !== 'ready' ||
      baselineRequestedRef.current ||
      state.stage !== 'job' ||
      !state.registeredProduct
    ) {
      return;
    }
    baselineRequestedRef.current = true;
    setBaselineRequested(true);
    dispatch({
      type: 'BEGIN_CAPTURE',
      kind: 'baseline',
      now: systemClock.now(),
    });
  };

  const registrationVisible =
    registrationPanelMounted && (state.stage === 'product_registration' || state.stage === 'job');
  const baselineReady = phase === 'ready' && !baselineRequested;

  return (
    <>
      <ScreenHeader dark />
      <section
        className={styles.firstTrialScene}
        data-fv-screen={
          state.stage === 'welcome'
            ? 'welcome'
            : state.stage === 'product_registration'
              ? 'product-registration'
              : 'baseline-ready'
        }
        data-first-trial-stage={state.stage}
        data-ingestion-phase={phase}
        style={specimenTimingProperties}
      >
        <div className={styles.firstTrialLeadSlot} data-first-trial-lead={state.stage}>
          {state.stage === 'welcome' && (
            <div className={styles.firstTrialWelcomeLead}>
              <p className={styles.firstTrialEyebrow}>ONE PRODUCT · ONE JOB · ONE HONEST RESULT</p>
              <h1 data-stage-focus tabIndex={-1}>
                Is your skincare actually doing anything?
              </h1>
              <p>
                Put one product on trial. Compare repeat scans.
                <br />
                Get one honest result.
              </p>
            </div>
          )}
          {state.stage === 'product_registration' && (
            <button type="button" className={styles.firstTrialBack} onClick={onBack}>
              ← Back
            </button>
          )}
        </div>

        <div className={styles.firstTrialMachine}>
          <OracleTrialStateMachine {...oracleProps} />
        </div>

        <div className={styles.firstTrialControls}>
          {state.stage === 'welcome' && (
            <button
              className={styles.firstTrialLoadAction}
              type="button"
              data-welcome-action
              onClick={onLoadProduct}
            >
              <span>LOAD A PRODUCT</span>
              <span aria-hidden="true">→</span>
            </button>
          )}

          {registrationVisible && (
            <ProductRegistration
              value={draft}
              disabled={registrationSubmitting}
              exiting={state.stage === 'job'}
              submitLabel="REGISTER & LOAD"
              onChange={setDraft}
              onRegister={onRegister}
            />
          )}

          {state.stage === 'job' && state.registeredProduct && (
            <>
              <button
                type="button"
                className={`${styles.followUpActionRail} ${styles.baselineActionRail}`}
                data-baseline-action
                data-baseline-action-state={baselineReady ? 'ready' : 'disabled'}
                aria-label="TAKE GUIDED BASELINE"
                disabled={!baselineReady}
                onClick={onBeginBaseline}
              >
                <i className={styles.followUpAccent} aria-hidden="true" />
                <span className={styles.followUpActionCopy}>
                  <small>BASELINE READY</small>
                  <strong>TAKE GUIDED BASELINE</strong>
                </span>
                <i
                  className={`${styles.followUpArrow} ${styles.baselineActionArrow}`}
                  aria-hidden="true"
                >
                  →
                </i>
              </button>
              <button type="button" className={styles.firstTrialEdit} onClick={onEditProduct}>
                Edit product
              </button>
            </>
          )}
        </div>

        <footer
          className={styles.firstTrialPrivacy}
          data-welcome-privacy={state.stage === 'welcome' ? '' : undefined}
        >
          {state.stage !== 'product_registration' &&
            'PRIVATE BY DEFAULT · FACE IMAGES STAY IN MEMORY'}
        </footer>
        <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
          {readyAnnouncement}
        </div>
      </section>
    </>
  );
}
