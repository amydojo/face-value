import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RegisteredProduct } from '../../domain/model';
import { FOLLOW_UP_INTERVAL_DAYS } from '../../domain/phaseB5';
import { OracleTrialStateMachine } from '../oracle-reveal/OracleRevealScene';
import styles from './CanonicalTrialChassis.module.css';

export type CanonicalTrialMode =
  | 'baseline-context'
  | 'baseline-locked'
  | 'comparison';

export function CanonicalTrialChassis({
  product,
  mode,
  ariaLabel,
  day = 1,
  intervalDays = FOLLOW_UP_INTERVAL_DAYS,
  children,
}: {
  product: RegisteredProduct;
  mode: CanonicalTrialMode;
  ariaLabel: string;
  day?: number;
  intervalDays?: number;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const machine = root.querySelector<HTMLElement>('[data-oracle-machine]');
    const target = root.querySelector<HTMLElement>('[data-oracle-trial-display]');
    if (machine) {
      machine.setAttribute('aria-label', ariaLabel);
      machine.setAttribute('data-canonical-trial-mode', mode);
    }
    setDisplay(target);
  }, [ariaLabel, mode]);

  return (
    <div ref={rootRef} className={styles.root} data-canonical-trial-chassis={mode}>
      <OracleTrialStateMachine
        state="pending"
        product={product}
        day={day}
        intervalDays={intervalDays}
      />
      {display &&
        createPortal(
          <div className={styles.firmware} data-canonical-trial-firmware data-mode={mode}>
            {children}
          </div>,
          display,
        )}
    </div>
  );
}
