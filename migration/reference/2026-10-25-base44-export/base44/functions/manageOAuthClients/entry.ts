import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
const OWNERS=new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
export default async function(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 try{
  const client=createClientFromRequest(req),guard=await assertActiveAccount(client);
  if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
  const me=await client.auth.me();
  if(me?.role!=='admin'||!OWNERS.has(String(me.email||'').toLowerCase().trim()))return Response.json({error:'Super admin required'},{status:403});
  const base=Deno.env.get('IFUND_OAUTH_SERVICE_URL'),bridge=Deno.env.get('IFUND_OAUTH_ADMIN_BRIDGE_SECRET');
  if(!base||!bridge)return Response.json({error:'OAuth service is not configured'},{status:503});
  const u=new URL(base);
  if(u.protocol!=='https:')return Response.json({error:'Invalid OAuth service configuration'},{status:503});
  const b=await req.json().catch(()=>null);
  const action=b?.action;
  const map={list:['GET','/oauth/admin/clients'],create:['POST','/oauth/admin/clients'],revoke:['POST','/oauth/admin/clients/revoke'],authorize:['POST','/oauth/admin/authorize']};
  if(!Object.hasOwn(map,action))return Response.json({error:'Unknown action'},{status:400});
  const [method,path]=map[action];const endpoint=new URL(path,u);
  const upstream=await fetch(endpoint.toString(),{method,headers:{'content-type':'application/json','x-ifund-oauth-admin-bridge':bridge},...(method==='POST'?{body:JSON.stringify(b)}:{}) ,redirect:'manual'});
  const json=await upstream.json().catch(()=>({error:'OAuth backend response invalid'}));
  return Response.json(json,{status:upstream.status,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('manageOAuthClients',e?.name||'unknown');return Response.json({error:'OAuth backend unavailable'},{status:503})}
}
