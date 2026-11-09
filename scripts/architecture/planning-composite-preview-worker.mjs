/**
 * PREVIEW-ONLY planning facade; no production routes, secrets or AI inference.
 * Strategy and Growth retain their existing isolated service bindings.
 * This consolidates the edge ingress surface, NOT their security principals.
 */
import { routePlanningAgent } from './planning-agent-routing-contract.mjs';

const SERVICES = Object.freeze({
  strategy: 'IFUND_STRATEGY_AGENT',
  growth: 'IFUND_GROWTH_AGENT',
});
const noStore = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const error = (status, code) => Response.json({error:code}, {status,headers:noStore});

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({service:'ifund-planning-agent-preview',ready:true}, {headers:noStore});
    }
    const route = routePlanningAgent(url.pathname, env);
    if (!route) return error(404, 'not_found');
    if (!['GET','POST','OPTIONS'].includes(request.method)) return error(405, 'method_not_allowed');
    // The upstream service still verifies the token, scope, subscription and RLS.
    // This early check prevents anonymous requests from reaching either service.
    if (request.method !== 'OPTIONS' && !/^Bearer [^\s]+$/i.test(request.headers.get('authorization') || '')) {
      return error(401, 'authentication_required');
    }
    if (request.method === 'OPTIONS') return error(405, 'preflight_not_configured');
    const binding = env[SERVICES[route.capability]];
    if (!binding || typeof binding.fetch !== 'function') return error(503, 'agent_unavailable');
    try {
      const response = await binding.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('cache-control','no-store');
      headers.set('x-content-type-options','nosniff');
      return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
    } catch {
      return error(502, 'agent_upstream_unavailable');
    }
  },
};
