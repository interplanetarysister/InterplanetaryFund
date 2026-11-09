import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../../"+path,import.meta.url),"utf8");

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

test("canonical editorial tables use published-only public reads and no browser mutation grants",()=>{
 const foundation=read("supabase/migrations/20261030175218_ifund_blog_migration_foundation_20261030.sql");
 const hardening=read("supabase/migrations/20261030233951_ifund_editorial_public_read_and_server_write_hardening_20261030.sql");
 const publications=read("supabase/migrations/20261031011426_ifund_official_publications_public_read_model_20261030.sql");
 assert.match(foundation,/alter table public.ifund_blog_entries enable row level security/i);
 assert.match(foundation,/alter table public.ifund_blogs enable row level security/i);
 assert.match(hardening,/ifund_blog_entries_read_published_or_owner/i);
 assert.match(hardening,/revoke all privileges[\s\S]*from PUBLIC, anon, authenticated/i);
 assert.doesNotMatch(hardening,/grant\s+(insert|update|delete)/i);
 assert.match(publications,/ifund_publications_final_read/i);
 assert.match(publications,/final_approved = true/i);
 assert.match(publications,/revoke all privileges[\s\S]*from PUBLIC, anon, authenticated/i);
 assert.doesNotMatch(publications,/grant\s+(insert|update|delete)/i);
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
