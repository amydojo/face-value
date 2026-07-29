import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  SpecimenRegistrationPhase,
  SpecimenRegistrationSnapshot,
} from '../domain/specimenRegistration';
import {
  IdentityLockSpecimen,
  type OracleSpecimenIdentity,
} from '../features/oracle-reveal/IdentityLockSpecimen';

const identity = (
  productName: string,
  strength: string | null = null,
  volume: string | null = '30 ml',
): OracleSpecimenIdentity => ({
  brand: 'Test Brand',
  productName,
  strength,
  volume,
  assignedJob: 'Reduce visible redness',
});

function registration(
  phase: SpecimenRegistrationPhase,
  scanProgress = phase === 'ready' ? 1 : 0,
  reducedMotion = false,
): SpecimenRegistrationSnapshot {
  const isReady = phase === 'ready';
  return {
    registrationId: phase === 'idle' ? null : 'registration-test-1',
    phase,
    scanProgress,
    isRegistering: !['idle', 'ready'].includes(phase),
    isVerified: phase === 'verified' || isReady,
    isReady,
    reducedMotion,
  };
}

function renderIdentity(
  productName: string,
  strength: string | null = null,
  phase: SpecimenRegistrationPhase = 'ready',
) {
  const result = render(
    <IdentityLockSpecimen
      identity={identity(productName, strength)}
      specimenState="baseline-ready"
      registration={registration(phase)}
    />,
  );
  const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
  const label = document.querySelector<HTMLElement>(
    '[data-specimen-layer="thermal-evidence-label"]',
  );
  const product = document.querySelector<HTMLElement>('[data-label-product]');
  if (!specimen || !label || !product) throw new Error('Expected the canonical specimen label.');
  return { ...result, specimen, label, product };
}

describe('IdentityLockSpecimen', () => {
  it('renders only normalized identity and a literal percentage while preserving source data', () => {
    const productName = 'Hyaluronic Acid 1% Serum';
    const { specimen, label, product } = renderIdentity(productName, null);

    expect(specimen).toHaveAttribute('aria-hidden', 'true');
    expect(specimen).not.toHaveAttribute('aria-label');
    expect(specimen).toHaveAttribute('data-specimen-brand', 'Test Brand');
    expect(specimen).toHaveAttribute('data-specimen-product', productName);
    expect(specimen).toHaveAttribute('data-specimen-strength', '');
    expect(specimen).toHaveAttribute('data-specimen-volume', '30 ml');
    expect(specimen).toHaveAttribute('data-display-product', 'HYALURONIC ACID');
    expect(specimen).toHaveAttribute('data-display-strength', '1%');

    expect(product).toHaveTextContent('HYALURONIC ACID');
    expect(product.querySelectorAll('[data-label-name-line]')).toHaveLength(2);
    expect(within(product).getByText('HYALURONIC')).toBeVisible();
    expect(within(product).getByText('ACID')).toBeVisible();
    expect(within(label).getByText('1%')).toBeVisible();
    expect(label).not.toHaveTextContent('TOPICAL');
    expect(label).not.toHaveTextContent('BASE');
    expect(label).not.toHaveTextContent('30 ML');
    expect(label).not.toHaveTextContent('FV / S01');
    expect(label).not.toHaveTextContent('SPECIMEN ID');
  });

  it('uses the controller snapshot for scan, verification, and completion attributes', () => {
    const sourceIdentity = identity(
      'Clinical Laboratory Azelaic Topical Acid Barrier Support Concentrate',
      '10%',
    );
    const { rerender } = render(
      <IdentityLockSpecimen
        identity={sourceIdentity}
        specimenState="baseline-ready"
        registration={registration('scanning', 0.425)}
      />,
    );
    const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
    if (!specimen) throw new Error('Expected the canonical specimen.');
    const beam = specimen.querySelector('[data-label-scan-beam]');
    const marker = specimen.querySelector('[data-label-status-marker]');

    expect(specimen).toHaveAttribute('data-registration-phase', 'scanning');
    expect(specimen).toHaveAttribute('data-registration-active', 'true');
    expect(specimen).toHaveAttribute('data-registration-complete', 'false');
    expect(specimen).toHaveAttribute('data-scan-state', 'active');
    expect(specimen).toHaveAttribute('data-scan-progress', '0.425');
    expect(beam).toHaveAttribute('data-label-scan-state', 'active');
    expect(marker).toHaveAttribute('data-label-status-state', 'hidden');

    rerender(
      <IdentityLockSpecimen
        identity={sourceIdentity}
        specimenState="baseline-ready"
        registration={registration('verified', 1)}
      />,
    );
    expect(specimen).toHaveAttribute('data-registration-phase', 'verified');
    expect(specimen).toHaveAttribute('data-registration-active', 'true');
    expect(marker).toHaveAttribute('data-label-status-state', 'locked');

    rerender(
      <IdentityLockSpecimen
        identity={sourceIdentity}
        specimenState="baseline-ready"
        registration={registration('ready')}
      />,
    );
    expect(specimen).toHaveAttribute('data-registration-complete', 'true');
    expect(specimen).toHaveAttribute('data-scan-state', 'inactive');
    expect(beam).toHaveAttribute('data-label-scan-state', 'inactive');
  });

  it('uses a soft wash instead of beam travel for reduced motion', () => {
    render(
      <IdentityLockSpecimen
        identity={identity('Niacinamide 10% Serum')}
        specimenState="baseline-ready"
        registration={registration('scanning', 0.5, true)}
      />,
    );

    expect(document.querySelector('[data-oracle-specimen]')).toHaveAttribute(
      'data-scan-state',
      'wash',
    );
    expect(document.querySelector('[data-label-scan-beam]')).toHaveAttribute(
      'data-label-scan-state',
      'wash',
    );
  });

  it.each([
    ['Niacinamide 10% Serum', 'NIACINAMIDE', '10%'],
    ['Hyaluronic Acid 2% Serum', 'HYALURONIC ACID', '2%'],
    ['Glycolic Acid 7% Toner', 'GLYCOLIC ACID', '7%'],
    ['Salicylic Acid 2% Solution', 'SALICYLIC ACID', '2%'],
    ['Benzoyl Peroxide 5% Gel', 'BENZOYL PEROXIDE', '5%'],
    ['Vitamin C Suspension 23%', 'VITAMIN C', '23%'],
    ['Alpha Arbutin 2% Serum', 'ALPHA ARBUTIN', '2%'],
  ])('normalizes %s to %s and keeps percentage punctuation', (productName, expected, strength) => {
    const { specimen, product } = renderIdentity(productName);
    expect(product).toHaveTextContent(expected);
    expect(product.querySelectorAll('[data-label-name-line]').length).toBeLessThanOrEqual(2);
    expect(specimen).toHaveAttribute('data-display-strength', strength);
  });

  it('keeps unknown ingredient identity to at most two explicit name lines', () => {
    const productName = 'Test Brand Advanced Daily Moon Jelly Hydrating Treatment Serum 18%';
    const { specimen, product, label } = renderIdentity(productName);

    expect(product).toHaveTextContent('MOON JELLY');
    expect(product.querySelectorAll('[data-label-name-line]')).toHaveLength(2);
    expect(specimen).toHaveAttribute('data-specimen-product', productName);
    expect(specimen).toHaveAttribute('data-display-strength', '18%');
    expect(within(label).getByText('18%')).toBeVisible();
  });
});
