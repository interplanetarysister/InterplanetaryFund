import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { EMBED_ID } from '../../shared/campaignEmbeds.ts';

const compact = (s: unknown,n: number) => String(s || '').trim().slice(0,n);
const safeCampaign = (c:any) => ({
 id:c.id,title:c.title,summary:c.summary,category:c.category,
 cover_image_url:c.cover_image_url,raised_amount:c.raised_amount,
 goal_amount:c.goal_amount,donor_count:c.donor_count,status:c.status,
});
export default async function(req:Request) {
 try {
  const base44=createClientFromRequest(req);
  const sr=base44.asServiceRole;
  const body=await req.json().catch(()=>({}));
  const mode=compact(body.mode||'read',20);
  if(mode==='save') {
   const guard=await assertActiveAccount(base44);
   if(!guard.ok) return Response.json({error:guard.error},{status:guard.status});
   const owner=guard.user;
   const focus=Array.isArray(body.focus_campaign_ids)
     ? [...new Set(body.focus_campaign_ids.map((v:any)=>compact(v,72)).filter((id:string)=>EMBED_ID.test(id)))].slice(0,6) : [];
   const priority=compact(body.priority_campaign_id,72);
   const owned=await sr.entities.Campaign.filter({created_by_id:owner.id},'-created_date',150);
   const followed=await sr.entities.FollowedCampaign.filter({user_id:owner.id},'-created_date',150);
   const allowed=new Set([
     ...(owned||[]).filter((c:any)=>c.status==='active').map((c:any)=>c.id),
     ...(followed||[]).filter((f:any)=>!f.archived).map((f:any)=>f.campaign_id),
   ]);
   const verifiedIds=[];
   for(const id of [...new Set([...focus,priority].filter(Boolean))]) {
    if(!allowed.has(id)) continue;
    const c=await sr.entities.Campaign.get(id).catch(()=>null);
    if(c?.status==='active') verifiedIds.push(id);
   }
   const selected=focus.filter(id=>verifiedIds.includes(id));
   const prioritized=verifiedIds.includes(priority)?priority:'';
   if(prioritized&&!selected.includes(prioritized))selected.unshift(prioritized);
   const existing=(await sr.entities.PublicProfile.filter({user_id:owner.id}))[0];
   const patch={
     user_id:owner.id,
     display_name:compact(body.display_name || owner.username || owner.full_name || 'IFund member',70),
     username:compact(owner.username,60),
     bio:compact(body.bio,900),
     avatar_url:compact(owner.photo_url,1200),
     focus_campaign_ids:selected.slice(0,6),
     priority_campaign_id:prioritized,
     show_posts:body.show_posts!==false,
     show_communities:body.show_communities!==false,
     updated_at:new Date().toISOString(),
   };
   const saved=existing
     ? await sr.entities.PublicProfile.update(existing.id,patch)
     : await sr.entities.PublicProfile.create(patch);
   return Response.json({ok:true,profile:saved});
  }
  if(mode!=='read') return Response.json({error:'Unsupported action'},{status:400});
  const userId=compact(body.user_id,72);
  if(!EMBED_ID.test(userId))return Response.json({error:'User not found'},{status:404});
  const account=await sr.entities.User.get(userId).catch(()=>null);
  if(!account||account.account_deletion_pending||account.account_status==='disabled')return Response.json({error:'User not found'},{status:404});
  const profile=(await sr.entities.PublicProfile.filter({user_id:userId}).catch(()=>[]))[0]||{};
  const display=compact(profile.display_name||account.username||'IFund member',70);
  const requested=[...new Set([profile.priority_campaign_id,...(profile.focus_campaign_ids||[])].filter(Boolean))].slice(0,7);
  const campaigns=await Promise.all(requested.map((id:string)=>sr.entities.Campaign.get(id).catch(()=>null)));
  const focus=campaigns.filter((c:any)=>c&&c.status==='active').map(safeCampaign);
  const owned=await sr.entities.Campaign.filter({created_by_id:userId,status:'active'},'-created_date',30).catch(()=>[]);
  const posts=profile.show_posts===false?[]:
    await sr.entities.SocialPost.filter({author_user_id:userId},'-created_date',24).catch(()=>[]);
  const memberships=profile.show_communities===false?[]:
    await sr.entities.CommunityMember.filter({user_id:userId},'-created_date',35).catch(()=>[]);
  const discussions=profile.show_communities===false?[]:
    await sr.entities.DiscussionPost.filter({created_by_id:userId},'-created_date',24).catch(()=>[]);
  const replies=profile.show_communities===false?[]:
    await sr.entities.DiscussionReply.filter({created_by_id:userId},'-created_date',24).catch(()=>[]);
  const groupIds=[...new Set([
    ...(memberships||[]).map((m:any)=>m.community_id),
    ...(discussions||[]).map((p:any)=>p.community_id),
    ...(replies||[]).map((p:any)=>p.community_id),
  ].filter(Boolean))].slice(0,50);
  const communities=await Promise.all(groupIds.map((id:string)=>
    sr.entities.Community.get(id).catch(()=>null)));
  const groups=communities.filter(Boolean).map((c:any)=>({
    id:c.id,name:c.name,description:c.description,type:c.type,
  }));
  const blogs=await sr.entities.UserBlog.filter({owner_user_id:userId,status:'active'}).catch(()=>[]);
  return Response.json({
    ok:true, profile:{user_id:userId,display_name:display,
      username:compact(profile.username||account.username,60),
      bio:compact(profile.bio,900),
      avatar_url:compact(profile.avatar_url||account.photo_url,1200),
      focus_campaign_ids:focus.map((c:any)=>c.id),
      priority_campaign_id:focus.some((c:any)=>c.id===profile.priority_campaign_id)?profile.priority_campaign_id:'',
      show_posts:profile.show_posts!==false,show_communities:profile.show_communities!==false,
    },
    focus,own_campaigns:(owned||[]).filter((c:any)=>c.status==='active').map(safeCampaign),
    posts:(posts||[]).map((p:any)=>({
       id:p.id,content:p.content,media_url:p.media_url,campaign_id:p.campaign_id,
       created_date:p.created_date,likes_count:p.likes_count,comments_count:p.comments_count,
    })),
    communities:groups,
    community_activity:profile.show_communities===false?[]:[
      ...(discussions||[]).map((p:any)=>({
        id:p.id,community_id:p.community_id,type:'discussion',
        title:compact(p.title,180),created_date:p.created_date,
      })),
      ...(replies||[]).map((p:any)=>({
        id:p.id,community_id:p.community_id,type:'reply',
        title:'Replied to a community discussion',created_date:p.created_date,
      })),
    ].sort((a:any,b:any)=>String(b.created_date||'').localeCompare(String(a.created_date||''))).slice(0,15),
    blogs:(blogs||[]).map((b:any)=>({id:b.id,title:b.title,description:b.description})),
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('managePublicProfile failed:',error instanceof Error?error.name:'UnknownError');
  return Response.json({error:'Profile could not be loaded.'},{status:500});
 }
}
