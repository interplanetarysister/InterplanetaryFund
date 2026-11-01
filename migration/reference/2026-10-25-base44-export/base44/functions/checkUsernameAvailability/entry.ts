import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkRateLimit } from '../../shared/rateLimit.ts';

const USERNAME=/^[a-z0-9][a-z0-9._-]{2,29}$/;

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const body=await req.json().catch(()=>({}));
    const username=String(body?.username||'').trim().toLowerCase();
    if(!USERNAME.test(username)) return Response.json({available:false,valid:false});
    const ip=(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'anon').split(',')[0].trim();
    const rl=await checkRateLimit(base44, `usernameAvailability:${ip}`, 30, 60);
    if(!rl.allowed) return Response.json({error:'Too many username checks. Please wait and try again.'},{status:429});
    const rows=await base44.asServiceRole.entities.User.filter({username}).catch(()=>[]);
    return Response.json({available:!(rows||[]).length,valid:true,username});
  }catch(error){
    console.error('checkUsernameAvailability failed:',error?.name||'UnknownError');
    return Response.json({error:'Username availability could not be checked.'},{status:503});
  }
}
