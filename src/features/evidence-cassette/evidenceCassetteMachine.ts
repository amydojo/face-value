export type EvidenceCassetteState =
  | 'sealed'
  | 'pressing'
  | 'released'
  | 'tilting'
  | 'settled'
  | 'clearing'
  | 'presented'
  | 'closing';

export type EvidenceCassetteEvent =
  | { type: 'ACTIVATE' }
  | { type: 'PRESS_COMPLETE' }
  | { type: 'RELEASE_COMPLETE' }
  | { type: 'TILT_COMPLETE' }
  | { type: 'SETTLE_COMPLETE' }
  | { type: 'GLASS_COMPLETE' }
  | { type: 'CLOSE_COMPLETE' }
  | { type: 'REDUCED_RELEASE_COMPLETE' }
  | { type: 'FORCE_STATE'; state: EvidenceCassetteState };

export interface CassetteStep {
  delay: number;
  event: EvidenceCassetteEvent;
}

export const cassetteTimings = {
  normal: {
    press: 80,
    latchAndPause: 140,
    tilt: 200,
    settleAndGlassPause: 160,
    glass: 320,
    close: 460,
  },
  reduced: {
    press: 80,
    release: 160,
    clear: 160,
    close: 300,
  },
} as const;

export function evidenceCassetteReducer(
  state: EvidenceCassetteState,
  event: EvidenceCassetteEvent,
): EvidenceCassetteState {
  if (event.type === 'FORCE_STATE') return event.state;

  switch (event.type) {
    case 'ACTIVATE':
      if (state === 'sealed') return 'pressing';
      if (state === 'presented') return 'closing';
      return state;
    case 'PRESS_COMPLETE':
      return state === 'pressing' ? 'released' : state;
    case 'RELEASE_COMPLETE':
      return state === 'released' ? 'tilting' : state;
    case 'REDUCED_RELEASE_COMPLETE':
      return state === 'released' ? 'clearing' : state;
    case 'TILT_COMPLETE':
      return state === 'tilting' ? 'settled' : state;
    case 'SETTLE_COMPLETE':
      return state === 'settled' ? 'clearing' : state;
    case 'GLASS_COMPLETE':
      return state === 'clearing' ? 'presented' : state;
    case 'CLOSE_COMPLETE':
      return state === 'closing' ? 'sealed' : state;
    default:
      return state;
  }
}

export function nextCassetteStep(
  state: EvidenceCassetteState,
  reducedMotion: boolean,
): CassetteStep | null {
  if (reducedMotion) {
    switch (state) {
      case 'pressing':
        return { delay: cassetteTimings.reduced.press, event: { type: 'PRESS_COMPLETE' } };
      case 'released':
        return {
          delay: cassetteTimings.reduced.release,
          event: { type: 'REDUCED_RELEASE_COMPLETE' },
        };
      case 'clearing':
        return { delay: cassetteTimings.reduced.clear, event: { type: 'GLASS_COMPLETE' } };
      case 'closing':
        return { delay: cassetteTimings.reduced.close, event: { type: 'CLOSE_COMPLETE' } };
      default:
        return null;
    }
  }

  switch (state) {
    case 'pressing':
      return { delay: cassetteTimings.normal.press, event: { type: 'PRESS_COMPLETE' } };
    case 'released':
      return {
        delay: cassetteTimings.normal.latchAndPause,
        event: { type: 'RELEASE_COMPLETE' },
      };
    case 'tilting':
      return { delay: cassetteTimings.normal.tilt, event: { type: 'TILT_COMPLETE' } };
    case 'settled':
      return {
        delay: cassetteTimings.normal.settleAndGlassPause,
        event: { type: 'SETTLE_COMPLETE' },
      };
    case 'clearing':
      return { delay: cassetteTimings.normal.glass, event: { type: 'GLASS_COMPLETE' } };
    case 'closing':
      return { delay: cassetteTimings.normal.close, event: { type: 'CLOSE_COMPLETE' } };
    default:
      return null;
  }
}

export function isCassetteBusy(state: EvidenceCassetteState) {
  return state !== 'sealed' && state !== 'presented';
}

export function isMechanicallySettled(state: EvidenceCassetteState) {
  return state === 'settled' || state === 'clearing' || state === 'presented';
}
