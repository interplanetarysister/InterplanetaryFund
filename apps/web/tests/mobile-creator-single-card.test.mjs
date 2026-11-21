import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
test("campaign creator is one What If-style card, not nested step panels",()=>{
 assert.match(source,/stepNames=\["Your idea","Your story","Ready to share"\]/);
 assert.match(source,/border border-cyan-300\/25 bg-slate-950 text-white shadow-2xl/);
 assert.equal((source.match(/<main className=/g)||[]).length,2); // loading state and main creator
 assert.equal((source.match(/<section className=\{/g)||[]).length,1);
 assert.doesNotMatch(source,/Campaign writing assistant<\/h2>/);
 assert.doesNotMatch(source,/ifund-cosmic-panel mx-auto max-w-2xl space-y-4/);
});
test("each page asks less, hides advanced features, keeps key capabilities",()=>{
 assert.match(source,/step===0&&<div className="space-y-5"/);
 assert.match(source,/step===1&&<div className="space-y-5"/);
 assert.match(source,/step===2&&<div aria-label="Campaign launch review"/);
 assert.match(source,/A little more context \(optional\)/);
 assert.match(source,/Add photo or illustration \(optional\)/);
 assert.match(source,/More editing tools \(optional\)/);
 assert.match(source,/Already fundraising somewhere else\? \(optional\)/);
 assert.match(source,/CampaignDocuments/);
 assert.match(source,/CampaignImageChoices/);
 assert.match(source,/CampaignVoiceGuide/);
 assert.match(source,/CampaignLocationFields/);
 assert.match(source,/save\("active"\)/);
});
test("existing idea is only used to seed an empty story, without extra user prompts",()=>{
 assert.match(source,/if\(step!==1\|\|!draftDetails\.trim\(\)\|\|loadingDraft\|\|draftLoadError\)return/);
 assert.match(source,/previous\.story\.trim\(\)\?previous/);
 assert.match(source,/summary:previous\.summary\|\|draftDetails\.trim\(\)\.slice\(0,SUMMARY_MAX\)/);
});
