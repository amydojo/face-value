export type OracleRevealState =
  | 'sealed'
  | 'opening'
  | 'transmitting'
  | 'verdict_revealed'
  | 'committing'
  | 'dispensing'
  | 'collected'
  | 'done';

export type OracleRevealEvent =
  | { type: 'REVEAL_STARTED' }
  | { type: 'REVEAL_PULL_COMPLETED' }
  | { type: 'TRANSMISSION_COMPLETED' }
  | { type: 'RECOMMENDATION_ACCEPTED' }
  | { type: 'DISPENSE_STARTED' }
  | { type: 'EVIDENCE_DISPENSED' }
  | { type: 'EVIDENCE_COLLECTION_STARTED' }
  | { type: 'EVIDENCE_COLLECTED' }
  | { type: 'ORACLE_DONE' };

export type OracleRevealModel = {
  phase: OracleRevealState;
  evidenceDispensed: boolean;
  collectionStarted: boolean;
};

export const initialOracleRevealModel: OracleRevealModel = {
  phase: 'sealed',
  evidenceDispensed: false,
  collectionStarted: false,
};

/**
 * Valid transitions:
 * sealed -> opening -> transmitting -> verdict_revealed -> committing
 * -> dispensing -> collected -> done
 *
 * Dispensing has two guarded mechanical milestones. EVIDENCE_DISPENSED makes
 * the paper collectible; EVIDENCE_COLLECTION_STARTED locks collection before
 * EVIDENCE_COLLECTED crosses the durable persistence boundary. Every duplicate
 * or out-of-order event returns the same model object.
 */
export function oracleRevealReducer(
  model: OracleRevealModel,
  event: OracleRevealEvent,
): OracleRevealModel {
  switch (event.type) {
    case 'REVEAL_STARTED':
      return model.phase === 'sealed'
        ? { ...model, phase: 'opening' }
        : model;
    case 'REVEAL_PULL_COMPLETED':
      return model.phase === 'opening'
        ? { ...model, phase: 'transmitting' }
        : model;
    case 'TRANSMISSION_COMPLETED':
      return model.phase === 'transmitting'
        ? { ...model, phase: 'verdict_revealed' }
        : model;
    case 'RECOMMENDATION_ACCEPTED':
      return model.phase === 'verdict_revealed'
        ? { ...model, phase: 'committing' }
        : model;
    case 'DISPENSE_STARTED':
      return model.phase === 'committing'
        ? {
            ...model,
            phase: 'dispensing',
            evidenceDispensed: false,
            collectionStarted: false,
          }
        : model;
    case 'EVIDENCE_DISPENSED':
      return model.phase === 'dispensing' &&
        !model.evidenceDispensed
        ? { ...model, evidenceDispensed: true }
        : model;
    case 'EVIDENCE_COLLECTION_STARTED':
      return model.phase === 'dispensing' &&
        model.evidenceDispensed &&
        !model.collectionStarted
        ? { ...model, collectionStarted: true }
        : model;
    case 'EVIDENCE_COLLECTED':
      return model.phase === 'dispensing' &&
        model.evidenceDispensed &&
        model.collectionStarted
        ? {
            phase: 'collected',
            evidenceDispensed: false,
            collectionStarted: false,
          }
        : model;
    case 'ORACLE_DONE':
      return model.phase === 'collected'
        ? { ...model, phase: 'done' }
        : model;
    default:
      return model;
  }
}

export const oracleTiming = {
  latchRelease: 80,
  chassisAdvance: 140,
  mechanicalPause: 180,
  displayWarmup: 220,
  transmissionResolve: 650,
  recommendationBeat: 160,
  controlCommit: 90,
  slotSeparate: 70,
  rollerEngage: 90,
  registrationFeed: 140,
  registrationPause: 80,
  paperFeed: 700,
  rollerStop: 40,
  paperSettle: 35,
  collectionLift: 260,
} as const;

export const oracleMotionDuration = {
  opening:
    oracleTiming.latchRelease +
    oracleTiming.chassisAdvance +
    oracleTiming.mechanicalPause,
  transmission:
    oracleTiming.displayWarmup +
    oracleTiming.transmissionResolve +
    oracleTiming.recommendationBeat,
  commit:
    oracleTiming.controlCommit +
    oracleTiming.slotSeparate +
    oracleTiming.rollerEngage,
  dispense:
    oracleTiming.registrationFeed +
    oracleTiming.registrationPause +
    oracleTiming.paperFeed +
    oracleTiming.rollerStop +
    oracleTiming.paperSettle,
  collection: oracleTiming.collectionLift,
} as const;
