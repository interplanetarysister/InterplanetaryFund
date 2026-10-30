import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateSustainabilityEvidence,listSustainabilityAudits,
  listEnvironmentCampaigns,saveSustainabilityEvidence} from "../src/lib/sustainability.js";
const USER="8a339fec-2227-45b0-8a35-b3850c1f69d4";
const ENTRY="03f653d1-6acb-4a5c-8c0a-01b9752d3635";
const plain={kind:"hosting",summary:"Documentation from hosting provider",
  observed_at:"2026-10-29T00:00:00Z",source_url:"https://example.com/provenance",
  notes:"A link only, no verified outcome.",verification_status:"documented"};
function create(role="admin",responses=[]){
 const seen=[];let i=0;
 const builder={
  select(){return this;},eq(a,b){seen.push(["eq",a,b]);return this},
  order(){return this;},limit(){return Promise.resolve(responses[i++]||{data:[],error:null})},
  insert(data){seen.push(["insert",data]);return this},
  maybeSingle(){return Promise.resolve(responses[i++]||{data:null,error:null})}
 };
 return {seen,client:{auth:{getUser:async()=>({data:{user:{id:USER,app_metadata:{role}}},error:null})},
    from(t){seen.push(["from",t]);return builder}}};
}
test("browser cannot assign independently verified status",()=>{
 assert.throws(()=>validateSustainabilityEvidence({...plain,verification_status:"independently_verified"}),/Invalid/);
});
test("source evidence links must be HTTPS without credentials",()=>{
 assert.throws(()=>validateSustainabilityEvidence({...plain,source_url:"http://example.com"}),/safe https/);
 assert.throws(()=>validateSustainabilityEvidence({...plain,source_url:"https://u:p@example.com"}),/safe https/);
 assert.equal(validateSustainabilityEvidence(plain).verification_status,"documented");
});
test("browser transfer bytes must not be negative or invented",()=>{
 const sample={...plain,kind:"browser_sample",transfer_bytes_observed:4096,
  resource_count_observed:8,resources_missing_transfer_data:2,verification_status:"unverified"};
 assert.equal(validateSustainabilityEvidence(sample).transfer_bytes_observed,4096);
 assert.throws(()=>validateSustainabilityEvidence({...sample,transfer_bytes_observed:-1}),/Invalid/);
 assert.throws(()=>validateSustainabilityEvidence({...sample,resource_count_observed:2.5}),/Invalid/);
});
test("non-admin users cannot load or write private environmental evidence",async()=>{
 const {seen,client}=create("member");
 await assert.rejects(()=>listSustainabilityAudits(client),/administrator session/);
 await assert.rejects(()=>saveSustainabilityEvidence(client,plain),/administrator session/);
 assert.equal(seen.length,0);
});
test("admin environmental campaign query uses active verified category",async()=>{
 const {seen,client}=create("admin",[{data:[{id:ENTRY,category:"environment",status:"active"}],error:null}]);
 const rows=await listEnvironmentCampaigns(client);
 assert.equal(rows.length,1);
 assert.ok(seen.some(x=>x[0]==="eq"&&x[1]==="category"&&x[2]==="environment"));
 assert.ok(seen.some(x=>x[0]==="eq"&&x[1]==="status"&&x[2]==="active"));
});
test("a saved observation requires a database-verified matching account",async()=>{
 const {seen,client}=create("admin",[{data:{id:ENTRY,author_id:USER,verification_status:"documented"},error:null}]);
 const result=await saveSustainabilityEvidence(client,plain);
 assert.equal(result.author_id,USER);
 const inserted=seen.find(x=>x[0]==="insert");
 assert.equal(inserted[1].author_id,USER);
 assert.equal(inserted[1].verification_status,"documented");
 const other=create("admin",[{data:{id:ENTRY,author_id:"other",verification_status:"documented"},error:null}]);
 await assert.rejects(()=>saveSustainabilityEvidence(other.client,plain),/not confirmed/);
});
test("original Planet Impact records cannot be marked verified by browser RLS",()=>{
 const schema=readFileSync(new URL("../../../supabase/migrations/pending/20261029_ifund_sustainability_audits.sql",import.meta.url),"utf8");
 assert.match(schema,/enable row level security/);
 assert.match(schema,/verification_status in \('unverified','documented'\)/);
 assert.doesNotMatch(schema,/grant update/i);
 assert.match(schema,/author_id=\(select auth\.uid\(\)\)/);
});
test("original Planet Impact source text and browser sampling survive the port",()=>{
 const page=readFileSync(new URL("../src/pages/SustainabilityAdmin.jsx",import.meta.url),"utf8");
 assert.match(page,/sampleBrowserTransfer/);
 assert.match(page,/Measured|measured|Measure/);
 assert.match(page,/Planet Impact/);
 assert.match(page,/saveSustainabilityEvidence/);
 assert.doesNotMatch(page,/base44\./);
});
