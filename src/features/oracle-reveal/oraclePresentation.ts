import type { ProductPlacement } from '../../domain/model';
import type { OracleRevealState } from '../../domain/oracleRevealMachine';
import type { FaceValueActuatorState } from '../../components/FaceValueActuator';

export type OracleMachineControlLabel = 'REVEAL' | 'KEEP' | null;

export const oracleAmberStates = [
  'idle',
  'trial-pending',
  'ready',
  'baseline-ready',
  'followup-ready',
  'specimen-verified',
  'specimen-preparing',
  'specimen-registering',
  'specimen-processing',
  'transmitting',
  'committed',
  'dispensing',
  'complete',
  'latest',
] as const;

export type OracleAmberState = (typeof oracleAmberStates)[number];

const actuatorStateByOracleAmberState = {
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

export function faceValueActuatorStateForOracleAmber(
  state: OracleAmberState,
): FaceValueActuatorState {
  return actuatorStateByOracleAmberState[state];
}

export function oracleMachineControlLabel(phase: OracleRevealState): OracleMachineControlLabel {
  switch (phase) {
    case 'sealed':
    case 'opening':
      return 'REVEAL';
    case 'verdict_revealed':
      return 'KEEP';
    case 'transmitting':
    case 'committing':
    case 'dispensing':
    case 'collected':
    case 'done':
      return null;
  }
}

export function oracleNextStep(placement: ProductPlacement): string {
  switch (placement) {
    case 'established':
      return 'KEEP USING IT';
    case 'retry_alone':
      return 'TEST IT ALONE';
    case 'useful_elsewhere':
      return 'TEST ANOTHER JOB';
    case 'released':
      return 'OUTSIDE ROUTINE';
    case 'cooling':
      return 'RETURN TO COOLING';
    case 'observation':
    case 'paused':
    case 'unclear':
    default:
      return 'TEST LONGER';
  }
}
