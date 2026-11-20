import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { identifyExternalFundraiser, canonicalExternalFundraiserUrl, suggestedFundraiserTitle, parseReportedAmount, groupReportedTotals } from "../src/lib/externalFundingHub.mjs";
import { IFUND_MEMBER_FIRST_AGENT_POLICY, memberFirstAgentEligibility } from "../../../worker/agents/memberFirstPolicy.js";

test("one pasted link identifies a supported host and canonical campaign",()=>{
  assert.deepEqual(identifyExternalFundraiser("https://www.gofundme.com/f/a-fundraiser"),{platform:"gofundme",url:"https://www.gofundme.com/f/a-fundraiser"});
  assert.deepEqual(identifyExternalFundraiser("https://givebutter.com/my-fundraiser"),{platform:"givebutter",url:"https://givebutter.com/my-fundraiser"});
  assert.equal(suggestedFundraiserTitle("https://fundrazr.com/a-b-c"),"A B C");
  assert.equal(suggestedFundraiserTitle("https://fundrazr.com/x"),"Your fundraiser");
});
test("one-link validation rejects lookalike hosts, credentials, account and checkout routes",()=>{
  for(const url of [
    "http://gofundme.com/f/help", "https://gofundme.com.evil.example/f/help",
    "https://user:password@gofundme.com/f/help", "https://gofundme.com:8443/f/help",
    "https://gofundme.com/login",
    "https://gofundme.com/f/%2e%2e", "https://givebutter.com/",
    "https://fundrazr.com/account", "https://paypal.com/pay",
  ]) assert.throws(()=>identifyExternalFundraiser(url),undefined,url);
  assert.equal(identifyExternalFundraiser("https://gofundme.com/f/help?utm_source=share#story").url,"https://gofundme.com/f/help");
  assert.equal(identifyExternalFundraiser("https://fundrazr.com/campaigns/91siB7").platform,"fundrazr");
  assert.equal(identifyExternalFundraiser("https://givebutter.com/c/campaignURL/auction").platform,"givebutter");
});
test("cumulative owner-reported totals never mix currencies or imply donations",()=>{
  const source=(amount_cents,currency)=>({amount_cents,currency,provenance:"owner_reported"});
  assert.deepEqual(groupReportedTotals([source(12000,"USD"),source(300,"USD"),source(500,"EUR"),{...source(900000,"USD"),provenance:"provider_confirmed"}]),{USD:12300,EUR:500});
  assert.deepEqual(groupReportedTotals([source(null,"USD")]),{});
  assert.equal(parseReportedAmount("125.25"),12525);
  assert.throws(()=>parseReportedAmount("-3"));
  assert.throws(()=>parseReportedAmount("3.123"));
  assert.throws(()=>parseReportedAmount("1e6"));
});
test("central agents are member-first and permit authorized external hosts",()=>{
  assert.equal(memberFirstAgentEligibility({}).mode,"ifund_invitation_only");
  assert.equal(memberFirstAgentEligibility({isVerifiedMember:true}).mode,"member_permission_required");
  assert.equal(memberFirstAgentEligibility({isVerifiedMember:true,ownerAuthorized:true,permittedAction:true}).allowed,true);
  assert.match(IFUND_MEMBER_FIRST_AGENT_POLICY,/IFund gain legitimate new members/);
  assert.match(IFUND_MEMBER_FIRST_AGENT_POLICY,/external host/);
  assert.match(IFUND_MEMBER_FIRST_AGENT_POLICY,/owner-reported/i);
});
test("the single-link hub is a members-only route and accessible from dashboard",()=>{
  const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  const dash=readFileSync(new URL("../src/pages/Dashboard.jsx",import.meta.url),"utf8");
  const page=readFileSync(new URL("../src/pages/ExternalFundingHub.jsx",import.meta.url),"utf8");
  assert.ok(app.includes('path="/fundraising-hub" element={<MemberAccess><ExternalFundingHub /></MemberAccess>}'));
  assert.match(dash,/to="\/fundraising-hub"/);
  assert.match(page,/Paste your fundraiser link/);
  assert.match(page,/not verified by external hosts/i);
  assert.match(page,/to="\/connections"/);
});
test("external reported funds are isolated from verified first-party ledger",()=>{
  const sql=readFileSync(new URL("../../../supabase/migrations/20261119223500_ifund_external_fundraising_hub.sql",import.meta.url),"utf8");
  assert.match(sql,/enable row level security/);
  assert.match(sql,/owner_id=auth.uid\(\)/);
  assert.match(sql,/provenance = 'owner_reported'/);
  assert.doesNotMatch(sql,/insert into public\.ifund_donations|insert into public\.ifund_ledger/);
});
