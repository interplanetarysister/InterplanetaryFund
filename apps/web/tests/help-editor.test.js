import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {helpDraftPayload,loadHelpEditorRecords,saveHelpDraft,publishHelpDraft}
 from "../src/lib/helpEditor.js";
import {listPublicHelpArticles,getPublicHelpArticle}
 from "../src/lib/helpPublic.js";
const ADMIN="e2be45fb-a4a3-4d8f-8aae-b1e9a7469ac1";
const ARTICLE="c918e6e9-bb07-4f06-a2f4-4b0dfdcfaeca";
const DRAFT="0eecc3e4-3c7d-4798-a56d-f6aa90493d43";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const make=(role="admin",answer=[])=>{
 const seen=[];
 const pending=[...answer];
 const chain={
  select(){return this},eq(...a){seen.push(["eq",...a]);return this},
  order(){return this},
  limit(){return Promise.resolve(pending.shift()||{data:[],error:null})},
  maybeSingle(){return Promise.resolve(pending.shift()||{data:null,error:null})},
  insert(row){seen.push(["insert",row]);return this},
  update(row){seen.push(["update",row]);return this}
 };
 return {seen,client:{
  auth:{getUser:async()=>({data:{user:{id:ADMIN,app_metadata:{role}}},error:null})},
  from(name){seen.push(["table",name]);return chain},
  rpc(name,params){seen.push(["rpc",name,params]);return Promise.resolve(pending.shift()||{data:null,error:new Error("missing")})}
 }};
};
const good={question:"How to start a cause?",slug:"how-to-start-a-cause",
 category:"Getting Started",description:"A short overview",answer:"Start with a clear purpose.",
 keywords:["fundraising","campaign"]};

test("private Help draft validation preserves permanent slugs and source categories",()=>{
 assert.equal(helpDraftPayload(good).slug,good.slug);
 assert.equal(helpDraftPayload(good).stage,"draft");
 assert.throws(()=>helpDraftPayload({...good,slug:"../../admin"}),/valid title/);
 assert.throws(()=>helpDraftPayload({...good,category:"Unknown"}),/valid title/);
 assert.throws(()=>helpDraftPayload({...good,question:""}),/valid title/);
 assert.throws(()=>helpDraftPayload({...good,answer:"x".repeat(20001)}),/valid title/);
});
test("member cannot read or write admin drafts",async()=>{
 const {client,seen}=make("member");
 await assert.rejects(()=>loadHelpEditorRecords(client),/Administrator session/);
 await assert.rejects(()=>saveHelpDraft(client,good),/Administrator session/);
 await assert.rejects(()=>publishHelpDraft(client,DRAFT),/Administrator session/);
 assert.equal(seen.length,0);
});
test("admin draft save cannot publish without a separate verified action",async()=>{
 const {client,seen}=make("admin",[{data:{id:DRAFT,author_id:ADMIN},error:null}]);
 const saved=await saveHelpDraft(client,good);
 assert.equal(saved.id,DRAFT);
 assert.ok(seen.some(x=>x[0]==="table"&&x[1]==="ifund_help_drafts"));
 assert.ok(seen.some(x=>x[0]==="insert"&&x[1].author_id===ADMIN));
 assert.ok(!seen.some(x=>x[0]==="table"&&x[1]==="ifund_help_articles"));
});
test("admin publish uses atomic RPC then independently verifies public article",async()=>{
 const {client,seen}=make("admin",[
  {data:ARTICLE,error:null},
  {data:{id:ARTICLE,answer:good.answer,slug:good.slug},error:null}
 ]);
 const published=await publishHelpDraft(client,DRAFT);
 assert.equal(published.slug,good.slug);
 assert.deepEqual(seen.find(x=>x[0]==="rpc"),
   ["rpc","ifund_publish_help_draft",{p_draft_id:DRAFT}]);
 assert.ok(seen.some(x=>x[0]==="table"&&x[1]==="ifund_help_articles"));
});
test("unverified publication confirmation fails closed",async()=>{
 const {client}=make("admin",[{data:null,error:new Error("not published")}]);
 await assert.rejects(()=>publishHelpDraft(client,DRAFT),/not confirmed/);
});
test("public Help articles exclude private drafts; static guidance survives unapplied schema",async()=>{
 const c={from:()=>({select(){return this},order(){return this},
  limit:async()=>({data:null,error:new Error("table not migrated")})})};
 const state=await listPublicHelpArticles(c);
 assert.equal(state.live,false);
 assert.ok(state.articles.length>0);
 assert.ok(state.articles.every(x=>x.slug));
 const db=source("src/lib/helpPublic.js");
 assert.doesNotMatch(db,/from\("ifund_help_drafts"\)/);
});
test("admin published Help Editor shares public reader path",()=>{
 const editor=source("src/pages/HelpAdmin.jsx");
 const app=source("src/App.jsx");
 const publicReader=source("src/pages/Help.jsx");
 assert.match(editor,/saveHelpDraft/);
 assert.match(editor,/publishHelpDraft/);
 assert.match(app,/path="\/admin\/help".*RequireAccess access="admin"/);
 assert.match(publicReader,/listPublicHelpArticles/);
});
test("help RLS and publish RPC require trusted admin claims",()=>{
 const sql=source("../supabase/migrations/pending/20261029_ifund_help_editor.sql");
 assert.match(sql,/security invoker/);
 assert.match(sql,/for update/);
 assert.match(sql,/auth\.jwt\(\)->'app_metadata'->>'role'/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/helpful_yes integer/);
 assert.match(sql,/Published help article URLs cannot be changed/);
 assert.doesNotMatch(sql,/security definer/i);
});
