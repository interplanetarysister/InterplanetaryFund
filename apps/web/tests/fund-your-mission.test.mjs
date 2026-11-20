import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SCOUT_PROVIDERS,SCOUT_POLICY,safeScoutUrl,scoutProvider} from "../src/lib/scoutCatalog.mjs";
const read = p => readFileSync(new URL(p,import.meta.url),"utf8");
test("SCOUT catalogs real integration documentation, not unapproved earning offers",()=>{
 assert.equal(SCOUT_POLICY.research_only,true);
 assert.equal(SCOUT_POLICY.payout_enabled,false);
 assert.equal(SCOUT_POLICY.member_enrollment_enabled,false);
 assert.equal(SCOUT_POLICY.provider_postbacks_enabled,false);
 assert.equal(SCOUT_POLICY.sponsor_posting_enabled,false);
 assert.equal(SCOUT_POLICY.verified_partnerships,0);
 assert.equal(SCOUT_PROVIDERS.length,3);
 for(const provider of SCOUT_PROVIDERS) {
  assert.equal(provider.state,"research_only");
  assert.equal(provider.partner_verified,false);
  assert.equal(provider.reward_state,"not_enabled");
  assert.equal(safeScoutUrl(provider.official_url),true);
  assert.equal(safeScoutUrl(provider.integration_url),true);
  assert.equal(scoutProvider(provider.id),provider);
 }
 assert.equal(scoutProvider("missing"),null);
 assert.equal(safeScoutUrl("javascript:alert(1)"),false);
 assert.equal(safeScoutUrl("http://example.com"),false);
 assert.equal(safeScoutUrl("https://me:pass@example.com"),false);
});
test("Fund Your Mission routes to genuine existing fundraising and research flows",()=>{
 const app=read("../src/App.jsx"),layout=read("../src/components/Layout.jsx");
 const page=read("../src/pages/FundYourMission.jsx");
 const dash=read("../src/pages/Dashboard.jsx");
 assert.match(app,/const FundYourMission = lazy/);
 assert.match(app,/path="\/fund-your-mission" element={<FundYourMission \/>}/);
 assert.match(layout,/to: "\/fund-your-mission", label: "Fund Your Mission"/);
 assert.match(dash,/to="\/fund-your-mission"/);
 assert.match(page,/to="\/fundraising-hub"/);
 assert.match(page,/to="\/institutions"/);
 assert.match(page,/api\/public\/opportunity-sources/);
 assert.match(page,/not yet verified IFund partners/);
 assert.match(page,/Sponsor submissions, offer enrollment, commissions and payouts are not enabled/);
 assert.doesNotMatch(page,/member.*earnings.*\$[0-9]+/i);
});
test("Fund Your Mission CTAs follow the same What If flag as routing and navigation",()=>{
 const app=read("../src/App.jsx"),layout=read("../src/components/Layout.jsx"),page=read("../src/pages/FundYourMission.jsx");
 assert.match(app,/const WHAT_IF_ENABLED = import\.meta\.env\.VITE_IFUND_WHAT_IF_ENABLED === "enabled"/);
 assert.match(layout,/const WHAT_IF_LAUNCHED = import\.meta\.env\.VITE_IFUND_WHAT_IF_ENABLED === "enabled"/);
 assert.match(page,/const whatIfEnabled = import\.meta\.env\.VITE_IFUND_WHAT_IF_ENABLED === "enabled"/);
 assert.match(page,/to=\{whatIfEnabled \? "\/what-if" : "\/create\?manual=1"\}/);
 assert.match(page,/to=\{whatIfEnabled \? "\/missions" : "\/campaigns"\}/);
 assert.match(page,/\{whatIfEnabled \? "Start a private Mission" : "Start a campaign"\}/);
 assert.match(page,/\{whatIfEnabled \? "My Missions" : "My campaigns"\}/);
 assert.match(page,/Private Missions are not available yet\./);
});
test("Route registry tracks source and runtime evidence independently",()=>{
 const routes=JSON.parse(read("../ci/route-acceptance.json")).routes;
 const row=routes.find(x=>x.route==="/fund-your-mission");
 assert.equal(row?.component,"FundYourMission");
 assert.equal(row?.role,"public");
 assert.match(row.backend_evidence,/still pending/);
});
