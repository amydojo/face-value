import { expect, it } from 'vitest';
import {
  loadStructuredDemoData,
  saveStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import { initialState } from '../app/machine';

it('persists structured observation data without images or object URLs', () => {
  const state = {
    ...initialState,
    assignedJob: 'Post-acne pigmentation',
    observation: 'active_stable' as const,
  };
  const data = toPersistedDemoData(state);

  expect(JSON.stringify(data)).not.toMatch(
    /blob:|data:image|baselineCapture|followupCapture/,
  );
  saveStructuredDemoData(state);
  expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/blob:|data:image/);
  expect(loadStructuredDemoData()).toMatchObject({
    assignedJob: 'Post-acne pigmentation',
    observation: 'active_stable',
  });
});

it('deletes malformed persisted data instead of hydrating it', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ observation: 'invented-state' }));
  expect(loadStructuredDemoData()).toBeNull();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
