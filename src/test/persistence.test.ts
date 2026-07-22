import { expect, it } from 'vitest';
import { initialState } from '../app/machine';
import { saveStructuredDemoData, STORAGE_KEY, toPersistedDemoData } from '../adapters/persistence/localObservationStore';

it('persists structured data without images or object URLs', () => {
  const data = toPersistedDemoData({ ...initialState, assignedJob:'Post-acne pigmentation' });
  expect(JSON.stringify(data)).not.toMatch(/blob:|data:image|baselineCapture|followupCapture/);
  saveStructuredDemoData({ ...initialState, assignedJob:'Post-acne pigmentation' });
  expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/blob:|data:image/);
});
