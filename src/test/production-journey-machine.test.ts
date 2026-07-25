import { expect, it } from 'vitest';
import { faceValueReducer, initialState } from '../app/machine';
import { ANALYSIS_SCENARIOS } from '../fixtures/analysis-scenarios';

const baseline = {
  id: 'baseline',
  kind: 'baseline' as const,
  source: 'file' as const,
  mimeType: 'image/jpeg' as const,
  createdAt: '2026-07-12T18:00:00.000Z',
  orientationRule: 'analysis-unmirrored' as const,
};

const followup = {
  id: 'followup',
  kind: 'followup' as const,
  source: 'file' as const,
  mimeType: 'image/jpeg' as const,
  createdAt: '2026-07-24T18:00:00.000Z',
  orientationRule: 'analysis-unmirrored' as const,
};

it('restores a persisted ready result through the reducer without a route fixture', () => {
  const analysisReady = {
    ...initialState,
    stage: 'cabinet' as const,
    cabinet: 'open' as const,
    observation: 'review_due' as const,
    assignedJob: 'Post-acne pigmentation',
    followupCapture: followup,
  };
  expect(faceValueReducer(analysisReady, { type: 'OPEN_REVIEW_DUE' }).stage).toBe('analysis');

  const resultReady = {
    ...analysisReady,
    analysis: ANALYSIS_SCENARIOS.likely_change,
    processing: 'succeeded' as const,
    confidence: 'likely' as const,
    comparison: 'comparable' as const,
  };
  expect(faceValueReducer(resultReady, { type: 'OPEN_REVIEW_DUE' }).stage).toBe('progress');
});

it('reopens an active trial directly from Your trials', () => {
  const active = {
    ...initialState,
    stage: 'cabinet' as const,
    cabinet: 'open' as const,
    observation: 'active_stable' as const,
    assignedJob: 'Post-acne pigmentation',
    baselineCapture: baseline,
  };
  expect(faceValueReducer(active, { type: 'OPEN_DRAWER' }).stage).toBe('observation');
});

it('SAVE_RESULT classifies, preserves context, and generates exactly one record', () => {
  const ready = {
    ...initialState,
    stage: 'placement' as const,
    observation: 'review_due' as const,
    assignedJob: 'Post-acne pigmentation',
    baselineCapture: baseline,
    followupCapture: followup,
    trace: {
      id: 'note-1',
      label: 'WHAT YOU NOTICED',
      detail: 'Less tight after cleansing',
      observedAt: '2026-07-20T18:00:00.000Z',
    },
    analysis: ANALYSIS_SCENARIOS.likely_change,
    confidence: 'likely' as const,
    comparison: 'comparable' as const,
    placement: 'established' as const,
    placementSealed: false,
  };

  const first = faceValueReducer(ready, {
    type: 'SAVE_RESULT',
    now: '2026-07-24T18:30:00.000Z',
  });
  const second = faceValueReducer(first, {
    type: 'SAVE_RESULT',
    now: '2026-07-24T18:31:00.000Z',
  });

  expect(first.placementSealed).toBe(true);
  expect(first.observation).toBe('complete');
  expect(first.archive).toHaveLength(1);
  expect(first.record?.note).toBe('Less tight after cleansing');
  expect(first.record?.baselineCapture?.id).toBe('baseline');
  expect(first.record?.followupCapture?.id).toBe('followup');
  expect(second.archive).toHaveLength(1);
  expect(second.record?.id).toBe(first.record?.id);
  expect(faceValueReducer(first, { type: 'OPEN_SAVED_RESULT' }).stage).toBe('record');
});

it('back and archive reopening preserve the same saved result', () => {
  const ready = {
    ...initialState,
    stage: 'placement' as const,
    assignedJob: 'Post-acne pigmentation',
    analysis: ANALYSIS_SCENARIOS.no_change,
    confidence: 'possible' as const,
    comparison: 'comparable' as const,
    placement: 'paused' as const,
  };
  const saved = faceValueReducer(ready, { type: 'SAVE_RESULT', now: '2026-07-24T19:00:00.000Z' });
  const opened = faceValueReducer(saved, { type: 'OPEN_SAVED_RESULT' });
  const archive = faceValueReducer(opened, { type: 'VIEW_ARCHIVE' });
  const reopened = faceValueReducer(archive, { type: 'VIEW_RECORD', record: archive.archive[0] });

  expect(reopened.record?.id).toBe(saved.record?.id);
  expect(reopened.archive).toHaveLength(1);
  expect(faceValueReducer(reopened, { type: 'BACK' }).stage).toBe('archive');
});
