import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const OWNERS = new Set(['cuddlemeplatonically@gmail.com', 'interplanetarysister@gmail.com']);
const toHex = (bytes) => [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
async function hash(value) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))); }
const safe = (entry) => ({id:entry.id,label:entry.label,scope:entry.scope,status:entry.status,key_prefix:entry.key_prefix,created_at:entry.created_at,revoked_at:entry.revoked_at,last_used_at:entry.last_used_at});
export default async function(req) {
  if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
  try {
    const client=createClientFromRequest(req);
    const guard=await assertActiveAccount(client);
    if(!guard.ok) return Response.json({error:guard.error},{status:guard.status});
    const me=await client.auth.me();
    if(me?.role!=='admin'||!OWNERS.has(String(me.email||'').trim().toLowerCase())) return Response.json({error:'Super admin required'},{status:403});
    const body=await req.json().catch(()=>({}));
    const db=client.asServiceRole.entities.ExternalAgentApiKey;
    if(body.action==='create') {
      const label=String(body.label||'').trim();
      if(label.length<2||label.length>80) return Response.json({error:'Agent name must have 2–80 characters'},{status:400});
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const token='ifund_ag_'+toHex(bytes);
      const scope=body.scope==='campaigns:read,content:write'?'campaigns:read,content:write':'campaigns:read';
      const now=new Date().toISOString();
      const record=await db.create({label,key_prefix:token.slice(0,18),key_hash:await hash(token),scope,status:'active',created_at:now});
      return Response.json({key:safe(record),secret:token,warning:'Copy now. This secret will not be shown again.'});
    }
    if(body.action==='revoke') {
      const id=String(body.id||'');
      const records=await db.list('-created_date',100);
      const found=records.find(x=>x.id===id);
      if(!found) return Response.json({error:'Key not found'},{status:404});
      await db.update(id,{status:'revoked',revoked_at:new Date().toISOString()});
      return Response.json({ok:true});
    }
    if(body.action && body.action!=='list') return Response.json({error:'Unknown action'},{status:400});
    const records=await db.list('-created_date',100);
    return Response.json({keys:records.map(safe)});
  } catch(e) {
    console.error('manageExternalAgentKeys failure',e?.name||'unknown');
    return Response.json({error:'Unable to manage agent keys'},{status:500});
  }
}