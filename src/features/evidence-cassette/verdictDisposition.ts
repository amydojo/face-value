import type { AnalysisResult, DisturbanceState, ProductPlacement, RecommendedAction } from '../../domain/model';

function assertNever(value: never): never {
  throw new Error(`Unsupported verdict recommendation: ${String(value)}`);
}

export function placementForVerdict(
  result: AnalysisResult,
  disturbance: DisturbanceState,
): Extract<ProductPlacement, 'established' | 'paused' | 'retry_alone'> {
  if (disturbance === 'overlap_retained') return 'retry_alone';

  const recommendation: RecommendedAction = result.recommendedAction;
  switch (recommendation) {
    case 'keep':
      return 'established';
    case 'continue_with_overlap':
      return 'retry_alone';
    case 'pause':
    case 'wait':
    case 'reassess':
    case 'return_to_cooling':
    case 'seek_professional_guidance':
      return 'paused';
    default:
      return assertNever(recommendation);
  }
}
