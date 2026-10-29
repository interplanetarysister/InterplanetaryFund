import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../../"+p,import.meta.url),"utf8");

test("historical community detail is mounted as a public source route",()=>{
 const app=read("apps/web/src/App.jsx");
 assert.match(app,/path="\/community\/:id" element={<CommunityDetail\s*\/>}/);
 const page=read("apps/web/src/pages/CommunityDetail.jsx");
 for(const label of ["Discussions","Volunteer","Members","IFund Reporter & community blogs"])
   assert.ok(page.includes(label),label);
});

test("community public records and member listings are consent-limited by RLS",()=>{
 const sql=read("supabase/migrations/pending/20261029_ifund_community_readers.sql");
 assert.match(sql,/ALTER TABLE public\.ifund_communities ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/ALTER TABLE public\.ifund_community_memberships ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/public_approved=true/);
 assert.match(sql,/public_listing_opt_in=true/);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/GRANT SELECT ON/);
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE)/i);
});

test("public community reader does not expose private member IDs and never invents totals",()=>{
 const api=read("apps/web/src/lib/communities.js");
 const page=read("apps/web/src/pages/CommunityDetail.jsx");
 assert.match(api,/\.eq\("public_approved",true\)/);
 assert.match(api,/\.eq\("public_listing_opt_in",true\)/);
 assert.match(api,/\.eq\("user_id",auth\.user\.id\)/);
 assert.doesNotMatch(api,/select\(".*user_id.*public_display_name/);
 assert.match(page,/This is not the total member count/);
 assert.doesNotMatch(page,/base44\.functions|service_role|\.insert\(/);
});

test("community page remains incomplete until discussions and membership have proof",()=>{
 const j=JSON.parse(read("docs/migration/role-platform-evidence.json"));
 const page=j.pages.find(p=>p.path==="/community/:id");
 assert.equal(page?.current_state,"implemented_partial");
 assert.equal(page?.release_status,"not_verified");
});
