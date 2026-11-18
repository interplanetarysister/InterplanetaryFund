import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rememberPendingCampaignSetup,pendingCampaignSetup,clearPendingCampaignSetup}
  from "../src/lib/campaignCreationRecovery.mjs";
import {emptyWizard} from "../src/lib/campaignWizard.js";

const owner="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const campaign="33333333-3333-4333-8333-333333333333";
const otherCampaign="44444444-4444-4444-8444-444444444444";
const setup=()=>({...emptyWizard(),draft_step:2,ai_profile:{
  ...emptyWizard().ai_profile,tone:"Clear and practical"
}});
function storage(){
 const map=new Map();
 return {
  getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>map.set(k,String(v)),
  removeItem:k=>map.delete(k),
  keys:()=>[...map.keys()],
  values:()=>[...map.values()]
 };
}

test("recovery stores only the saved owner campaign and private wizard metadata",()=>{
 const s=storage();
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup()),true);
 assert.deepEqual(pendingCampaignSetup(s,owner,campaign)?.setup,setup());
 assert.equal(pendingCampaignSetup(s,owner)?.campaignId,campaign);
 assert.deepEqual(pendingCampaignSetup(s,other),null);
 assert.equal(s.keys().length,1);
 assert.doesNotMatch(s.values()[0],/donation|published|payment|beneficiary_document/i);
});
test("the owner cannot overwrite a different unsaved campaign's setup recovery",()=>{
 const s=storage();
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup()),true);
 assert.equal(rememberPendingCampaignSetup(s,owner,otherCampaign,setup()),false);
 assert.equal(pendingCampaignSetup(s,owner)?.campaignId,campaign);
});
test("same owner may revise the saved campaign's pending setup",()=>{
 const s=storage();
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup()),true);
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,{...setup(),draft_step:3}),true);
 assert.equal(pendingCampaignSetup(s,owner,campaign).setup.draft_step,3);
});
test("silent or stale storage writes never acknowledge updated pending setup",()=>{
 const s=storage();
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup()),true);
 const initial=pendingCampaignSetup(s,owner,campaign).setup;
 const revised={...setup(),draft_step:4};
 s.setItem=()=>{};
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,revised),false);
 assert.deepEqual(pendingCampaignSetup(s,owner,campaign).setup,initial);
 const empty=storage();empty.setItem=()=>{};
 assert.equal(rememberPendingCampaignSetup(empty,owner,campaign,setup()),false);
});
test("cleanup requires owner and campaign match, and only removes the verified record",()=>{
 const s=storage();
 rememberPendingCampaignSetup(s,owner,campaign,setup());
 assert.equal(clearPendingCampaignSetup(s,other,campaign),true);
 assert.ok(pendingCampaignSetup(s,owner,campaign));
 assert.equal(clearPendingCampaignSetup(s,owner,otherCampaign),false);
 assert.ok(pendingCampaignSetup(s,owner,campaign));
 assert.equal(clearPendingCampaignSetup(s,owner,campaign),true);
 assert.equal(pendingCampaignSetup(s,owner),null);
});
test("tampered recovery is fail-closed and cannot be overwritten silently",()=>{
 const s=storage();
 rememberPendingCampaignSetup(s,owner,campaign,setup());
 const key=s.keys()[0];
 s.setItem(key,'{"version":1,"owner_id":"'+other+'","campaign_id":"'+campaign+'","setup":{}}');
 assert.equal(pendingCampaignSetup(s,owner),null);
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup()),false);
 assert.equal(clearPendingCampaignSetup(s,owner,campaign),false);
});
test("blocked session storage does not produce a false save receipt",()=>{
 const blocked={getItem(){throw Error("blocked")},setItem(){throw Error("blocked")},removeItem(){throw Error("blocked")}};
 assert.equal(rememberPendingCampaignSetup(blocked,owner,campaign,setup()),false);
 assert.equal(pendingCampaignSetup(blocked,owner),null);
 assert.equal(clearPendingCampaignSetup(blocked,owner,campaign),false);
});
test("invalid campaign, invalid owner and malformed wizard payload cannot become recovery pointers",()=>{
 const s=storage();
 assert.equal(rememberPendingCampaignSetup(s,owner,"not-a-uuid",setup()),false);
 assert.equal(rememberPendingCampaignSetup(s,"guest",campaign,setup()),false);
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,{...setup(),end_date:"2026-13-30"}),false);
 assert.deepEqual(s.keys(),[]);
});
test("creator persists pending setup before its server metadata request and clears only after success",()=>{
 const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
 const saved=source.indexOf("const recoveryStored=rememberPendingCampaignSetup");
 const server=source.indexOf("await saveCampaignSetup",saved);
 const cleanup=source.indexOf("clearPendingCampaignSetup",server);
 assert.ok(saved>0&&server>saved&&cleanup>server);
 assert.match(source,/const localRecovery=ownerId\?pendingCampaignSetup/);
 assert.match(source,/Navigate to=\{"\/create\?draft="/);
});
test("saved campaign details stay recoverable when setup loading fails",()=>{
 const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
 const details=source.indexOf("await loadOwnerCampaign");
 const recovery=source.indexOf("const localRecovery=ownerId?pendingCampaignSetup",details);
 const request=source.indexOf("await loadCampaignSetup",recovery);
 const fallback=source.indexOf("if(!localRecovery)throw setupError",request);
 const hydrate=source.indexOf("setForm({ title:data.title",fallback);
 assert.ok(details>=0 && recovery>details && request>recovery && fallback>request && hydrate>fallback);
 assert.match(source,/const restoredSetup=localRecovery\\?\\.setup\\|\\|/);
 assert.match(source,/Setup service is unavailable; recovered changes are kept in this tab/);
});

test("creator exposes a manual, owner-scoped retry for retained guest copies",()=>{
 const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
 assert.match(source,/guestCopyRetained/);
 assert.match(source,/function retryGuestCopyCleanup\(\)/);
 assert.match(source,/importGuestCampaign\(sessionStorage,ownerId\)/);
 assert.match(source,/onClick=\{retryGuestCopyCleanup\}/);
 assert.match(source,/Retry guest-copy cleanup/);
 assert.match(source,/owner draft or guest draft has changed/i);
 assert.match(source,/outcome\.status==="imported"/);
});

test("saved draft links stay private and editorial field review can navigate across stages",()=>{
 const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
 const gate=readFileSync(new URL("../src/components/campaigns/PrepublicationGate.jsx",import.meta.url),"utf8");
 const score=readFileSync(new URL("../src/components/campaigns/CampaignReadinessScore.jsx",import.meta.url),"utf8");
 assert.match(source,/savedStatus==="active"\?\x60\/campaign\//);
 assert.match(source,/Reopen saved draft/);
 assert.match(source,/id="campaign-cover-url"/);
 assert.match(source,/onFocusField=\{focusCampaignField\}/);
 assert.match(gate,/onFocusField\(target\)/);
 assert.match(score,/onFocusField\?\.\(row.field\)/);
});
test("saved campaign agent launcher only offers existing member routes",()=>{
 const source=readFileSync(new URL("../src/components/agents/AgentFeatureLauncher.jsx",import.meta.url),"utf8");
 const routes=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 for(const path of ["/agents","/strategy","/communications","/permissions"]){
  assert.match(source,new RegExp(path.replace("/","\\/")));
  assert.ok(routes.includes('path="'+path+'"'));
 }
 assert.doesNotMatch(source,/publish\(|sendMessage\(|withdraw\(/);
});

test("campaign-prefilled agent workspaces verify the signed-in owner before selecting records",()=>{
 const agents=readFileSync(new URL("../src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
 const story=readFileSync(new URL("../src/pages/StoryAgent.jsx",import.meta.url),"utf8");
 const echo=readFileSync(new URL("../src/pages/CommunicationsWorkspace.jsx",import.meta.url),"utf8");
 const strategy=readFileSync(new URL("../src/pages/CampaignStrategy.jsx",import.meta.url),"utf8");
 assert.match(agents,/initialCampaignId=\{campaignId\}/);
 assert.match(story,/owned\.some\(item=>item\.id===initialCampaignId\)/);
 assert.match(echo,/data\.some\(item=>item\.id===requestedCampaign\)/);
 assert.match(strategy,/items\.filter\(item=>item\.campaign_id===requestedCampaign\)/);
 assert.match(strategy,/owner_id===owner/);
});
