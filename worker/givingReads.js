import { authenticatedUser, accountGuardResponse, migrationReady, response } from './reads.js';
import { listMyGiving } from './givingRepository.js';

const GIVING_PATHS = new Set(['/api/me/giving', '/api/giving/mine']);
const MAX_GIVING_ROWS = 1000;

/** Read-only, verified giving history for the currently authenticated donor. */
export async function routeGivingRead(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  if (!GIVING_PATHS.has(path)) return response(404, { error: 'Not found.' });
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!migrationReady(env)) return response(503, { error: 'Giving history is not enabled.' });

  try {
    const account = await authenticatedUser(request, env, fetcher);
    if (!account) return response(401, { error: 'Sign in to view your giving history.' });
    const denied = accountGuardResponse(account);
    if (denied) return denied;

    const donations = await listMyGiving(env, account.jwt, fetcher);
    if (donations.length > MAX_GIVING_ROWS) {
      return response(409, { error: 'Giving history is too large to verify in one request.' });
    }
    return response(200, { donations });
  } catch {
    return response(503, { error: 'We could not load your confirmed giving history.' });
  }
}
