// Authenticated Cloudflare Pages API helper. Uses caller JWT and Supabase RLS, never service_role.
export function respond(body, status=200) {
  return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json','cache-control':'no-store'}});
}
export async function activeSession(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return {error:respond({error:'Service unavailable'},503)};
  let origin;
  try { origin=new URL(env.SUPABASE_URL); if(origin.protocol!=='https:') throw Error(); }
  catch {return {error:respond({error:'Service unavailable'},503)};}
  const token=(request.headers.get('authorization')||'').match(/^Bearer ([^\s]+)$/i)?.[1];
  if(!token) return {error:respond({error:'Unauthorized'},401)};
  const headers={apikey:env.SUPABASE_ANON_KEY,authorization:`Bearer ${token}`};
  const userResponse=await fetch(new URL('/auth/v1/user',origin),{headers,redirect:'manual'}).catch(()=>null);
  if(!userResponse?.ok) return {error:respond({error:'Unauthorized'},401)};
  const user=await userResponse.json().catch(()=>null);
  if(!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id)) return {error:respond({error:'Unauthorized'},401)};
  const url=new URL('/rest/v1/ifund_profiles',origin);
  url.searchParams.set('select','account_status,account_deletion_pending,lifecycle_provenance');
  url.searchParams.set('id',`eq.${user.id}`);
  const profileResponse=await fetch(url,{headers,redirect:'manual'}).catch(()=>null);
  if(!profileResponse?.ok) return {error:respond({error:'Account unavailable'},403)};
  const rows=await profileResponse.json().catch(()=>[]);
  const p=rows?.[0];
  if(p?.account_status!=='active'||p?.account_deletion_pending!==false||!p?.lifecycle_provenance)
    return {error:respond({error:'Account not active'},403)};
  return {origin,headers,user};
}
