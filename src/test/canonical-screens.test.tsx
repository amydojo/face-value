import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../fixtures/products';
import { CanonicalFaceValueApplication } from '../features/canonical/CanonicalFaceValueApplication';
import { createInitialEvidenceTrial, productFromSpecimen, transitionTrial, type EvidenceTrialState } from '../features/evidence-machine/evidenceTrial';

const KEY = 'face-value:evidence-machine:v2';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
});

const renderAt = (trial: EvidenceTrialState) => {
  localStorage.setItem(KEY, JSON.stringify({ trial, archive: [], selectedProductId: 'hydrating-drops' }));
  return render(<MemoryRouter><CanonicalFaceValueApplication /></MemoryRouter>);
};

it('landing exposes one page primary while the actuator is parked', () => {
  const { container } = renderAt(createInitialEvidenceTrial());
  expect(screen.getByRole('button', { name: /Start a product trial/i })).toBeVisible();
  expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-primary-owner', 'page');
  expect(container.querySelectorAll('.pagePrimary')).toHaveLength(0);
});

it('job selection has one page primary and updates the machine without arming it', () => {
  let trial = createInitialEvidenceTrial();
  trial = transitionTrial(trial, { type: 'PRODUCT_REGISTERED', product: productFromSpecimen(PRODUCTS[1]) });
  const { container } = renderAt(trial);
  expect(screen.getByRole('button', { name: /Assign this job/i })).toBeDisabled();
  expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-primary-owner', 'page');
  expect(container.querySelector('[data-actuator-state="parked"]')).toBeInTheDocument();
});

it('baseline required exposes the machine primary and no duplicate scan CTA', () => {
  let trial = createInitialEvidenceTrial();
  trial = transitionTrial(trial, { type: 'PRODUCT_REGISTERED', product: productFromSpecimen(PRODUCTS[1]) });
  trial = transitionTrial(trial, { type: 'JOB_SELECTED', job: 'Visible Tone Consistency' });
  trial = transitionTrial(trial, { type: 'JOB_ASSIGNED' });
  const { container } = renderAt(trial);
  expect(screen.getByRole('button', { name: /Start baseline scan/i })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Take baseline/i })).not.toBeInTheDocument();
  expect(container.querySelector('[data-evidence-machine]')).toHaveAttribute('data-primary-owner', 'machine');
});
