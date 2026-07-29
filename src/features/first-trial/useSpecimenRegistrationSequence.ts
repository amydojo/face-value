import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  specimenRegistrationPhases,
  specimenRegistrationTiming,
  type SpecimenRegistrationPhase,
  type SpecimenRegistrationSnapshot,
  type SpecimenRegistrationTiming,
} from '../../domain/specimenRegistration';

const announcementForPhase: Partial<Record<SpecimenRegistrationPhase, string>> = {
  preparing: 'Preparing specimen registration.',
  scanning: 'Registering specimen.',
  verified: 'Specimen verified.',
  ready: 'Ready to take guided baseline.',
};

type SequenceState = {
  registrationId: string | null;
  phase: SpecimenRegistrationPhase;
  scanProgress: number;
  announcement: string;
};

type SequenceAction =
  | { type: 'start'; registrationId: string }
  | { type: 'phase'; registrationId: string; phase: SpecimenRegistrationPhase }
  | { type: 'scan-progress'; registrationId: string; progress: number }
  | { type: 'reset'; phase: 'idle' | 'ready' };

type ActiveSequence = {
  registrationId: string;
  generation: number;
  controller: AbortController;
  phaseTimer: number | null;
  scanTimer: number | null;
};

function initialSequenceState(initiallyReady: boolean): SequenceState {
  return {
    registrationId: null,
    phase: initiallyReady ? 'ready' : 'idle',
    scanProgress: initiallyReady ? 1 : 0,
    announcement: '',
  };
}

function sequenceReducer(state: SequenceState, action: SequenceAction): SequenceState {
  switch (action.type) {
    case 'start':
      return {
        registrationId: action.registrationId,
        phase: 'preparing',
        scanProgress: 0,
        announcement: announcementForPhase.preparing ?? '',
      };
    case 'phase':
      if (state.registrationId !== action.registrationId) return state;
      return {
        ...state,
        phase: action.phase,
        scanProgress: action.phase === 'ready' ? 1 : state.scanProgress,
        announcement: announcementForPhase[action.phase] ?? state.announcement,
      };
    case 'scan-progress':
      if (state.registrationId !== action.registrationId || state.phase !== 'scanning') {
        return state;
      }
      return {
        ...state,
        scanProgress: Math.max(0, Math.min(1, action.progress)),
      };
    case 'reset':
      return initialSequenceState(action.phase === 'ready');
  }
}

function clearActiveTimers(active: ActiveSequence) {
  if (active.phaseTimer !== null) window.clearTimeout(active.phaseTimer);
  if (active.scanTimer !== null) window.clearInterval(active.scanTimer);
  active.phaseTimer = null;
  active.scanTimer = null;
}

function registrationScanEasing(progress: number): number {
  const x = Math.max(0, Math.min(1, progress));
  const coordinate = (time: number, firstControl: number, secondControl: number) => {
    const inverse = 1 - time;
    return (
      3 * inverse * inverse * time * firstControl +
      3 * inverse * time * time * secondControl +
      time * time * time
    );
  };

  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const candidate = (lower + upper) / 2;
    if (coordinate(candidate, 0.32, 0.11) < x) lower = candidate;
    else upper = candidate;
  }
  return coordinate((lower + upper) / 2, 0, 1);
}

export interface SpecimenRegistrationSequence {
  phase: SpecimenRegistrationPhase;
  scanProgress: number;
  isRegistering: boolean;
  isVerified: boolean;
  isReady: boolean;
  announcement: string;
  registration: SpecimenRegistrationSnapshot;
  start(registrationId: string): void;
  cancel(nextPhase?: 'idle' | 'ready'): void;
}

