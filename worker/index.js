import { routeReadRequest, response } from './reads.js';
import { routeCampaignWrite } from './campaignWrites.js';
import { routeCommunityWrite } from './communityWrites.js';
import { routeAccountRequest } from './accountRoutes.js';
import { routeOAuthRequest } from './oauth.js';
import { routeStudioRequest, routePublicStudioPage, routeStudioGenerateRequest, routeStudioStatusRequest, routeStudioVersionRequest } from './studioRoutes.js';


function allowedFrontendOrigin(origin, env) {
  if (!origin || origin.length > 512) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) return false;
    return String(env.OAUTH_FRONTEND_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean).includes(origin);
  } catch { return false; }
}
function withCors(request, env, result) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith('/api/oauth/') && pathname !== '/api/account/connections') return result;
  const origin = request.headers.get('origin') || '';
  if (!origin) return result;
  if (!allowedFrontendOrigin(origin, env)) return response(403, { error: 'Origin not allowed.' });
  const headers = new Headers(result.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '600');
  headers.append('Vary', 'Origin');
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}

/** Independent migration API. No Base44 proxy or payment functionality. */
export default {
  async fetch(request, env = {}) {
    const pathname = new URL(request.url).pathname;
    const corsPath = pathname.startsWith('/api/oauth/') || pathname === '/api/account/connections';
    if (corsPath && request.method === 'OPTIONS') {
      const origin = request.headers.get('origin') || '';
      if (!allowedFrontendOrigin(origin, env)) return response(403, { error: 'Origin not allowed.' });
      return withCors(request, env, new Response(null, { status: 204 }));
    }
    if (pathname === '/api/studio/pages' || /^\/api\/studio\/pages\/[0-9a-f-]+$/i.test(pathname)) return routeStudioRequest(request, env);
    if (pathname === '/api/studio/generate') return routeStudioGenerateRequest(request, env);
    if (pathname === '/api/studio/status') return routeStudioStatusRequest(request, env);
    if (/^\/api\/studio\/pages\/[0-9a-f-]+\/versions(?:\/[0-9]+\/restore)?$/i.test(pathname)) return routeStudioVersionRequest(request, env);
    if (/^\/api\/public\/studio\/pages\/[a-z0-9-]+$/i.test(pathname)) return routePublicStudioPage(request, env);
    if (pathname === '/api/health') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      return response(200, { status: 'ok', service: 'ifund-migration-api', production: false });
    }
    if (pathname === '/api/community/feed' ||
        pathname === '/api/campaigns/public' ||
        pathname === '/api/campaigns/mine' ||
        /^\/api\/campaigns\/[a-f0-9-]+\/draft$/i.test(pathname)) {
      return routeReadRequest(request, env);
    }
    if (request.method === 'GET' && /^\/api\/campaigns\/[^/]+$/.test(pathname)) {
      return routeReadRequest(request, env);
    }
    if (pathname.startsWith('/api/oauth/')) return withCors(request, env, await routeOAuthRequest(request, env));
    if (pathname === '/api/account/me' ||
        pathname === '/api/account/profile' ||
        pathname === '/api/account/connections') {
      return withCors(request, env, await routeAccountRequest(request, env));
    }
    if (pathname === '/api/community/posts' ||
        /^\/api\/community\/posts\/[^/]+$/.test(pathname)) {
      return routeCommunityWrite(request, env);
    }
    if (pathname === '/api/campaigns' || /^\/api\/campaigns\/[^/]+$/.test(pathname)) {
      return routeCampaignWrite(request, env);
    }
    return response(404, { error: 'Not found.' });
  },
};
