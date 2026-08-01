import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IdentityLockSpecimen,
  type OracleSpecimenIdentity,
} from '../features/oracle-reveal/IdentityLockSpecimen';
import type { SpecimenRegistrationSnapshot } from '../domain/specimenRegistration';

const identity: OracleSpecimenIdentity = {
  productId: 'product-azelaic-10',
  accession: 'SPECIMEN 01',
  brand: 'Naturium',
  productName: 'Azelaic Topical Acid',
  strength: '10%',
  volume: '30 ml',
  assignedJob: 'Reduce visible redness',
};

const registration: SpecimenRegistrationSnapshot = {
  registrationId: identity.productId,
  phase: 'ready',
  scanProgress: 1,
  isRegistering: false,
  isVerified: true,
  isReady: true,
  reducedMotion: false,
};

function renderResultReady(state = 'sealed') {
  return render(
    <div data-oracle-machine data-cassette-variant="reveal" data-oracle-state={state}>
      <IdentityLockSpecimen
        identity={identity}
        specimenState="verdict"
        registration={registration}
      />
    </div>,
  );
}

describe('Oracle result-ready specimen presentation', () => {
  it('keeps one canonical registered specimen grounded inside the Oracle chamber', () => {
    renderResultReady();

    const specimens = document.querySelectorAll('[data-oracle-specimen]');
    const specimen = specimens.item(0);

    expect(specimens).toHaveLength(1);
    expect(specimen).toHaveAttribute('data-specimen-renderer', 'identity-lock');
    expect(specimen).toHaveAttribute('data-specimen-coordinate-system', 'oracle-chamber');
    expect(specimen).toHaveAttribute('data-specimen-grounding', 'registered-platform');
    expect(specimen).toHaveAttribute('data-specimen-id', identity.productId);
    expect(specimen).toHaveAttribute('data-specimen-accession', identity.accession);
    expect(specimen).toHaveAttribute('data-specimen-brand', identity.brand);
    expect(specimen).toHaveAttribute('data-specimen-product', identity.productName);
    expect(specimen).toHaveAttribute('data-specimen-strength', identity.strength);
    expect(specimen).toHaveAttribute('data-specimen-volume', identity.volume);
    expect(specimen).toHaveAttribute('data-specimen-job', identity.assignedJob);
    expect(specimen.querySelector('[data-specimen-layer="contact-shadow"]')).toBeTruthy();
    expect(specimen.querySelector('[data-specimen-layer="thermal-evidence-label"]')).toBeTruthy();
    expect(specimen.querySelector('[data-specimen-layer="evidence-lock-strip"]')).toBeTruthy();
  });

  it('limits the restrained amber completion field to the sealed result-ready state', () => {
    renderResultReady();

    const contract = document.querySelector<HTMLStyleElement>(
      '[data-oracle-result-ready-presentation]',
    );
    const css = contract?.textContent ?? '';

    expect(contract).toHaveAttribute('data-completion-field-state', 'sealed-only');
    expect(contract).toHaveAttribute('data-completion-field-cycle-ms', '3600');
    expect(contract).toHaveAttribute('data-completion-field-scientific-meaning', 'none');
    expect(css).toContain("[data-oracle-state='sealed']");
    expect(css).toContain("[data-specimen-state='verdict']::after");
    expect(css).toContain('animation: oracleSealedHoldingGlow 3.6s ease-in-out infinite;');
    expect(css).not.toContain("[data-oracle-state='opening']");
    expect(css).not.toContain("[data-oracle-state='transmitting']");
    expect(css).not.toContain("[data-oracle-state='verdict_revealed']");
    expect(css).not.toContain("[data-oracle-state='committing']");
    expect(css).not.toContain("[data-oracle-state='dispensing']");
    expect(css).not.toContain("[data-oracle-state='collected']");
  });

  it('locks the centered geometry, grounding shelf, and reduced-motion static field', () => {
    renderResultReady();

    const contract = document.querySelector<HTMLStyleElement>(
      '[data-oracle-result-ready-presentation]',
    );
    const css = contract?.textContent ?? '';

    expect(css).toContain('top: 18.5%;');
    expect(css).toContain('left: 55%;');
    expect(css).toContain('right: auto;');
    expect(css).toContain('transform: translateX(-50%);');
    expect(css).toContain("[data-specimen-state='verdict']::before");
    expect(css).toContain('border-top: 1px solid rgba(231, 180, 116, 0.12);');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important;');
    expect(css).toContain('opacity: 0.27;');
  });
});
