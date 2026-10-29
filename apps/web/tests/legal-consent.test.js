import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {legalAcceptanceStatus,acceptLegalAgreement} from "../src/lib/legalAcceptance.js";
import {TERMS_VERSION} from "../src/lib/legalPolicy.js";
const OWNER="d3e640b2-57d2-43f0-94f3-480e9a0d4a72";
const OTHER="5736073e-e3d2-4dfa-8433-97397ce92920";

function makeClient(responses=[]){
 const operations=[];
 const queue=[...responses];
 const builder={
   select(...args){operations.push(["select",...args]);return this;},
   eq(...args){operations.push(["eq",...args]);return this;},
   insert(...args){operations.push(["insert",...args]);return this;},
   maybeSingle(){operations.push(["maybeSingle"]);return Promise.resolve(queue.shift()||{data:null,error:null});}
 };
 return {operations,client:{
   auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
   from(name){operations.push(["from",name]);return builder}
 }};
}
test("only the exact current source legal version is accepted",()=>{
 assert.equal(TERMS_VERSION,"2026-10-13-v3");
});
test("missing recorded assent cannot unlock account features",async()=>{
 const {client}=makeClient([{data:null,error:null}]);
 assert.deepEqual(await legalAcceptanceStatus(client),{accepted:false,terms_version:TERMS_VERSION});
});
test("status query derives owner from canonical verified auth and matches version",async()=>{
 const {client,operations}=makeClient([{
  data:{owner_id:OWNER,terms_version:TERMS_VERSION,explicit_consent:true,accepted_at:"2026-10-29T00:00:00Z"},
  error:null
 }]);
 const result=await legalAcceptanceStatus(client);
 assert.equal(result.accepted,true);
 assert.ok(operations.some(op=>op[0]==="eq" && op[1]==="owner_id" && op[2]===OWNER));
 assert.ok(operations.some(op=>op[0]==="eq" && op[1]==="terms_version" && op[2]===TERMS_VERSION));
});
test("data from a different account is not accepted, even if marked true",async()=>{
 const {client}=makeClient([{
  data:{owner_id:OTHER,terms_version:TERMS_VERSION,explicit_consent:true,accepted_at:"2026-10-29T00:00:00Z"},
  error:null
 }]);
 await assert.rejects(()=>legalAcceptanceStatus(client),/owner verification failed/);
});
test("no consent checkbox means no insert or implied acceptance",async()=>{
 const {client,operations}=makeClient();
 await assert.rejects(()=>acceptLegalAgreement(client,{explicit_consent:false}),/affirmatively accept/);
 assert.equal(operations.length,0);
});
test("explicit consent is persisted and independently re-read before success",async()=>{
 const {client,operations}=makeClient([
  {data:{owner_id:OWNER,terms_version:TERMS_VERSION,explicit_consent:true,accepted_at:"2026-10-29T00:00:00Z"},error:null},
  {data:{owner_id:OWNER,terms_version:TERMS_VERSION,explicit_consent:true,accepted_at:"2026-10-29T00:00:00Z"},error:null}
 ]);
 assert.equal((await acceptLegalAgreement(client,{explicit_consent:true})).accepted,true);
 const insert=operations.find(op=>op[0]==="insert");
 assert.deepEqual(insert[1],{owner_id:OWNER,terms_version:TERMS_VERSION,explicit_consent:true});
 assert.ok(operations.filter(op=>op[0]==="maybeSingle").length>=2);
});
test("a successful insert with no verified read is not reported as agreement",async()=>{
 const {client}=makeClient([{data:{owner_id:OWNER},error:null},{data:null,error:null}]);
 await assert.rejects(()=>acceptLegalAgreement(client,{explicit_consent:true}),/not confirmed/);
});
test("legal consent status is keyed to current account, preventing cross-login stale acceptance",()=>{
 const component=readFileSync(new URL("../src/components/TermsAcceptance.jsx",import.meta.url),"utf8");
 assert.match(component,/status\.owner===user\?\.id/);
 assert.match(component,/setAgreed\(false\)/);
 assert.match(component,/auth\.getUser\(\)/);
});
test("canonical RLS requires owner, immutable server timestamp and no anonymous insert",()=>{
 const schema=readFileSync(new URL("../../../supabase/migrations/pending/20261029_ifund_legal_acceptances.sql",import.meta.url),"utf8");
 assert.match(schema,/accepted_at timestamptz not null default now\(\)/);
 assert.match(schema,/grant insert \(owner_id,terms_version,explicit_consent\)/);
 assert.match(schema,/owner_id=\(select auth\.uid\(\)\)/);
 assert.doesNotMatch(schema,/grant insert.*\bto anon\b/i);
});
