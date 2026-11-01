import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Tool-facing write boundary: an agent may prepare/revise/cancel content,
// but cannot publish, approve its own draft, send messages or mutate campaigns.
const TYPES = new Set(['social_post','campaign_update','campaign_changes','external_post','blog_entry','discussion_post','discussion_reply','profile_update']);
const AGENTS = new Set(['chief_of_staff','strategy_agent','growth_agent','communications_agent','story_agent','outreach_agent','managed_connection_agent','connection_discovery_agent']);
const FIELDS: Record<string,string[]> = {
  social_post: ['content','media_url','campaign_id'],
  campaign_update: ['title','content','media_url','media_type'],
  campaign_changes: ['title','summary','story','category','goal_amount','cover_image_url','end_date','location','ai_profile','status'],
  external_post: ['content','donation_destination_connection_id'],
  blog_entry: ['blog_id','entry_id','title','summary','body'],
  discussion_post: ['community_id','title','content','category'],
  discussion_reply: ['post_id','content'],
  profile_update: ['display_name','bio','focus_campaign_ids','priority_campaign_id','show_posts','show_communities'],
};
const clip=(v:any,n:number)=>String(v??'').trim().slice(0,n);
function sanitize(kind:string, raw:any) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (Object.keys(raw).some(k => !FIELDS[kind].includes(k))) return null;
  const out:Record<string,unknown>={};
  for (const field of FIELDS[kind]) {
    if (!(field in raw)) continue;
    const value=raw[field];
    if (['show_posts','show_communities'].includes(field)) out[field]=value===true;
    else if (field==='focus_campaign_ids') {
      if (!Array.isArray(value)) return null;
      out[field]=value.slice(0,6).map(v=>clip(v,72)).filter(Boolean);
    } else if (field==='ai_profile') {
      if(!value || typeof value!=='object' || Array.isArray(value) || JSON.stringify(value).length>5000)return null;
      out[field]=value;
    } else if (field==='goal_amount') {
      if(!Number.isFinite(Number(value)) || Number(value)<0)return null;
      out[field]=Number(value);
    } else if (field==='status') {
      if(!['draft','active','paused','completed'].includes(value))return null;
      out[field]=value;
    } else out[field]=clip(value,field==='body'?12000:field==='content'?10000:field==='story'?12000:field==='summary'?1000:500);
  }
  const meaningful = kind==='campaign_changes'||kind==='profile_update' ? Object.keys(out).length>0 :
    kind==='blog_entry' ? !!out.title && !!out.body && !!out.blog_id :
    kind==='discussion_post' ? !!out.title && !!out.content && !!out.community_id :
    kind==='discussion_reply' ? !!out.content && !!out.post_id : !!out.content;
  return meaningful?out:null;
}
const readDraft=(d:any)=>({id:d.id,kind:d.kind,campaign_id:d.campaign_id,connection_id:d.connection_id,payload:d.payload,status:d.status,source_agent:d.source_agent,created_at:d.created_at,updated_at:d.updated_at,result_id:d.result_id,result_summary:d.result_summary,last_error:d.last_error});
export default async function(req:Request) {
  try {
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user, sr=base44.asServiceRole;
    const body=await req.json().catch(()=>({}));
    const mode=clip(body.mode||'list',20);
    if(mode==='list'){
      const rows=await sr.entities.AgentContentDraft.filter({owner_user_id:user.id},'-created_date',100);
      return Response.json({ok:true,drafts:(rows||[]).filter((d:any)=>d.owner_user_id===user.id).map(readDraft)});
    }
    if(mode==='create'){
      const kind=clip(body.kind,40), source=clip(body.source_agent||'chief_of_staff',50);
      if(!TYPES.has(kind)||!AGENTS.has(source))return Response.json({error:'Unsupported content action'},{status:400});
      const payload=sanitize(kind,body.payload);
      if(!payload)return Response.json({error:'Invalid content draft'},{status:400});
      const campaignId=clip(body.campaign_id||payload.campaign_id,72),connectionId=clip(body.connection_id,72);
      if(['campaign_update','campaign_changes','external_post'].includes(kind)&&!campaignId)
        return Response.json({error:'Select a campaign'},{status:400});
      if(kind==='external_post'&&!connectionId)return Response.json({error:'Select a connection'},{status:400});
      if(campaignId){
        const campaign=await sr.entities.Campaign.get(campaignId).catch(()=>null);
        if(!campaign||campaign.created_by_id!==user.id)return Response.json({error:'Campaign not owned by account'},{status:403});
      }
      if(connectionId){
        const c=await sr.entities.PlatformConnection.get(connectionId).catch(()=>null);
        if(!c||c.created_by_id!==user.id||c.campaign_id&&c.campaign_id!==campaignId)
          return Response.json({error:'Connection is not authorized for this campaign'},{status:403});
      }
      if(kind==='blog_entry'){
        const blog=await sr.entities.UserBlog.get(String(payload.blog_id)).catch(()=>null);
        if(!blog||blog.owner_user_id!==user.id)return Response.json({error:'Blog not owned by account'},{status:403});
      }
      if(kind==='discussion_post'){
        const members=await sr.entities.CommunityMember.filter({community_id:String(payload.community_id),user_id:user.id});
        if(!members?.length&&user.role!=='admin')return Response.json({error:'Join the community before posting'},{status:403});
      }
      if(kind==='discussion_reply'){
        const post=await sr.entities.DiscussionPost.get(String(payload.post_id)).catch(()=>null);
        if(!post)return Response.json({error:'Discussion not found'},{status:404});
        const members=await sr.entities.CommunityMember.filter({community_id:post.community_id,user_id:user.id});
        if(!members?.length&&user.role!=='admin')return Response.json({error:'Join the community before replying'},{status:403});
      }
      const now=new Date().toISOString();
      const draft=await base44.entities.AgentContentDraft.create({owner_user_id:user.id,source_agent:source,kind,campaign_id:campaignId,connection_id:connectionId,payload,status:'draft',created_at:now,updated_at:now});
      return Response.json({ok:true,draft:readDraft(draft),needs_owner_review:true});
    }
    if(!['revise','cancel'].includes(mode))return Response.json({error:'Unsupported action'},{status:400});
    const id=clip(body.draft_id,80);
    const draft=await sr.entities.AgentContentDraft.get(id).catch(()=>null);
    if(!draft||draft.owner_user_id!==user.id)return Response.json({error:'Draft not found'},{status:404});
    if(draft.status!=='draft')return Response.json({error:'Only unsubmitted drafts can be changed'},{status:409});
    if(mode==='cancel'){
      await sr.entities.AgentContentDraft.update(id,{status:'cancelled',updated_at:new Date().toISOString()});
      return Response.json({ok:true,cancelled:true,draft_id:id});
    }
    const payload=sanitize(draft.kind,body.payload);
    if(!payload)return Response.json({error:'Invalid replacement draft'},{status:400});
    // Identity, destination, campaign and type remain fixed while revising.
    // All nested resource selectors stay immutable; a text edit cannot move a
    // previously reviewed draft onto a different account, blog, or thread.
    for(const key of ['campaign_id','blog_id','entry_id','community_id','post_id','donation_destination_connection_id']){
      if(String(payload[key]??'')!==String(draft.payload?.[key]??''))
        return Response.json({error:'Destination fields cannot change during a draft edit'},{status:409});
    }
    const updated=await sr.entities.AgentContentDraft.update(id,{payload,updated_at:new Date().toISOString()});
    return Response.json({ok:true,draft:readDraft(updated)});
  } catch(error){
    console.error('manageAgentContentDraft:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Unable to manage AI content draft'},{status:500});
  }
}
