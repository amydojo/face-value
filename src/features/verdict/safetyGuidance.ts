import type { RednessAction, RednessEvaluationSnapshot } from '../../domain/evidence/redness';

/**
 * Safety-priority guidance: what a person should do with their skin and this product now.
 *
 * Pure presentation derived from fields every saved evaluation already carries. It never changes
 * the evaluator's action, thresholds, or gates, and it is never persisted, so saved records stay
 * exactly as they were written. Three signals stay distinct: what the scans showed, whether
 * another change could explain it, and what the person reported.
 */
export type SafetyGuidanceKind =
  | 'pause_for_symptoms'
  | 'check_skin_first'
  | 'not_readable'
  | 'no_change'
  | 'favorable_unproven';

export interface SafetyGuidance {
  kind: SafetyGuidanceKind;
  tone: 'safety' | 'neutral';
  title: string;
  lines: string[];
  /** What the evaluator's action label means here, when it could be misread as advice. */
  actionMeaning: string | null;
  /** Caption shown above the action label. EVIDENCE when the label must not read as advice. */
  nextCaption: 'NEXT' | 'EVIDENCE';
}

const ACTION_NAMES: Record<RednessAction, string> = {
  keep: 'Keep using it',
  test_longer: 'Test longer',
  retry_alone: 'Retry it alone',
  not_proving_job: 'Not proving its job',
  safety_interruption: 'Safety interruption',
};

const OTHER_CHANGE = 'Another product or routine change during the trial could also explain';
const SKIN_CHECK =
  'Look at how your skin feels before using the product again. If it is irritated, pause the product.';
const SYMPTOMS_NOT_RECORDED = 'Symptoms were not recorded for this trial.';

const establishedMeasurement = (evaluation: RednessEvaluationSnapshot) =>
  evaluation.measurementQuality === 'adequate' || evaluation.measurementQuality === 'strong';

/** The first evidence limitation that keeps this result from being called, in actionFor order. */
function bindingLimitation(evaluation: RednessEvaluationSnapshot): string | null {
  if (evaluation.attributionQuality === 'blocked') return `${OTHER_CHANGE} the result.`;
  if (evaluation.observationWindowStatus === 'too_early') {
    return 'The follow-up came before the planned trial window ended, so Face Value cannot call this result yet.';
  }
  if (evaluation.measurementQuality === 'limited') {
    return 'Matching scan conditions were not measured, so Face Value cannot call this result yet.';
  }
  if (['mixed', 'contradicted', 'not_available'].includes(evaluation.directionAgreement.status)) {
    return 'The follow-up scans did not agree with each other, so Face Value cannot call this result yet.';
  }
  return null;
}

function pauseForSymptoms(evaluation: RednessEvaluationSnapshot): SafetyGuidance {
  const scansWorse =
    evaluation.effectClassification === 'worsened' && evaluation.measurementQuality !== 'invalid';
  return {
    kind: 'pause_for_symptoms',
    tone: 'safety',
    title: 'Pause the product',
    lines: [
      'You reported symptoms during this trial.',
      ...(scansWorse ? ['The measurements also moved in an unfavorable direction.'] : []),
      'Stop using the product for now. If symptoms are severe, spreading, or not settling, get advice from a pharmacist, doctor, or dermatologist.',
      'Face Value does not diagnose a reaction or identify its cause.',
    ],
    actionMeaning: null,
    nextCaption: 'NEXT',
  };
}

function checkSkinFirst(evaluation: RednessEvaluationSnapshot): SafetyGuidance {
  const action = evaluation.interpretation.recommendedAction;
  const lines = ['The measurements moved in an unfavorable direction.'];
  if (!establishedMeasurement(evaluation)) {
    lines.push('Matching scan conditions were not measured, so this change is not confirmed.');
  }
  if (evaluation.attributionQuality === 'blocked') lines.push(`${OTHER_CHANGE} it.`);
  lines.push('Face Value cannot tell whether the product caused it.', SKIN_CHECK);
  if (evaluation.tolerance === null) lines.push(SYMPTOMS_NOT_RECORDED);
  const actionMeaning =
    action === 'test_longer'
      ? '"Test longer" describes the evidence, not your skin. It does not mean continued use has been shown to be safe.'
      : action === 'retry_alone'
        ? '"Retry it alone" describes the evidence, not your skin. Check your skin before starting another trial.'
        : `"${ACTION_NAMES[action]}" describes the evidence, not your skin.`;
  return {
    kind: 'check_skin_first',
    tone: 'safety',
    title: 'Check your skin before continuing',
    lines,
    actionMeaning,
    nextCaption: 'EVIDENCE',
  };
}

function notReadable(evaluation: RednessEvaluationSnapshot): SafetyGuidance {
  const caution = evaluation.effectClassification === 'worsened' || evaluation.tolerance === null;
  return {
    kind: 'not_readable',
    tone: caution ? 'safety' : 'neutral',
    title: 'No result was read',
    lines: [
      'Face Value could not read these scans, so it makes no claim about whether redness went up or down.',
      ...(evaluation.tolerance === null ? [SYMPTOMS_NOT_RECORDED] : []),
      ...(caution ? ['If your skin feels irritated, pause the product.'] : []),
    ],
    actionMeaning: `"${ACTION_NAMES[evaluation.interpretation.recommendedAction]}" here means this trial produced no readable result. It is not a sign the product is working or safe to continue.`,
    nextCaption: 'EVIDENCE',
  };
}

export function safetyGuidanceFor(
  evaluation: RednessEvaluationSnapshot | null | undefined,
): SafetyGuidance | null {
  if (!evaluation) return null;
  if (evaluation.safetyStatus === 'interrupted') return pauseForSymptoms(evaluation);
  if (evaluation.measurementQuality === 'invalid') return notReadable(evaluation);
  const effect = evaluation.effectClassification;
  if (effect === 'worsened') return checkSkinFirst(evaluation);

  const limitation = bindingLimitation(evaluation);
  const symptoms = evaluation.tolerance === null ? [SYMPTOMS_NOT_RECORDED] : [];
  const action = evaluation.interpretation.recommendedAction;
  if (effect === 'no_detectable_change') {
    return {
      kind: 'no_change',
      tone: 'neutral',
      title: 'No change detected',
      lines: [
        'Visible redness stayed close to the baseline. This is not a sign of improvement.',
        ...(limitation ? [limitation] : []),
        ...symptoms,
      ],
      actionMeaning:
        action === 'test_longer' ? '"Test longer" means the evidence is not enough to call this trial yet.' : null,
      nextCaption: 'NEXT',
    };
  }
  if (effect && action !== 'keep') {
    return {
      kind: 'favorable_unproven',
      tone: 'neutral',
      title: 'Favorable direction, not proof',
      lines: [
        'The measurements moved in a favorable direction.',
        ...(limitation ? [limitation] : []),
        'This does not show that the product works.',
        ...symptoms,
      ],
      actionMeaning:
        action === 'test_longer' ? '"Test longer" means the evidence is not enough to call this trial yet.' : null,
      nextCaption: 'NEXT',
    };
  }
  return null;
}
