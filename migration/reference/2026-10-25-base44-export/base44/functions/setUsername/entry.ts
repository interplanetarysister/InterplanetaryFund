import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const USERNAME=/^[a-z0-9][a-z0-9._-]{2,29}$/;

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok) return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user;
    const body=await req.json().catch(()=>({}));
    const username=String(body?.username||'').trim().toLowerCase();
    if(!USERNAME.test(username)) return Response.json({error:'Use 3–30 letters, numbers, dots, dashes, or underscores. Start with a letter or number.'},{status:400});
    const rows=await base44.asServiceRole.entities.User.filter({username}).catch(()=>[]);
    if((rows||[]).some((row)=>row.id!==user.id)) return Response.json({error:'That username is already taken.'},{status:409});
    await base44.asServiceRole.entities.User.update(user.id,{username});
    return Response.json({ok:true,username});
  }catch(error){
    console.error('setUsername failed:',error?.name||'UnknownError');
    return Response.json({error:'Username could not be saved.'},{status:500});
  }
}
