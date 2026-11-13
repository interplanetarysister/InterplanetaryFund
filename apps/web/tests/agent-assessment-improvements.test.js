import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merchantReceiptExceptions } from "../src/lib/merchantReconciliation.mjs";
import { connectionCapabilityReadiness } from "../src/lib/connectionCapabilityReadiness.mjs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("ORBIT marks only verified reconciliation problems without altering receipts",()=>{
  const original=[
    {paypal_transaction_id:"one",gross_cents:100,processing_fee_cents:30,net_cents:70,allocation_status:"platform_support",source_site:"ifund.com"},
    {paypal_transaction_id:"two",gross_cents:100,processing_fee_cents:80,net_cents:70,allocation_status:"unattributed",source_site:"unattributed"},
  ];
  const before=JSON.stringify(original);
  const result=merchantReceiptExceptions(original);
  assert.equal(result.length,1);
  assert.equal(result[0].id,"two");
  assert.equal(result[0].issues.length,3);
  assert.equal(JSON.stringify(original),before);
  assert.equal(merchantReceiptExceptions(null),null);
  assert.equal(merchantReceiptExceptions([{paypal_transaction_id:"m",gross_cents:null,processing_fee_cents:0,net_cents:0,source_site:"ifund.com"}])[0].issues[0],"Missing or invalid verified cent amounts");
});
test("LINK never promotes connected OAuth to publishing without provider scope and grant evidence",()=>{
  const verified={status:"connected",verified_at:"2026-11-12T00:00:00Z"};
  assert.equal(connectionCapabilityReadiness({record:verified,authorizationEnabled:true}).publishReady,false);
  assert.equal(connectionCapabilityReadiness({record:verified,authorizationEnabled:true,publishScopeVerified:true,providerGrantVerified:false}).publishReady,false);
  assert.equal(connectionCapabilityReadiness({record:verified,authorizationEnabled:true,publishScopeVerified:true,providerGrantVerified:true}).publishReady,true);
  assert.equal(connectionCapabilityReadiness({record:{status:"pending"},authorizationEnabled:true,publishScopeVerified:true,providerGrantVerified:true}).publishReady,false);
});
test("owner editorial UI and agent network do not silently publish or transmit story text",()=>{
  const gate=read("../src/components/campaigns/PrepublicationGate.jsx");
  const queue=read("../src/components/agents/EditorialAgentQueue.jsx");
  const team=read("../src/pages/AgentsTeam.jsx");
  assert.match(gate,/ifund_queue_editorial_agent_review/);
  assert.match(gate,/Save a private draft first/);
  assert.match(gate,/Apply reviewed duplicate removal/);
  assert.match(gate,/Apply reviewed punctuation changes/);
  assert.match(queue,/ifund_my_editorial_agent_reviews/);
  assert.match(queue,/not an independent AI conversation/);
  assert.match(team,/<EditorialAgentQueue \/>/);
});
test("POLARIS, PULSE, FORGE and LINK improvements are available in their owner workspaces",()=>{
  assert.match(read("../src/pages/CampaignStrategy.jsx"),/editorial\.remainingCharacters/);
  assert.match(read("../src/pages/CampaignStrategy.jsx"),/campaign-story/);
  assert.match(read("../src/pages/Institutions.jsx"),/<OpportunityEligibilityReview opportunity=\{opportunity\}\/>/);
  assert.match(read("../src/components/agents/CampaignGrowthTrends.jsx"),/evaluateGrowthTrend/);
  assert.match(read("../src/pages/Connections.jsx"),/connectionCapabilityReadiness/);
  assert.match(read("../src/pages/AdminFinance.jsx"),/merchantReceiptExceptions/);
});
