import { requireYouCamAccessWithOptions } from './_youcam_session.js';

type AppShellFetcher = (request: Request) => Promise<Response>;

const fetchAppShell: AppShellFetcher = (request) => fetch(request);

function consumerRedirect(request: Request): Response {
  return new Response(null, {
    status: 302,
    headers: {
      'cache-control': 'no-store, max-age=0',
      location: new URL('/', request.url).toString(),
    },
  });
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
  if (accessFailure) return consumerRedirect(request);

  const appShell = await loadAppShell(
    new Request(new URL('/index.html', request.url), {
      method: request.method,
      headers: {
        accept: request.headers.get('accept') ?? 'text/html',
      },
    }),
  );
  const headers = new Headers(appShell.headers);
  headers.set('cache-control', 'private, no-store, max-age=0');
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');

  return new Response(request.method === 'HEAD' ? null : appShell.body, {
    status: appShell.status,
    statusText: appShell.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    return serveProtectedDemo(request);
  },
};
