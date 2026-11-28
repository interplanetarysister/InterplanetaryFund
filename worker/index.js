import { routeReadRequest, response } from './reads.js';
import { routeCampaignWrite } from './campaignWrites.js';
import { routeCommunityWrite } from './communityWrites.js';
import { routeAccountRequest } from './accountRoutes.js';
import { oauthCorsOrigin, routeOAuthRequest } from './oauth.js';
import { serviceGateway } from './services/gateway.js';
import { routeImageStudio } from './imageStudio.js';
import { routeImageImprove } from './imageImprove.js';
import { routeVideoGeneration } from './videoGeneration.js';
import { routeCaptionGeneration } from './captionGeneration.js';
import { routeGeocodeCity } from './geocodeCity.js';
import { strategyRoute } from './agents/strategy.js';
import { routeTeamQuestion } from './agents/teamQuestion.js';
import { routeMissionExplore } from './missions/explore.js';
import { routeMissionPlan } from './missions/plan.js';
import { routeAgentOperations } from './agents/opsRoom.js';
import { growthRoute } from './agents/growth.js';
import { communicationsRoute } from './agents/communications.js';
import { handleManagedConnections } from './agents/managedConnections.js';
import { routeExecutiveRequest } from './agents/michelle.js';
import { routeStudioRequest, routePublicStudioPage, routeStudioGenerateRequest, routeStudioStatusRequest, routeStudioVersionRequest, routePublicHelpIndex } from './studioRoutes.js';

/** Independent migration API. No Base44 proxy or payment functionality. */
export default {
  async fetch(request, env = {}) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/payments/email-addon/status' ||
        pathname === '/api/payments/email-addon/start' ||
        pathname === '/api/payments/email-addon/webhook') {
      // Isolated recurring PayPal checkout never falls through to donation rails.
      if (typeof env.IFUND_EMAIL_ADDON_BILLING?.fetch !== 'function')
        return response(503, { error: 'Recurring email checkout is not configured.' });
      return env.IFUND_EMAIL_ADDON_BILLING.fetch(request);
    }
    if (pathname === '/api/missions/explore') return routeMissionExplore(request, env);
    if (pathname === '/api/missions/plan') {
      // Mission inference uses isolated Workers AI only when explicitly enabled.
      // Do not send mission requests to the legacy question service until its
      // dedicated Mission route has been deployed and verified.
      if (env.IFUND_WHAT_IF_AI_ENABLED === 'enabled' && typeof env.AI?.run === 'function')
        return routeMissionPlan(request, env);
      if (env.IFUND_WHAT_IF_AI_SERVICE?.fetch && env.IFUND_WHAT_IF_AI_ENABLED === 'enabled')
        return env.IFUND_WHAT_IF_AI_SERVICE.fetch(request);
      return routeMissionPlan(request, env);
    }
    if (pathname === '/api/geocode/city') return routeGeocodeCity(request, env);
    if (pathname.startsWith('/api/executive/') || pathname.startsWith('/api/investor-meeting/')) {
      return routeExecutiveRequest(request, env);
    }
    if (pathname === '/api/agents/ops/analyze') return routeAgentOperations(request, env);
    if (pathname === '/api/agents/team/status' || pathname === '/api/agents/team/question') {
      // Prefer the isolated Workers AI service when Cloudflare Pages binds it.
      // The local route remains fail-closed when inference is not configured.
      if (typeof env.IFUND_AGENT_SERVICE?.fetch === 'function') {
        return env.IFUND_AGENT_SERVICE.fetch(request);
      }
      return routeTeamQuestion(request, env);
    }
    if (pathname.startsWith('/api/agents/strategy/')) return strategyRoute(request, env);
    if (pathname.startsWith('/api/agents/growth/')) return growthRoute(request, env);
    if (pathname.startsWith('/api/agents/communications/')) {
      // Production Pages binds the isolated Communications Worker. Direct local
      // invocation has no IFUND_COMMUNICATIONS_* flags and falsely reports 503.
      // Do not synthesize successful delivery when the service is unavailable.
      if (typeof env.IFUND_COMMUNICATIONS_AGENT?.fetch === 'function')
        return env.IFUND_COMMUNICATIONS_AGENT.fetch(request);
      return communicationsRoute(request, env);
    }
    if (pathname.startsWith('/api/agents/connections/')) return handleManagedConnections(request, env);
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
    if (pathname === '/api/ai/images/generate') return env.IFUND_IMAGE_STUDIO?.fetch ? env.IFUND_IMAGE_STUDIO.fetch(request) : routeImageStudio(request, env);
    if (pathname === '/api/ai/images/improve') return env.IFUND_IMAGE_STUDIO?.fetch ? env.IFUND_IMAGE_STUDIO.fetch(request) : routeImageImprove(request, env);
    if (pathname === '/api/ai/videos/status' || pathname === '/api/ai/videos/generate' || pathname.startsWith('/api/ai/videos/jobs/') || pathname.startsWith('/api/ai/videos/concierge/')) return routeVideoGeneration(request, env);
    if (pathname === '/api/ai/captions/status' || pathname === '/api/ai/captions/generate') return routeCaptionGeneration(request, env);
    if (pathname === '/api/services' || pathname.startsWith('/api/services/')) return serviceGateway(request, env);
    if (pathname === '/api/studio/pages' || /^\/api\/studio\/pages\/[0-9a-f-]+$/i.test(pathname)) return routeStudioRequest(request, env);
    if (pathname === '/api/studio/generate') return env.IFUND_STUDIO_AI_SERVICE?.fetch ? env.IFUND_STUDIO_AI_SERVICE.fetch(request) : routeStudioGenerateRequest(request, env);
    if (pathname === '/api/studio/status') return env.IFUND_STUDIO_AI_SERVICE?.fetch ? env.IFUND_STUDIO_AI_SERVICE.fetch(request) : routeStudioStatusRequest(request, env);
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
