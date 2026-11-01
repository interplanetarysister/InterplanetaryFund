import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasSubscriptionLevel } from '../../shared/subscriptionEntitlements.ts';
import { normalizeCampaignEmbeds, campaignIdsFromText, EMBED_ID } from '../../shared/campaignEmbeds.ts';

const str=(v:unknown,n:number)=>String(v||'').trim().slice(0,n);
const safeBlog=(b:any)=>b?({id:b.id,owner_user_id:b.owner_user_id,type:b.type,
  title:b.title,description:b.description,cover_image_url:b.cover_image_url,status:b.status}):null;
const safeEntry=(e:any)=>({id:e.id,blog_id:e.blog_id,owner_user_id:e.owner_user_id,
  type:e.type,title:e.title,summary:e.summary,body:e.body,status:e.status,
  featured:e.featured,published_at:e.published_at,created_at:e.created_at});
const canAuthor=(u:any)=>!!u&&(u.role==='admin'||
  (hasSubscriptionLevel(u,1)&&u.subscription_status==='active'));
const editable=(e:any,u:any)=>!!u&&!!e&&(e.owner_user_id===u.id||u.role==='admin');
export default async function(req:Request) {
 try{
  const base44=createClientFromRequest(req),sr=base44.asServiceRole;
  const body=await req.json().catch(()=>({}));
  const mode=str(body.mode||'feed',30);
  const user=await base44.auth.me().catch(()=>null);
  if(['create_blog','edit_blog','save_entry','publish_entry','delete_entry'].includes(mode)){
    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    if(!canAuthor(guard.user))return Response.json({error:'Publishing a blog requires an active paid membership.'},{status:403});
  }
  if(mode==='create_blog'){
    const mine=await sr.entities.UserBlog.filter({owner_user_id:user.id});
    const existing=(mine||[]).find((b:any)=>b.type==='member');
    if(existing)return Response.json({ok:true,blog:safeBlog(existing),already_exists:true});
    if(user.role!=='admin'&&(mine||[]).some((b:any)=>b.type==='official')){
      return Response.json({error:'Only one blog per account.'},{status:409});
    }
    const title=str(body.title,90);
    if(title.length<3)return Response.json({error:'Blog title must contain at least three characters.'},{status:400});
    const created=await sr.entities.UserBlog.create({
      owner_user_id:user.id,type:'member',title,description:str(body.description,500),
      status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    });
    // Converge concurrent requests on the earliest blog. An account cannot
    // rotate a second permanent blog after a plan expires or a title changes.
    const check=await sr.entities.UserBlog.filter({owner_user_id:user.id});
    const ordered=(check||[]).filter((b:any)=>b.type==='member').sort((a:any,b:any)=>
      String(a.created_date||'').localeCompare(String(b.created_date||''))||
      String(a.id).localeCompare(String(b.id)));
    for(const extra of ordered.slice(1)){
      await sr.entities.UserBlog.update(extra.id,{status:'archived'}).catch(()=>{});
    }
    const blog=ordered[0]||created;
    return Response.json({ok:true,blog:safeBlog(blog)});
  }
  if(mode==='edit_blog'){
    const blog=await sr.entities.UserBlog.get(str(body.blog_id,72)).catch(()=>null);
    if(!blog||blog.owner_user_id!==user.id)return Response.json({error:'Blog not found'},{status:404});
    const updated=await sr.entities.UserBlog.update(blog.id,{
      title:str(body.title||blog.title,90),description:str(body.description,500),
      updated_at:new Date().toISOString(),
    });
    return Response.json({ok:true,blog:safeBlog(updated)});
  }
  if(mode==='save_entry'||mode==='publish_entry'){
    const blog=await sr.entities.UserBlog.get(str(body.blog_id,72)).catch(()=>null);
    if(!blog||blog.owner_user_id!==user.id||blog.status!=='active')
      return Response.json({error:'Blog not found'},{status:404});
    if(blog.type==='official'&&user.role!=='admin')return Response.json({error:'Official stories require admin access'},{status:403});
    const title=str(body.title,140),raw=normalizeCampaignEmbeds(body.body);
    if(title.length<3||raw.trim().length<12)return Response.json({error:'Provide a title and article.'},{status:400});
    const ids=campaignIdsFromText(raw);
    for(const id of ids){
      if(!EMBED_ID.test(id))return Response.json({error:'Invalid campaign link.'},{status:400});
      const campaign=await sr.entities.Campaign.get(id).catch(()=>null);
      if(!campaign||campaign.status!=='active')return Response.json({error:'An embedded campaign is not public or active.'},{status:400});
    }
    let old=null;
    if(body.entry_id){
      old=await sr.entities.BlogEntry.get(str(body.entry_id,72)).catch(()=>null);
      if(!editable(old,user)||old.blog_id!==blog.id)return Response.json({error:'Article not found'},{status:404});
    }
    const publish=mode==='publish_entry',now=new Date().toISOString();
    const patch={blog_id:blog.id,owner_user_id:blog.owner_user_id,
      type:blog.type==='official'?'newsletter':'article',
      title,summary:str(body.summary,400),body:raw,
      status:publish?'published':old?.status==='published'?'published':'draft',
      featured:blog.type==='official'&&publish,
      ...(publish?{published_at:old?.published_at||now}:{}),updated_at:now,
    };
    const entry=old?await sr.entities.BlogEntry.update(old.id,patch):
      await sr.entities.BlogEntry.create({...patch,created_at:now});
    return Response.json({ok:true,entry:safeEntry(entry)});
  }
  if(mode==='delete_entry'){
    const entry=await sr.entities.BlogEntry.get(str(body.entry_id,72)).catch(()=>null);
    if(!editable(entry,user))return Response.json({error:'Article not found'},{status:404});
    await sr.entities.BlogEntry.delete(entry.id);
    return Response.json({ok:true,deleted:true});
  }
  if(mode==='mine'){
    if(!user?.id)return Response.json({error:'Sign in required'},{status:401});
    const blogs=await sr.entities.UserBlog.filter({owner_user_id:user.id});
    const blog=(blogs||[]).find((b:any)=>b.type==='member')||null;
    const entries=blog?await sr.entities.BlogEntry.filter({blog_id:blog.id},'-created_date',100):[];
    return Response.json({ok:true,blog:safeBlog(blog),entries:(entries||[]).filter((e:any)=>e.owner_user_id===user.id).map(safeEntry),
      can_create:canAuthor(user),existing_count:(blogs||[]).filter((b:any)=>b.type==='member').length});
  }
  if(mode==='feed'){
    const blogs=await sr.entities.UserBlog.list('-created_date',200);
    const entries=await sr.entities.BlogEntry.filter({status:'published'},'-published_at',120);
    return Response.json({ok:true,
      entries:(entries||[]).filter((e:any)=>e.status==='published').map((e:any)=>({
        id:e.id,blog_id:e.blog_id,owner_user_id:e.owner_user_id,title:e.title,summary:e.summary,
        type:e.type,featured:e.featured,published_at:e.published_at,created_at:e.created_at,
        author_name:(blogs||[]).find((b:any)=>b.id===e.blog_id)?.title||'IFund member blog',
      }))});
  }
  if(mode==='article'){
    const entry=await sr.entities.BlogEntry.get(str(body.entry_id,72)).catch(()=>null);
    if(!entry||entry.status!=='published'&&entry.owner_user_id!==user?.id&&user?.role!=='admin')
      return Response.json({error:'Article not found'},{status:404});
    const blog=await sr.entities.UserBlog.get(entry.blog_id).catch(()=>null);
    if(!blog)return Response.json({error:'Blog unavailable'},{status:404});
    const campaigns=await Promise.all(campaignIdsFromText(entry.body).map(async(id:string)=>{
      const c=await sr.entities.Campaign.get(id).catch(()=>null);
      return c?.status==='active'?{
        id:c.id,title:c.title,cover_image_url:c.cover_image_url,
        summary:c.summary,goal_amount:c.goal_amount,raised_amount:c.raised_amount,
        donor_count:c.donor_count,category:c.category,status:c.status,
      }:null;
    }));
    return Response.json({ok:true,entry:safeEntry(entry),blog:safeBlog(blog),
      campaigns:campaigns.filter(Boolean)});
  }
  return Response.json({error:'Unsupported action'},{status:400});
 }catch(error){
  console.error('manageBlog failed:',error instanceof Error?error.name:'UnknownError');
  return Response.json({error:'Blog request could not be completed.'},{status:500});
 }
}
