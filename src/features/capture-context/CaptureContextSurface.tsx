import { useMemo, useState } from 'react';
import type { CaptureContext, CaptureKind } from '../../domain/model';
import { emptyCaptureContext, hasMeaningfulCaptureContext } from '../../domain/phaseB5';
import styles from '../../styles/FaceValue.module.css';
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
  const [context, setContext] = useState<CaptureContext>(emptyCaptureContext);
  const changed = useMemo(() => hasMeaningfulCaptureContext(context), [context]);

  return (
    <section className={styles.contextScreen} data-fv-screen={`${kind}-context`}>
      <p className={styles.eyebrow}>
        {kind === 'baseline' ? 'BASELINE SECURED' : 'FOLLOW-UP SECURED'}
      </p>
      <h1 data-stage-focus tabIndex={-1}>
        Anything meaningfully different today?
      </h1>
      <p>Face Value asks only about context the camera cannot see. This is optional.</p>

      <div className={styles.contextDefault} data-selected={!changed || undefined}>
        <span aria-hidden="true">{changed ? '○' : '●'}</span>
        <strong>Nothing different</strong>
      </div>

      <CaptureContextFields context={context} onChange={setContext} />

      <button type="button" className={styles.primaryAction} onClick={() => onContinue(context)}>
        <span>{changed ? 'SAVE CONTEXT' : 'NOTHING DIFFERENT'}</span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
