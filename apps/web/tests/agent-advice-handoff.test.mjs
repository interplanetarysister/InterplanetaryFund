import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rememberAgentAdvice,readAgentAdvice,forgetAgentAdvice,AgentAdviceHandoffError} from "../src/lib/agentAdviceHandoff.mjs";
const OWNER="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
const CAMPAIGN="33333333-3333-4333-8333-333333333333";
const ID="44444444-4444-4444-8444-444444444444";
const store=()=>{const map=new Map();return {setItem(k,v){map.set(k,v)},getItem(k){return map.get(k)||null},removeItem(k){map.delete(k)},size:()=>map.size};};
const at=1000000;
test("agent answers open only in the named account's review editor",()=>{
 const storage=store();
 const r=rememberAgentAdvice(storage,{ownerId:OWNER,answer:"Include verified estimates and receipts.",agent:"orbit"},{now:at,id:ID});
 assert.equal(r.target,"/create?agentAdvice="+ID);
 assert.equal(readAgentAdvice(storage,{ownerId:OWNER,id:ID,now:at+1000}).answer,"Include verified estimates and receipts.");
 assert.equal(readAgentAdvice(storage,{ownerId:OTHER,id:ID,now:at+1000}),null);
 assert.equal(readAgentAdvice(storage,{ownerId:OWNER,id:ID,campaignId:CAMPAIGN,now:at+1000}),null);
 assert.equal(readAgentAdvice(storage,{ownerId:OWNER,id:ID,now:at+31*60*1000}),null);
 assert.equal(forgetAgentAdvice(storage,{ownerId:OTHER,id:ID,now:at+2000}),false);
 assert.equal(forgetAgentAdvice(storage,{ownerId:OWNER,id:ID,now:at+2000}),true);
 assert.equal(storage.size(),0);
});
test("campaign-specific advice cannot be transferred to another campaign",()=>{
 const storage=store();
 const r=rememberAgentAdvice(storage,{ownerId:OWNER,campaignId:CAMPAIGN,answer:"Verify all amounts before publishing.",agent:"story"},{now:at,id:ID});
 assert.equal(r.target,"/campaigns/"+CAMPAIGN+"/edit?agentAdvice="+ID);
 assert.equal(readAgentAdvice(storage,{ownerId:OWNER,id:ID,now:at+2000}),null);
 assert.equal(readAgentAdvice(storage,{ownerId:OWNER,id:ID,campaignId:CAMPAIGN,now:at+2000}).agent,"story");
});
test("invalid or oversized inference cannot enter a campaign editor",()=>{
 const s=store();
 for(const opts of [{ownerId:OTHER,agent:"unknown",answer:"text"},{ownerId:OWNER,agent:"story",answer:" "},{ownerId:OWNER,agent:"story",answer:"x".repeat(6001)},{ownerId:OWNER,agent:"story",answer:"valid",campaignId:"../../admin"}]){
   assert.throws(()=>rememberAgentAdvice(s,opts,{now:at,id:ID}),AgentAdviceHandoffError);
 }
 assert.equal(s.size(),0);
});
test("only same-account UI, explicit click, and normal save can apply advice",()=>{
 const team=readFileSync(new URL("../src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
 const review=readFileSync(new URL("../src/components/agents/AgentAdviceReview.jsx",import.meta.url),"utf8");
 const create=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
 const workspace=readFileSync(new URL("../src/pages/CampaignWorkspace.jsx",import.meta.url),"utf8");
 assert.match(team,/onClick=\{reviewAnswerInCampaign\}/);
 // Owner directive 2026-11-27: applying agent advice requires the SAME
 // account, not a verified email.
 assert.match(team,/verified\?\.id!==user\.id/);
 assert.doesNotMatch(team,/email_confirmed_at/);
 assert.doesNotMatch(review,/email_confirmed_at/);
 assert.match(review,/current\.data\?\.user\?\.id!==ownerId/);
 assert.match(review,/onClick=\{accept\}/);
 assert.match(review,/onClick=\{dismiss\}/);
 assert.match(review,/await onApply\(combined\)/);
 assert.doesNotMatch(review,/saveOwnerCampaign|publishCampaign|setCampaignStatus/);
 assert.match(create,/AgentAdviceReview[^>]+onApply=\{text => change\("story",text\)\}/);
 assert.match(workspace,/AgentAdviceReview[^>]+onApply=\{text =>/);
});
