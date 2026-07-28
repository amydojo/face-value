import type { ProductPlacement } from '../../domain/model';

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
