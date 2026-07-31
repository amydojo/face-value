import { afterEach, describe, expect, it, vi } from 'vitest';
import { serveProtectedDemo } from '../../api/demo';
import {
  createYouCamDemoSession,
  requireYouCamAccess,
} from '../../api/_youcam_session';

afterEach(() => {
  delete process.env.YOUCAM_SPIKE_TOKEN;
  vi.useRealTimers();
});

describe('YouCam demo authorization boundary', () => {
  it('issues a short-lived Secure HttpOnly SameSite cookie and accepts it', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const response = createYouCamDemoSession('phase-b-secret-value');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Max-Age=1800');
    expect(setCookie).toContain('Path=/;');
    expect(setCookie).not.toContain('Path=/api/youcam');
    expect(setCookie).not.toContain('phase-b-secret-value');

    const cookie = setCookie.split(';')[0];
    const accessFailure = requireYouCamAccess(new Request('https://face-value.test/api/youcam/task', {
      headers: { cookie },
    }));
    expect(accessFailure).toBeNull();
  });

  it('fails closed without a valid session', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const failure = requireYouCamAccess(new Request('https://face-value.test/api/youcam/task'));
    expect(failure?.status).toBe(401);
    expect(await failure?.json()).toMatchObject({
      error: { code: 'unauthorized_demo_session' },
    });
  });

  it('redirects unauthorized /demo requests to the engineering gate without loading the shell', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const loadAppShell = vi.fn();

    const response = await serveProtectedDemo(
      new Request('https://face-value.test/demo'),
      loadAppShell,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/youcam-spike?next=demo');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('location')).not.toContain('phase-b-secret-value');
    expect(response.headers.get('location')).not.toContain('fv_youcam_demo');
    expect(loadAppShell).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain('Demo Lab');
  });

  it('redirects invalid signed-cookie shapes to the engineering gate', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const loadAppShell = vi.fn();

    const response = await serveProtectedDemo(
      new Request('https://face-value.test/demo', {
        headers: { cookie: 'fv_youcam_demo=not-a-valid-signed-session' },
      }),
      loadAppShell,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/youcam-spike?next=demo');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(loadAppShell).not.toHaveBeenCalled();
  });

  it('redirects an expired signed cookie to the engineering gate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T20:00:00.000Z'));
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const session = createYouCamDemoSession('phase-b-secret-value');
    const cookie = (session.headers.get('set-cookie') ?? '').split(';')[0];
    vi.advanceTimersByTime((30 * 60 * 1_000) + 1);
    const loadAppShell = vi.fn();

    const response = await serveProtectedDemo(
      new Request('https://face-value.test/demo', {
        headers: { cookie },
      }),
      loadAppShell,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/youcam-spike?next=demo');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(loadAppShell).not.toHaveBeenCalled();
  });

  it('serves the production app shell for /demo only with the signed session cookie', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const session = createYouCamDemoSession('phase-b-secret-value');
    const cookie = (session.headers.get('set-cookie') ?? '').split(';')[0];
    const loadAppShell = vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe('/index.html');
      return new Response('<div id="root"></div>', {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });

    const response = await serveProtectedDemo(
      new Request('https://face-value.test/demo', {
        headers: { cookie },
      }),
      loadAppShell,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(await response.text()).toBe('<div id="root"></div>');
    expect(loadAppShell).toHaveBeenCalledOnce();
  });

  it('does not accept the legacy raw-token header as /demo navigation access', async () => {
    process.env.YOUCAM_SPIKE_TOKEN = 'phase-b-secret-value';
    const loadAppShell = vi.fn();

    const response = await serveProtectedDemo(
      new Request('https://face-value.test/demo', {
        headers: { 'x-face-value-spike-token': 'phase-b-secret-value' },
      }),
      loadAppShell,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/youcam-spike?next=demo');
    expect(loadAppShell).not.toHaveBeenCalled();
  });
});
