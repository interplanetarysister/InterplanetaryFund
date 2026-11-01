import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Invoked only by the authenticated chat UI, never registered as an agent tool.
// "Approve all drafts" is the account owner's deliberate instruction, not
// permission for an LLM or a different account to approve on their behalf.
const clean=(v:any,n=160)=>String(v??'').trim().slice(0,n);
const POST_KINDS=new Set(['social_post','campaign_update','external_post','blog_entry','discussion_post','discussion_reply']);
const AUTHORIZED=/^(?:please\s+)?(?:approve(?:\s+and\s+publish)?|publish|post)\s+(?:all|every)\s+(?:my\s+)?(?:pending\s+)?(?:drafts?|posts?)(?:\s+(?:now|please))?[.!]?$/i;
const summary=(d:any)=>({
  id:d.id,kind:d.kind,status:d.status,campaign_id:d.campaign_id||'',
  connection_id:d.connection_id||'',source_agent:d.source_agent||'',
  content:d.payload||{},updated_at:d.updated_at||d.created_date||'',
  result_id:d.result_id||'',result_summary:d.result_summary||''
});
const distributed=(p:any)=>({
  id:p.id,kind:'external_distributed_post',status:p.status,
  campaign_id:p.campaign_id||'',connection_id:p.connection_id||'',
  platform:p.platform||'',content:clean(p.content,10000),
  external_post_url:p.external_post_url||'',updated_at:p.updated_date||p.created_date||''
});

