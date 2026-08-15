import { useMemo, useState, type RefObject } from 'react';
import {
  oracleSpecimenIdentityFromRegisteredProduct,
  oracleSpecimenIdentityLabel,
} from '../../adapters/product/specimenFromRegisteredProduct';
import { useFaceValue } from '../../app/faceValueContext';
import type { CaptureContext, CaptureKind } from '../../domain/model';
import { emptyCaptureContext, hasMeaningfulCaptureContext } from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';
import { OracleTrialTruthMachine } from '../oracle-reveal/OracleRevealScene';
import instrumentStyles from '../trial-truth/TrialTruthSurface.module.css';
import { CAPTURE_CONTEXT_OPTIONS } from './captureContextOptions';

export function CaptureContextFields({
  context,
  onChange,
  optionsClassName = styles.contextOptions,
  noteClassName = styles.contextNote,
  noteLabel = 'Add context',
}: {
  context: CaptureContext;
  onChange(context: CaptureContext): void;
  optionsClassName?: string;
  noteClassName?: string;
  noteLabel?: string;
}) {
  return (
    <>
      <fieldset className={optionsClassName}>
        <legend>Optional context</legend>
        {CAPTURE_CONTEXT_OPTIONS.map((option) => (
          <label key={option.key}>
            <input
              type="checkbox"
              checked={context[option.key]}
              onChange={(event) =>
                onChange({
                  ...context,
                  [option.key]: event.target.checked,
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <label className={noteClassName}>
        <span>{noteLabel}</span>
        <textarea
          rows={2}
          maxLength={240}
          value={context.note ?? ''}
          placeholder="Optional note"
          onChange={(event) =>
            onChange({
              ...context,
              note: event.target.value || null,
            })
          }
        />
      </label>
    </>
  );
}

export function CaptureContextQuestion({
  context,
  headingId,
  headingRef,
  productIdentity,
  productAccessibleLabel,
  statusLabel,
  detailLabel,
  question,
  helper,
  motionDirection = 'forward',
  onChange,
}: {
  context: CaptureContext;
  headingId: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  productIdentity: string;
  productAccessibleLabel: string;
  statusLabel: string;
  detailLabel?: string;
  question: string;
  helper: string;
  motionDirection?: 'forward' | 'back';
  onChange(context: CaptureContext): void;
}) {
  return (
    <div
      className={instrumentStyles.firmwarePanel}
      data-trial-truth-firmware-view="capture-context"
      data-motion-direction={motionDirection}
      data-capture-context-question
    >
      <header className={instrumentStyles.firmwareHeader}>
        <span>{statusLabel}</span>
        {detailLabel ? <span>{detailLabel}</span> : null}
      </header>
      <p
        className={instrumentStyles.productIdentity}
        aria-label={`Registered product: ${productAccessibleLabel}`}
        data-trial-truth-product-identity
      >
        <span aria-hidden="true">{productIdentity}</span>
      </p>
      <section className={instrumentStyles.contextSubview} aria-labelledby={headingId}>
        <div className={instrumentStyles.contextSubviewHeading}>
          <h1 id={headingId} ref={headingRef} data-stage-focus tabIndex={-1}>
            {question}
          </h1>
          <p>{helper}</p>
        </div>
        <div className={instrumentStyles.contextScroller} data-trial-truth-context-scroller>
          <CaptureContextFields
            context={context}
            onChange={onChange}
            optionsClassName={instrumentStyles.contextOptions}
            noteClassName={instrumentStyles.contextNote}
            noteLabel="Optional note"
          />
        </div>
      </section>
    </div>
  );
}

export function CaptureContextSurface({
  kind,
  onContinue,
}: {
  kind: CaptureKind;
  onContinue(context: CaptureContext): void;
}) {
  const { state } = useFaceValue();
  const [context, setContext] = useState<CaptureContext>(emptyCaptureContext);
  const changed = useMemo(() => hasMeaningfulCaptureContext(context), [context]);
  const product = state.registeredProduct;
  const securedLabel = kind === 'baseline' ? 'BASELINE SECURED' : 'FOLLOW-UP SECURED';

  if (!product) return null;

  const productIdentity = oracleSpecimenIdentityFromRegisteredProduct(product);
  const compactIdentity = [
    product.accession,
    [product.productName, product.strength].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');
  const controlLabel = changed ? 'SAVE CONTEXT' : 'NOTHING DIFFERENT';

  return (
    <section
      className={instrumentStyles.screen}
      data-fv-screen={`${kind}-context`}
      data-capture-context-instrument
      aria-labelledby={`${kind}-context-heading`}
    >
      <div className={instrumentStyles.machineStage}>
        <OracleTrialTruthMachine
          product={product}
          step={4}
          view="capture-context"
          firmware={
            <CaptureContextQuestion
              context={context}
              headingId={`${kind}-context-heading`}
              productIdentity={compactIdentity}
              productAccessibleLabel={oracleSpecimenIdentityLabel(productIdentity)}
              statusLabel={securedLabel}
              detailLabel="CAPTURE CONTEXT"
              question="Anything meaningfully different today?"
              helper="Qualify what the camera cannot see. Optional."
              onChange={setContext}
            />
          }
          controlLabel={controlLabel}
          controlAccessibleLabel={controlLabel}
          controlEnabled
          onControl={() => onContinue(context)}
          machineAccessibleLabel={`${securedLabel}. Capture context for ${oracleSpecimenIdentityLabel(productIdentity)}.`}
        />
      </div>
      <div className={instrumentStyles.backSlot} aria-hidden="true" />
    </section>
  );
}
