import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookmarkMissionResource } from "../src/api/missions.js";

const owner="1c00c40e-7722-4d1a-8edc-2d234a440cbf";
const mission="c92c15ba-9a4a-4f24-a5c2-4a01d98653a9";
const resource="external:awesome-monthly-grants";
function mockClient({consent=true,badReceipt=false,swapped=false}={}){
 const calls=[];
 let reads=0;
 const chain=(data)=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data,error:null};}});
 return {calls,client:{
  auth:{async getUser(){reads++;return {data:{user:{
   id:swapped&&reads>1?"22222222-2222-4222-8222-222222222222":owner,
   email_confirmed_at:"2026-11-20T00:00:00Z",is_anonymous:false
  }},error:null};}},
  from(name){calls.push({table:name});if(name==="ifund_profiles")
   return chain({account_status:"active",account_deletion_pending:false});
   if(name==="ifund_legal_acceptances")
    return chain({owner_id:owner,terms_version:"2026-11-10-v4",explicit_consent:consent});
   throw Error("Unexpected direct database table "+name);
  },
  async rpc(name,args){calls.push({rpc:name,args});return {
   data:badReceipt?{mission_id:mission,opportunity_id:resource,source_status:"provider_verified",match_status:"offered",id:"wrong"}:
   {id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",mission_id:mission,
     opportunity_id:resource,source_status:"source_checked",match_status:"interested",already_saved:false},error:null
  };}
 }};
}
test("confirmed member explicitly bookmarks source as interested; no direct provider actions",async()=>{
 const {client,calls}=mockClient();
 const result=await bookmarkMissionResource(client,mission,resource);
 assert.equal(result.match_status,"interested");
 assert.equal(result.source_status,"source_checked");
 assert.ok(calls.some(x=>x.rpc==="ifund_mission_bookmark_verified_resource"));
 assert.ok(!calls.some(x=>x.table==="ifund_mission_opportunity_matches"));
 assert.equal(calls.filter(x=>x.rpc).length,1);
});
test("client rejects inflated status receipts, revoked Terms, and account switches",async()=>{
 const bad=mockClient({badReceipt:true});
 await assert.rejects(()=>bookmarkMissionResource(bad.client,mission,resource),/could not be confirmed/i);
 const revoked=mockClient({consent:false});
 await assert.rejects(()=>bookmarkMissionResource(revoked.client,mission,resource),/agreement/i);
 assert.equal(revoked.calls.filter(x=>x.rpc).length,0);
 const changed=mockClient({swapped:true});
 await assert.rejects(()=>bookmarkMissionResource(changed.client,mission,resource),/account changed/i);
});
test("server-side bookmark migration forbids unverified awards and logs one event per new link",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120123005_ifund_what_if_resource_bookmark_owner_rpc.sql",import.meta.url),"utf8");
 assert.match(sql,/ifund_current_user_has_current_terms/);
 assert.match(sql,/email_confirmed_at is not null/);
 assert.match(sql,/source_system='ifund_external_verified_v1'/);
 assert.match(sql,/match_status.*?interested/s);
 assert.match(sql,/source_status.*?source_checked/s);
 assert.match(sql,/on conflict \(mission_id,opportunity_id\).*do nothing/s);
 assert.match(sql,/event_type,safe_summary/);
 assert.doesNotMatch(sql,/grant execute.*?to anon/i);
});
