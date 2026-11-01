import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { latestWritingGuidance } from '../../shared/writingGuidance.ts';

// Official IFund on-site reporter, with an independently viewable archive.
// An issue is published only from the one explicitly designated official blog.
// Outside social promotion uses a separate connector and permission pipeline.
const TOPICS = [
  'Why community comments and shared decisions matter in fundraising',
  'The human story behind clear campaign goals',
  'What members want from a trustworthy fundraising experience',
  'How helpful AI can simplify repetitive work for organizers',
  'Why campaign storytelling benefits from authentic voices',
  'Community ideas, events and causes worth discussing',
  'The vision of a more connected public fundraising network',
  'Why clear permissions and verified connections matter',
];
function clean(v:any,n:number){return String(v||'').trim().slice(0,n);}
export default async function(req: Request) {
 try {
  const base44=createClientFromRequest(req),sr=base44.asServiceRole;
  const official=await sr.entities.UserBlog.filter({type:'official',status:'active'},'-created_date',8);
  const blog=(official||[]).find((b:any)=>b.title==='The Interplanetary Fund Reporter');
  if(!blog)return Response.json({ok:true,skipped:true,reason:'Official blog is not configured'});
  const admin=await sr.entities.User.get(blog.owner_user_id).catch(()=>null);
  if(admin?.role!=='admin'||admin.account_deletion_pending)
   return Response.json({ok:true,skipped:true,reason:'Reporter authorization is not active'});
  const articles=await sr.entities.BlogEntry.filter({blog_id:blog.id},'-published_at',30);
  const today=new Date().toISOString().slice(0,10);
  if((articles||[]).some((e:any)=>e.status==='published'&&String(e.published_at||'').startsWith(today)))
    return Response.json({ok:true,skipped:true,reason:'Today’s edition has already been published'});
  const lastTitles=(articles||[]).slice(0,14).map((e:any)=>clean(e.title,160));
  const topic=TOPICS[(Math.floor(Date.now()/86400000))%TOPICS.length];
  const research=await latestWritingGuidance(sr,1200);
  const res=await sr.integrations.Core.InvokeLLM({
   prompt:`You write the daily INSIDE REPORTER diary for Interplanetary Fund (IFund), a developing people-centered fundraising/community platform.
This is a public newsletter that anyone can read from https://interplanetaryfund.com/blogs.
Topic for this issue: ${topic}.
Unique prior issue titles: ${lastTitles.join(' | ')}.
General weekly public marketing study context: ${research || 'Respect donors, explain causes clearly, and invite authentic community responses.'}
Style: highly engaging, smart, enthusiastic, optimistic, confident IFund brand personality, plain language accessible to children, creative but grounded. 250–450 words. Give readers insight into the platform's direction, what the community could become, and ask one thoughtful question encouraging comments and constructive feedback. Include https://interplanetaryfund.com/community and https://interplanetaryfund.com/discover as links.
IMPORTANT FACT CHECKING: You do not have a verified live deployment report, a list of completed releases, or a provider accounting feed. Do not assert that donations, external cross-posting, account automation, withdrawals, new pages, partnerships or features are currently functional or production-launched. Describe those as vision or ongoing development. Do not invent dates, milestones, user feedback, quotes, surveys, revenue, virality, superiority rankings or financial security certifications. Do not reveal internal errors, private data, keys or email addresses.
Provide one unique original story title, short summary, and body in plain text separated into readable paragraphs. JSON only.`,
   response_json_schema:{type:'object',properties:{title:{type:'string'},summary:{type:'string'},body:{type:'string'}}},
  });
  const title=clean(res?.title,140),body=clean(res?.body,8000),summary=clean(res?.summary,400);
  if(title.length<12||body.length<400||lastTitles.includes(title))
    return Response.json({ok:false,error:'Reporter draft did not meet publication checks'},{status:422});
  const now=new Date().toISOString();
  const entry=await sr.entities.BlogEntry.create({
    blog_id:blog.id,owner_user_id:blog.owner_user_id,
    type:'newsletter',title,summary,body,
    status:'published',featured:true,published_at:now,created_at:now,updated_at:now,
  });
  await sr.entities.Notification.create({
    user_id:blog.owner_user_id,title:'The IFund Reporter published a new issue',
    body:title,type:'system',link:`/blogs/${entry.id}`,read:false,
  }).catch(()=>{});
  return Response.json({ok:true,published:true,entry_id:entry.id,title});
 }catch(error){
  console.error('runReporterDiary failed',error instanceof Error?error.name:'UnknownError');
  return Response.json({error:'Reporter publishing is temporarily unavailable'},{status:500});
 }
}
