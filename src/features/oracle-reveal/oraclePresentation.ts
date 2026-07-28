import type { ProductPlacement } from '../../domain/model';
import type { OracleRevealState } from '../../domain/oracleRevealMachine';

export type OracleMachineControlLabel = 'REVEAL' | 'KEEP' | null;

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
