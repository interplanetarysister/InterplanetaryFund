import test from "node:test";
import assert from "node:assert/strict";
import { hasUnifiedAIConsent, hasMixedLegacyAIConsent, AI_CONSENT_FIELDS } from "../src/lib/unifiedAIConsent.mjs";
import { verifyOwnerAIConsent } from "../../../worker/aiConsent.js";

const uid="11111111-1111-4111-8111-111111111111";
const env={SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test"};
const approved=Object.fromEntries(AI_CONSENT_FIELDS.map(key=>[key,true]));
const row={owner_id:uid,...approved};
const account={uid,jwt:"verified.jwt"};

test("one AI control refuses partial legacy settings rather than expanding prior consent",()=>{
 assert.equal(hasUnifiedAIConsent(row,uid),true);
 assert.equal(hasMixedLegacyAIConsent(row,uid),false);
 for(const key of AI_CONSENT_FIELDS){
  const partial={...row,[key]:false};
  assert.equal(hasUnifiedAIConsent(partial,uid),false,key);
  assert.equal(hasMixedLegacyAIConsent(partial,uid),true,key);
 }
 assert.equal(hasUnifiedAIConsent({...row,owner_id:"other"},uid),false);
 assert.equal(hasUnifiedAIConsent({owner_id:uid},uid),false);
 assert.equal(hasMixedLegacyAIConsent({...row,...Object.fromEntries(AI_CONSENT_FIELDS.map(key=>[key,false]))},uid),false);
});

test("Cloudflare AI permission verification uses the member JWT and stored owner row",async()=>{
 const calls=[];
 const fetcher=async(url,init)=>{calls.push({url,init});return Response.json([row]);};
 const result=await verifyOwnerAIConsent(env,account,fetcher);
 assert.deepEqual(result,{allowed:true,status:200});
 assert.equal(calls.length,1);
 assert.ok(calls[0].url.includes("owner_id=eq."));
 assert.equal(calls[0].init.headers.Authorization,"Bearer verified.jwt");
 assert.equal(calls[0].init.redirect,"manual");
});

test("AI is denied before inference for disabled, mixed, foreign, missing and unreachable preference",async()=>{
 for(const rows of [
   [], [{...row,...Object.fromEntries(AI_CONSENT_FIELDS.map(key=>[key,false]))}],
   [{...row,allow_ai_outreach_drafts:false}],
   [{...row,owner_id:"22222222-2222-4222-8222-222222222222"}]
 ]){
  const result=await verifyOwnerAIConsent(env,account,()=>Response.json(rows));
  assert.equal(result.allowed,false);
  assert.equal(result.status,403);
 }
 assert.equal((await verifyOwnerAIConsent(env,account,()=>Response.json({}, {status:500}))).status,503);
 assert.equal((await verifyOwnerAIConsent(env,account,()=>{throw Error("offline");})).status,503);
 assert.equal((await verifyOwnerAIConsent(env,null,()=>assert.fail("No remote call"))).status,401);
});
