import test from "node:test";
import assert from "node:assert/strict";
import { routeMissionExplore } from "../worker/missions/explore.js";
const ENDPOINT="https://ifund.example.invalid/api/missions/explore";
const make=(method="POST",payload={prompt:"Help me start a community garden."},headers={"content-type":"application/json"})=>
 new Request(ENDPOINT,{method,headers,...(method==="POST"?{body:typeof payload==="string"?payload:JSON.stringify(payload)}:{})});
test("no feature flag: deny without reading or saving user prompt",async()=>{
 const r=await routeMissionExplore(make(),{});
 assert.equal(r.status,503);
 assert.equal((await r.json()).code,"mission_explore_disabled");
});
test("unsupported method denied",async()=>{
 const r=await routeMissionExplore(make("GET"),{IFUND_WHAT_IF_ENABLED:"enabled"});
 assert.equal(r.status,405);
});
test("valid prompt: provisional result has no provider/funding claims",async()=>{
 const r=await routeMissionExplore(make(),{IFUND_WHAT_IF_ENABLED:"enabled"});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.provisional,true);
 assert.equal(data.provider_actions_executed,0);
 assert.equal(data.provider_funding_confirmed,false);
 assert.match(data.privacy,/not saved/i);
 assert.equal(data.pathways.find(p=>p.kind==="resources").verification,"not_yet_researched");
 assert.equal(r.headers.get("cache-control"),"no-store, private");
});
test("missing prompt, HTML body and oversized inputs are rejected",async()=>{
 const env={IFUND_WHAT_IF_ENABLED:"enabled"};
 assert.equal((await routeMissionExplore(make("POST",{prompt:""}),env)).status,400);
 assert.equal((await routeMissionExplore(make("POST",{prompt:"x".repeat(12001)}),env)).status,400);
 assert.equal((await routeMissionExplore(make("POST","<script>alert(1)</script>",{"content-type":"text/html"}),env)).status,415);
 assert.equal((await routeMissionExplore(make("POST",{prompt:"a".repeat(16200)}),env)).status,413);
});
test("invalid JSON is rejected",async()=>{
 const r=await routeMissionExplore(make("POST",'{"prompt":',{"content-type":"application/json"}),{IFUND_WHAT_IF_ENABLED:"enabled"});
 assert.equal(r.status,400);
});
