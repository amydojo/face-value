import { requireYouCamAccessWithOptions } from './_youcam_session.js';

type AppShellFetcher = (request: Request) => Promise<Response>;

const fetchAppShell: AppShellFetcher = (request) => fetch(request);

function engineeringGateRedirect(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      'cache-control': 'no-store, max-age=0',
      location: '/youcam-spike?next=demo',
    },
  });
}

function protectedShellHeaders(appShell: Response): Headers {
  const headers = new Headers();
  const contentType = appShell.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  return headers;
}

export async function serveProtectedDemo(
  request: Request,
  loadAppShell: AppShellFetcher = fetchAppShell,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, {
      status: 405,
      headers: {
        allow: 'GET, HEAD',
        'cache-control': 'no-store, max-age=0',
      },
    });
  }

  const accessFailure = requireYouCamAccessWithOptions(request, {
    allowLegacyHeader: false,
  });
  if (accessFailure) return engineeringGateRedirect();

  const appShell = await loadAppShell(
    new Request(new URL('/index.html', request.url), {
      method: request.method,
      headers: {
        accept: request.headers.get('accept') ?? 'text/html',
      },
    }),
  );

  // Do not proxy static transport/entity headers such as Content-Length or
  // Content-Encoding through the function response. Preview tooling may inject
  // markup into HTML responses, and stale upstream lengths can prevent Safari
  // from committing the replacement document even after authorization succeeds.
  const body = request.method === 'HEAD' ? null : await appShell.arrayBuffer();

  return new Response(body, {
    status: appShell.status,
    statusText: appShell.statusText,
    headers: protectedShellHeaders(appShell),
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    return serveProtectedDemo(request);
  },
};
