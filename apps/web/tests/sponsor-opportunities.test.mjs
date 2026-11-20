import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {onRequest} from "../functions/api/public/sponsor-opportunities.js";
const env={SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test-key"};
const row={id:"offer1",sponsor_id:"sponsor1",source_kind:"direct_sponsor",title:"Complete a qualified survey",summary:"Verified completion only",requirements:"Complete survey",official_url:"https://example.org/task",geography:"US",eligibility:"Eligible adults",reward_minor:275,currency:"USD",compensation_basis:"verified_conversion",starts_at:null,ends_at:null,verified_at:"2026-11-20T00:00:00Z"};
const sponsor={id:"sponsor1",display_name:"Test verified sponsor",official_url:"https://example.org",partner_claim_allowed:false};
const request=()=>new Request("https://interplanetaryfund.com/api/public/sponsor-opportunities");
const response=async (offers=[row],sponsors=[sponsor])=>onRequest({request:request(),env,fetch:async url=>Response.json(url.includes("sponsor_opportunities")?offers:sponsors)});
test("The sponsor endpoint defaults to fail-closed and never authorizes enrollment or payouts",async()=>{
 const r=await response();assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.count,1);assert.equal(data.opportunities[0].reward_minor,275);
 assert.equal(data.opportunities[0].enrollment_enabled,false);
 assert.equal(data.opportunities[0].reward_payable,false);
 assert.equal(data.member_enrollment_enabled,false);
 assert.equal(data.reward_payout_enabled,false);
});
test("The sponsor endpoint rejects missing credentials, mutations and failed data retrieval",async()=>{
 assert.equal((await onRequest({request:new Request(request().url,{method:"POST"}),env})).status,405);
 assert.equal((await onRequest({request:request(),env:{}})).status,503);
 assert.equal((await onRequest({request:request(),env,fetch:async()=>new Response("unavailable",{status:503})})).status,503);
});
test("The sponsor endpoint filters untrusted redirects, invalid rewards and unmatched sponsors",async()=>{
 const r=await response([row,{...row,id:"bad",official_url:"javascript:alert(1)"},{...row,id:"negative",reward_minor:-20},{...row,id:"missing",sponsor_id:"other"}]);
 assert.equal((await r.json()).count,1);
 assert.equal((await (await response([row],[])).json()).count,0);
});
test("Dedicated sponsor schema has RLS, no member payout writes and separate reward accounting",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120145900_ifund_sponsor_task_research_foundation.sql",import.meta.url),"utf8");
 for(const name of ["ifund_sponsor_organizations","ifund_sponsor_opportunities","ifund_sponsor_participations","ifund_sponsor_reward_events"]){
  assert.match(sql,new RegExp("alter table public\\."+name+" enable row level security","i"));
  assert.match(sql,new RegExp("revoke all on public\\."+name+" from public,anon,authenticated","i"));
 }
 assert.match(sql,/sponsor_offer_publication_gate/);
 assert.match(sql,/reward_clearance_requires_settlement/);
 assert.match(sql,/owner_id=\(select auth.uid\(\)\)/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) /i);
});
