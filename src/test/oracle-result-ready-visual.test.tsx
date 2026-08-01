import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IdentityLockSpecimen,
  type OracleSpecimenIdentity,
} from '../features/oracle-reveal/IdentityLockSpecimen';
import type { SpecimenRegistrationSnapshot } from '../domain/specimenRegistration';
import choreographyCss from '../styles/oracle-specimen-choreography.css?raw';

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
  it('keeps one canonical registered specimen and its complete identity through the ceremony', () => {
    renderResultReady();

    const specimens = document.querySelectorAll('[data-oracle-specimen]');
    const specimen = specimens.item(0);

    expect(specimens).toHaveLength(1);
    expect(specimen).toHaveAttribute('data-specimen-renderer', 'identity-lock');
    expect(specimen).toHaveAttribute('data-specimen-coordinate-system', 'oracle-chamber');
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

  it('holds the sealed specimen at true center without a visible registration shelf', () => {
    expect(choreographyCss).toContain("[data-oracle-state='sealed']");
    expect(choreographyCss).toContain('left: 50%;');
    expect(choreographyCss).toContain('top: 103%;');
    expect(choreographyCss).toContain('border: 0;');
    expect(choreographyCss).toContain("[data-specimen-layer='contact-shadow']");
    expect(choreographyCss).toContain('transform: scale(0.82);');
  });

  it('docks magnetically during opening and remains right-locked for every result phase', () => {
    expect(choreographyCss).toContain("[data-oracle-state='opening']");
    expect(choreographyCss).toContain(
      'animation: oracleSpecimenMagneticDock var(--oracle-opening-duration, 400ms)',
    );
    expect(choreographyCss).toContain('@keyframes oracleSpecimenMagneticDock');
    expect(choreographyCss).toContain('left: 73.4%;');
    expect(choreographyCss).toContain('left: 72%;');

    for (const phase of [
      'transmitting',
      'verdict_revealed',
      'committing',
      'dispensing',
      'collected',
    ]) {
      expect(choreographyCss).toContain(`[data-oracle-state='${phase}']`);
    }
  });

  it('breathes only while sealed, then carries a quiet static dock field', () => {
    expect(choreographyCss).toContain('animation: oracleSealedHoldingGlow 3.6s ease-in-out infinite;');
    expect(choreographyCss).toContain('Once authorized, a quieter static field');
    expect(choreographyCss).toContain('opacity: 0.13;');
    expect(choreographyCss).toContain('animation: none;');
  });

  it('removes specimen travel under Reduce Motion while preserving both final positions', () => {
    expect(choreographyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(choreographyCss).toContain("[data-oracle-state='opening']");
    expect(choreographyCss).toContain('left: 72%;');
    expect(choreographyCss).toContain('animation: none;');
    expect(choreographyCss).toContain('opacity: 0.27;');
  });
});