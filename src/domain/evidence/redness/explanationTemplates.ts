import type {
  AttributionQuality,
  DirectionAgreement,
  EffectClassification,
  MeasurementQuality,
  RednessAction,
  RednessInterpretation,
  SafetyStatus,
} from './types';

// Deterministic result copy. Decision logic lives in evaluateRedness.ts; every branch here only
// reads the action and quality fields the evaluator already chose and selects words for them.
//
// Copy rules (P0):
// 1. A test_longer explanation names the gate that produced it, in actionFor() order, with an
//    unreadable comparison stated first.
// 2. "Comparable" is used only when comparability was established (adequate/strong measurement).
// 3. Every check_required state tells the person to check their skin; no worsening result is
//    ever paired with encouraging language.
// 4. No movement is claimed from an invalid comparison, and "changed" is never said of a null.
// 5. Boundaries are described as provisional, never as repeat-scan calibrated.

const FAVORABLE_EFFECTS: ReadonlySet<EffectClassification> = new Set([
  'directional_improvement',
  'meaningful_candidate',
  'strong_improvement',
]);

const SKIN_CHECK = 'Check how your skin is responding before you continue.';
const CONDITIONS_UNMEASURED =
  'matching scan conditions were not measured, so Face Value cannot call this result yet.';
const NOT_ISOLATED =
  'another product or routine change means this trial could not isolate this product.';

const CLAIM_BOUNDARY_TAIL = [
  'Face Value operating thresholds are not clinical efficacy thresholds.',
  'Face Value does not diagnose a skin condition or establish product causation.',
];

export interface RednessInterpretationInput {
  action: RednessAction;
  effect: EffectClassification | null;
  measurementQuality: MeasurementQuality;
  safetyStatus: SafetyStatus;
  tooEarly: boolean;
  limitations: string[];
  /** Gates actionFor() already evaluated, passed through so the words can name them. */
  directionAgreement: DirectionAgreement['status'];
  attributionQuality: AttributionQuality;
  corroboratingSignalCount: number;
  toleranceCollected: boolean;
}

const comparabilityEstablished = (quality: MeasurementQuality): boolean =>
  quality === 'adequate' || quality === 'strong';

function findingFor(input: RednessInterpretationInput): string {
  const established = comparabilityEstablished(input.measurementQuality);
  const worsened = established
    ? 'Visible redness worsened across comparable scans.'
    : 'Visible redness was higher at follow-up.';
  if (input.action === 'safety_interruption') {
    return input.effect === 'worsened' && input.measurementQuality !== 'invalid'
      ? worsened
      : 'Reported symptoms interrupted this trial.';
  }
  if (input.measurementQuality === 'invalid') {
    return 'This comparison was not readable.';
  }
  if (input.action === 'retry_alone') {
    return 'The trial did not isolate this product.';
  }
  if (input.effect === 'worsened') {
    return worsened;
  }
  if (input.effect === 'strong_improvement' || input.effect === 'meaningful_candidate') {
    return established
      ? 'Visible redness improved across comparable scans.'
      : 'Visible redness was lower at follow-up.';
  }
  if (input.effect === 'directional_improvement') {
    return 'Visible redness moved in a favorable direction.';
  }
  if (input.effect === 'no_detectable_change') {
    return 'No detectable improvement showed up.';
  }
  return 'No readable redness finding was available.';
}

function nonFindingFor(input: RednessInterpretationInput): string {
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
    return comparabilityEstablished(input.measurementQuality)
      ? 'Comparable scans did not establish progress on the assigned visible-redness job.'
      : 'The saved scans did not establish progress on the assigned visible-redness job.';
  }
  if (input.effect === 'worsened') {
    return 'The result does not diagnose a reaction or establish why redness changed.';
  }
  return 'The available evidence did not establish progress on the assigned job.';
}

/** What the scores showed, stated without a comparability claim. Worsening leads with safety. */
function movementLead(effect: EffectClassification | null): string {
  switch (effect) {
    case 'worsened':
      return `Visible redness was higher at follow-up. ${SKIN_CHECK}`;
    case 'no_detectable_change':
      return 'No detectable change showed up';
    case 'strong_improvement':
    case 'meaningful_candidate':
      return 'Visible redness was lower at follow-up';
    case 'directional_improvement':
      return 'Visible redness moved in a favorable direction';
    case null:
      return 'The comparison did not produce a readable change';
  }
}

