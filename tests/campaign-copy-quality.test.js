import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_COPY_ANGLES, CAMPAIGN_COPY_GUIDANCE,
  freeCopyOutlineOptions, findRedundantCampaignOptions,
  requireDistinctCampaignOptions,
} from "../apps/web/src/lib/campaignCopyQuality.mjs";
import { storyMessages, storyOutput } from "../worker/agents/story.js";
import { campaignPreviewInput,basicCampaignOutline } from "../worker/services/campaign-preview.js";
import {
  CAMPAIGN_COPY_WEEKLY_PRACTICUM, evaluateCampaignCopyCandidate,
} from "../apps/web/src/lib/agentWorkforceTraining.mjs";
import { TRAINING_ROLES } from "../apps/web/src/lib/agentTrainingDirectory.mjs";

const story = "The organizers described their needs and plan for the accessible community garden. ".repeat(20).trim();
const draft = {
 titles:[
  "Help create an accessible community garden",
  "Why this garden matters to our neighbors",
  "Imagine more people sharing the garden",
  "Join us to improve access to the garden",
  "A community project with room for everyone"
 ],
 summaries:[
  "Our neighborhood garden needs accessibility equipment. Learn what the organizers hope to improve, then decide if you want to support or share.",
  "A more accessible garden could welcome neighbors who have trouble using the space today. Explore the plan and join the community effort if it speaks to you."
 ],
 story,image_prompt:"Illustration of an accessible garden without invented people."
};

test("five headline approaches are intentionally different and context-matched",()=>{
 assert.equal(CAMPAIGN_COPY_ANGLES.length,5);
 assert.equal(findRedundantCampaignOptions(draft.titles).length,0);
 assert.equal(findRedundantCampaignOptions(draft.summaries).length,0);
 assert.match(CAMPAIGN_COPY_GUIDANCE,/coherent/i);
 assert.match(CAMPAIGN_COPY_GUIDANCE,/profit|returns/);
 assert.match(CAMPAIGN_COPY_GUIDANCE,/voluntary/i);
});

test("near-duplicate title and summary rewrites are rejected before receipt",()=>{
 assert.deepEqual(findRedundantCampaignOptions([
   "Help create the community garden now",
   "Help create the community garden today"
 ]),[[0,1]]);
 assert.equal(requireDistinctCampaignOptions(draft.titles,draft.summaries),true);
 assert.equal(storyOutput({response:draft}).titles.length,5);
 assert.throws(()=>storyOutput({response:{...draft,titles:[
   ...draft.titles.slice(0,4),"Help create an accessible community garden"
 ]}}),/incomplete draft/i);
 assert.throws(()=>storyOutput({response:{...draft,summaries:[
   "Our campaign needs an accessible community garden",
   "Our campaign needs an accessible community garden today"
 ]}}),/incomplete draft/i);
});
test("section-only rewriting is not required to supply five options",()=>{
 assert.deepEqual(storyOutput('{"section":"This is a clearer factual update."}',true),
  {section:"This is a clearer factual update."});
});
test("AI instructions require context-specific angles and forbid invented profitability",()=>{
 const messages=storyMessages({details:"A community seeks support for accessible raised beds and pathways in the public garden.",section:null}, {research:null});
 assert.match(messages[0].content,/five non-redundant titles/i);
 assert.match(messages[0].content,/two distinct short descriptions/i);
 assert.match(messages[0].content,/profit|investment/);
 assert.match(messages[0].content,/donor.*agency|voluntary|donors.*agency/i);
 assert.match(messages[0].content,/Never invent names/);
 assert.doesNotMatch(messages[1].content,/automatically_publish/i);
});
test("free non-AI outline keeps organizer facts and avoids redundant options",()=>{
 const input=campaignPreviewInput({
  request_id:"11111111-1111-4111-8111-111111111111",
  details:"A community center wants raised garden beds and wider pathways.",
  answers:{need:"raised beds and wider pathways",beneficiary:"community garden visitors",cause:"community"},
  goal:1200
 });
 const result=basicCampaignOutline(input);
 assert.equal(result.titles.length,5);
 assert.equal(result.summaries.length,2);
 assert.equal(result.ai_inference,false);
 assert.ok(result.story.includes(input.details));
 assert.equal(requireDistinctCampaignOptions(result.titles,result.summaries),true);
 assert.match(result.summaries[0],/raised beds/);
 assert.ok(result.titles.every(t=>t.length<=150));
});
test("weekly practice involves Story Polaris Echo, candidate scores are never auto-approved",()=>{
 assert.deepEqual(CAMPAIGN_COPY_WEEKLY_PRACTICUM.agents,["story","polaris","echo"]);
 assert.equal(CAMPAIGN_COPY_WEEKLY_PRACTICUM.scenarios.length,3);
 for(const agent of CAMPAIGN_COPY_WEEKLY_PRACTICUM.agents){
  assert.match(TRAINING_ROLES[agent].lesson,/titles|headlines|description|copy|preview/);
 }
 assert.deepEqual(evaluateCampaignCopyCandidate({titles:draft.titles,summaries:draft.summaries}),
  {passed:false,issue:"independent_fact_and_ethics_review_required",independently_reviewed:false});
 assert.equal(evaluateCampaignCopyCandidate({titles:[...draft.titles.slice(0,4),draft.titles[0]],summaries:draft.summaries}).issue,"redundant_options");
});
