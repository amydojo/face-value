import { expect, it } from 'vitest';
import {
  loadStructuredDemoData,
  saveStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import { initialState } from '../app/machine';

it('persists structured scan metadata without images or object URLs', () => {
  const state = {
    ...initialState,
    assignedJob: 'Post-acne pigmentation',
    observation: 'review_due' as const,
    baselineCapture: {
      id: 'baseline',
      kind: 'baseline' as const,
      source: 'file' as const,
      mimeType: 'image/jpeg' as const,
      createdAt: '2026-07-12T18:00:00.000Z',
      orientationRule: 'analysis-unmirrored' as const,
    },
    followupCapture: {
      id: 'followup',
      kind: 'followup' as const,
      source: 'file' as const,
      mimeType: 'image/jpeg' as const,
      createdAt: '2026-07-24T18:00:00.000Z',
      orientationRule: 'analysis-unmirrored' as const,
    },
  };
  const data = toPersistedDemoData(state);

  expect(data.baselineCapture?.id).toBe('baseline');
  expect(data.followupCapture?.id).toBe('followup');
  expect(JSON.stringify(data)).not.toMatch(/blob:|data:image|objectURL|imageBytes|base64/);
  saveStructuredDemoData(state);
  expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/blob:|data:image/);
  expect(loadStructuredDemoData()).toMatchObject({
    assignedJob: 'Post-acne pigmentation',
    observation: 'review_due',
    baselineCapture: { id: 'baseline', kind: 'baseline' },
    followupCapture: { id: 'followup', kind: 'followup' },
  });
});

it('backfills older structured data without capture metadata', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    selectedDrawerIndex: 0,
    selectedSpecimenId: 'fermented-essence',
    assignedJob: 'Post-acne pigmentation',
    observation: 'active_stable',
    placement: 'observation',
    placementSealed: false,
    comparison: 'not_available',
    confidence: 'insufficient',
    disturbance: 'none',
    trace: null,
    analysis: null,
    record: null,
    archive: [],
  }));

  expect(loadStructuredDemoData()).toMatchObject({
    baselineCapture: null,
    followupCapture: null,
  });
});

it('deletes malformed persisted data instead of hydrating it', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ observation: 'invented-state' }));
  expect(loadStructuredDemoData()).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
