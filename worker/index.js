import { routeReadRequest, response } from './reads.js';
import { routeCampaignWrite } from './campaignWrites.js';
import { routeCommunityWrite } from './communityWrites.js';
import { routeAccountRequest } from './accountRoutes.js';
import { oauthCorsOrigin, routeOAuthRequest } from './oauth.js';
import { serviceGateway } from './services/gateway.js';
import { routeImageStudio } from './imageStudio.js';
import { routeImageImprove } from './imageImprove.js';
import { routeStudioRequest, routePublicStudioPage, routeStudioGenerateRequest, routeStudioStatusRequest, routeStudioVersionRequest, routePublicHelpIndex } from './studioRoutes.js';

/** Independent migration API. No Base44 proxy or payment functionality. */
export default {
  async fetch(request, env = {}) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/oauth/')) {
      const origin = oauthCorsOrigin(request, env);
      if (request.method === 'OPTIONS' && !origin) return response(403, { error: 'Origin not allowed.' });
      const result = request.method === 'OPTIONS'
        ? new Response(null, { status: 204 })
        : await routeOAuthRequest(request, env);
      if (!origin) return result;
      const headers = new Headers(result.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.append('Vary', 'Origin');
      return new Response(result.body, { status: result.status, headers });
    }
    if (pathname === '/api/public/help/index') return routePublicHelpIndex(request, env);
    if (pathname === '/api/ai/images/generate') return routeImageStudio(request, env);
    if (pathname === '/api/ai/images/improve') return routeImageImprove(request, env);
    if (pathname === '/api/services' || pathname.startsWith('/api/services/')) return serviceGateway(request, env);
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
    if (pathname === '/api/account/me' ||
        pathname === '/api/account/profile' ||
        pathname === '/api/account/connections') {
      return routeAccountRequest(request, env);
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
