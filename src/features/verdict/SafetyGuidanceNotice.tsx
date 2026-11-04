import { useId } from 'react';
import type { SafetyGuidance } from './safetyGuidance';
import styles from './SafetyGuidanceNotice.module.css';

/** The Oracle's page headline. On a safety result it carries the guidance title. */
export const RESULT_HEADLINE_ID = 'oracle-result-headline';

/**
 * Always-visible result guidance. Its title carries the meaning; colour only reinforces it.
 * When the page headline already shows the title (`headlineId`), the note is labelled by that
 * headline and does not repeat it.
 */
export function SafetyGuidanceNotice({
  guidance,
  id,
  headlineId,
}: {
  guidance: SafetyGuidance;
  id?: string;
  headlineId?: string;
}) {
  const titleId = useId();
  return (
    <section
      id={id}
      role="note"
      aria-labelledby={headlineId ?? titleId}
      className={styles.notice}
      data-safety-guidance={guidance.kind}
      data-tone={guidance.tone}
    >
      {!headlineId && <strong id={titleId}>{guidance.title}</strong>}
      {guidance.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {guidance.actionMeaning && <small>{guidance.actionMeaning}</small>}
    </section>
  );
}
