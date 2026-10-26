import { readinessSummary } from './automationRegistry.js';
import { response } from './reads.js';

/**
 * Public, non-sensitive operational readiness summary.
 * Never returns agent tools, internal instructions, credentials, or provider IDs.
 * Deployment can expose status on both web and mobile API clients.
 */
export function routeAutomationReadiness(request) {
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  return response(200, readinessSummary());
}