export default async function(req:Request) {
  try {
    if(req.method!=='POST')return Response.json({error:'POST required'},{status:405});
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user, sr=base44.asServiceRole;
    const body=await req.json().catch(()=>({}));
    const mode=clean(body.mode||'list',30);
    const allDrafts=await sr.entities.AgentContentDraft.filter({owner_user_id:user.id},'-created_date',500);
    const ownDrafts=(allDrafts||[]).filter((d:any)=>d.owner_user_id===user.id);
    const [byAuthor,byOwner]=await Promise.all([
      sr.entities.DistributedPost.filter({created_by_id:user.id},'-created_date',500),
      sr.entities.DistributedPost.filter({owner_user_id:user.id},'-created_date',500),
    ]);
    const existing=[...new Map([...(byAuthor||[]),...(byOwner||[])]
      .filter((p:any)=>p.created_by_id===user.id||p.owner_user_id===user.id)
      .map((p:any)=>[p.id,p])).values()];
    const eligible=existing.filter((p:any)=>['draft','pending_approval','approved'].includes(p.status));
    if(mode==='list'||mode==='show'){
      const id=clean(body.draft_id,100);
      const prepared=id?ownDrafts.filter((d:any)=>d.id===id):ownDrafts.filter((d:any)=>d.status==='draft');
      const external=id?existing.filter((d:any)=>d.id===id):eligible;
      if(id&&!prepared.length&&!external.length)return Response.json({error:'Draft not found'},{status:404});
      return Response.json({ok:true,drafts:prepared.slice(0,12).map(summary),external_posts:external.slice(0,12).map(distributed),
        total_drafts:prepared.length,total_external_posts:external.length,truncated:prepared.length>12||external.length>12},
        {headers:{'Cache-Control':'no-store'}});
    }
    if(mode!=='approve_all')return Response.json({error:'Unsupported action'},{status:400});
    const instruction=clean(body.owner_instruction,250);
    if(body.owner_chat_authorized!==true||!AUTHORIZED.test(instruction))
      return Response.json({error:'A direct owner approval instruction is required.'},{status:403});
    // Snapshot candidate IDs once. Newly staged DistributedPost records are
    // published through their draft result rather than processed twice.
    const results:any[]=[];
    const skippedDrafts=new Set((Array.isArray(body.excluded_draft_ids)?body.excluded_draft_ids:[]).slice(0,500).map((v:any)=>clean(v,100)));
    const skippedPosts=new Set((Array.isArray(body.excluded_post_ids)?body.excluded_post_ids:[]).slice(0,500).map((v:any)=>clean(v,100)));
    const draftCandidates=ownDrafts.filter((d:any)=>d.status==='draft'&&!skippedDrafts.has(d.id));
    const candidates=draftCandidates.slice(0,12);
    const publishCandidates=eligible.filter((p:any)=>!skippedPosts.has(p.id));
    const initiallyEligible=publishCandidates.slice(0,12);
    for(const d of candidates){
      if(!POST_KINDS.has(d.kind)){
        results.push({draft_id:d.id,kind:d.kind,outcome:'needs_separate_review'});
        continue;
      }
      try{
        const response=await base44.functions.invoke('applyAgentContentDraft',
          {draft_id:d.id,confirm_owner_review:true});
        const data=response?.data||response;
        if(data?.ok!==true){
          results.push({draft_id:d.id,kind:d.kind,outcome:'unconfirmed'});
          continue;
        }
        if(d.kind==='blog_entry'){
          // The existing apply function saves the article, but doesn't
          // publish it. The owner's bulk instruction requests both steps.
          if(!data.result_id){
            results.push({draft_id:d.id,kind:d.kind,outcome:'staged_unconfirmed'});
            continue;
          }
          const article=await base44.functions.invoke('manageBlog',{
            mode:'publish_entry',blog_id:d.payload?.blog_id,entry_id:data.result_id,
            title:d.payload?.title,summary:d.payload?.summary,body:d.payload?.body
          });
          const published=article?.data||article;
          results.push({draft_id:d.id,kind:d.kind,result_id:data.result_id,
            outcome:published?.ok===true&&published?.entry?.status==='published'
              ?'applied_to_ifund':'staged_unconfirmed'});
          continue;
        }
        if(d.kind!=='external_post'){
          results.push({draft_id:d.id,kind:d.kind,outcome:'applied_to_ifund',
            result_id:data.result_id||''});
          continue;
        }
        if(!data.result_id){
          results.push({draft_id:d.id,kind:d.kind,outcome:'staged_unconfirmed'});
          continue;
        }
        const publishing=await base44.functions.invoke('publishPost',
          {post_id:data.result_id,user_publish_authorized:true});
        const published=publishing?.data||publishing;
        const post=published?.post;
        results.push({draft_id:d.id,kind:d.kind,post_id:data.result_id,
          outcome:published?.manual?'approved_manual':
            post?.status==='published'?'published':'publishing_unconfirmed',
          external_post_url:post?.external_post_url||'',reason:clean(published?.reason,180)});
      }catch{
        // Never retry without checking the canonical record: a downstream
        // write may already have succeeded before a transport error.
        results.push({draft_id:d.id,kind:d.kind,outcome:'unconfirmed'});
      }
    }
    for(const p of initiallyEligible){
      try{
        const response=await base44.functions.invoke('publishPost',
          {post_id:p.id,user_publish_authorized:true});
        const data=response?.data||response;
        results.push({post_id:p.id,platform:p.platform,
          outcome:data?.manual?'approved_manual':
            data?.post?.status==='published'?'published':'publishing_unconfirmed',
          external_post_url:data?.post?.external_post_url||'',reason:clean(data?.reason,180)});
      }catch{
        results.push({post_id:p.id,platform:p.platform,outcome:'unconfirmed'});
      }
    }
    await logAudit(base44,{action:'owner_approved_drafts_from_chat',
      actor_user_id:user.id,target_type:'AgentContentDraft',target_id:user.id,
      detail:'Owner chat command processed '+results.length+' owned draft/post records',
      status:'success'}).catch(() => {});
    const count=(outcome:string)=>results.filter(r=>r.outcome===outcome).length;
    return Response.json({ok:true,processed:results.length,
      published:count('published'),applied_to_ifund:count('applied_to_ifund'),
      approved_manual:count('approved_manual'),
      needs_separate_review:count('needs_separate_review'),
      unconfirmed:count('unconfirmed')+count('publishing_unconfirmed')+count('staged_unconfirmed'),
      remaining_unprocessed:Math.max(0,draftCandidates.length-12)+Math.max(0,publishCandidates.length-12),
      results}, {headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('ownerAgentChatActions:',e instanceof Error?e.name:'Error');
    return Response.json({error:'Could not confirm the chat action. Check draft statuses before retrying.'},{status:500});
  }
}