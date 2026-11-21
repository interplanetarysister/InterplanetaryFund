import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const tour=read("../public/stitch-review/index.html");
const admin=read("../public/stitch-review/admin-previews.js");
const window={};vm.runInNewContext(admin,{window,document:{createElement:()=>({})}},{"timeout":500});
const api=window.IFUND_STITCH_ADMIN_PREVIEW;
const routes=["/admin","/ops","/platform","/admin/studio","/admin/integrations","/admin/audit","/admin/deletions","/admin/help","/admin/sustainability","/admin/sponsor-inquiries","/admin/social-moderation","/admin/finance"];
test("Stitch review displays source-backed previews of all real admin screens",()=>{
 assert.ok(api);
 for(const route of routes)assert.equal(api.has(route),true,route);
 assert.equal(api.has("/admin/nonexistent"),false);
 assert.match(tour,/IFUND_STITCH_ADMIN_PREVIEW\?\.has\(item\.path\)/);
 assert.match(tour,/IFUND_STITCH_ADMIN_PREVIEW\.render\(item\.path\)/);
});
test("each admin section tells Stitch what it does, with no private records",()=>{
 for(const route of routes){
  const sections=api.sections(route);
  assert.ok(sections.length>0,route);
  for(const item of sections){
   assert.ok(item.title.length>=4,route+" title");
   assert.ok(item.purpose.length>=55,route+" section: "+item.title);
  }
 }
 assert.match(admin,/Purpose: /);
 assert.match(admin,/not a live authenticated screenshot/);
 assert.doesNotMatch(admin,/supabase\.co|@gmail\.com|sk-proj|PAYPAL_CLIENT_SECRET|Bearer [A-Za-z0-9]/);
});
test("admin preview navigation stays read-only and actual public iframe stays sandboxed",()=>{
 assert.match(tour,/script-src 'self' 'unsafe-inline'/);
 assert.match(tour,/admin-previews\.js/);
 assert.match(tour,/iframe\.sandbox="allow-scripts"/);
 assert.match(tour,/pointer-events:none/);
 assert.match(tour,/form-action 'none'/);
 assert.doesNotMatch(admin,/fetch\(|XMLHttpRequest|\.submit\(|\.post\(/);
 assert.match(admin,/window\.stitchTourSelect\?\./);
});
