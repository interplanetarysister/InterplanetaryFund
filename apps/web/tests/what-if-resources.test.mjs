import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listVerifiedMissionResources } from "../src/api/missions.js";

const ID="1c00c40e-7722-4d1a-8edc-2d234a440cbf";
const resource=(overrides={})=>({
 id:"external:example",title:"Example community program",type:"grant",
 description:"Research this potential program.",official_url:"https://example.org/program",
 official_provider:"Example provider",verified_at:"2026-11-12T00:00:00Z",
 source_system:"ifund_external_verified_v1",status:"program",
 cause_tags:["community","education"],geography:"Provider-specific",
 requirements_complete:false,deadline_at:null,...overrides
});
const mockClient=(rows,options={})=>{
 const activity=[];
 let checks=0;
 const query={
  select(){return this;},eq(){return this;},in(){return this;},
  not(){return this;},order(){return this;},
  async limit(){return {data:rows,error:options.readError?new Error("unavailable"):null};}
 };
 const profile={
  select(){return this;},eq(){return this;},
  async maybeSingle(){return {data:{account_status:"active",account_deletion_pending:false},error:null};}
 };
 const client={
  auth:{async getUser(){checks++;return {data:{user:{
   id:options.swapOwner&&checks>1?"db2e3f88-2a7d-4973-abfc-c55ba3ed1c60":ID,
   email_confirmed_at:"2026-11-20T10:00:00Z",
   is_anonymous:options.anonymous===true
  }},error:null};}},
  from(name){activity.push(name);if(name==="ifund_profiles")return profile;
   if(name==="ifund_opportunity")return query;throw Error("unexpected table "+name);}
 };
 return {client,activity};
};
test("catalog returns source-checked HTTPS links without upgrading a source into an eligibility claim",async()=>{
 const {client,activity}=mockClient([resource(),resource({
   id:"external:other",title:"Other program",cause_tags:["science"]})]);
 const result=await listVerifiedMissionResources(client,{goalType:"community"});
 assert.equal(result.length,2);
 assert.equal(result[0].id,"external:example");
 assert.equal(result[0].source_status,"source_link_checked");
 assert.equal(result[0].eligibility_status,"not_checked");
 assert.equal(result[0].match_status,"potential_only");
 assert.deepEqual([...new Set(activity)].sort(),["ifund_opportunity","ifund_profiles"]);
});
test("unverified, non-HTTPS and revoked catalog entries are never shown",async()=>{
 const {client}=mockClient([
  resource({official_url:"http://unsafe.invalid/"}),
  resource({verified_at:null}),
  resource({status:"closed"}),
  resource({source_system:"untrusted-import"}),
  resource({id:"external:valid"})
 ]);
 const r=await listVerifiedMissionResources(client);
 assert.deepEqual(r.map(x=>x.id),["external:valid"]);
});
test("an anonymous member, failed source read, or changed account is denied",async()=>{
 await assert.rejects(()=>listVerifiedMissionResources(mockClient([resource()],{anonymous:true}).client),/confirmed email account/i);
 await assert.rejects(()=>listVerifiedMissionResources(mockClient([resource()],{readError:true}).client),/could not be loaded/i);
 await assert.rejects(()=>listVerifiedMissionResources(mockClient([resource()],{swapOwner:true}).client),/account changed/i);
});
test("resource access migration keeps verified-source policy and denies anon and member writes",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261120122219_ifund_what_if_verified_opportunity_catalog_read.sql",import.meta.url),"utf8");
 const workspace=readFileSync(new URL("../src/pages/MissionWorkspace.jsx",import.meta.url),"utf8");
 assert.match(sql,/ifund_external_verified_opportunity_public/);
 assert.match(sql,/grant select \(/i);
 assert.doesNotMatch(sql,/grant (all|insert|update|delete).*to authenticated/i);
 assert.doesNotMatch(sql,/grant .* to anon/i);
 assert.match(workspace,/Eligibility not checked/);
 assert.match(workspace,/target="_blank" rel="noopener noreferrer"/);
});
