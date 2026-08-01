import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalysisActivityField } from '../features/capture-sequence/AnalysisActivityField';
import { CapturedSpecimenTransition } from '../features/capture-sequence/CapturedSpecimenTransition';
import { CaptureInstruction } from '../features/capture-sequence/CaptureInstruction';
import { FaceAcquisitionGuide } from '../features/capture-sequence/FaceAcquisitionGuide';

function renderLayerStack(reducedMotion = false) {
  return render(
    <div data-capture-sequence data-reduced-motion={reducedMotion}>
      <CapturedSpecimenTransition />
      <AnalysisActivityField />
      <FaceAcquisitionGuide phase="captured" activeIssue={null} />
      <CaptureInstruction
        phase="captured"
        copy={{
          primary: 'Analyzing your scan',
          secondary: 'Checking three measurements for consistency.',
        }}
      >
        <div data-measurement-indicator />
      </CaptureInstruction>
    </div>,
  );
}

describe('amber analysis activity field visibility', () => {
  it('uses an explicit veil, activity, guide, and instruction layer order', () => {
    renderLayerStack();

    const veil = document.querySelector<HTMLElement>('[data-capture-layer="captured-veil"]');
    const activity = document.querySelector<SVGElement>(
      '[data-capture-layer="analysis-activity"]',
    );
    const guide = document.querySelector<HTMLElement>(
      '[data-capture-layer="acquisition-guide"]',
    );
    const instruction = document.querySelector<HTMLElement>(
      '[data-capture-layer="instruction-and-progress"]',
    );

    expect(veil?.style.zIndex).toBe('4');
    expect(activity?.style.zIndex).toBe('5');
    expect(guide?.style.zIndex).toBe('6');
    expect(instruction?.style.zIndex).toBe('10');
    expect(activity).toHaveAttribute('data-activity-layer', 'above-veil-below-guide');
  });

  it('keeps the field authored, decorative, clipped, and visible at restrained values', () => {
    renderLayerStack();

    const field = document.querySelector<SVGElement>('[data-analysis-activity-field]');
    const points = [...document.querySelectorAll<SVGCircleElement>('[data-analysis-activity-point]')];
    const connections = document.querySelectorAll('[data-analysis-activity-connection]');
    const fieldCss = field?.querySelector('style')?.textContent ?? '';

    expect(field).toHaveAttribute('aria-hidden', 'true');
    expect(field).not.toHaveAttribute('aria-label');
    expect(field).toHaveAttribute('data-activity-coordinate-source', 'authored-static');
    expect(field).toHaveAttribute('data-activity-scientific-meaning', 'none');
    expect(field).toHaveAttribute('data-activity-active-point-target', '3-5');
    expect(field).toHaveAttribute('data-activity-cycle-ms', '2800');
    expect(field).toHaveAttribute('data-activity-point-rest-opacity', '0.12');
    expect(field).toHaveAttribute('data-activity-point-active-opacity', '0.72');
    expect(field).toHaveAttribute('data-activity-connection-peak-opacity', '0.36');
    expect(points).toHaveLength(21);
    expect(points.every((point) => point.getAttribute('r') === '2.15')).toBe(true);
    expect(connections).toHaveLength(3);
    expect(field?.querySelector('clipPath ellipse')).toBeTruthy();
    expect(field?.querySelector('canvas, image, foreignObject')).toBeNull();
    expect(fieldCss).toContain('opacity: 0.12;');
    expect(fieldCss).toContain('opacity: 0.72;');
    expect(fieldCss).toContain('opacity: 0.36;');
    expect(fieldCss).toContain('stroke-width: 0.7;');
  });

  it('keeps a static low-opacity field when reduced motion is active', () => {
    renderLayerStack(true);

    const field = document.querySelector<SVGElement>('[data-analysis-activity-field]');
    const fieldCss = field?.querySelector('style')?.textContent ?? '';

    expect(field).toHaveAttribute('data-activity-reduced-motion', 'static');
    expect(fieldCss).toContain("[data-reduced-motion='true']");
    expect(fieldCss).toContain('animation: none;');
    expect(fieldCss).toContain('opacity: 0.16;');
    expect(fieldCss).toContain('opacity: 0.08;');
  });
});
