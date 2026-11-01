import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

export default async function(req) {
  try {
    const base44=createClientFromRequest(req); const guard=await assertActiveAccount(base44);
    if(!guard.ok) return Response.json({error:guard.error},{status:guard.status}); const user=guard.user;
    const body=await req.json().catch(()=>({})); const id=String(body?.item_id||'').trim();
    const rows=await base44.asServiceRole.entities.InboxItem.filter({id}); const item=rows?.[0];
    if(!item) return Response.json({error:'Inbox item not found'},{status:404});
    if(item.user_id!==user.id && user.role!=='admin') return Response.json({error:'Not authorized'},{status:403});
    const patch={};
    if('ai_draft' in body){const d=String(body.ai_draft||''); if(d.length>10000)return Response.json({error:'Draft too long'},{status:400}); patch.ai_draft=d;}
    if('status' in body){if(body.status!=='done')return Response.json({error:'Invalid status'},{status:400}); patch.status='done';}
    if(!Object.keys(patch).length)return Response.json({error:'No supported update'},{status:400});
    await base44.asServiceRole.entities.InboxItem.update(id,patch);
    return Response.json({ok:true,item:{...item,...patch}});
  }catch(error){console.error('updateInboxItem failed:',error?.name||'UnknownError');return Response.json({error:'Inbox item could not be updated safely.'},{status:500});}
}