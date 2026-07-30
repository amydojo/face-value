import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CaptureQuality } from '../domain/captureAcquisition';
import {
  CaptureSequence,
  createCaptureSequenceState,
  reduceCaptureSequence,
  type CaptureIssue,
  type CapturePhase,
  type CaptureSequenceState,
} from '../features/capture-sequence';

const quality = (overrides: Partial<CaptureQuality> = {}): CaptureQuality => ({
  facePresent: true,
  distanceValid: true,
  alignmentValid: true,
  angleValid: true,
  lightingValid: true,
  stillnessValid: true,
  ...overrides,
});

const stateFor = (
  phase: CapturePhase,
  {
    activeIssue = null,
    quality: nextQuality = quality(),
    capturedImage = null,
  }: {
    activeIssue?: CaptureIssue | null;
    quality?: CaptureQuality;
    capturedImage?: string | null;
  } = {},
): CaptureSequenceState => ({
  ...createCaptureSequenceState(0),
  phase,
  phaseEnteredAt: 0,
  activeIssue,
  quality: nextQuality,
  capturedImage,
});

const renderSequence = (state: CaptureSequenceState, reducedMotion = false) =>
  render(
    <CaptureSequence
      state={state}
      accession="FV–014"
      product="Azelaic Topical Acid"
      job="Reduce visible redness"
      mountRef={createRef<HTMLDivElement>()}
      fixture
      previewLive
      reducedMotion={reducedMotion}
    />,
  );