export function useSpecimenRegistrationSequence({
  initiallyReady,
  reducedMotion,
  onReady,
}: {
  initiallyReady: boolean;
  reducedMotion: boolean;
  onReady?: () => void;
}): SpecimenRegistrationSequence {
  const [state, dispatch] = useReducer(sequenceReducer, initiallyReady, initialSequenceState);
  const activeRef = useRef<ActiveSequence | null>(null);
  const generationRef = useRef(0);
  const completedRegistrationRef = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const abortActive = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    active.controller.abort();
    clearActiveTimers(active);
  }, []);

  const cancel = useCallback(
    (nextPhase: 'idle' | 'ready' = 'idle') => {
      generationRef.current += 1;
      abortActive();
      dispatch({ type: 'reset', phase: nextPhase });
    },
    [abortActive],
  );

  const start = useCallback(
    (registrationId: string) => {
      const normalizedRegistrationId = registrationId.trim();
      if (
        !normalizedRegistrationId ||
        activeRef.current?.registrationId === normalizedRegistrationId ||
        completedRegistrationRef.current === normalizedRegistrationId
      ) {
        return;
      }

      abortActive();
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const controller = new AbortController();
      const timing: SpecimenRegistrationTiming = reducedMotion
        ? specimenRegistrationTiming.reduced
        : specimenRegistrationTiming.normal;
      const active: ActiveSequence = {
        registrationId: normalizedRegistrationId,
        generation,
        controller,
        phaseTimer: null,
        scanTimer: null,
      };
      activeRef.current = active;
      dispatch({ type: 'start', registrationId: normalizedRegistrationId });

      const isCurrent = () =>
        !controller.signal.aborted &&
        activeRef.current === active &&
        generationRef.current === generation;

      const stopScanProgress = () => {
        if (active.scanTimer !== null) window.clearInterval(active.scanTimer);
        active.scanTimer = null;
      };

      const startScanProgress = () => {
        const startedAt = Date.now();
        const scanDuration = timing.scanning;
        stopScanProgress();
        active.scanTimer = window.setInterval(() => {
          if (!isCurrent()) {
            stopScanProgress();
            return;
          }
          dispatch({
            type: 'scan-progress',
            registrationId: normalizedRegistrationId,
            progress: registrationScanEasing((Date.now() - startedAt) / scanDuration),
          });
        }, 16);
      };

      const enterPhase = (index: number) => {
        if (!isCurrent()) return;
        const phase = specimenRegistrationPhases[index];
        const duration = timing[phase];

        if (phase === 'scanning') startScanProgress();

        active.phaseTimer = window.setTimeout(() => {
          active.phaseTimer = null;
          if (!isCurrent()) return;

          if (phase === 'scanning') {
            stopScanProgress();
            dispatch({
              type: 'scan-progress',
              registrationId: normalizedRegistrationId,
              progress: 1,
            });
          }

          const nextPhase: SpecimenRegistrationPhase =
            index + 1 < specimenRegistrationPhases.length
              ? specimenRegistrationPhases[index + 1]
              : 'ready';
          dispatch({
            type: 'phase',
            registrationId: normalizedRegistrationId,
            phase: nextPhase,
          });

          if (nextPhase === 'ready') {
            clearActiveTimers(active);
            activeRef.current = null;
            completedRegistrationRef.current = normalizedRegistrationId;
            onReadyRef.current?.();
            return;
          }

          enterPhase(index + 1);
        }, duration);
      };

      enterPhase(0);
    },
    [abortActive, reducedMotion],
  );

  useEffect(
    () => () => {
      generationRef.current += 1;
      abortActive();
    },
    [abortActive],
  );

  const isReady = state.phase === 'ready';
  const isVerified = state.phase === 'verified' || isReady;
  const isRegistering = !['idle', 'ready'].includes(state.phase);

  return {
    phase: state.phase,
    scanProgress: state.scanProgress,
    isRegistering,
    isVerified,
    isReady,
    announcement: state.announcement,
    registration: {
      registrationId: state.registrationId,
      phase: state.phase,
      scanProgress: state.scanProgress,
      isRegistering,
      isVerified,
      isReady,
      reducedMotion,
    },
    start,
    cancel,
  };
}
