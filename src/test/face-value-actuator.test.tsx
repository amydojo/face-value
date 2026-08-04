import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  FaceValueActuator,
  type FaceValueActuatorState,
} from '../components/FaceValueActuator';
import actuatorCss from '../components/FaceValueActuator.module.css?raw';

describe('FaceValueActuator', () => {
  it.each<{
    state: FaceValueActuatorState;
    ring: 'ready' | 'scanning' | null;
    depth: 'standard' | 'captured';
  }>([
    { state: 'rest', ring: null, depth: 'standard' },
    { state: 'ready', ring: 'ready', depth: 'standard' },
    { state: 'scanning', ring: 'scanning', depth: 'standard' },
    { state: 'captured', ring: null, depth: 'captured' },
  ])('renders the canonical $state visual contract', ({ state, ring, depth }) => {
    const { container } = render(<FaceValueActuator state={state} />);
    const actuator = container.querySelector('[data-face-value-actuator]');
    const rings = container.querySelectorAll('[data-actuator-ring]');

    expect(actuator).toHaveAttribute('data-actuator-state', state);
    expect(actuator).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('[data-actuator-layer="housing"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-actuator-layer="bezel"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-actuator-layer="recess"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-actuator-layer="cap-gloss"]')).toHaveLength(1);
    expect(container.querySelector('[data-actuator-cap]')).toHaveAttribute(
      'data-actuator-cap-depth',
      depth,
    );
    expect(rings).toHaveLength(ring ? 1 : 0);
    if (ring) expect(rings.item(0)).toHaveAttribute('data-actuator-ring', ring);
    if (state === 'scanning') expect(actuator).toHaveAttribute('data-actuator-active', 'true');
    else expect(actuator).not.toHaveAttribute('data-actuator-active');
  });

  it('can expose a standalone image name without moving semantics into decorative internals', () => {
    const { container } = render(<FaceValueActuator state="scanning" decorative={false} />);
    const actuator = container.querySelector('[data-face-value-actuator]');

    expect(actuator).not.toHaveAttribute('aria-hidden');
    expect(actuator).toHaveAttribute('role', 'img');
    expect(actuator).toHaveAccessibleName('Face Value actuator: scanning');
  });

  it('keeps the 64 px master geometry scalable through one inherited custom property', () => {
    expect(actuatorCss).toContain('--fv-actuator-render-size: var(--fv-actuator-size, 64px);');
    expect(actuatorCss).toContain('top: 7.8125%;');
    expect(actuatorCss).toContain('left: 9.375%;');
    expect(actuatorCss).toContain('width: 81.25%;');
    expect(actuatorCss).toContain('top: 12.5%;');
    expect(actuatorCss).toContain('left: 14.0625%;');
    expect(actuatorCss).toContain('width: 71.875%;');
    expect(actuatorCss).toContain('top: 21.875%;');
    expect(actuatorCss).toContain('width: 56.25%;');
  });

  it('uses bounded state-entry motion and removes it for reduced motion', () => {
    expect(actuatorCss).not.toMatch(/infinite/);
    expect(actuatorCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(actuatorCss).toContain('.readyRing,');
    expect(actuatorCss).toContain('.scanningRing {');
    expect(actuatorCss).toContain('animation: none;');
    expect(actuatorCss).toContain('transition: none;');
  });
});
