import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Human-facing action ONLY. This function must never be included in the
// agent tool_configs. Owner chooses the exact draft in the review UI.
export default async function(req:Request) {
  try {
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user,sr=base44.asServiceRole;
    const body=await req.json().catch(()=>({}));
    const id=String(body.draft_id||'').trim();
    if(!id)return Response.json({error:'Draft ID required'},{status:400});
    if(body.confirm_owner_review!==true)return Response.json({error:'Review and confirm this content before applying.'},{status:400});
    const draft=await sr.entities.AgentContentDraft.get(id).catch(()=>null);
    if(!draft||draft.owner_user_id!==user.id)return Response.json({error:'Draft not found'},{status:404});
    if(draft.status==='applied')return Response.json({ok:true,already_applied:true,result_id:draft.result_id,kind:draft.kind});
    if(draft.status!=='draft')return Response.json({error:'This draft is not available for application. Check its status before retrying.'},{status:409});

    const p=draft.payload||{}, campaignId=String(draft.campaign_id||'');
    if(campaignId){
      const owned=await sr.entities.Campaign.get(campaignId).catch(()=>null);
      if(!owned||owned.created_by_id!==user.id)return Response.json({error:'Campaign authorization changed'},{status:403});
    }
    if(draft.connection_id){
      const connected=await sr.entities.PlatformConnection.get(draft.connection_id).catch(()=>null);
      if(!connected||connected.created_by_id!==user.id||connected.campaign_id&&connected.campaign_id!==campaignId)
        return Response.json({error:'Connection authorization changed'},{status:403});
    }
    if(draft.kind==='blog_entry'){
      const blog=await sr.entities.UserBlog.get(String(p.blog_id||'')).catch(()=>null);
      if(!blog||blog.owner_user_id!==user.id)return Response.json({error:'Blog authorization changed'},{status:403});
    }
    if(draft.kind==='discussion_post'||draft.kind==='discussion_reply'){
      const post=draft.kind==='discussion_reply'?await sr.entities.DiscussionPost.get(String(p.post_id||'')).catch(()=>null):null;
      const communityId=draft.kind==='discussion_reply'?post?.community_id:p.community_id;
      if(!communityId)return Response.json({error:'Discussion is unavailable'},{status:404});
      const members=await sr.entities.CommunityMember.filter({community_id:communityId,user_id:user.id});
      if(!members?.length&&user.role!=='admin')return Response.json({error:'Community membership required'},{status:403});
    }

    // No follow-up auto retry: the downstream operation might have created a
    // post before encountering a partial error. Reconcile failed drafts first.
    await sr.entities.AgentContentDraft.update(id,{status:'applying',updated_at:new Date().toISOString()});
    const invoke=async(name:string,args:any)=>{
      const response=await base44.functions.invoke(name,args);
      const data=response?.data??response;
      if(data?.error || data?.ok===false)throw new Error('Existing content action rejected the request.');
      return data;
    };
    try {
      let name='',args:any={},humanResult='';
      switch(draft.kind){
        case 'social_post':
          name='createSocialPost';args={content:p.content,media_url:p.media_url,campaign_id:campaignId||p.campaign_id,ai_generated:true};
          humanResult='IFund social post created';break;
        case 'campaign_update':
          name='postCampaignUpdate';args={campaign_id:campaignId,title:p.title,content:p.content,media_url:p.media_url,media_type:p.media_type,cross_post:false};
          humanResult='Campaign update published on IFund; external sharing not triggered';break;
        case 'campaign_changes':{
          const current=await sr.entities.Campaign.get(campaignId);
          if(!current||current.created_by_id!==user.id)throw new Error('Campaign no longer belongs to the owner');
          const keys=['title','summary','story','category','goal_amount','status','cover_image_url','end_date','location','location_lat','location_lng','ai_profile','story_versions','draft_step','accept_crypto_donations'];
          const merged=Object.fromEntries(keys.filter(k=>current[k]!==undefined).map(k=>[k,current[k]]));
          Object.assign(merged,p);
          name='saveCampaign';args={campaign_id:campaignId,campaign:merged};
          humanResult='Campaign details updated';break;
        }
        case 'external_post':
          name='createDistributedPost';args={campaign_id:campaignId,connection_id:draft.connection_id,content:p.content,donation_destination_connection_id:p.donation_destination_connection_id};
          humanResult='External post prepared for separate publishing approval';break;
        case 'blog_entry':
          if(p.entry_id){
            const existing=await sr.entities.BlogEntry.get(String(p.entry_id)).catch(()=>null);
            if(!existing||existing.owner_user_id!==user.id||existing.status==='published')
              throw new Error('Published or inaccessible blog articles require the direct owner editor');
          }
          name='manageBlog';args={mode:'save_entry',blog_id:p.blog_id,entry_id:p.entry_id,title:p.title,summary:p.summary,body:p.body};
          humanResult='Blog article saved; publication still requires approval';break;
        case 'discussion_post':
          name='createDiscussionPost';args={community_id:p.community_id,title:p.title,content:p.content,category:p.category||'question'};
          humanResult='Community discussion published';break;
        case 'discussion_reply':
          name='postDiscussionReply';args={post_id:p.post_id,content:p.content};
          humanResult='Community reply published';break;
        case 'profile_update':{
          const current=(await sr.entities.PublicProfile.filter({user_id:user.id}))[0]||{};
          name='managePublicProfile';args={
            mode:'save',
            display_name:p.display_name??current.display_name??user.username,
            bio:p.bio??current.bio??'',
            focus_campaign_ids:p.focus_campaign_ids??current.focus_campaign_ids??[],
            priority_campaign_id:p.priority_campaign_id??current.priority_campaign_id??'',
            show_posts:p.show_posts??current.show_posts??true,
            show_communities:p.show_communities??current.show_communities??true,
          };
          humanResult='Public profile updated';break;
        }
        default: throw new Error('Unsupported draft kind');
      }
      const data=await invoke(name,args);
      const output=data?.post||data?.update||data?.campaign||data?.entry||data?.reply||data?.profile||data?.draft||data;
      const resultId=String(output?.id||output?.campaign_id||draft.campaign_id||'');
      await sr.entities.AgentContentDraft.update(id,{
        status:'applied',result_id:resultId,result_summary:humanResult,
        applied_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:'',
      });
      await logAudit(base44,{action:'owner_applied_agent_content',actor_user_id:user.id,target_type:'AgentContentDraft',target_id:id,detail:humanResult,status:'success'});
      return Response.json({ok:true,draft_id:id,kind:draft.kind,result_id:resultId,result_summary:humanResult,external_published:false});
    }catch(error){
      await sr.entities.AgentContentDraft.update(id,{status:'failed',last_error:'The existing content process did not confirm completion. Check for a partial result before trying again.',updated_at:new Date().toISOString()});
      console.error('applyAgentContentDraft downstream:',error instanceof Error?error.name:'Error');
      return Response.json({error:'The content action could not be confirmed; check for a partial result before retrying.',draft_id:id},{status:502});
    }
  }catch(error){
    console.error('applyAgentContentDraft:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Could not apply the agent draft'},{status:500});
  }
}
