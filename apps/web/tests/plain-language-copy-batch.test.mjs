import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../src/pages/Dashboard.jsx");
const whatIf = read("../src/pages/WhatIfStart.jsx");
const mission = read("../src/pages/MissionWorkspace.jsx");
const analytics = read("../src/pages/AnalyticsCenter.jsx");
const detail = read("../src/pages/CampaignDetail.jsx");
const home = read("../src/pages/Home.jsx");
const discover = read("../src/pages/Discover.jsx");
const fund = read("../src/pages/FundYourMission.jsx");
const help = read("../src/pages/Help.jsx");
const tips = read("../src/pages/FundraisingTips.jsx");

test("dashboard uses consistent iFund branding and plain AI/finance wording", () => {
  assert.match(dashboard, /Your iFund workspace/);
  assert.match(dashboard, /Private by default\. Turn on AI assistance in Permissions if you want suggestions\./);
  assert.match(dashboard, /Open What If/);
  assert.match(dashboard, /Only donation totals confirmed by the payment provider are shown\./);
  assert.doesNotMatch(dashboard, /Your IFund workspace|Explore What If\?|No estimated donation totals\./);
});

test("What If and Mission workspace use owner-facing language without weakening truth guards", () => {
  assert.match(whatIf, /Save private Mission/);
  assert.match(whatIf, /Use the standard campaign editor instead/);
  assert.match(whatIf, /No sponsor, aid program, donation, or external action has been verified\./);
  assert.match(mission, /Private Mission workspace/);
  assert.match(mission, /Saved plan/);
  assert.match(mission, /Your checklist sets progress\. Donation amounts are never estimated\./);
  assert.match(mission, /Opportunities remain unverified until supported by external evidence\./);
  assert.doesNotMatch(mission, /What If\? Engine|Plan version|agent records|made-up donation estimate/);
});

test("Command Center, campaign detail and public browsing copy is clearer", () => {
  assert.match(analytics, />Campaign Command Center</);
  assert.match(analytics, /\["atlas", "Campaign Atlas"\]/);
  assert.match(detail, /Share this campaign on iFund Social/);
  assert.match(detail, /Donations are unavailable\. Show funding details/);
  assert.match(home, /Start a campaign/);
  assert.match(home, /Get the IFund app/);
  assert.match(discover, /Browse published campaigns and learn what each organizer is asking for\./);
  assert.match(discover, /min-h-11 w-full rounded-xl border/);
});

test("earnings, help and guide copy stay truthful while using current brand casing", () => {
  assert.match(fund, /Earning and marketplace ideas are future research, not available income today\./);
  assert.match(fund, /not yet verified IFund partners/);
  assert.match(fund, /Sponsor submissions, offer enrollment, commissions and payouts are not enabled\./);
  assert.match(help, /Search iFund help articles/);
  assert.match(help, /Public iFund agreements and privacy information\. No sign-in required\./);
  assert.match(help, /Email IFund support/);
  assert.match(tips, /iFund \/ Fundraising Guide/);
});
