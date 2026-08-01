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

const authoredVerdictLines = [
  ['VISIBLE REDNESS', 'IMPROVED ACROSS', 'COMPARABLE SCANS.'],
  ['VISIBLE REDNESS', 'MOVED IN A', 'FAVORABLE DIRECTION.'],
  ['NO DETECTABLE', 'IMPROVEMENT', 'SHOWED UP.'],
  ['THIS COMPARISON', 'WAS NOT', 'READABLE.'],
  ['THE TRIAL', 'DID NOT ISOLATE', 'THIS PRODUCT.'],
  ['VISIBLE REDNESS', 'WORSENED ACROSS', 'COMPARABLE SCANS.'],
] as const;

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

  it('holds the sealed specimen at true center and moves the dock only modestly farther right', () => {
    expect(choreographyCss).toContain('--oracle-specimen-dock-offset: clamp(60px, 18.2vw, 80px);');
    expect(choreographyCss).not.toContain(
      '--oracle-specimen-dock-offset: clamp(54px, 16.5vw, 74px);',
    );
    expect(choreographyCss).toContain('left: 50%;');
    expect(choreographyCss).toContain('top: 106%;');
    expect(choreographyCss).toContain("[data-specimen-layer='contact-shadow']");
    expect(choreographyCss).toContain('transform: scale(0.76);');
  });

  it('reserves a full-width header, bounded copy lane, and stable NEXT row', () => {
    expect(choreographyCss).toContain('--oracle-verdict-copy-lane: 57%;');
    expect(choreographyCss).toContain(
      '--oracle-verdict-lane-gap: clamp(12px, 3.6vw, 16px);',
    );
    expect(choreographyCss).toContain(
      'grid-template-columns: minmax(0, var(--oracle-verdict-copy-lane)) minmax(0, 1fr);',
    );
    expect(choreographyCss).toContain(
      'grid-template-rows: 26px minmax(62px, 1fr) minmax(42px, 0.7fr);',
    );
    expect(choreographyCss).toContain('grid-column: 1 / -1;');
    expect(choreographyCss).toContain('justify-content: space-between;');
    expect(choreographyCss).toContain('text-align: right;');
    expect(choreographyCss).toContain('grid-row: 3;');
    expect(choreographyCss).toContain('padding-top: clamp(6px, 1.8vw, 8px);');
  });

  it('projects every frozen verdict into exactly three authored non-wrapping visual lines', () => {
    expect(authoredVerdictLines.every((lines) => lines.length <= 3)).toBe(true);
    expect(choreographyCss).toContain('white-space: pre;');
    expect(choreographyCss).toContain('font-size: clamp(10.5px, 3.05vw, 12.4px);');
    expect(choreographyCss).toContain('font-size: clamp(11.5px, 3.45vw, 14px);');

    for (const lines of authoredVerdictLines) {
      expect(choreographyCss).toContain(`content: '${lines.join('\\A ')}';`);
    }

    expect(choreographyCss).toContain('COMPARABLE SCANS.');
    expect(choreographyCss).toContain('FAVORABLE DIRECTION.');
    expect(choreographyCss).toContain('color: transparent;');
    expect(choreographyCss).toContain('font-size: 0;');
  });

  it('uses a delayed Apple-like precision glide without moving the canonical wrapper', () => {
    expect(choreographyCss).toContain('--oracle-dock-delay: 180ms;');
    expect(choreographyCss).toContain('--oracle-dock-duration: 480ms;');
    expect(choreographyCss).toContain('--oracle-dock-ease: cubic-bezier(0.22, 1, 0.36, 1);');
    expect(choreographyCss).toContain('> :not(style)');
    expect(choreographyCss).toContain('translate: var(--oracle-specimen-dock-offset) 0;');
    expect(choreographyCss).toContain('@keyframes oracleFieldRelease');
    expect(choreographyCss).toContain('@keyframes oracleShadowTighten');
    expect(choreographyCss).toContain('@keyframes oracleDockCapture');
    expect(choreographyCss).toContain('@keyframes oracleFirmwareUncover');
    expect(choreographyCss).toContain('animation: oracleFirmwareUncover 260ms');

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

  it('keeps an active dock field after authorization and dims it through record completion', () => {
    expect(choreographyCss).toContain('Once authorized, a compact static field');
    expect(choreographyCss).toContain('animation: oracleDockCapture 280ms');
    expect(choreographyCss).toContain("[data-specimen-layer='right-rim']");
    expect(choreographyCss).toContain("[data-specimen-layer='base-reflection']");
    expect(choreographyCss).toContain("[data-oracle-state='committing']");
    expect(choreographyCss).toContain('opacity: 0.13;');
    expect(choreographyCss).toContain("[data-oracle-state='dispensing']");
    expect(choreographyCss).toContain('opacity: 0.09;');
    expect(choreographyCss).toContain("[data-oracle-state='collected']");
    expect(choreographyCss).toContain('opacity: 0.06;');
  });

  it('generates a visible breathing field only while sealed', () => {
    expect(choreographyCss).toContain("content: '';\n  translate: 0 0;");
    expect(choreographyCss).toContain('animation: oracleSealedHoldingGlow 3.6s ease-in-out infinite;');
    expect(choreographyCss).toContain('@keyframes oracleSealedHoldingGlow');
    expect(choreographyCss).toContain('opacity: 0.5;');
    expect(choreographyCss).toContain('transform: scale(1.06);');
  });

  it('removes travel, field contraction, capture, and firmware stagger under Reduce Motion', () => {
    expect(choreographyCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(choreographyCss).toContain('transition: none;');
    expect(choreographyCss).toContain('translate: var(--oracle-specimen-dock-offset) 0;');
    expect(choreographyCss).toContain('opacity: 0.4;');
    expect(choreographyCss).toContain('transform: scale(1.01);');
    expect(choreographyCss).toContain('animation: none;');
  });
});