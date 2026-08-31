const ALLOWED_PARAMS = ['ac', 'ids', 't', 'pg', 'wd', 'h'] as const;

async function getSources(request: Request, env: Env): Promise<VodSource[]> {
  const configUrl = new URL('/vod.json', request.url);
  const response = await env.ASSETS.fetch(configUrl);
  if (!response.ok) throw new Error('Source configuration is unavailable');
  return response.json<VodSource[]>();
}

function jsonError(message: string, status: number): Response {
  return Response.json(
    { code: 0, message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

async function proxyVod(request: Request, env: Env): Promise<Response> {
  const requestUrl = new URL(request.url);
  const sourceId = requestUrl.searchParams.get('source');
  if (!sourceId) return jsonError('Missing source', 400);

  const sources = await getSources(request, env);
  const source = sources.find(item => item.id === sourceId && item.isEnabled !== false);
  if (!source) return jsonError('Unknown or disabled source', 404);

  const action = requestUrl.searchParams.get('ac') || 'list';
  if (action !== 'list' && action !== 'detail') {
    return jsonError('Unsupported action', 400);
  }

  const upstreamUrl = new URL(source.url);
  for (const name of ALLOWED_PARAMS) {
    const value = requestUrl.searchParams.get(name);
    if (value) upstreamUrl.searchParams.set(name, value);
  }
  upstreamUrl.searchParams.set('ac', action);

  const upstream = await fetch(upstreamUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'TV-Catalog/1.0',
    },
    signal: AbortSignal.timeout(12_000),
    cf: {
      cacheEverything: true,
      cacheTtl: action === 'detail' && requestUrl.searchParams.has('ids') ? 300 : 60,
    },
  });

  if (!upstream.ok || !upstream.body) {
    return jsonError(`Upstream returned HTTP ${upstream.status}`, 502);
  }

  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': action === 'detail' ? 'public, max-age=120' : 'public, max-age=30',
    'X-Content-Type-Options': 'nosniff',
    'X-Vod-Source': source.id,
  });
  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET') return jsonError('Method not allowed', 405);

    try {
      if (url.pathname === '/api/vod') return await proxyVod(request, env);
      if (url.pathname === '/api/sources') {
        const sources = await getSources(request, env);
        return Response.json(sources.map(({ url: _url, ...source }) => source), {
          headers: { 'Cache-Control': 'public, max-age=300' },
        });
      }
      return jsonError('Not found', 404);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'vod_proxy_error',
        path: url.pathname,
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
      return jsonError('The video source is temporarily unavailable', 502);
    }
  },
} satisfies ExportedHandler<Env>;

interface VodSource {
  id: string;
  name: string;
  url: string;
  format?: string;
  isEnabled?: boolean;
}
