import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OFFICIAL_OUTREACH_COPY,validateOutreachCandidate,
  fetchOfficialOutreachCandidates,reviewOfficialOutreachCandidate} from "../src/lib/officialOutreach.mjs";
const admin={id:"11111111-1111-4111-8111-111111111111",email_confirmed_at:"2026-11-19T12:00:00Z",is_anonymous:false};
const row={provider:"facebook",display_name:"Interplanetary Fund",
  historical_handle:"@InterplanetaryFund",historical_login_email:"historical@example.com",
  legacy_claim:"historical_active",review_status:"unverified",verified_provider_connections:0,
  verification_notes:null};
function mocked({user=admin,rows=[row],readError=null,reviewState="needs_login"}={}){
 const calls=[];
 return {calls,client:{
  auth:{async getUser(){return {data:{user},error:null}}},
  async rpc(name,args){
   calls.push({name,args});
   if(readError)return {data:null,error:{message:"denied"}};
   return {data:name==="ifund_admin_outreach_candidates"
       ?rows.map(r=>({...r,review_status:calls.some(c=>c.name==="ifund_admin_review_outreach_candidate")?reviewState:r.review_status,verification_notes:calls.some(c=>c.name==="ifund_admin_review_outreach_candidate")?"No auth grant":r.verification_notes}))
       :{provider:"facebook",review_status:reviewState,connected:false,publish_granted:false},
    error:null};
  }
 }};
}
test("recovering historical accounts does not assert an active OAuth grant",async()=>{
 const {client,calls}=mocked();
 const list=await fetchOfficialOutreachCandidates(client);
 assert.equal(list.length,1);assert.equal(list[0].verified_provider_connections,0);
 assert.equal(calls[0].name,"ifund_admin_outreach_candidates");
 assert.throws(()=>validateOutreachCandidate({...row,review_status:"connected"}));
});
test("owner review must be persisted and cannot mark connected",async()=>{
 const {client,calls}=mocked();
 const record=await reviewOfficialOutreachCandidate(client,{provider:"facebook",status:"needs_login",notes:"No auth grant"});
 assert.equal(record.review_status,"needs_login");
 assert.deepEqual(calls.map(c=>c.name),["ifund_admin_review_outreach_candidate","ifund_admin_outreach_candidates"]);
 await assert.rejects(()=>reviewOfficialOutreachCandidate(client,{provider:"facebook",status:"connected"}));
});
test("unverified member is rejected; non-admin RPC remains the authoritative gate",async()=>{
 await assert.rejects(()=>fetchOfficialOutreachCandidates(mocked({user:null}).client));
 await assert.rejects(()=>fetchOfficialOutreachCandidates(mocked({readError:"denied"}).client));
});
test("official outreach accurately describes platform without promising funding or verified partnerships",()=>{
 for(const v of Object.values(OFFICIAL_OUTREACH_COPY)){
  assert.match(v,/https:\/\/interplanetaryfund\.com/);
  assert.doesNotMatch(v,/guaranteed donations|guaranteed funding|approved partnership/i);
 }
});
test("private legacy email inventory uses an admin guard, not browser-visible static source",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120015000_ifund_official_outreach_recovery_inventory.sql",import.meta.url),"utf8");
 const component=readFileSync(new URL("../src/components/connections/OfficialOutreachRecovery.jsx",import.meta.url),"utf8");
 const adminPage=readFileSync(new URL("../src/pages/AdminConnections.jsx",import.meta.url),"utf8");
 assert.match(sql,/alter table ifund_ops\.official_outreach_account_candidates enable row level security/);
 assert.match(sql,/public\.ifund_current_user_is_verified_admin\(\)/);
 assert.match(sql,/review_status in\('unverified','needs_login','provider_verification_required','unsupported'\)/);
 assert.match(sql,/publish_granted',false/);
 assert.doesNotMatch(sql,/grant (select|update|insert) on ifund_ops\.official_outreach_account_candidates to authenticated/i);
 assert.match(component,/fetchOfficialOutreachCandidates\(authClient\(\)\)/);
 assert.match(adminPage,/<OfficialOutreachRecovery \/>/);
});
