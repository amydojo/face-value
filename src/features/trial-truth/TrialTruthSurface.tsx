import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react';
import { systemClock } from '../../adapters/clock/clock';
import {
  oracleSpecimenIdentityFromRegisteredProduct,
  oracleSpecimenIdentityLabel,
} from '../../adapters/product/specimenFromRegisteredProduct';
import { useFaceValue } from '../../app/faceValueContext';
import {
  normalizeTrialTruthState,
  trialTruthGenerationFor,
  trialTruthMatchesCurrentTrial,
  type TrialTruthFaceValueEvent,
} from '../../app/trialTruthMachine';
import { EvidenceShell, ScreenHeader } from '../../components/hardware';
import type { CaptureContext } from '../../domain/model';
import { emptyCaptureContext } from '../../domain/phaseB5';
import {
  IRRITATION_SIGNALS,
  type TrialTruthDraft,
  type TrialTruthToleranceAnswer,
} from '../../domain/trialTruth';
import { CaptureContextFields } from '../capture-context/CaptureContextSurface';
import { CAPTURE_CONTEXT_OPTIONS } from '../capture-context/captureContextOptions';
import { OracleTrialTruthMachine } from '../oracle-reveal/OracleRevealScene';
import styles from './TrialTruthSurface.module.css';

const symptomLabels = {
  burning: 'Burning',
  stinging: 'Stinging',
  itching: 'Itching',
  heat: 'Heat',
  swelling: 'Swelling',
  peeling: 'Peeling',
  blistering: 'Blistering',
  eye_involvement: 'Eye involvement',
  rapid_escalation: 'Rapid escalation',
  unusual_sensitivity: 'Unusual sensitivity',
} as const;

const adherenceOptions = [
  ['yes', 'YES'],
  ['mostly', 'MOSTLY'],
  ['no', 'NO'],
] as const;

const toleranceOptions = [
  ['none', 'NONE'],
  ['mild', 'MILD'],
  ['moderate', 'MODERATE'],
  ['severe', 'SEVERE'],
] as const;

const visibleChangeOptions = [
  ['less', 'LESS'],
  ['same', 'SAME'],
  ['more', 'MORE'],
] as const;

type TrialTruthStep = 1 | 2 | 3 | 4;
type FirmwareView = 'question' | 'symptoms' | 'capture-context';
type MotionDirection = 'forward' | 'back';
type CaptureCheckChoice = 'nothing' | 'context' | null;

const symptomsRequired = (tolerance: TrialTruthToleranceAnswer | null): boolean =>
  tolerance === 'moderate' || tolerance === 'severe';

const toleranceReady = (draft: TrialTruthDraft): boolean =>
  draft.tolerance !== null && (!symptomsRequired(draft.tolerance) || draft.symptoms.length > 0);

const initialStepForDraft = (draft: TrialTruthDraft): TrialTruthStep => {
  if (draft.adherence === null) return 1;
  if (!toleranceReady(draft)) return 2;
  return 3;
};

