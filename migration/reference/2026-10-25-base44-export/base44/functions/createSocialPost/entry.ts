import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { enforceImagePolicy } from '../../shared/serverImagePolicy.ts';

const TIER=[['platinum',1000],['gold',500],['silver',200],['bronze',50]];
const tierFor=(score)=>TIER.find(([,min])=>score>=min)?.[0]||'none';

export default async function(req){
 try{
  const base44=createClientFromRequest(req); const activeAccount = await assertActiveAccount(base44); if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });const user=await base44.auth.me();
  if(!user)return Response.json({error:'Authentication required'},{status:401});
  const b=await req.json().catch(()=>({}));const content=String(b?.content||'').trim();
  if(!content||content.length>10000)return Response.json({error:'Post content is invalid'},{status:400});
  const campaignId=String(b?.campaign_id||'').trim();let campaign=null;
  if(campaignId){const rows=await base44.asServiceRole.entities.Campaign.filter({id:campaignId});campaign=rows?.[0];if(!campaign||campaign.status==='draft')return Response.json({error:'Campaign unavailable'},{status:404});}
  const mediaUrl = b?.media_url ? await enforceImagePolicy(base44, activeAccount.user, b.media_url) : undefined;
  const score=Math.max(0,Number(user.social_score)||0)+10;const tier=tierFor(score);
  const post=await base44.entities.SocialPost.create({
   author_user_id:user.id,author_username:user.username||user.full_name||'',author_name:user.full_name||'',author_banner_tier:tier,
   content,media_url:mediaUrl,campaign_id:campaign?.id,campaign_title:campaign?.title,
   is_top_post:tier==='gold'||tier==='platinum',crosspost_platforms:Array.isArray(b?.crosspost_platforms)?b.crosspost_platforms.map(String).slice(0,20):[],
   ai_generated:b?.ai_generated===true,
   image_generated:b?.image_generated===true && typeof b?.media_url==='string' &&
     Boolean(mediaUrl),
  });
  await base44.auth.updateMe({social_score:score,banner_tier:tier});
  return Response.json({ok:true,post,social_score:score,banner_tier:tier});
 }catch(error){console.error('createSocialPost failed:',error?.name||'UnknownError');return Response.json({error:'Post could not be created safely.'},{status:500});}
}
