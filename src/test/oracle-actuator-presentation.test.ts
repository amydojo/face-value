import { describe, expect, it } from 'vitest';
import type { FaceValueActuatorState } from '../components/FaceValueActuator';
import {
  faceValueActuatorStateForOracleAmber,
  oracleAmberStates,
  type OracleAmberState,
} from '../features/oracle-reveal/oraclePresentation';

const expectedProjection = {
  idle: 'rest',
  'trial-pending': 'rest',
  ready: 'ready',
  'baseline-ready': 'ready',
  'followup-ready': 'ready',
  'specimen-verified': 'ready',
  'specimen-preparing': 'scanning',
  'specimen-registering': 'scanning',
  'specimen-processing': 'scanning',
  transmitting: 'scanning',
  committed: 'captured',
  dispensing: 'captured',
  complete: 'captured',
  latest: 'captured',
} satisfies Record<OracleAmberState, FaceValueActuatorState>;

describe('Oracle amber presentation projection', () => {
  it('maps every current domain amber state to exactly one canonical actuator state', () => {
    expect(oracleAmberStates).toEqual(Object.keys(expectedProjection));
    expect(
      Object.fromEntries(
        oracleAmberStates.map((state) => [state, faceValueActuatorStateForOracleAmber(state)]),
      ),
    ).toEqual(expectedProjection);
  });
});
