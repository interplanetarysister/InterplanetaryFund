import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {removeMissionResourceBookmark} from "../src/api/missions.js";

const OWNER="1c00c40e-7722-4d1a-8edc-2d234a440cbf";
const MISSION="c92c15ba-9a4a-4f24-a5c2-4a01d98653a9";
const OPPORTUNITY="external:awesome-monthly-grants";
function makeClient({terms=true,receipt=null,swap=false}={}){
 let calls=0,writeCount=0;
 const chain=data=>({select(){return this},eq(){return this},async maybeSingle(){return {data,error:null}}});
 return {get writes(){return writeCount},client:{
  auth:{async getUser(){calls++;return {data:{user:{
   id:swap&&calls>1?"22222222-2222-4222-8222-222222222222":OWNER,
   email_confirmed_at:"2026-11-20T00:00:00Z",is_anonymous:false}},error:null}}},
  from(table){
   if(table==="ifund_profiles")return chain({account_status:"active",account_deletion_pending:false});
   if(table==="ifund_legal_acceptances")return chain({
    owner_id:OWNER,terms_version:"2026-11-10-v4",explicit_consent:terms});
   throw Error("Unrecognized table: "+table);
  },
  async rpc(name,args){
   writeCount++;
   assert.equal(name,"ifund_mission_remove_tentative_resource");
   assert.deepEqual(args,{p_mission_id:MISSION,p_opportunity_id:OPPORTUNITY});
   return {data:receipt??{
    mission_id:MISSION,opportunity_id:OPPORTUNITY,removed:true,already_absent:false
   },error:null};
  }
 }};
}
test("owner can remove only a tentative bookmark through RPC",async()=>{
 const ctx=makeClient();
 const result=await removeMissionResourceBookmark(ctx.client,MISSION,OPPORTUNITY);
 assert.equal(result.removed,true);
 assert.equal(ctx.writes,1);
});
test("repeated resource removal is safe, inflated receipts and wrong owner refused",async()=>{
 const missing=makeClient({receipt:{mission_id:MISSION,opportunity_id:OPPORTUNITY,removed:false,already_absent:true}});
 assert.equal((await removeMissionResourceBookmark(missing.client,MISSION,OPPORTUNITY)).already_absent,true);
 const fake=makeClient({receipt:{mission_id:MISSION,opportunity_id:OPPORTUNITY,removed:false,already_absent:false}});
 await assert.rejects(()=>removeMissionResourceBookmark(fake.client,MISSION,OPPORTUNITY),/could not be removed/i);
 const terms=makeClient({terms:false});
 await assert.rejects(()=>removeMissionResourceBookmark(terms.client,MISSION,OPPORTUNITY),/agreement/i);
 assert.equal(terms.writes,0);
 const swap=makeClient({swap:true});
 await assert.rejects(()=>removeMissionResourceBookmark(swap.client,MISSION,OPPORTUNITY),/account changed/i);
});
test("database removal forbids progressed applications and audits only real deletes",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120124048_ifund_what_if_remove_tentative_bookmark_rpc.sql",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/MissionWorkspace.jsx",import.meta.url),"utf8");
 assert.match(sql,/match_status='interested' and source_status='source_checked'/);
 assert.match(sql,/ifund_current_user_has_current_terms/);
 assert.match(sql,/v_deleted is not null then/);
 assert.match(sql,/from public\.ifund_missions\s+where id=p_mission_id and owner_id=v_owner/);
 assert.doesNotMatch(sql,/grant execute.*?to anon/i);
 assert.match(page,/Remove bookmark/);
});
