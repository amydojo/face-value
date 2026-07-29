import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { browserHaptics } from '../../adapters/haptics/haptics';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { ScreenHeader } from '../../components/hardware';
import type { RegisteredProduct } from '../../domain/model';
import { createRegisteredProduct, type ProductRegistrationInput } from '../../domain/phaseB5';
import { specimenRegistrationTiming } from '../../domain/specimenRegistration';
import styles from '../../styles/FaceValue.module.css';
import {
  OracleTrialStateMachine,
  type OracleSpecimenIdentity,
  type OracleTrialStateMachineProps,
} from '../oracle-reveal/OracleRevealScene';
import { ProductRegistration } from '../product-registration/ProductRegistration';
import { useSpecimenRegistrationSequence } from './useSpecimenRegistrationSequence';

type SpecimenTimingProperties = CSSProperties & {
  '--fv-form-exit-duration': string;
  '--fv-registration-aligning-duration': string;
  '--fv-registration-processing-duration': string;
  '--fv-registration-ready-duration': string;
};

const specimenTimingProperties: SpecimenTimingProperties = {
  '--fv-form-exit-duration': '140ms',
  '--fv-registration-aligning-duration': `${specimenRegistrationTiming.normal.aligning}ms`,
  '--fv-registration-processing-duration': `${specimenRegistrationTiming.normal.processing}ms`,
  '--fv-registration-ready-duration': '220ms',
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
  const [registrationPanelMounted, setRegistrationPanelMounted] = useState(
    state.stage === 'product_registration',
  );
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [baselineRequested, setBaselineRequested] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const baselineRequestedRef = useRef(false);
  const registrationEventRef = useRef(0);
  const onRegistrationReady = useCallback(() => {
    if (!reducedMotion) browserHaptics.confirm();
  }, [reducedMotion]);
  const registrationSequence = useSpecimenRegistrationSequence({
    initiallyReady: state.stage === 'job' && Boolean(state.registeredProduct),
    reducedMotion,
    onReady: onRegistrationReady,
  });
  const { phase } = registrationSequence;
  const cancelRegistration = registrationSequence.cancel;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (state.stage === 'welcome') {
      cancelRegistration();
      setRegistrationPanelMounted(false);
      setRegistrationSubmitting(false);
      baselineRequestedRef.current = false;
      setBaselineRequested(false);
    } else if (state.stage === 'product_registration') {
      cancelRegistration();
      setRegistrationPanelMounted(true);
      setRegistrationSubmitting(false);
      baselineRequestedRef.current = false;
      setBaselineRequested(false);
    }
  }, [cancelRegistration, state.stage]);

  useEffect(() => {
    if (phase !== 'idle' && phase !== 'preparing') {
      setRegistrationPanelMounted(false);
    }
    if (phase === 'ready') {
      setRegistrationSubmitting(false);
    }
  }, [phase]);

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
              registration: registrationSequence.registration,
            }
          : { state: 'empty' };

  const onLoadProduct = () => {
    setRegistrationPanelMounted(true);
    dispatch({ type: 'START_PRODUCT_REGISTRATION' });
  };

  const onBack = () => {
    registrationSequence.cancel();
    setRegistrationPanelMounted(false);
    setRegistrationSubmitting(false);
    dispatch({ type: 'BACK' });
  };

  const onRegister = (value: ProductRegistrationInput) => {
    const product = createRegisteredProduct(value, systemClock.now());
    registrationEventRef.current += 1;
    const registrationId = `${product.id}:${registrationEventRef.current}`;
    setRegistrationSubmitting(true);
    baselineRequestedRef.current = false;
    setBaselineRequested(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    registrationSequence.start(registrationId);
    dispatch({ type: 'REGISTER_PRODUCT', product });
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  };

  const onEditProduct = () => {
    if (!state.registeredProduct) return;
    registrationSequence.cancel();
    setDraft(draftFromRegisteredProduct(state.registeredProduct));
    setRegistrationPanelMounted(true);
    setRegistrationSubmitting(false);
    baselineRequestedRef.current = false;
    setBaselineRequested(false);
    dispatch({ type: 'BACK' });
  };

  const onBeginBaseline = () => {
    if (
      !registrationSequence.isReady ||
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
  const baselineReady = registrationSequence.isReady && !baselineRequested;

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
        data-registration-phase={phase}
        data-registration-active={registrationSequence.isRegistering}
        data-registration-complete={registrationSequence.isReady}
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
                  <small>{baselineReady ? 'BASELINE READY' : 'REGISTRATION IN PROGRESS'}</small>
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
        <div className={styles.liveRegion} role="status" aria-live="polite" aria-atomic="true">
          {registrationSequence.announcement}
        </div>
      </section>
    </>
  );
}
