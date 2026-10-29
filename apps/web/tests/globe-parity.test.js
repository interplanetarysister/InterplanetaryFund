import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("original public globe retains Three.js renderer and source appearance",()=>{
 const globe=read("apps/web/src/components/globe/CampaignGlobe.jsx");
 const page=read("apps/web/src/pages/GlobalGlobe.jsx");
 const pkg=JSON.parse(read("apps/web/package.json"));
 assert.equal(pkg.dependencies.three,"^0.171.0");
 assert.match(globe,/new THREE\.WebGLRenderer/);
 assert.match(globe,/earth_atmos_2048\.jpg/);
 assert.match(globe,/latLngToVector3/);
 assert.match(page,/CampaignGlobe/);
 assert.match(page,/No public campaigns currently have owner-approved globe locations/);
});
test("globe never shows private or fabricated coordinates",()=>{
 const data=read("apps/web/src/lib/globeCampaigns.js");
 const sql=read("supabase/migrations/pending/20261029_ifund_globe_locations.sql");
 assert.match(data,/\.eq\("status","active"\)/);
 assert.match(data,/\.eq\("globe_visible",true\)/);
 assert.match(data,/Number\.isFinite/);
 assert.match(data,/raised_amount:null/);
 assert.match(sql,/globe_visible boolean NOT NULL DEFAULT false/);
 assert.match(sql,/location_lat BETWEEN -90 AND 90/);
 assert.match(sql,/location_lng BETWEEN -180 AND 180/);
 assert.doesNotMatch(sql,/GRANT SELECT ON/i);
});
test("globe registered as a source-only standalone public route",()=>{
 const app=read("apps/web/src/App.jsx");
 const pages=JSON.parse(read("docs/migration/role-platform-evidence.json"));
 assert.match(app,/path="\/globe" element={<GlobalGlobe \/>/);
 const p=pages.pages.find(x=>x.path==="/globe");
 assert.equal(p.current_state,"implemented_partial");
 assert.equal(p.release_status,"not_verified");
});
