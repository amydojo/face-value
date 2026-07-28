import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse } from './_youcam.js';

const SESSION_COOKIE = 'fv_youcam_demo';
const SESSION_TTL_SECONDS = 30 * 60;

function expectedSecret(): string | null {
  return process.env.YOUCAM_SPIKE_TOKEN?.trim() || null;
}

function equalSecret(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(receivedBytes, expectedBytes);
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function cookieValue(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  for (const segment of cookie.split(';')) {
    const [name, ...parts] = segment.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=') || null;
  }
  return null;
}

function validSession(value: string | null, secret: string): boolean {
  if (!value) return false;
  const [expiresAt, receivedSignature] = value.split('.');
  if (!expiresAt || !receivedSignature) return false;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  return equalSecret(receivedSignature, signature(expiresAt, secret));
}

function accessError(status: 401 | 503, code: string, message: string): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
        retryable: false,
      },
    },
    status,
  );
}

export function requireYouCamAccess(request: Request): Response | null {
  return requireYouCamAccessWithOptions(request);
}

export function requireYouCamAccessWithOptions(
  request: Request,
  { allowLegacyHeader = true }: { allowLegacyHeader?: boolean } = {},
): Response | null {
  const secret = expectedSecret();
  if (!secret) {
    return accessError(
      503,
      'demo_session_not_configured',
      'The protected YouCam demo session is not configured.',
    );
  }

  const legacyHeader = request.headers.get('x-face-value-spike-token') ?? '';
  if (allowLegacyHeader && legacyHeader && equalSecret(legacyHeader, secret)) return null;
  if (validSession(cookieValue(request), secret)) return null;

  return accessError(
    401,
    'unauthorized_demo_session',
    'The protected YouCam demo session has expired or is unavailable.',
  );
}

export function createYouCamDemoSession(token: string): Response {
  const secret = expectedSecret();
  if (!secret) {
    return accessError(
      503,
      'demo_session_not_configured',
      'The protected YouCam demo session is not configured.',
    );
  }
  if (!token || !equalSecret(token, secret)) {
    return accessError(
      401,
      'unauthorized_demo_session',
      'The protected YouCam demo token was not accepted.',
    );
  }

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1_000;
  const payload = String(expiresAt);
  const value = `${payload}.${signature(payload, secret)}`;

  return Response.json(
    { authenticated: true, expiresAt: new Date(expiresAt).toISOString() },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store, max-age=0',
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; Secure; HttpOnly; SameSite=Strict`,
      },
    },
  );
}
