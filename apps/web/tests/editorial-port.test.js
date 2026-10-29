import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("original editorial routes are mounted with source-specific pages",()=>{
 const app=read("apps/web/src/App.jsx");
 for(const path of ["/blogs","/blogs/:id","/publications/:id"]){
  assert.ok(app.includes('path="'+path+'"'),path);
 }
 assert.match(app,/const Blogs = lazy/);
 assert.match(app,/const BlogArticle = lazy/);
 assert.match(app,/const PublicationArticle = lazy/);
});

test("editorial data API never exposes unapproved drafts or private source data",()=>{
 const api=read("apps/web/src/lib/editorial.js");
 assert.match(api,/from\("ifund_blog_entries"\)/);
 assert.match(api,/\.eq\("status","published"\)/);
 assert.match(api,/\.eq\("blog.status","active"\)/);
 assert.match(api,/\.eq\("final_approved",true\)/);
 assert.doesNotMatch(api,/ifund_stage|service_role|base44/);
});

test("public editorial table RLS has no user publishing or mutation grants",()=>{
 const schema=read("supabase/migrations/pending/20261029_ifund_editorial_readers.sql");
 assert.match(schema,/alter table public.ifund_blog_entries enable row level security/);
 assert.match(schema,/create policy ifund_entries_published_or_owner/);
 assert.match(schema,/create policy ifund_publications_final/);
 assert.match(schema,/grant select on public.ifund_user_blogs/);
 assert.doesNotMatch(schema,/grant (insert|update|delete) on public.ifund_blog_entries/i);
});

test("source article embedded campaigns cannot execute arbitrary iframe HTML",()=>{
 const render=read("apps/web/src/components/campaigns/CampaignEmbeddedText.jsx");
 const parse=read("apps/web/src/lib/campaignEmbed.js");
 assert.match(render,/splitCampaignContent/);
 assert.match(render,/<CampaignCard/);
 assert.doesNotMatch(render,/dangerouslySetInnerHTML/);
 assert.match(parse,/\[campaign:/);
});

test("original official-publication content and PDF checks remain in source replica",()=>{
 const article=read("apps/web/src/pages/PublicationArticle.jsx");
 assert.match(article,/final/i);
 assert.match(article,/approvedPdfUrl/);
 assert.match(article,/protocol!=="https:"/);
 assert.match(article,/Open PDF/);
 assert.match(article,/Status Report/);
});

test("no historical editorial records have been silently fabricated",()=>{
 const docs=read("docs/migration/role-platform-evidence.json");
 const matrix=JSON.parse(docs).pages;
 for(const path of ["/blogs","/blogs/:id","/publications/:id"]){
  const route=matrix.find(x=>x.path===path);
  assert.equal(route.current_state,"implemented_partial");
  assert.equal(route.release_status,"not_verified");
 }
});
