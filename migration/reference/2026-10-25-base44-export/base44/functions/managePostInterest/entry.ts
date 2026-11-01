import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Owner-only preferences for individual IFund social posts.
// Unlike a direct client update to SocialPost, this supports likes on
// another member's public post without granting post-edit permission.
export default async function(req:Request) {
  try {
    const base44=createClientFromRequest(req);
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user, sr=base44.asServiceRole;
    const body=await req.json().catch(()=>({}));
    const mode=String(body.mode||'list').slice(0,16);
    if(mode==='list'){
      const records=await sr.entities.PostInterest.filter({user_id:user.id},'-updated_at',300);
      return Response.json({ok:true,interests:(records||[]).filter((r:any)=>r.user_id===user.id).map((r:any)=>({
        post_id:r.post_id,liked:r.liked===true,saved:r.saved===true,
      }))},{headers:{'Cache-Control':'no-store'}});
    }
    if(mode!=='set')return Response.json({error:'Unsupported interaction'},{status:400});
    const postId=String(body.post_id||'').trim();
    if(!/^[A-Za-z0-9_-]{6,96}$/.test(postId))return Response.json({error:'Invalid post'},{status:400});
    const field=String(body.field||'');
    if(!['liked','saved'].includes(field)||typeof body.value!=='boolean')
      return Response.json({error:'Invalid preference'},{status:400});
    const post=await sr.entities.SocialPost.get(postId).catch(()=>null);
    if(!post)return Response.json({error:'Post unavailable'},{status:404});
    const records=await sr.entities.PostInterest.filter({user_id:user.id,post_id:postId},'-updated_at',10);
    const record=(records||[]).find((r:any)=>r.user_id===user.id&&r.post_id===postId);
    const wasLiked=record?.liked===true, wasSaved=record?.saved===true;
    const nextLiked=field==='liked'?body.value:wasLiked;
    const nextSaved=field==='saved'?body.value:wasSaved;
    if(nextLiked===wasLiked && nextSaved===wasSaved){
      return Response.json({ok:true,post_id:postId,liked:nextLiked,saved:nextSaved,likes_count:Math.max(0,Number(post.likes_count)||0)});
    }
    const now=new Date().toISOString();
    if(record)await sr.entities.PostInterest.update(record.id,{liked:nextLiked,saved:nextSaved,updated_at:now});
    else await base44.entities.PostInterest.create({user_id:user.id,post_id:postId,liked:nextLiked,saved:nextSaved,updated_at:now});
    if(nextLiked!==wasLiked) {
      const delta=nextLiked?1:-1;
      // Server atomic increment handles distinct users liking at the same time.
      // A missing/invalid legacy count is never allowed to become negative.
      if(delta===1 || (Number(post.likes_count)||0)>0){
        try {
          await sr.entities.SocialPost.updateMany({id:postId},{$inc:{likes_count:delta}});
        } catch(error) {
          // Roll back the preference if the count mutation was rejected; never
          // claim success in that case. Avoid automatic outbound retries.
          if(record)await sr.entities.PostInterest.update(record.id,{liked:wasLiked,saved:wasSaved,updated_at:now}).catch(()=>{});
          else {
            const created=await sr.entities.PostInterest.filter({user_id:user.id,post_id:postId});
            for(const item of created||[])if(item.user_id===user.id)await sr.entities.PostInterest.delete(item.id).catch(()=>{});
          }
          return Response.json({error:'Could not save this like. Refresh before retrying.'},{status:502});
        }
      }
    }
    const updated=await sr.entities.SocialPost.get(postId).catch(()=>null);
    return Response.json({ok:true,post_id:postId,liked:nextLiked,saved:nextSaved,likes_count:Math.max(0,Number(updated?.likes_count)||0)});
  }catch(error){
    console.error('managePostInterest:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Could not update this post preference.'},{status:500});
  }
}
