import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CaptureSequence, createCaptureSequenceState } from '../features/capture-sequence';

const renderSequence = ({
  activeCapture,
  previewLive,
  previewStatus,
}: {
  activeCapture: boolean;
  previewLive: boolean;
  previewStatus: 'idle' | 'requesting-permission' | 'waiting-first-frame' | 'preview-live';
}) =>
  render(
    <CaptureSequence
      state={createCaptureSequenceState(0)}
      accession="FV–014"
      product="Azelaic Topical Acid"
      job="Reduce visible redness"
      mountRef={createRef<HTMLDivElement>()}
      fixture
      previewLive={previewLive}
      previewStatus={previewStatus}
      activeCapture={activeCapture}
      reducedMotion={false}
      captureKind="baseline"
    />,
  );

describe('submission continuity camera state truth', () => {
  it('does not claim sensing before guided capture starts', () => {
    renderSequence({ activeCapture: false, previewLive: false, previewStatus: 'idle' });

    expect(screen.getByRole('heading', { name: 'Ready for your baseline' })).toBeVisible();
    expect(screen.getByText('Start guided capture below. We’ll ask for camera access first.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Position your face' })).not.toBeInTheDocument();
  });

  it('asks for camera access until a live preview genuinely exists', () => {
    renderSequence({
      activeCapture: true,
      previewLive: false,
      previewStatus: 'requesting-permission',
    });

    expect(screen.getByRole('heading', { name: 'Allow camera access' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Position your face' })).not.toBeInTheDocument();
  });

  it('allows positioning guidance only after preview-live', () => {
    renderSequence({ activeCapture: true, previewLive: true, previewStatus: 'preview-live' });

    expect(screen.getByRole('heading', { name: 'Position your face' })).toBeVisible();
    expect(screen.getByText('Looking for a stable frame')).toBeVisible();
  });
});
