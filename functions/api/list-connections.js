import { activeSession, respond } from '../_lib/auth.js';

// POST /api/list-connections
// Owner-scoped connection status only. Never return OAuth tokens, secrets, or
// arbitrary provider metadata. No admin "all accounts" bypass.
export async function onRequestPost({ request, env }) {
  const session = await activeSession(request, env);
  if (session.error) return session.error;
  if (Number(request.headers.get('content-length') || 0) > 2048)
    return respond({ error: 'Request too large' }, 413);
  const body = await request.json().catch(() => ({}));
  if (body?.scope === 'all') return respond({ error: 'Forbidden' }, 403);
  const url = new URL('/rest/v1/ifund_connections', session.origin);
  url.searchParams.set('select', 'id,provider,status,verified_at,created_at');
  url.searchParams.set('owner_id', `eq.${session.user.id}`);
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '300');
  const response = await fetch(url, { headers: session.headers, redirect: 'manual' }).catch(() => null);
  if (!response?.ok) return respond({ error: 'Connections unavailable' }, 502);
  const rows = await response.json().catch(() => null);
  if (!Array.isArray(rows)) return respond({ error: 'Invalid connection response' }, 502);
  return respond({ connections: rows.map(({id,provider,status,verified_at,created_at}) =>
    ({id,provider,status,verified_at,created_at})) });
}
