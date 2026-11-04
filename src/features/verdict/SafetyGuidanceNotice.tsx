import { useId } from 'react';
import type { SafetyGuidance } from './safetyGuidance';
import styles from './SafetyGuidanceNotice.module.css';

/** Always-visible result guidance. Its title carries the meaning; colour only reinforces it. */
export function SafetyGuidanceNotice({ guidance, id }: { guidance: SafetyGuidance; id?: string }) {
  const titleId = useId();
  return (
    <section
      id={id}
      role="note"
      aria-labelledby={titleId}
      className={styles.notice}
      data-safety-guidance={guidance.kind}
      data-tone={guidance.tone}
    >
      <strong id={titleId}>{guidance.title}</strong>
      {guidance.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {guidance.actionMeaning && <small>{guidance.actionMeaning}</small>}
    </section>
  );
}
