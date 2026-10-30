const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

/** Build a sanitized JSON response without leaking upstream secrets. */
export function response(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANONICAL_SUPABASE_HOST = 'ssibsfmtodgximseeqsv.supabase.co';
function canonicalSupabaseUrl(value) { try { const u=new URL(value); return u.protocol==='https:' && u.hostname.toLowerCase()===CANONICAL_SUPABASE_HOST && !u.username && !u.password && !u.port && u.pathname==='/' && !u.search && !u.hash; } catch { return false; } }
export function migrationReady(env) { return env?.MIGRATION_API_PREVIEW==='enabled' && canonicalSupabaseUrl(env?.SUPABASE_URL) && typeof env?.SUPABASE_PUBLISHABLE_KEY==='string' && env.SUPABASE_PUBLISHABLE_KEY.length>0; }

function providerHeaders(env, jwt) {
  // Modern sb_publishable_ keys are API identifiers, NOT bearer JWTs.
  // Anonymous reads use only apikey. User-scoped reads forward the verified JWT.
  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Accept: 'application/json',
  };
  if (jwt) headers.Authorization = 'Bearer ' + jwt;
  return headers;
}

export function accountGuardResponse(account) {
  const issue=account?.accountError;
  return issue ? response(issue.status,{error:issue.message}) : null;
}
async function activeProfileError(uid,jwt,env,fetcher) {
  try {
    const params=new URLSearchParams({select:'id,account_status,account_deletion_pending',id:'eq.'+uid,limit:'2'});
    const res=await fetcher(env.SUPABASE_URL+'/rest/v1/ifund_profiles?'+params.toString(),{method:'GET',headers:providerHeaders(env,jwt)});
    if(!res.ok)return {status:503,message:'Account status could not be verified.'};
    const rows=await res.json();
    if(!Array.isArray(rows))return {status:503,message:'Account status could not be verified.'};
    if(rows.length!==1||rows[0]?.id!==uid)return {status:401,message:'This account is no longer available.'};
    const p=rows[0];
    if(typeof p.account_status!=='string'||typeof p.account_deletion_pending!=='boolean')return {status:503,message:'Account status could not be verified.'};
    if(p.account_deletion_pending)return {status:403,message:'This account is scheduled for deletion and can no longer be used.'};
    if(p.account_status!=='active')return {status:403,message:'This account is no longer available.'};
    return null;
  } catch { return {status:503,message:'Account status could not be verified.'}; }
}
/** Verify Supabase Auth and enforce fresh profile lifecycle state. */
export async function authenticatedUser(request,env,fetcher=fetch) {
  const value=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9._~-]+$/.test(value))return null;
  const jwt=value.slice(7);
  try {
    const res=await fetcher(env.SUPABASE_URL+'/auth/v1/user',{headers:providerHeaders(env,jwt)});
    if(!res.ok)return null;
    const account=await res.json();
    if(!uuid.test(account?.id||'')||!account.email_confirmed_at)return null;
    const accountError=await activeProfileError(account.id,jwt,env,fetcher);
    return {uid:account.id,jwt,...(accountError?{accountError}:{})};
  } catch { return null; }
}

/** Shared read-only PostgREST request, with user JWT for user-scoped RLS. */
async function readOnly(env, relative, jwt, fetcher) {
  const upstream = await fetcher(env.SUPABASE_URL + '/rest/v1/' + relative, {
    method: 'GET',
    headers: providerHeaders(env, jwt),
  });
  if (!upstream.ok) return response(503, { error: 'Migration data source unavailable.' });
  return response(200, await upstream.json());
}

/**
 * Independent read endpoints for community feeds, owner drafts, and campaign
 * discovery. The preview flag defaults disabled. No financial writes.
 */
export async function routeReadRequest(request, env, fetcher = fetch) {
  if (request.method !== 'GET') return response(405, { error: 'Method not allowed.' });
  if (!migrationReady(env)) return response(503, { error: 'Independent migration API not enabled.' });

  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/community/feed') {
      return await readOnly(
        env, 'ifund_posts?select=id,author_id,body,created_at&order=created_at.desc&limit=30',
        null, fetcher,
      );
    }
    if (path === '/api/campaigns/public') {
      return await readOnly(
        env, 'ifund_campaigns?select=id,title,summary,category,goal_amount,cover_image_url,created_at&status=eq.active&order=created_at.desc&limit=30',
        null, fetcher,
      );
    }

    if (path === '/api/campaigns/mine') {
      const member = await authenticatedUser(request, env, fetcher);
      if (!member) return response(401, { error: 'Sign in to view your campaigns.' });
      const denied=accountGuardResponse(member); if(denied)return denied;
      const params = new URLSearchParams({
        select: 'id,title,summary,category,goal_amount,cover_image_url,status,created_at,updated_at',
        owner_id: 'eq.' + member.uid,
        order: 'created_at.desc',
        limit: '50',
      });
      return await readOnly(env, 'ifund_campaigns?' + params.toString(), member.jwt, fetcher);
    }
    const publicMatch = /^\/api\/campaigns\/([a-f0-9-]+)$/i.exec(path);
    if (publicMatch) {
      if (!uuid.test(publicMatch[1])) return response(400, { error: 'Invalid campaign ID.' });
      const params = new URLSearchParams({
        select: 'id,title,summary,story,category,goal_amount,cover_image_url,created_at,updated_at',
        id: 'eq.' + publicMatch[1], status: 'eq.active', limit: '1',
      });
      return await readOnly(env, 'ifund_campaigns?' + params.toString(), null, fetcher);
    }
    const match = /^\/api\/campaigns\/([a-f0-9-]+)\/draft$/i.exec(path);
    if (match) {
      if (!uuid.test(match[1])) return response(400, { error: 'Invalid campaign ID.' });
      const member = await authenticatedUser(request, env, fetcher);
      if (!member) return response(401, { error: 'Sign in to view this draft.' });
      const denied=accountGuardResponse(member); if(denied)return denied;
      const params = new URLSearchParams({
        select: 'id,title,summary,story,category,goal_amount,cover_image_url,status',
        id: 'eq.' + match[1],
        owner_id: 'eq.' + member.uid,
        status: 'eq.draft',
        limit: '1',
      });
      return await readOnly(env, 'ifund_campaigns?' + params.toString(), member.jwt, fetcher);
    }
    return response(404, { error: 'Not found.' });
  } catch {
    return response(503, { error: 'Migration data source unavailable.' });
  }
}
