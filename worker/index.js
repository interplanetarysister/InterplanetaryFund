export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'interplanetary-fund', backend: 'cloudflare', version: 'migration-0.1' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
