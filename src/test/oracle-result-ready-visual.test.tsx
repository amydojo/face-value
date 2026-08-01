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

  it('holds the canonical wrapper and sealed specimen at true center without changing the dock', () => {
    expect(choreographyCss).toContain('--oracle-specimen-dock-offset: clamp(54px, 16.5vw, 74px);');
    expect(choreographyCss).not.toContain(
      '--oracle-specimen-dock-offset: clamp(46px, 14.6vw, 63px);',
    );
    expect(choreographyCss).toContain('left: 50%;');
    expect(choreographyCss).toContain('top: 106%;');
    expect(choreographyCss).toContain("[data-specimen-layer='contact-shadow']");
    expect(choreographyCss).toContain('transform: scale(0.76);');
  });

  it('reserves a bounded left firmware lane for verdict and trial metadata', () => {
    expect(choreographyCss).toContain('--oracle-verdict-copy-lane: 57%;');
    expect(choreographyCss).toContain(
      '--oracle-verdict-lane-gap: clamp(12px, 3.6vw, 16px);',
    );
    expect(choreographyCss).toContain(
      'grid-template-columns: minmax(0, var(--oracle-verdict-copy-lane)) minmax(0, 1fr);',
    );
    expect(choreographyCss).toContain('[data-firmware-state] > header');
    expect(choreographyCss).toContain('[data-firmware-state]\n  > div:first-of-type');
    expect(choreographyCss).toContain('[data-firmware-state]\n  [data-oracle-finding]');
    expect(choreographyCss).toContain('max-width: 100%;');
  });

  it('translates only rendered layers during opening and keeps them docked for every result phase', () => {
    expect(choreographyCss).toContain("[data-oracle-state='opening']");
    expect(choreographyCss).toContain('> :not(style)');
    expect(choreographyCss).toContain(
      'transition: translate var(--oracle-opening-duration, 400ms)',
    );
    expect(choreographyCss).toContain('cubic-bezier(0.16, 1.08, 0.3, 1)');
    expect(choreographyCss).toContain('translate: var(--oracle-specimen-dock-offset) 0;');

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

  it('generates a visible breathing field only while sealed', () => {
    expect(choreographyCss).toContain("content: '';\n  translate: 0 0;");
    expect(choreographyCss).toContain('animation: oracleSealedHoldingGlow 3.6s ease-in-out infinite;');
    expect(choreographyCss).toContain('@keyframes oracleSealedHoldingGlow');
    expect(choreographyCss).toContain('opacity: 0.5;');
    expect(choreographyCss).toContain('transform: scale(1.06);');
    expect(choreographyCss).toContain('Once authorized, a quieter static field');
    expect(choreographyCss).toContain('opacity: 0.13;');
    expect(choreographyCss).toContain('animation: none;');
  });

  it('removes specimen travel and aura breathing under Reduce Motion', () => {
    expect(choreographyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(choreographyCss).toContain('transition: none;');
    expect(choreographyCss).toContain('translate: var(--oracle-specimen-dock-offset) 0;');
    expect(choreographyCss).toContain('opacity: 0.4;');
    expect(choreographyCss).toContain('transform: scale(1.01);');
    expect(choreographyCss).toContain('animation: none;');
  });
});