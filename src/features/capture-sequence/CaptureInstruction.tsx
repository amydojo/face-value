import type { ReactNode } from 'react';
import type { CaptureInstructionCopy, CapturePhase } from './types';
import styles from './CaptureSequence.module.css';

export function CaptureInstruction({
  copy,
  phase,
  children,
}: {
  copy: CaptureInstructionCopy;
  phase: CapturePhase;
  children?: ReactNode;
}) {
  return (
    <div
      className={styles.instruction}
      data-capture-instruction
      aria-live="polite"
      aria-atomic="true"
      role={phase === 'error' ? 'alert' : undefined}
    >
      <h1 id="camera-heading" data-stage-focus tabIndex={-1}>
        {copy.primary}
      </h1>
      <p>{copy.secondary}</p>
      {children}
    </div>
  );
}
