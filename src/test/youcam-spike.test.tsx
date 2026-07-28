import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YouCamSpike } from '../features/youcam-spike/YouCamSpike';

const mocks = vi.hoisted(() => ({
  analyzeCapture: vi.fn(),
}));

vi.mock('../adapters/analysis/youcam/YouCamSkinAnalysisProvider', () => ({
  YouCamProviderError: class YouCamProviderError extends Error {
    status = 500;
    code = 'fixture_error';
  },
  YouCamSkinAnalysisProvider: class YouCamSkinAnalysisProvider {
    analyzeCapture = mocks.analyzeCapture;
  },
}));

describe('YouCamSpike', () => {
  beforeEach(() => {
    mocks.analyzeCapture.mockReset();
    mocks.analyzeCapture.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Analysis cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      authenticated: true,
      expiresAt: '2026-07-27T21:00:00.000Z',
    })));
  });

  it('exchanges the token once and creates only one analysis attempt under rapid activation', async () => {
    const user = userEvent.setup();
    render(<YouCamSpike />);

    await user.type(
      screen.getByLabelText('Protected demo token'),
      'phase-b-access',
    );
    await user.click(screen.getByRole('button', { name: 'OPEN PROTECTED SESSION' }));
    await screen.findByText('SESSION OPEN');
    expect(screen.getByLabelText('Protected demo token')).toHaveValue('');
    expect(fetch).toHaveBeenCalledWith('/api/youcam/session', expect.objectContaining({
      credentials: 'include',
    }));

    const file = new File(['face'], 'baseline.jpg', { type: 'image/jpeg' });
    await user.upload(
      screen.getByLabelText('Choose a face image for the YouCam spike'),
      file,
    );

    const runButton = screen.getByRole('button', { name: 'RUN LIVE HD REDNESS' });
    await user.dblClick(runButton);

    expect(mocks.analyzeCapture).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'ANALYZING REDNESS' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Cancel analysis' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'RUN LIVE HD REDNESS' })).toBeEnabled();
    });
  });
});
