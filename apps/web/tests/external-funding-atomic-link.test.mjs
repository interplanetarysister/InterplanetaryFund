import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linkExternalFundraiser } from "../src/api/externalFundingHub.js";

const uid="11111111-1111-4111-8111-111111111111";
const sourceId="22222222-2222-4222-8222-222222222222";
const url="https://gofundme.com/f/a-fundraiser";
function clientFixture({existing=false,fail=false,foreign=false}={}) {
 const calls=[];
 const user={id:uid,email:"owner@example.com",email_confirmed_at:"2026-11-20T01:00:00Z",is_anonymous:false};
 const client={
  calls,
  auth:{getUser:async()=>({data:{user},error:null})},
  from(table){
   calls.push({table});
   if(table==="ifund_profiles")return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{account_status:"active",account_deletion_pending:false},error:null})};
   if(table==="ifund_external_fundraiser_sources")return {
    select(){return this;},eq(){return this;},
    maybeSingle:async()=>({data:{id:sourceId,owner_id:foreign?"33333333-3333-4333-8333-333333333333":uid,group_id:"44444444-4444-4444-8444-444444444444",platform:"gofundme",campaign_url:url,provenance:"owner_reported"},error:null})
   };
   throw Error("Unapproved table: "+table);
  },
  async rpc(name,args) {
    calls.push({name,args});
    if(fail)return {data:null,error:{message:"transient server failure"}};
    return {data:[{source_id:sourceId,already_linked:existing}],error:null};
  }
 };
 return client;
}
test("one-link create is an atomic RPC without separate empty-group writes",async()=>{
 const client=clientFixture();
 const result=await linkExternalFundraiser(client,{platform:"gofundme",url,title:"A Fundraiser"});
 assert.equal(result.alreadyLinked,false);
 const rpc=client.calls.find(x=>x.name==="ifund_link_external_fundraiser");
 assert.equal(rpc.args.p_group_id,null);
 assert.equal(rpc.args.p_campaign_url,url);
 assert.equal(client.calls.some(x=>x.table==="ifund_external_fundraiser_groups"),false);
});
test("repeat link returns already-linked and keeps the existing campaign group",async()=>{
 const client=clientFixture({existing:true});
 const result=await linkExternalFundraiser(client,{platform:"gofundme",url,title:"A Fundraiser"});
 assert.equal(result.alreadyLinked,true);
 assert.equal(result.source.campaign_url,url);
});
test("RPC errors fail closed without pretending save succeeded",async()=>{
 await assert.rejects(linkExternalFundraiser(clientFixture({fail:true}),{platform:"gofundme",url,title:"A Fundraiser"}),/could not be saved/);
});
test("source returned from another owner cannot be accepted",async()=>{
 await assert.rejects(linkExternalFundraiser(clientFixture({foreign:true}),{platform:"gofundme",url,title:"A Fundraiser"}),/could not be verified/);
});
test("invalid host never reaches RPC",async()=>{
 const c=clientFixture();
 await assert.rejects(linkExternalFundraiser(c,{platform:"gofundme",url:"https://gofundme.com.evil.invalid/f/a-fundraiser",title:"A Fundraiser"}));
 assert.equal(c.calls.some(x=>x.name==="ifund_link_external_fundraiser"),false);
});
test("Postgres function is invoker-RLS, member-only, atomic and idempotent",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120021500_ifund_atomic_external_link.sql",import.meta.url),"utf8");
 assert.match(sql,/security invoker/);
 assert.match(sql,/v_owner uuid := auth\.uid\(\)/);
 assert.match(sql,/account_deletion_pending=false/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/already_linked := true/);
 assert.match(sql,/insert into public\.ifund_external_fundraiser_groups/);
 assert.match(sql,/insert into public\.ifund_external_fundraiser_sources/);
 assert.match(sql,/grant execute on function .* to authenticated/);
 assert.doesNotMatch(sql,/grant execute .* to anon/);
 const page=readFileSync(new URL("../src/pages/ExternalFundingHub.jsx",import.meta.url),"utf8");
 assert.match(page,/linkExternalFundraiser\(client/);
 assert.match(page,/alreadyLinked\?/);
 assert.doesNotMatch(page,/createExternalFundraiserGroup/);
});