describe('canonical capture phase presentation', () => {
  it('renders Searching with one quiet guide and one active instruction', () => {
    renderSequence(
      stateFor('searching', {
        activeIssue: 'face-missing',
        quality: quality({
          facePresent: false,
          distanceValid: false,
          alignmentValid: false,
          angleValid: false,
          lightingValid: false,
          stillnessValid: false,
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: 'Position your face' })).toBeVisible();
    expect(screen.getByText('Looking for a stable frame')).toBeVisible();
    expect(document.querySelectorAll('[data-face-acquisition-guide]')).toHaveLength(1);
    expect(document.querySelector('[data-guide-phase="searching"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-guide-segment]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-guide-connector]')).toHaveLength(4);
    expect(document.querySelector('ellipse')).toBeNull();
    expect(document.querySelector('[data-capture-scan-band]')).toBeNull();
  });

  it('renders Aligning with one deterministic distance issue', () => {
    renderSequence(
      stateFor('aligning', {
        activeIssue: 'too-far',
        quality: quality({
          distanceValid: false,
          stillnessValid: false,
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: 'Move slightly closer' })).toBeVisible();
    expect(screen.getByLabelText('alignment: current')).toBeVisible();
  });

  it('renders Aligning with light as the only current rail condition', () => {
    renderSequence(
      stateFor('aligning', {
        activeIssue: 'uneven-light',
        quality: quality({
          lightingValid: false,
          stillnessValid: false,
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: 'Move toward softer light' })).toBeVisible();
    expect(screen.getByLabelText('light: current')).toBeVisible();
    expect(screen.getByLabelText('alignment: passed')).toBeVisible();
  });

  it('renders Locking without success language or a second guide', () => {
    renderSequence(stateFor('locking'));
    expect(screen.getByRole('heading', { name: 'Frame locked' })).toBeVisible();
    expect(document.querySelectorAll('[data-face-acquisition-guide]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-guide-segment]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-guide-connector]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-capture-guide-anchor]')).toHaveLength(4);
    expect(document.querySelector('ellipse')).toBeNull();
    expect(screen.getAllByLabelText(/: passed$/)).toHaveLength(3);
    expect(screen.queryByLabelText(/: current$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Good|Perfect|Passed|Success/)).not.toBeInTheDocument();
  });

  it('renders the warm scan optics only during Scanning', () => {
    renderSequence(stateFor('scanning'));
    expect(
      screen.getByRole('heading', {
        name: 'Reading capture conditions',
      }),
    ).toBeVisible();
    expect(document.querySelector('[data-capture-scan-band]')).toBeTruthy();
    expect(document.querySelector('[data-capture-scan-atmosphere]')).toBeTruthy();
    expect(document.querySelector('[data-capture-scan-optic]')).toBeTruthy();
    expect(document.querySelector('[data-region-registration-overlay]')).toBeNull();
  });

  it('renders Captured over the same persistent bitmap and guide', () => {
    renderSequence(
      stateFor('captured', {
        capturedImage: 'blob:abstract-specimen',
      }),
    );
    expect(screen.getByRole('heading', { name: 'Baseline secured' })).toBeVisible();
    expect(document.querySelector('[data-frame-frozen="true"]')).toBeTruthy();
    expect(document.querySelector('[data-capture-shutter]')).toBeTruthy();
    expect(document.querySelector('[data-captured-specimen-transition]')).toBeTruthy();
    expect(document.querySelector('[data-guide-phase="captured"]')).toBeTruthy();
  });

  it('renders the exact permission error and keeps photo fallback outside the component', () => {
    const state = reduceCaptureSequence(createCaptureSequenceState(0), {
      type: 'FAILED',
      failure: 'permission-denied',
      at: 0,
    });
    renderSequence(state);
    expect(screen.getByRole('heading', { name: 'Camera access is needed' })).toBeVisible();
    expect(screen.getByText('Enable camera access or choose a photo instead')).toBeVisible();
  });

  it('marks reduced motion while retaining state and copy', () => {
    renderSequence(stateFor('scanning'), true);
    expect(
      document.querySelector('[data-capture-sequence][data-reduced-motion="true"]'),
    ).toBeTruthy();
    expect(
      document
        .querySelector<HTMLElement>('[data-capture-sequence]')
        ?.style.getPropertyValue('--fv-capture-reduced-scan-duration'),
    ).toBe('300ms');
    expect(
      screen.getByRole('heading', {
        name: 'Reading capture conditions',
      }),
    ).toBeVisible();
  });

  it('shows one stable opening instruction and no synthetic person in production', () => {
    render(
      <CaptureSequence
        state={stateFor('searching', { activeIssue: 'face-missing' })}
        accession="FV–014"
        product="Specimen"
        job="Observation"
        mountRef={createRef<HTMLDivElement>()}
        fixture={false}
        previewLive={false}
        previewStatus="waiting-first-frame"
        reducedMotion={false}
      />,
    );
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Preparing preview' })).toBeVisible();
    expect(screen.getByText('This may take a moment')).toBeVisible();
    expect(document.querySelector('[data-native-camera-preview]')).toBeTruthy();
    expect(document.querySelector('[data-capture-synthetic-feed]')).toBeNull();
  });

  it('removes the guide and rail when the camera is unavailable', () => {
    const failed = reduceCaptureSequence(createCaptureSequenceState(0), {
      type: 'FAILED',
      failure: 'camera-unavailable',
      at: 0,
    });
    renderSequence(failed);
    expect(document.querySelector('[data-face-acquisition-guide]')).toBeNull();
    expect(document.querySelector('[data-capture-quality-rail]')).toBeNull();
  });

  it('keeps one persistent authored guide path system across all five phases', () => {
    const { rerender } = render(
      <CaptureSequence
        state={stateFor('searching', { activeIssue: 'face-missing' })}
        accession="FV–014"
        product="Specimen"
        job="Observation"
        mountRef={createRef<HTMLDivElement>()}
        fixture
        previewLive
        reducedMotion={false}
      />,
    );
    const guide = document.querySelector('[data-face-acquisition-guide]');
    const segmentGroup = guide?.querySelector('[data-capture-guide-segments]');
    const connectorGroup = guide?.querySelector('[data-capture-guide-connectors]');
    const segmentPaths = [...(segmentGroup?.querySelectorAll('path') ?? [])];
    const connectorPaths = [...(connectorGroup?.querySelectorAll('path') ?? [])];
    expect(segmentPaths).toHaveLength(4);
    expect(connectorPaths).toHaveLength(4);
    expect(guide?.querySelector('ellipse')).toBeNull();
    expect(segmentPaths.every((path) => !path.hasAttribute('stroke-dasharray'))).toBe(true);

    for (const phase of ['aligning', 'locking', 'scanning', 'captured'] as const) {
      rerender(
        <CaptureSequence
          state={stateFor(phase, {
            capturedImage: phase === 'captured' ? 'blob:abstract-specimen' : null,
          })}
          accession="FV–014"
          product="Specimen"
          job="Observation"
          mountRef={createRef<HTMLDivElement>()}
          fixture
          previewLive
          reducedMotion={false}
        />,
      );
      expect(document.querySelector('[data-face-acquisition-guide]')).toBe(guide);
      expect(guide?.querySelector('[data-capture-guide-segments]')).toBe(segmentGroup);
      expect(guide?.querySelector('[data-capture-guide-connectors]')).toBe(connectorGroup);
      expect([...(guide?.querySelectorAll('[data-guide-segment]') ?? [])]).toEqual(
        segmentPaths,
      );
      expect([...(guide?.querySelectorAll('[data-guide-connector]') ?? [])]).toEqual(
        connectorPaths,
      );
    }
  });

  it('marks active and error compositions without changing the component family', () => {
    const { rerender } = render(
      <CaptureSequence
        state={stateFor('aligning', { activeIssue: 'too-far' })}
        accession="FV–014"
        product="Specimen"
        job="Observation"
        mountRef={createRef<HTMLDivElement>()}
        fixture
        previewLive
        activeCapture
        reducedMotion={false}
      />,
    );
    const sequence = document.querySelector('[data-capture-sequence]');
    expect(sequence).toHaveAttribute('data-capture-layout', 'active');

    rerender(
      <CaptureSequence
        state={reduceCaptureSequence(createCaptureSequenceState(0), {
          type: 'FAILED',
          failure: 'camera-unavailable',
          at: 0,
        })}
        accession="FV–014"
        product="Specimen"
        job="Observation"
        mountRef={createRef<HTMLDivElement>()}
        fixture
        previewLive={false}
        activeCapture={false}
        reducedMotion={false}
      />,
    );
    expect(document.querySelector('[data-capture-sequence]')).toBe(sequence);
    expect(sequence).toHaveAttribute('data-capture-layout', 'error');
  });
});
