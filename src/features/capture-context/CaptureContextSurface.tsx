import { useMemo, useState } from 'react';
import { useFaceValue } from '../../app/faceValueContext';
import type { CaptureContext, CaptureKind } from '../../domain/model';
import { emptyCaptureContext, hasMeaningfulCaptureContext } from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';
import instrumentStyles from './CaptureContextSurface.module.css';
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
          rows={3}
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
  const compactIdentity = product
    ? [
        product.accession,
        product.brand,
        [product.productName, product.strength].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(' · ')
    : 'REGISTERED SPECIMEN';

  return (
    <section
      className={instrumentStyles.screen}
      data-fv-screen={`${kind}-context`}
      data-capture-context-instrument
      aria-labelledby={`${kind}-context-heading`}
    >
      <article className={instrumentStyles.machine} data-context-machine data-context-kind={kind}>
        <div className={instrumentStyles.display} data-context-machine-display>
          <div className={instrumentStyles.firmware}>
            <header className={instrumentStyles.header}>
              <strong>{securedLabel}</strong>
              <span>CAPTURE CONTEXT</span>
            </header>

            <div className={instrumentStyles.identity}>
              <div className={instrumentStyles.identityCopy}>
                <span>SPECIMEN / TRIAL</span>
                <strong title={compactIdentity}>{compactIdentity}</strong>
              </div>
              <i className={instrumentStyles.specimen} aria-hidden="true" />
            </div>

            <h1 id={`${kind}-context-heading`} className={instrumentStyles.question} data-stage-focus tabIndex={-1}>
              Anything meaningfully different today?
            </h1>
            <p className={instrumentStyles.helper}>
              Qualify what the camera cannot see. This context is optional.
            </p>

            <div className={instrumentStyles.defaultState} data-selected={!changed || undefined}>
              <i aria-hidden="true" />
              <strong>NOTHING DIFFERENT</strong>
            </div>

            <CaptureContextFields
              context={context}
              onChange={setContext}
              optionsClassName={instrumentStyles.options}
              noteClassName={instrumentStyles.note}
              noteLabel="Optional context"
            />
          </div>
        </div>

        <div className={instrumentStyles.deck} data-context-machine-deck>
          <button type="button" onClick={() => onContinue(context)}>
            <span>{changed ? 'SAVE CONTEXT' : 'NOTHING DIFFERENT'}</span>
          </button>
        </div>
      </article>
    </section>
  );
}
