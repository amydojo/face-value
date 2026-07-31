import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function storageContents(storage: Storage): string {
  return Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index);
    return key ? storage.getItem(key) ?? '' : '';
  }).join('\n');
}

describe('YouCamSpike', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/youcam-spike');
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

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('exchanges the token once and creates only one analysis attempt under rapid activation', async () => {
    const user = userEvent.setup();
    const replaceLocation = vi.fn();
    render(<YouCamSpike replaceLocation={replaceLocation} />);

    await user.type(
      screen.getByLabelText('Protected demo token'),
      'phase-b-access',
    );
    await user.click(screen.getByRole('button', { name: 'OPEN PROTECTED SESSION' }));
    await screen.findByText('SESSION OPEN');
    expect(replaceLocation).not.toHaveBeenCalled();
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

  it('replaces the browser location with /demo after successful return-mode authentication', async () => {
    window.history.replaceState({}, '', '/youcam-spike?next=demo');
    const user = userEvent.setup();
    const replaceLocation = vi.fn();
    const token = 'demo-return-token-never-rendered';
    const log = vi.spyOn(console, 'log');
    const info = vi.spyOn(console, 'info');
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    render(<YouCamSpike replaceLocation={replaceLocation} />);

    expect(
      screen.getByText('Open the protected session to continue to Demo Lab.'),
    ).toBeVisible();
    await user.type(screen.getByLabelText('Protected demo token'), token);
    await user.click(screen.getByRole('button', { name: 'OPEN PROTECTED SESSION' }));

    await waitFor(() => {
      expect(replaceLocation).toHaveBeenCalledOnce();
    });
    expect(replaceLocation).toHaveBeenCalledWith('/demo');
    expect(screen.getByLabelText('Protected demo token')).toHaveValue('');
    expect(document.body).not.toHaveTextContent(token);
    expect(storageContents(localStorage)).not.toContain(token);
    expect(storageContents(sessionStorage)).not.toContain(token);
    expect([
      ...log.mock.calls,
      ...info.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ].flat().join(' ')).not.toContain(token);
  });

  it('reads the literal Demo Lab return mode once when the gate mounts', async () => {
    window.history.replaceState({}, '', '/youcam-spike?next=demo');
    const user = userEvent.setup();
    const replaceLocation = vi.fn();
    render(<YouCamSpike replaceLocation={replaceLocation} />);
    window.history.replaceState({}, '', '/youcam-spike?next=https%3A%2F%2Fevil.example');

    await user.type(screen.getByLabelText('Protected demo token'), 'phase-b-access');
    await user.click(screen.getByRole('button', { name: 'OPEN PROTECTED SESSION' }));

    await waitFor(() => {
      expect(replaceLocation).toHaveBeenCalledWith('/demo');
    });
  });

  it.each([
    'next=https://evil.example',
    'next=https%3A%2F%2Fevil.example',
    'next=..%2F',
    'next=%2Fdemo',
    'next=Demo',
    'next=demo%2F',
  ])('ignores non-literal return query %s', async (query) => {
    window.history.replaceState({}, '', `/youcam-spike?${query}`);
    const user = userEvent.setup();
    const replaceLocation = vi.fn();
    render(<YouCamSpike replaceLocation={replaceLocation} />);

    expect(
      screen.queryByText('Open the protected session to continue to Demo Lab.'),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Protected demo token'), 'phase-b-access');
    await user.click(screen.getByRole('button', { name: 'OPEN PROTECTED SESSION' }));

    await screen.findByText('SESSION OPEN');
    expect(replaceLocation).not.toHaveBeenCalled();
  });
});
