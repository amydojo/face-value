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
});
