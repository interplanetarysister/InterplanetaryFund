import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {analyzeGoalSuccess,SUPPORT_CHANNELS} from "../src/lib/goalSuccessAnalysis.mjs";
const read=file=>readFileSync(new URL(file,import.meta.url),"utf8");

test("Goal Success Analysis supplies all funding, earnings and nonfinancial pathways without invented money",()=>{
 const report=analyzeGoalSuccess({id:"test",title:"Kids lemonade stand",summary:"Children want to sell lemonade and learn business skills.",category:"business",goal_amount:"100"});
 assert.equal(report.target,100);
 assert.deepEqual(SUPPORT_CHANNELS.map(c=>c.id),["crowdfunding","grants","sponsors","earnings","resources","volunteers","assistance","financing"]);
 assert.equal(report.fundingReceived,null);
 assert.equal(report.resourcesConfirmed,null);
 assert.ok(report.channels.every(c=>c.confirmedAmount===0&&c.verification==="Not checked for this campaign"));
 assert.equal(report.channels.find(c=>c.id==="earnings").relevance,"explore");
 assert.equal(report.channels.find(c=>c.id==="financing").relevance,"consider_carefully");
});
test("missing targets are unknown, not zero confirmed dollars",()=>{
 const report=analyzeGoalSuccess({title:"Help my neighbors",category:"community",goal_amount:""});
 assert.equal(report.target,null);
 assert.equal(report.fundingReceived,null);
 assert.equal(report.channels.find(c=>c.id==="volunteers").relevance,"explore");
});
test("Command Hub keeps existing readiness and adds owner-scoped goal analysis in same tab",()=>{
 const strategy=read("../src/pages/CampaignStrategy.jsx");
 const command=read("../src/pages/AnalyticsCenter.jsx");
 const component=read("../src/components/agents/GoalSuccessAnalysis.jsx");
 assert.match(command,/view==="analysis" \? <CampaignStrategy\/>/);
 assert.match(strategy,/listOwnerCampaigns\(client\)/);
 assert.match(strategy,/ifund_owner_campaign_strategy_readiness/);
 assert.match(strategy,/ownerCampaign:campaign/);
 assert.match(strategy,/<GoalSuccessAnalysis campaign=\{item\.campaign\|\|item\.ownerCampaign\} \/>/);
 assert.match(component,/Not verified here/);
 assert.match(component,/See verified finances/);
 assert.doesNotMatch(component,/publishCampaign\(|submitApplication\(|postToProvider\(/);
});