export function TrialTruthSurface() {
  const context = useFaceValue();
  const state = normalizeTrialTruthState(context.state);
  const dispatch =
    context.dispatchTrialTruth ?? (context.dispatch as Dispatch<TrialTruthFaceValueEvent>);
  const truthCommitted = trialTruthMatchesCurrentTrial(state);
  const [step, setStep] = useState<TrialTruthStep>(() =>
    truthCommitted ? 4 : initialStepForDraft(state.trialTruthDraft),
  );
  const [view, setView] = useState<FirmwareView>('question');
  const [motionDirection, setMotionDirection] = useState<MotionDirection>('forward');
  const [captureContextDraft, setCaptureContextDraft] = useState<CaptureContext>(() =>
    emptyCaptureContext(),
  );
  const [captureContext, setCaptureContext] = useState<CaptureContext>(() => emptyCaptureContext());
  const [captureCheckChoice, setCaptureCheckChoice] = useState<CaptureCheckChoice>(null);
  const [captureCheckComplete, setCaptureCheckComplete] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const finalSubmitRef = useRef(false);
  const generationId = trialTruthGenerationFor(state);
  const product = state.registeredProduct;
  const draft = state.trialTruthDraft;
  const selectedSymptomLabels = draft.symptoms.map((symptom) => symptomLabels[symptom]);
  const selectedCaptureContextLabels = CAPTURE_CONTEXT_OPTIONS.filter(
    (option) => captureContext[option.key],
  ).map((option) => option.label);
  if (captureContext.note) selectedCaptureContextLabels.push('Note added');

  const goBack = useCallback(() => {
    setMotionDirection('back');
    if (view === 'symptoms') {
      setView('question');
      return;
    }
    if (view === 'capture-context') {
      setView('question');
      return;
    }
    if (step > 1) {
      setStep((current) => (current - 1) as TrialTruthStep);
      return;
    }
    dispatch({ type: 'TRIAL_TRUTH_BACK' });
  }, [dispatch, step, view]);

  useEffect(() => {
    questionRef.current?.focus({ preventScroll: true });
  }, [step, view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      goBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBack]);

  if (state.stage !== 'followup_context' || !product) return null;

  const productIdentity = oracleSpecimenIdentityFromRegisteredProduct(product);
  const compactProductIdentity = [
    product.accession,
    [product.productName, product.strength].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

  const controlEnabled =
    view === 'symptoms'
      ? draft.tolerance === 'mild' || draft.symptoms.length > 0
      : view === 'capture-context'
        ? true
        : step === 1
          ? draft.adherence !== null
          : step === 2
            ? toleranceReady(draft)
            : step === 3
              ? draft.visibleChange !== null
              : captureCheckComplete;
  const controlLabel =
    view === 'symptoms'
      ? 'SAVE SIGNS'
      : view === 'capture-context'
        ? 'SAVE CONTEXT'
        : step === 4
          ? 'SEE RESULT'
          : 'CONTINUE';
  const controlAccessibleLabel =
    view === 'symptoms'
      ? 'Save signs'
      : view === 'capture-context'
        ? 'Save capture context'
        : step === 1
          ? 'Continue to skin response'
          : step === 2
            ? 'Continue to visible redness'
            : step === 3
              ? 'Continue to capture check'
              : 'See result';

  const advance = () => {
    if (!controlEnabled) return;
    setMotionDirection('forward');
    if (view === 'symptoms') {
      setView('question');
      return;
    }
    if (view === 'capture-context') {
      setCaptureContext({ ...captureContextDraft });
      setCaptureCheckChoice('context');
      setCaptureCheckComplete(true);
      setView('question');
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (!generationId) return;
    if (finalSubmitRef.current) return;
    finalSubmitRef.current = true;
    if (!truthCommitted) {
      dispatch({
        type: 'TRIAL_TRUTH_SUBMITTED',
        generationId,
        now: systemClock.now(),
      });
    }
    dispatch({
      type: 'CAPTURE_CONTEXT_RECORDED',
      kind: 'followup',
      context: captureContext,
    });
  };

  const firmware = (
    <div
      key={`${step}-${view}`}
      className={styles.firmwarePanel}
      data-trial-truth-firmware-view={view}
      data-motion-direction={motionDirection}
    >
      <header className={styles.firmwareHeader}>
        <span>{step === 4 ? 'CAPTURE CHECK · OPTIONAL' : 'FOLLOW-UP SECURED'}</span>
        {step !== 4 && <span>{step} / 3</span>}
      </header>
      <p
        className={styles.productIdentity}
        aria-label={`Registered product: ${oracleSpecimenIdentityLabel(productIdentity)}`}
        data-trial-truth-product-identity
      >
        <span aria-hidden="true">{compactProductIdentity}</span>
      </p>

      {view === 'symptoms' ? (
        <section className={styles.symptomSubview} aria-labelledby="trial-truth-symptom-heading">
          <div className={styles.symptomSubviewHeading}>
            <h1 id="trial-truth-symptom-heading" ref={questionRef} tabIndex={-1}>
              What did you notice?
            </h1>
            <p>Choose all that apply.</p>
          </div>
          <fieldset className={styles.symptomSelector}>
            <legend className={styles.srOnly}>What did you notice?</legend>
            <div className={styles.symptomScroller} data-trial-truth-symptom-scroller>
              {IRRITATION_SIGNALS.map((symptom) => (
                <label key={symptom} className={styles.symptomOption}>
                  <input
                    type="checkbox"
                    checked={draft.symptoms.includes(symptom)}
                    onChange={() => dispatch({ type: 'TRIAL_TRUTH_SYMPTOM_TOGGLED', symptom })}
                  />
                  <span>{symptomLabels[symptom]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {symptomsRequired(draft.tolerance) && draft.symptoms.length === 0 && (
            <p className={styles.symptomRequirement} role="status">
              Choose at least one.
            </p>
          )}
        </section>
      ) : view === 'capture-context' ? (
        <section className={styles.contextSubview} aria-labelledby="trial-truth-context-heading">
          <div className={styles.contextSubviewHeading}>
            <h1 id="trial-truth-context-heading" ref={questionRef} tabIndex={-1}>
              What was different?
            </h1>
            <p>Choose any that apply.</p>
          </div>
          <div className={styles.contextScroller} data-trial-truth-context-scroller>
            <CaptureContextFields
              context={captureContextDraft}
              onChange={setCaptureContextDraft}
              optionsClassName={styles.contextOptions}
              noteClassName={styles.contextNote}
              noteLabel="Optional note"
            />
          </div>
        </section>
      ) : (
        <section
          className={styles.questionView}
          data-trial-truth-question-step={step}
          data-trial-truth-has-summary={
            step === 2 && draft.tolerance !== null && draft.tolerance !== 'none' ? '' : undefined
          }
        >
          {step === 1 && (
            <>
              <h1 id="trial-truth-adherence-heading" ref={questionRef} tabIndex={-1}>
                Did you use it as planned?
              </h1>
              <fieldset className={styles.segmentedGroup}>
                <legend className={styles.srOnly}>Did you use it as planned?</legend>
                <div className={styles.segments} data-segment-count="3">
                  {adherenceOptions.map(([value, label]) => (
                    <label key={value} className={styles.segment}>
                      <input
                        type="radio"
                        name="trial-truth-adherence"
                        value={value}
                        checked={draft.adherence === value}
                        onChange={() =>
                          dispatch({ type: 'TRIAL_TRUTH_ADHERENCE_SELECTED', answer: value })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className={styles.helper}>
                This helps Face Value judge whether the product was isolated.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 id="trial-truth-tolerance-heading" ref={questionRef} tabIndex={-1}>
                How did your skin respond?
              </h1>
              <fieldset className={styles.segmentedGroup}>
                <legend className={styles.srOnly}>How did your skin respond?</legend>
                <div className={styles.segments} data-segment-count="4">
                  {toleranceOptions.map(([value, label]) => (
                    <label key={value} className={styles.segment}>
                      <input
                        type="radio"
                        name="trial-truth-tolerance"
                        value={value}
                        checked={draft.tolerance === value}
                        onChange={() =>
                          dispatch({ type: 'TRIAL_TRUTH_TOLERANCE_SELECTED', answer: value })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {draft.tolerance !== null && draft.tolerance !== 'none' && (
                <button
                  type="button"
                  className={styles.symptomSummary}
                  aria-label={`${selectedSymptomLabels.length > 0 ? 'Edit' : 'Add'} reported symptoms`}
                  onClick={() => {
                    setMotionDirection('forward');
                    setView('symptoms');
                  }}
                >
                  <span>
                    <b>WHAT DID YOU NOTICE?</b>
                    {selectedSymptomLabels.length > 0 && (
                      <small>{selectedSymptomLabels.join(' · ')}</small>
                    )}
                  </span>
                  <strong>{selectedSymptomLabels.length > 0 ? 'EDIT' : 'ADD'}</strong>
                </button>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 id="trial-truth-visible-change-heading" ref={questionRef} tabIndex={-1}>
                <span>Compared with the start of this trial,</span>
                <span>your visible redness looks:</span>
              </h1>
              <fieldset className={styles.segmentedGroup}>
                <legend className={styles.srOnly}>
                  Compared with the start of this trial, your visible redness looks
                </legend>
                <div className={styles.segments} data-segment-count="3">
                  {visibleChangeOptions.map(([value, label]) => (
                    <label key={value} className={styles.segment}>
                      <input
                        type="radio"
                        name="trial-truth-visible-change"
                        value={value}
                        checked={draft.visibleChange === value}
                        onChange={() =>
                          dispatch({
                            type: 'TRIAL_TRUTH_VISIBLE_CHANGE_SELECTED',
                            answer: value,
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className={styles.helper}>Face Value cannot diagnose a reaction.</p>
            </>
          )}

          {step === 4 && (
            <>
              <h1 id="trial-truth-capture-check-heading" ref={questionRef} tabIndex={-1}>
                Anything different around today’s scan?
              </h1>
              {captureCheckComplete && captureCheckChoice === 'context' ? (
                <button
                  type="button"
                  className={styles.contextSummary}
                  aria-label="Edit capture context"
                  onClick={() => {
                    setMotionDirection('forward');
                    setView('capture-context');
                  }}
                >
                  <span>
                    <b>CAPTURE CONTEXT</b>
                    <small>
                      {selectedCaptureContextLabels.length > 0
                        ? selectedCaptureContextLabels.join(' · ')
                        : 'Nothing different'}
                    </small>
                  </span>
                  <strong>EDIT</strong>
                </button>
              ) : (
                <div
                  className={styles.captureChoices}
                  data-trial-truth-capture-choices
                  role="group"
                  aria-label="Anything different around today’s scan?"
                >
                  <button
                    type="button"
                    data-selected={captureCheckChoice === 'nothing' || undefined}
                    onClick={() => {
                      const emptyContext = emptyCaptureContext();
                      setCaptureContextDraft(emptyContext);
                      setCaptureContext(emptyContext);
                      setCaptureCheckChoice('nothing');
                      setCaptureCheckComplete(true);
                    }}
                  >
                    NOTHING DIFFERENT
                  </button>
                  <button
                    type="button"
                    data-selected={captureCheckChoice === 'context' || undefined}
                    onClick={() => {
                      setMotionDirection('forward');
                      setCaptureCheckChoice('context');
                      setCaptureCheckComplete(false);
                      setView('capture-context');
                    }}
                  >
                    ADD CONTEXT
                  </button>
                </div>
              )}
              <p className={styles.helper}>Optional context the camera cannot see.</p>
            </>
          )}
        </section>
      )}

      {state.trialTruthValidation && !state.trialTruthValidation.valid && (
        <p className={styles.validation} role="alert">
          {state.trialTruthValidation.messages[0]}
        </p>
      )}
    </div>
  );

  return (
    <EvidenceShell tone="light" label="Face Value trial truth">
      <ScreenHeader />
      <section className={styles.screen} data-fv-screen="trial-truth">
        <div className={styles.machineStage}>
          <OracleTrialTruthMachine
            product={product}
            step={step}
            view={view}
            firmware={firmware}
            controlLabel={controlLabel}
            controlAccessibleLabel={controlAccessibleLabel}
            controlEnabled={controlEnabled}
            onControl={advance}
          />
        </div>
        <div className={styles.backSlot}>
          {(view !== 'question' || (step > 1 && !(step === 4 && truthCommitted))) && (
            <button type="button" className={styles.back} onClick={goBack}>
              {view === 'symptoms'
                ? 'Back to skin response'
                : view === 'capture-context'
                  ? 'Back to capture check'
                  : 'Back'}
            </button>
          )}
        </div>
      </section>
    </EvidenceShell>
  );
}
