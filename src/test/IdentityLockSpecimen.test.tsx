import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IdentityLockSpecimen,
  type OracleSpecimenIdentity,
} from '../features/oracle-reveal/IdentityLockSpecimen';

const blankIdentity: OracleSpecimenIdentity = {
  brand: 'UNNAMED BRAND',
  productName: 'UNNAMED PRODUCT',
  strength: null,
  volume: null,
  assignedJob: 'Reduce visible redness',
};

const longIdentity: OracleSpecimenIdentity = {
  brand: 'Clinical Laboratory',
  productName: 'Clinical Laboratory Azelaic Topical Acid Barrier Support Concentrate',
  strength: '10%',
  volume: '30 ml',
  assignedJob: 'Reduce visible redness',
};

const identity = (productName: string, strength: string | null = null): OracleSpecimenIdentity => ({
  brand: 'Test Brand',
  productName,
  strength,
  volume: '30 ml',
  assignedJob: 'Reduce visible redness',
});

const renderIdentity = (productName: string, strength: string | null = null) => {
  const result = render(
    <IdentityLockSpecimen
      identity={identity(productName, strength)}
      specimenState="baseline-ready"
      phase="ready"
    />,
  );
  const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
  const product = document.querySelector<HTMLElement>('[data-label-product]');
  const labelContent = document.querySelector<HTMLElement>('[data-label-content]');
  if (!specimen || !product || !labelContent) throw new Error('Expected the canonical specimen label.');
  return { ...result, specimen, product, labelContent };
};

