import {activeSession,respond} from '../_lib/auth.js';

// POST /api/get-campaign-draft — replacement for Base44 getCampaignDraft.
// RLS must restrict ifund_campaigns to owner; explicit owner filter is defense in depth.
export async function onRequestPost({request,env}) {
  const session=await activeSession(request,env);
  if(session.error) return session.error;
  if(Number(request.headers.get('content-length')||0)>2048) return respond({error:'Request too large'},413);
  const body=await request.json().catch(()=>null);
  const id=typeof body?.campaign_id==='string'?body.campaign_id.trim():'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return respond({error:'Invalid campaign ID'},400);
  const url=new URL('/rest/v1/ifund_campaigns',session.origin);
  url.searchParams.set('select','id,owner_id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,updated_at');
  url.searchParams.set('id',`eq.${id}`);
  url.searchParams.set('owner_id',`eq.${session.user.id}`);
  url.searchParams.set('status','eq.draft');
  url.searchParams.set('limit','1');
  const response=await fetch(url,{headers:session.headers,redirect:'manual'}).catch(()=>null);
  if(!response?.ok) return respond({error:'Unable to load draft'},502);
  const rows=await response.json().catch(()=>[]);
  if(!Array.isArray(rows)||!rows[0]) return respond({error:'Draft not found'},404);
  const {owner_id,...campaign}=rows[0];
  return respond({ok:true,campaign});
}
