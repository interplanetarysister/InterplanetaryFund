import { routeReadRequest, response } from './reads.js';
import { routeCampaignWrite } from './campaignWrites.js';
import { routeCommunityWrite } from './communityWrites.js';
import { routeAccountRequest } from './accountRoutes.js';
import { geocodeCity } from './geocodeCity.js';

/** Independent migration API. No Base44 proxy or payment functionality. */
export default {
  async fetch(request, env = {}) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/public-config') {
      if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
      if (env.SUPABASE_URL !== 'https://ssibsfmtodgximseeqsv.supabase.co' ||
          typeof env.SUPABASE_PUBLISHABLE_KEY !== 'string' || !env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
        return response(503, { error: 'Public configuration unavailable.' });
      }
      // Publishable keys are intentionally browser-visible; private and legacy
      // JWT-shaped credentials are never returned by this endpoint.
      return response(200, { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY });
    }
    if (pathname === '/functions/geocodeCity' || pathname === '/api/apps/6a67a778342a8fe05ee79cba/functions/geocodeCity') return geocodeCity(request, env);
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
