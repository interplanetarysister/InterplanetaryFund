import { readJsonBody, BodyError } from './bodyLimit.js';
import { authenticatedUser, accountGuardResponse, migrationReady, response } from './reads.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id,title,body,type,link,read,created_at';

/** Owner-scoped notification reads. No service-role credentials; acknowledgements only. */
export async function notificationRequest(request, env = {}, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/api/notifications/health') {
    if (request.method !== 'GET') return response(405, {error:'Method not allowed.'});
    return response(200, {service:'ifund-notifications', runtime:'cloudflare-worker',
      configured:env.IFUND_NOTIFICATIONS_ENABLED === 'enabled' && migrationReady(env),
      authentication_required:true, writes_enabled:true, acknowledgement_only:true});
  }
  const single = /^\/api\/notifications\/([a-f0-9-]+)$/i.exec(url.pathname);
  const batch = url.pathname === '/api/notifications/acknowledge';
  const listing = url.pathname === '/api/notifications';
  if (!listing && !single && !batch) return response(404, {error:'Not found.'});
  if ((listing && request.method !== 'GET') || (single && request.method !== 'PATCH') || (batch && request.method !== 'POST')) return response(405, {error:'Method not allowed.'});
  if (single && !UUID.test(single[1])) return response(400, {error:'Invalid notification ID.'});
  if (env.IFUND_NOTIFICATIONS_ENABLED !== 'enabled' || !migrationReady(env))
    return response(503, {error:'Notifications are unavailable.'});
  // Refuse redirects on every privileged upstream request; never forward a JWT
  // through an unexpected redirect. All URLs derive from the pinned backend.
  const boundedFetch = (input, init = {}) => fetcher(input, {
    ...init, redirect:'error', signal:AbortSignal.timeout(8000),
  });
  try {
    const member = await authenticatedUser(request, env, boundedFetch);
    if (!member) return response(401, {error:'Sign in to view notifications.'});
    const denied = accountGuardResponse(member); if (denied) return denied;
    if (single || batch) {
      let ids;
      if (single) {
        if (request.body !== null) return response(400, {error:'Acknowledgements do not accept field changes.'});
        ids = [single[1]];
      } else {
        if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type') || '')) return response(415, {error:'JSON required.'});
        const input = await readJsonBody(request, 4096);
        if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || !Array.isArray(input.ids) || input.ids.length > 50 || input.ids.some(id => typeof id !== 'string' || !UUID.test(id))) return response(422, {error:'Provide up to 50 notification IDs.'});
        ids = [...new Set(input.ids.map(id => id.toLowerCase()))];
      }
      ids = ids.map(id => id.toLowerCase());
      if (!ids.length) return response(200, {acknowledged:[]});
      const params = new URLSearchParams({select:'id,owner_id,read',owner_id:'eq.'+member.uid,id:'in.('+ids.join(',')+')'});
      const upstream = await boundedFetch(env.SUPABASE_URL+'/rest/v1/ifund_notifications?'+params, {
        method:'PATCH',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+member.jwt,
          Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({read:true}),
      });
      if (!upstream.ok) return response(503, {error:'Notification acknowledgement not confirmed.'});
      const rows = await upstream.json();
      if (!Array.isArray(rows) || rows.length !== ids.length || new Set(rows.map(r => r?.id)).size !== ids.length || rows.some(r => !r || !ids.includes(r.id) || r.owner_id !== member.uid || r.read !== true)) return response(409, {error:'Notification acknowledgement not confirmed.'});
      return response(200, {acknowledged:rows.map(r => r.id)});
    }

    const query = new URLSearchParams({select:FIELDS, owner_id:'eq.'+member.uid,
      order:'created_at.desc,id.desc', limit:'50'});
    const upstream = await boundedFetch(env.SUPABASE_URL+'/rest/v1/ifund_notifications?'+query, {
      method:'GET', headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,
        Authorization:'Bearer '+member.jwt, Accept:'application/json'},
    });
    if (!upstream.ok) return response(503, {error:'Notifications are unavailable.'});
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.length > 50 || rows.some(row =>
      !row || !UUID.test(row.id || '') || typeof row.read !== 'boolean' ||
      typeof row.title !== 'string' || row.title.length > 1000 ||
      (row.body !== null && (typeof row.body !== 'string' || row.body.length > 16000)) ||
      typeof row.type !== 'string' || row.type.length > 100 ||
      typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)) ||
      (row.link !== null && typeof row.link !== 'string')))
      return response(503, {error:'Notifications are unavailable.'});
    return response(200, rows.map(row => ({id:row.id,title:row.title,body:row.body,
      type:row.type,read:row.read,created_at:row.created_at,
      link:typeof row.link === 'string' && /^\/(?![\/\\])/.test(row.link) &&
        !/[\x00-\x20\\]/.test(row.link) && row.link.length <= 2048 ? row.link : null})));
  } catch (error) { if (error instanceof BodyError) return response(error.status,{error:error.message}); return response(503, {error:'Notifications are unavailable.'}); }
}

export default {fetch:notificationRequest};
