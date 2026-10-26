import test from "node:test";
import assert from "node:assert/strict";
import { routeEntityEventRequest } from "../worker/automationEvents.js";
import { WORKFLOWS } from "../worker/automationRegistry.js";
const base="https://independent.example/v1/internal/entity-events";
const api=(body,headers={},env={})=>routeEntityEventRequest(new Request(base,{
  method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)
}),env);
const sample={eventId:"12345678-1234-1234-1234-123456789012",
  entity:"Campaign",eventType:"create",recordId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"};
test("entity workflow contracts map to original source events",()=>{
  assert.equal(WORKFLOWS.filter(x=>x.kind==="entity").length,6);
  assert.ok(WORKFLOWS.some(x=>x.id==="Campaign Sync on Update"&&
    x.entityName==="CampaignUpdate"&&x.events.includes("create")));
});
test("entity events route cannot be called when disabled",async()=>{
  const r=await api(sample,{},{});assert.equal(r.status,404);
});
test("a forged or unsigned release flag cannot enqueue source entity workflows",async()=>{
  let calls=0;
  const env={IFUND_AUTOMATIONS_ENABLED:"enabled",IFUND_ENTITY_EVENTS_ENABLED:"enabled",
    IFUND_AUTOMATION_RELEASE_APPROVED:"true",
    IFUND_WORKFLOW:{async create(){calls++}},
    IFUND_EVENT_SIGNING_SECRET:"a-32-byte-secret-value-for-testing-only"};
  const missing=await api(sample,{},env);
  assert.equal(missing.status,401);
  const body=JSON.stringify(sample);
  const stamp=Math.floor(Date.now()/1000).toString();
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.IFUND_EVENT_SIGNING_SECRET),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(stamp+"."+body));
  const hex=Array.from(new Uint8Array(sig),x=>x.toString(16).padStart(2,"0")).join("");
  const valid=await api(sample,{"x-ifund-timestamp":stamp,"x-ifund-signature":hex},env);
  assert.equal(valid.status,409);
  assert.equal(calls,0);
});
