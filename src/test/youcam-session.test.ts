import { afterEach, describe, expect, it } from 'vitest';
import {
  createYouCamDemoSession,
  requireYouCamAccess,
} from '../../api/_youcam_session';

afterEach(() => {
  delete process.env.YOUCAM_SPIKE_TOKEN;
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
});
