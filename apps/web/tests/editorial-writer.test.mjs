import test from "node:test";
import assert from "node:assert/strict";
import { prepareEditorialResearch, writerInstructions, reviewEditorialDraft } from "../src/lib/editorialWriter.mjs";
const asOf = "2026-11-18T15:00:00.000Z";
const source = {url:"https://github.com/interplanetarysister/InterplanetaryFund/commit/abcdef123",status:"verified",checked_at:"2026-11-18T14:00:00Z",kind:"ifund_release",fact:"The source contains a reviewed, specifically identified code change."};
const brief = () => prepareEditorialResearch({channel:"social",topic:"How to tell a clear fundraising story",asOf,sources:[source]});
test("requires verified current unique sourced facts", () => {
  assert.throws(() => prepareEditorialResearch({channel:"news",topic:"Latest iFund product news",sources:[]}), /Research evidence/);
  assert.throws(() => prepareEditorialResearch({channel:"news",topic:"Latest iFund product news",asOf,sources:[{...source,status:"unknown"}]}), /verified/);
  assert.throws(() => prepareEditorialResearch({channel:"news",topic:"Latest iFund product news",asOf,sources:[{...source,checked_at:"2026-10-01T00:00:00Z"}]}), /verified/);
  assert.throws(() => prepareEditorialResearch({channel:"news",topic:"Latest iFund product news",asOf,sources:[source,source]}), /verified/);
  assert.throws(() => prepareEditorialResearch({channel:"news",topic:"Latest iFund product news",asOf,sources:[{...source,url:"https://untrusted.example/release"}]}), /canonical/);
});
test("writer instructions require evidence and honest platform claims", () => {
  assert.match(writerInstructions(brief()), /never conceal limitations/);
  assert.match(writerInstructions(brief()), /Do not publish automatically/);
  assert.throws(() => writerInstructions({channel:"social"}), /research verification/);
});
test("a source-checked social package remains draft only", () => {
  const packet=brief();
  assert.deepEqual(reviewEditorialDraft(packet,{title:"One honest campaign story",body:"Tell supporters what matters, why help is needed, and where the funds will go.",source_urls:[source.url],image_concept:"Original Earth-forward illustration",short_video_storyboard:"Three scene 20-second explainer"}),{ready_for_review:true,blockers:[],status:"draft_only"});
  assert.ok(reviewEditorialDraft(packet,{title:"One honest campaign story",body:"Short",source_urls:["https://bad.example"]}).blockers.includes("citations_unverified"));
});
