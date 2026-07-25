import { expect, it } from 'vitest';
import { faceValueReducer, initialState } from '../app/machine';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';

const followup = {
  id: 'followup',
  kind: 'followup' as const,
  source: 'file' as const,
  mimeType: 'image/jpeg' as const,
  createdAt: '2026-07-24T18:00:00.000Z',
  orientationRule: 'analysis-unmirrored' as const,
};

it('restores a persisted review-due cassette into analysis or verdict without a route fixture', () => {
  const analysisReady = {
    ...initialState,
    stage: 'cabinet' as const,
    cabinet: 'open' as const,
    observation: 'review_due' as const,
    assignedJob: 'Post-acne pigmentation',
    followupCapture: followup,
  };
  expect(faceValueReducer(analysisReady, { type: 'OPEN_REVIEW_DUE' }).stage).toBe('analysis');

  const verdictReady = {
    ...analysisReady,
    analysis: ANALYSIS_SCENARIOS.likely_change,
    processing: 'succeeded' as const,
    confidence: 'likely' as const,
    comparison: 'comparable' as const,
  };
  expect(faceValueReducer(verdictReady, { type: 'OPEN_REVIEW_DUE' }).stage).toBe('progress');
});

it('generates exactly one durable record for the same committed classification', () => {
  const committed = {
    ...initialState,
    stage: 'placement' as const,
    observation: 'complete' as const,
    assignedJob: 'Post-acne pigmentation',
    analysis: ANALYSIS_SCENARIOS.likely_change,
    confidence: 'likely' as const,
    comparison: 'comparable' as const,
    placement: 'established' as const,
    placementSealed: true,
  };
  const first = faceValueReducer(committed, {
    type: 'GENERATE_RECORD',
    now: '2026-07-24T18:30:00.000Z',
  });
  const replayablePlacement = { ...first, stage: 'placement' as const };
  const second = faceValueReducer(replayablePlacement, {
    type: 'GENERATE_RECORD',
    now: '2026-07-24T18:30:00.000Z',
  });

  expect(first.archive).toHaveLength(1);
  expect(second.archive).toHaveLength(1);
  expect(second.archive[0].id).toBe(first.archive[0].id);
});
