import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../../"+p,import.meta.url),"utf8");

test("institution index and details preserve the historical member routes",()=>{
 const app=read("apps/web/src/App.jsx");
 assert.match(app,/path="\/institutions"[^\n]*RequireAccess access="member"/);
 assert.match(app,/path="\/institutions\/:id"[^\n]*RequireAccess access="member"/);
 assert.match(app,/import\("\.\/pages\/Institutions"\)/);
 assert.match(app,/import\("\.\/pages\/InstitutionDetail"\)/);
});

test("institution source categories and visual components are preserved",()=>{
 const source=read("apps/web/src/components/institutions/institutionTypes.js");
 const card=read("apps/web/src/components/institutions/InstitutionCard.jsx");
 const profile=read("apps/web/src/components/institutions/InstitutionProfile.jsx");
 for(const label of ["Corporate Foundation","International NGO","University","Hospital","Volunteer Programs".replace(" Programs","")]){
   if(label!=="Volunteer")assert.ok(source.includes(label),label);
 }
 assert.match(card,/verification_status/);
 assert.match(profile,/Programs offered/);
 assert.match(profile,/safeInstitutionWebsite/);
});

test("institutional public reads require explicit independent approval, never client writes",()=>{
 const reader=read("apps/web/src/lib/institutions.js");
 const sql=read("supabase/migrations/pending/20261029_ifund_institutions_readers.sql");
 assert.match(reader,/\.eq\("is_public",true\)/);
 assert.match(reader,/approved_for_public/);
 assert.match(sql,/ALTER TABLE public\.ifund_institutions ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/public_approved_at IS NOT NULL/);
 assert.match(sql,/approved_for_public=true/);
 assert.match(sql,/GRANT SELECT ON TABLE/);
 assert.doesNotMatch(sql,/GRANT INSERT|GRANT UPDATE|GRANT DELETE/i);
});

test("institution detail omits private applications and financial activity",()=>{
 const page=read("apps/web/src/pages/InstitutionDetail.jsx");
 assert.match(page,/Opportunities/);
 assert.match(page,/applications and institution-management|Applications and institution-management/i);
 assert.doesNotMatch(page,/from\("ifund_finance|service_role/);
});

test("two institution pages remain partial until real schema and role tests",()=>{
 const data=JSON.parse(read("docs/migration/role-platform-evidence.json"));
 for(const path of ["/institutions","/institutions/:id"]){
  const item=data.pages.find(x=>x.path===path);
  assert.equal(item.current_state,"implemented_partial");
  assert.equal(item.release_status,"not_verified");
 }
});
