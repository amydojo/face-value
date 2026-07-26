import { expect, it } from 'vitest';
import { initialState } from '../app/machine';
import type { EvidenceRecordData, FaceValueState } from '../domain/model';
import { PRODUCTS } from '../fixtures/products';
import {
  deriveHumanButterMachineState,
  evidenceRecordFromHumanButter,
} from '../features/evidence-machine/humanButterMachineAdapter';
import { resolveMachineConfiguration } from '../features/evidence-machine/machineConfiguration';

const record: EvidenceRecordData = {
  id: 'ER-202607271900',
  specimenId: PRODUCTS[0].id,
  accession: PRODUCTS[0].accession,
  product: PRODUCTS[0].product,
  job: 'Post-acne pigmentation',
  observationWindow: 'Baseline to follow-up',
  comparison: 'partially_comparable',
  finding: 'Visible tone consistency appears slightly improved.',
  nonFinding: 'The trial does not establish which overlapping product caused the change.',
  confidence: 'possible',
  disturbance: 'overlap_retained',
  finalPlacement: 'retry_alone',
  recommendedAction: 'continue_with_overlap',
  claimBoundary: 'Possible evidence only. Product attribution remains limited.',
  createdAt: '2026-07-27T19:00:00.000Z',
  includesFaceImage: false,
  note: 'Less tight after cleansing',
  baselineCapture: {
    id: 'baseline-adapter',
    kind: 'baseline',
    source: 'file',
    mimeType: 'image/jpeg',
    createdAt: '2026-07-15T19:00:00.000Z',
    orientationRule: 'analysis-unmirrored',
  },
  followupCapture: {
    id: 'followup-adapter',
    kind: 'followup',
    source: 'file',
    mimeType: 'image/jpeg',
    createdAt: '2026-07-27T19:00:00.000Z',
    orientationRule: 'analysis-unmirrored',
  },
};

it('arms SAVE RESULT from the existing Human Butter decision without creating parallel truth', () => {
  const state: FaceValueState = {
    ...initialState,
    stage: 'placement',
    selectedSpecimenId: PRODUCTS[0].id,
    assignedJob: record.job,
    placement: 'retry_alone',
    analysis: {
      captureQuality: 'accepted',
      comparison: record.comparison,
      visibleSignal: 'tone consistency',
      confidence: record.confidence,
      finding: record.finding,
      nonFinding: record.nonFinding,
      relevantContext: 'A second product overlapped the trial.',
      recommendedAction: record.recommendedAction,
      claimBoundary: record.claimBoundary,
      simulated: true,
    },
  };

  const machineState = deriveHumanButterMachineState(state, PRODUCTS[0]);
  const config = resolveMachineConfiguration(machineState);

  expect(machineState.phase).toBe('verdict-ready');
  expect(machineState.disposition).toBe('retry_alone');
  expect(config.primaryActionOwner).toBe('machine');
  expect(config.actuator.actionId).toBe('save-result');
  expect(config.actuator.accessibleLabel).toBe('Save result and release Evidence Record');
});

it('maps the durable saved result into the same collectible artifact identity', () => {
  const artifact = evidenceRecordFromHumanButter(record);

  expect(artifact.id).toBe(record.id);
  expect(artifact.productName).toBe(record.product);
  expect(artifact.finding.metric).toBe(record.job);
  expect(artifact.confidence).toBe('possible');
  expect(artifact.nextStepCode).toBe('R3');
  expect(artifact.nextStep).toBe('Retry alone');
  expect(artifact.detail.context).toMatch(/second active product/i);
});
