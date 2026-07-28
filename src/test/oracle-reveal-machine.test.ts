import { describe, expect, it } from 'vitest';
import {
  initialOracleRevealModel,
  oracleMotionDuration,
  oracleRevealReducer,
  oracleTiming,
} from '../domain/oracleRevealMachine';
import { oracleTrialIdentity } from '../domain/oracleTrialIdentity';
import { oracleMachineControlLabel } from '../features/oracle-reveal/oraclePresentation';

describe('Oracle Reveal reducer', () => {
  it('moves through every state in one guarded order', () => {
    const opening = oracleRevealReducer(initialOracleRevealModel, {
      type: 'REVEAL_STARTED',
    });
    const transmitting = oracleRevealReducer(opening, {
      type: 'REVEAL_PULL_COMPLETED',
    });
    const revealed = oracleRevealReducer(transmitting, {
      type: 'TRANSMISSION_COMPLETED',
    });
    const committing = oracleRevealReducer(revealed, {
      type: 'RECOMMENDATION_ACCEPTED',
    });
    const dispensing = oracleRevealReducer(committing, {
      type: 'DISPENSE_STARTED',
    });
    const presented = oracleRevealReducer(dispensing, {
      type: 'EVIDENCE_DISPENSED',
    });
    const collecting = oracleRevealReducer(presented, {
      type: 'EVIDENCE_COLLECTION_STARTED',
    });
    const collected = oracleRevealReducer(collecting, {
      type: 'EVIDENCE_COLLECTED',
    });
    const done = oracleRevealReducer(collected, {
      type: 'ORACLE_DONE',
    });

    expect([
      opening.phase,
      transmitting.phase,
      revealed.phase,
      committing.phase,
      dispensing.phase,
      collected.phase,
      done.phase,
    ]).toEqual([
      'opening',
      'transmitting',
      'verdict_revealed',
      'committing',
      'dispensing',
      'collected',
      'done',
    ]);
    expect(presented.evidenceDispensed).toBe(true);
    expect(collecting.collectionStarted).toBe(true);
  });

  it('returns the same model for duplicates and invalid transitions', () => {
    const invalid = oracleRevealReducer(initialOracleRevealModel, {
      type: 'EVIDENCE_DISPENSED',
    });
    expect(invalid).toBe(initialOracleRevealModel);

    const opening = oracleRevealReducer(initialOracleRevealModel, {
      type: 'REVEAL_STARTED',
    });
    expect(oracleRevealReducer(opening, { type: 'REVEAL_STARTED' })).toBe(opening);
    expect(oracleRevealReducer(opening, { type: 'ORACLE_DONE' })).toBe(opening);
  });

  it('centralizes the complete mechanical timing contract', () => {
    expect(oracleTiming).toMatchObject({
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
    });
    expect(oracleMotionDuration).toEqual({
      opening: 400,
      transmission: 1030,
      commit: 250,
      dispense: 995,
      collection: 260,
    });
  });

  it('maps every reducer state to one non-conflicting machine legend', () => {
    expect(
      [
        'sealed',
        'opening',
        'transmitting',
        'verdict_revealed',
        'committing',
        'dispensing',
        'collected',
        'done',
      ].map((phase) =>
        oracleMachineControlLabel(phase as Parameters<typeof oracleMachineControlLabel>[0]),
      ),
    ).toEqual(['REVEAL', 'REVEAL', null, 'KEEP', null, null, null, null]);
  });

  it('derives one 014 presentation identity from the trial interval', () => {
    expect(
      oracleTrialIdentity({
        baselineAt: '2026-07-01T12:00:00.000Z',
        followUpAt: '2026-07-15T12:00:00.000Z',
        accession: 'SPECIMEN 01',
      }),
    ).toEqual({
      number: '014',
      folio: 'FV–014',
      firmware: 'TRIAL 014',
    });
  });
});