/** "<lead>, but <reason>" for other effects; "<safety lead> <Reason>" for worsening. */
function withReason(effect: EffectClassification | null, reason: string): string {
  if (effect === 'worsened') {
    return `${movementLead(effect)} ${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
  }
  return `${movementLead(effect)}, but ${reason}`;
}

function testLongerExplanation(input: RednessInterpretationInput): string {
  const worsening = input.safetyStatus === 'check_required' && input.effect === 'worsened';
  // Both gates can select test_longer; an unreadable comparison is the more fundamental fact
  // and no movement may be claimed from it.
  if (input.measurementQuality === 'invalid') {
    const base =
      'The scans were not comparable enough to read. Repeat the comparison under matched conditions.';
    return input.safetyStatus === 'check_required'
      ? `${base} If your skin feels worse, pause the product and review how it is responding.`
      : base;
  }
  if (input.tooEarly) {
    return worsening
      ? `Visible redness was higher at follow-up. ${SKIN_CHECK} The trial window is not complete, so this product job cannot be judged yet.`
      : 'The trial window is not complete. Keep the predeclared schedule before judging this product job.';
  }
  if (input.measurementQuality === 'limited') {
    return withReason(input.effect, CONDITIONS_UNMEASURED);
  }
  if (input.effect === 'directional_improvement') {
    return 'The direction looks encouraging, but the change is not yet strong or consistent enough to call.';
  }
  if (input.directionAgreement !== 'agreeing') {
    return withReason(
      input.effect,
      'at least one follow-up frame moved the other way, so the change is not consistent enough to call.',
    );
  }
  if (input.attributionQuality === 'weak') {
    return withReason(
      input.effect,
      'reported use or other trial changes weaken the link to this product, so it is not ready to call.',
    );
  }
  if (input.corroboratingSignalCount === 0 && input.effect && FAVORABLE_EFFECTS.has(input.effect)) {
    return withReason(
      input.effect,
      'your own observation did not confirm the change, so it is not ready to call.',
    );
  }
  if (!input.toleranceCollected) {
    return withReason(
      input.effect,
      'symptoms and tolerance were not recorded, so it is not ready to call.',
    );
  }
  return withReason(input.effect, 'the evidence is not complete enough to call this result yet.');
}

function retryAloneExplanation(input: RednessInterpretationInput): string {
  if (input.measurementQuality === 'invalid') {
    return `The scans were not readable, and ${NOT_ISOLATED}`;
  }
  if (input.effect === 'worsened') {
    return `Visible redness was higher at follow-up. ${SKIN_CHECK} Also, ${NOT_ISOLATED}`;
  }
  if (input.effect === 'no_detectable_change' || input.effect === null) {
    return `No detectable change showed up, and ${NOT_ISOLATED}`;
  }
  return 'Redness changed, but this product was not the only thing that could have caused it.';
}

/** Rule 3: a check_required result always carries the skin check, including the case where
 * symptoms were simply never recorded. */
function withSafetyCheck(input: RednessInterpretationInput, explanation: string): string {
  if (input.safetyStatus !== 'check_required' || /your skin/i.test(explanation)) return explanation;
  return input.toleranceCollected
    ? `${explanation} ${SKIN_CHECK}`
    : `${explanation} Symptoms were not recorded. ${SKIN_CHECK}`;
}

function explanationFor(input: RednessInterpretationInput): string {
  switch (input.action) {
    case 'test_longer':
    case 'retry_alone':
      return withSafetyCheck(input, actionExplanation(input));
    default:
      return actionExplanation(input);
  }
}

function actionExplanation(input: RednessInterpretationInput): string {
  switch (input.action) {
    case 'keep':
      return "Visible redness improved beyond Face Value's provisional strong boundary, and the follow-up frames agreed under matching scan conditions.";
    case 'test_longer':
      return testLongerExplanation(input);
    case 'retry_alone':
      return retryAloneExplanation(input);
    case 'not_proving_job':
      return input.safetyStatus === 'check_required' && input.effect === 'worsened'
        ? 'The comparison shows worsening without a reported severe symptom. The product is not proving this job, and the change warrants a safety check.'
        : 'The comparison is readable, but it does not show detectable progress on the job this product was given.';
    case 'safety_interruption':
      if (input.effect !== 'worsened' || input.measurementQuality === 'invalid') {
        return 'The reported symptoms make an ordinary product verdict inappropriate. Face Value cannot diagnose the reaction.';
      }
      return comparabilityEstablished(input.measurementQuality)
        ? 'Redness worsened and the reported symptoms make a favorable product verdict inappropriate. Face Value cannot diagnose the reaction.'
        : 'Visible redness was higher at follow-up, and the reported symptoms make a favorable product verdict inappropriate. Face Value cannot diagnose the reaction.';
  }
}

export function interpretationForRedness(input: RednessInterpretationInput): RednessInterpretation {
  return {
    finding: findingFor(input),
    nonFinding: nonFindingFor(input),
    limitations: [...new Set(input.limitations)],
    claimBoundary: [
      comparabilityEstablished(input.measurementQuality)
        ? 'This result describes visible redness in comparable scans.'
        : 'This result describes visible redness in the saved scans; matching scan conditions were not measured.',
      ...CLAIM_BOUNDARY_TAIL,
    ],
    recommendedAction: input.action,
    explanation: explanationFor(input),
  };
}
