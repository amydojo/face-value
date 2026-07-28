import type {
  EffectClassification,
  MeasurementQuality,
  RednessAction,
  RednessInterpretation,
  SafetyStatus,
} from './types';

const EXPLANATIONS: Record<RednessAction, string> = {
  keep: 'Redness improved beyond the active repeat-scan threshold. The change appeared consistently under comparable conditions.',
  test_longer:
    'The direction looks encouraging, but the change is not yet strong or consistent enough to call.',
  retry_alone:
    'Redness changed, but this product was not the only thing that could have caused it.',
  not_proving_job:
    'The comparison is readable, but it does not show detectable progress on the job this product was given.',
  safety_interruption:
    'Redness worsened and the reported symptoms make a favorable product verdict inappropriate. Face Value cannot diagnose the reaction.',
};

const CLAIM_BOUNDARY = [
  'This result describes visible redness in comparable scans.',
  'Face Value operating thresholds are not clinical efficacy thresholds.',
  'Face Value does not diagnose a skin condition or establish product causation.',
];

function findingFor(input: {
  action: RednessAction;
  effect: EffectClassification | null;
  measurementQuality: MeasurementQuality;
}): string {
  if (input.action === 'safety_interruption') {
    return input.effect === 'worsened' && input.measurementQuality !== 'invalid'
      ? 'Visible redness worsened across comparable scans.'
      : 'Reported symptoms interrupted this trial.';
  }
  if (input.measurementQuality === 'invalid') {
    return 'This comparison was not readable.';
  }
  if (input.action === 'retry_alone') {
    return 'The trial did not isolate this product.';
  }
  if (input.effect === 'worsened') {
    return 'Visible redness worsened across comparable scans.';
  }
  if (input.effect === 'strong_improvement' || input.effect === 'meaningful_candidate') {
    return 'Visible redness improved across comparable scans.';
  }
  if (input.effect === 'directional_improvement') {
    return 'Visible redness moved in a favorable direction.';
  }
  if (input.effect === 'no_detectable_change') {
    return 'No detectable improvement showed up.';
  }
  return 'No readable redness finding was available.';
}

function nonFindingFor(input: {
  action: RednessAction;
  effect: EffectClassification | null;
  measurementQuality: MeasurementQuality;
  tooEarly: boolean;
}): string {
  if (input.action === 'safety_interruption') {
    return 'No favorable product conclusion was made, and Face Value cannot diagnose the reaction.';
  }
  if (input.measurementQuality === 'invalid') {
    return 'No product conclusion was made from this comparison.';
  }
  if (input.action === 'retry_alone') {
    return 'The result does not establish which product or routine change caused the movement.';
  }
  if (input.tooEarly) {
    return 'The predeclared trial window is not complete.';
  }
  if (input.action === 'keep') {
    return 'The result supports the assigned visible-redness job; it does not establish clinical efficacy.';
  }
  if (input.effect === 'directional_improvement') {
    return 'The evidence is not yet strong or complete enough to support keeping the product for this job.';
  }
  if (input.effect === 'no_detectable_change') {
    return 'Comparable scans did not establish progress on the assigned visible-redness job.';
  }
  if (input.effect === 'worsened') {
    return 'The result does not diagnose a reaction or establish why redness changed.';
  }
  return 'The available evidence did not establish progress on the assigned job.';
}

export function interpretationForRedness(input: {
  action: RednessAction;
  effect: EffectClassification | null;
  measurementQuality: MeasurementQuality;
  safetyStatus: SafetyStatus;
  tooEarly: boolean;
  limitations: string[];
}): RednessInterpretation {
  let explanation = EXPLANATIONS[input.action];
  if (input.action === 'test_longer' && input.measurementQuality === 'invalid') {
    explanation =
      'The scans were not comparable enough to read. Repeat the comparison under matched conditions.';
  } else if (input.action === 'test_longer' && input.tooEarly) {
    explanation =
      'The trial window is not complete. Keep the predeclared schedule before judging this product job.';
  } else if (input.action === 'safety_interruption' && input.effect !== 'worsened') {
    explanation =
      'The reported symptoms make an ordinary product verdict inappropriate. Face Value cannot diagnose the reaction.';
  } else if (
    input.safetyStatus === 'check_required' &&
    input.effect === 'worsened' &&
    input.action === 'not_proving_job'
  ) {
    explanation =
      'The comparison shows worsening without a reported severe symptom. The product is not proving this job, and the change warrants a safety check.';
  }

  return {
    finding: findingFor(input),
    nonFinding: nonFindingFor(input),
    limitations: [...new Set(input.limitations)],
    claimBoundary: [...CLAIM_BOUNDARY],
    recommendedAction: input.action,
    explanation,
  };
}
