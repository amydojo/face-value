import { useEffect, useState } from 'react';
import { CAPTURE_TIMING } from './constants';

export type AnalysisWaitPresentationPhase = 'scan-complete' | 'analysis' | 'confirmed' | null;

interface TimedPresentation {
  generationId: string | null;
  phase: Exclude<AnalysisWaitPresentationPhase, 'scan-complete' | null> | null;
  measurement: number | null;
  enteredAt: number;
}

const idlePresentation: TimedPresentation = {
  generationId: null,
  phase: null,
  measurement: null,
  enteredAt: 0,
};

const runtimeNow = (): number =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

export interface AnalysisWaitPresentation {
  phase: AnalysisWaitPresentationPhase;
  measurement: number | null;
  completedCount: number;
}

/**
 * Runtime-only legibility timing. Reducer/provider facts are inputs and this
 * hook can only trail them; it never creates analysis completion.
 */
export function useAnalysisWaitPresentation({
  active,
  generationId,
  scanCompleteDwellFinished,
  activeMeasurement,
  allMeasurementsComplete,
  evidenceCommitted,
  onPresentationComplete,
}: {
  active: boolean;
  generationId: string | null;
  scanCompleteDwellFinished: boolean;
  activeMeasurement: number | null;
  allMeasurementsComplete: boolean;
  evidenceCommitted: boolean;
  onPresentationComplete: (generationId: string) => void;
}): AnalysisWaitPresentation {
  const [timed, setTimed] = useState<TimedPresentation>(idlePresentation);

  useEffect(() => {
    if (active) return;
    setTimed((current) =>
      current.generationId === null && current.phase === null ? current : idlePresentation,
    );
  }, [active]);

  useEffect(() => {
    if (!active || !generationId || !scanCompleteDwellFinished) return;

    const target = allMeasurementsComplete
      ? ({ phase: 'confirmed', measurement: null } as const)
      : activeMeasurement !== null
        ? ({ phase: 'analysis', measurement: activeMeasurement } as const)
        : null;
    if (!target) return;

    const enteredAt = runtimeNow();
    if (timed.generationId !== generationId || timed.phase === null) {
      setTimed({ generationId, ...target, enteredAt });
      return;
    }
    if (timed.phase === 'confirmed') return;
    if (target.phase === 'analysis' && target.measurement <= (timed.measurement ?? 0)) return;

    const remaining = Math.max(
      0,
      CAPTURE_TIMING.analysisProgressMinimumMs - (enteredAt - timed.enteredAt),
    );
    const advance = () => {
      setTimed((current) => {
        if (
          current.generationId !== generationId ||
          current.phase !== 'analysis' ||
          (target.phase === 'analysis' && target.measurement <= (current.measurement ?? 0))
        ) {
          return current;
        }
        return {
          generationId,
          ...target,
          enteredAt: runtimeNow(),
        };
      });
    };
    if (remaining === 0) {
      advance();
      return;
    }
    const timer = window.setTimeout(advance, remaining);
    return () => window.clearTimeout(timer);
  }, [
    active,
    activeMeasurement,
    allMeasurementsComplete,
    generationId,
    scanCompleteDwellFinished,
    timed,
  ]);

  useEffect(() => {
    if (
      !active ||
      !generationId ||
      !evidenceCommitted ||
      timed.generationId !== generationId ||
      timed.phase !== 'confirmed'
    ) {
      return;
    }
    const remaining = Math.max(
      0,
      CAPTURE_TIMING.analysisConfirmationHoldMs - (runtimeNow() - timed.enteredAt),
    );
    const timer = window.setTimeout(() => onPresentationComplete(generationId), remaining);
    return () => window.clearTimeout(timer);
  }, [active, evidenceCommitted, generationId, onPresentationComplete, timed]);

  if (!active) return { phase: null, measurement: null, completedCount: 0 };
  if (!scanCompleteDwellFinished || timed.generationId !== generationId || timed.phase === null) {
    return { phase: 'scan-complete', measurement: null, completedCount: 0 };
  }
  if (timed.phase === 'confirmed') {
    return { phase: 'confirmed', measurement: null, completedCount: 3 };
  }
  const measurement = Math.min(3, Math.max(1, timed.measurement ?? 1));
  return {
    phase: 'analysis',
    measurement,
    completedCount: measurement - 1,
  };
}