describe('IdentityLockSpecimen', () => {
  it('uses one bounded label layout and a concise blank preview', () => {
    render(
      <IdentityLockSpecimen
        identity={blankIdentity}
        specimenState="registration-preview"
        phase="idle"
      />,
    );

    const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
    const label = document.querySelector<HTMLElement>(
      '[data-specimen-layer="thermal-evidence-label"]',
    );
    if (!specimen || !label) throw new Error('Expected the canonical specimen label.');

    expect(specimen).toHaveAttribute('data-label-layout', 'safe');
    expect(label.querySelectorAll('[data-label-content]')).toHaveLength(1);
    expect(within(label).getByText('FV / S01')).toBeVisible();
    expect(within(label).getByText('SPECIMEN ID')).toBeVisible();
    expect(within(label).getByText('UNNAMED')).toBeVisible();
    expect(within(label).getByText('TOPICAL')).toBeVisible();
    expect(within(label).getByText('PREVIEW')).toBeVisible();
    expect(within(label).queryByText('UNNAMED BRAND')).not.toBeInTheDocument();
    expect(within(label).queryByText('UNNAMED PRODUCT')).not.toBeInTheDocument();
    expect(within(label).queryByText('LOCK')).not.toBeInTheDocument();
    expect(label.querySelector('[data-label-status-marker]')).toHaveAttribute(
      'data-label-status-state',
      'hidden',
    );
  });

  it('keeps full source identity while resolving one scan and one tiny locked marker', () => {
    const { rerender } = render(
      <IdentityLockSpecimen
        identity={longIdentity}
        specimenState="registration-preview"
        phase="idle"
      />,
    );

    const specimen = screen.getByText('AZELAIC').closest('[data-oracle-specimen]');
    if (!(specimen instanceof HTMLElement)) throw new Error('Expected the canonical specimen.');

    expect(specimen).toHaveAttribute('data-specimen-brand', longIdentity.brand);
    expect(specimen).toHaveAttribute('data-specimen-product', longIdentity.productName);
    expect(within(specimen).getByText('10')).toBeVisible();
    expect(within(specimen).getByText('30 ML · BASE')).toBeVisible();
    expect(specimen.querySelector('[data-label-scan-beam]')).toHaveAttribute(
      'data-label-scan-state',
      'inactive',
    );

    rerender(
      <IdentityLockSpecimen
        identity={longIdentity}
        specimenState="baseline-ready"
        phase="locking"
      />,
    );
    expect(specimen.querySelector('[data-label-scan-beam]')).toHaveAttribute(
      'data-label-scan-state',
      'active',
    );
    expect(specimen.querySelector('[data-label-status-marker]')).toHaveAttribute(
      'data-label-status-state',
      'hidden',
    );

    rerender(
      <IdentityLockSpecimen identity={longIdentity} specimenState="baseline-ready" phase="ready" />,
    );
    expect(specimen.querySelector('[data-label-scan-beam]')).toHaveAttribute(
      'data-label-scan-state',
      'inactive',
    );
    expect(specimen.querySelector('[data-label-status-marker]')).toHaveAttribute(
      'data-label-status-state',
      'locked',
    );
    expect(within(specimen).queryByText('LOCK')).not.toBeInTheDocument();

    rerender(
      <IdentityLockSpecimen identity={longIdentity} specimenState="pending" phase="ready" />,
    );
    expect(specimen.querySelector('[data-label-scan-beam]')).toHaveAttribute(
      'data-label-scan-state',
      'inactive',
    );
    expect(specimen.querySelector('[data-label-status-marker]')).toHaveAttribute(
      'data-label-status-state',
      'locked',
    );
  });

  it.each([
    ['Niacinamide 10% Serum', 'NIACINAMIDE'],
    ['Hyaluronic Acid 2% Serum', 'HYALURONIC ACID'],
    ['Glycolic Acid 7% Toner', 'GLYCOLIC ACID'],
    ['Salicylic Acid 2% Solution', 'SALICYLIC ACID'],
    ['Benzoyl Peroxide 5% Gel', 'BENZOYL PEROXIDE'],
    ['Vitamin C Suspension 23%', 'VITAMIN C'],
    ['Alpha Arbutin 2% Serum', 'ALPHA ARBUTIN'],
    ['Ceramides Barrier Repair Cream', 'CERAMIDES'],
  ])('normalizes %s to %s without changing fixed label rows', (productName, expected) => {
    const { specimen, product, labelContent } = renderIdentity(productName);
    expect(product).toHaveTextContent(expected);
    expect(product.textContent?.split('\n')).toHaveLength(1);
    expect(specimen).toHaveAttribute('data-specimen-product', productName);
    expect(labelContent.querySelector('[data-label-group="strength"]')).toBeInTheDocument();
    expect(within(labelContent).getByText('TOPICAL')).toBeVisible();
    expect(within(labelContent).getByText('30 ML · BASE')).toBeVisible();
  });

  it.each([
    ['10% Niacinamide + 1% Zinc PCA Serum', 'NIACINAMIDE + ZINC PCA'],
    ['Hyaluronic Acid 2% + B5', 'HYALURONIC ACID + PANTHENOL'],
    ['AHA 30% + BHA 2% Peeling Solution', 'AHA + BHA'],
    ['Retinal 0.1% Emulsion', 'RETINAL'],
  ])('uses compact multi-active evidence identity for %s', (productName, expected) => {
    const { specimen, product } = renderIdentity(productName);
    expect(product).toHaveTextContent(expected);
    expect(specimen).toHaveAttribute('data-display-product', expected);
    expect(specimen).toHaveAttribute('data-accessibility-product', expect.stringContaining('TEST BRAND'));
  });

  it('keeps strength, support, and footer in the same grid rows for every identity', () => {
    const cases = [
      'NIACINAMIDE',
      'HYALURONIC ACID',
      'GLYCOLIC ACID',
      'SALICYLIC ACID',
      'BENZOYL PEROXIDE',
      'NIACINAMIDE + ZINC PCA',
      'HYALURONIC ACID + PANTHENOL',
    ];

    for (const productName of cases) {
      const { unmount } = renderIdentity(productName, '10%');
      const groups = Array.from(document.querySelectorAll('[data-label-group]')).map((node) =>
        node.getAttribute('data-label-group'),
      );
      expect(groups).toEqual([
        'metadata',
        'product-identity',
        'strength',
        'supporting-metadata',
        'footer',
      ]);
      expect(screen.getByText('10')).toBeVisible();
      expect(screen.getByText('TOPICAL')).toBeVisible();
      expect(screen.getByText('30 ML · BASE')).toBeVisible();
      unmount();
    }
  });

  it('uses a safe cleaned fallback for unknown products and stays within two hero lines', () => {
    const productName = 'Test Brand Advanced Daily Moon Jelly Hydrating Treatment Serum 18%';
    const { specimen, product } = renderIdentity(productName);
    expect(product).toHaveTextContent('MOON JELLY');
    expect(product.textContent?.split('\n').length).toBeLessThanOrEqual(2);
    expect(specimen).toHaveAttribute('data-specimen-product', productName);
    expect(specimen).toHaveAttribute('data-display-strength', '18');
  });
});
