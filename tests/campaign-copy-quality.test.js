import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_COPY_ANGLES, CAMPAIGN_COPY_GUIDANCE,
  freeCopyOutlineOptions, findRedundantCampaignOptions,
  requireDistinctCampaignOptions, findEchoedSentences,
  EXPERT_CAMPAIGN_WRITER_METHOD, ANTI_ECHO_RULES,
  PUBLIC_FACING_DISCRETION_RULES, findPublicFacingViolations,
  findCampaignCopyDiscretionViolations, stripPublicFacingViolations,
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
test("echo detection flags organizer sentences restated in generated copy",()=>{
 const details="We need to raise money for new brakes and a transmission for the van. The van takes kids to after school programs every day.";
 const echoed="Our fundraiser matters. We need to raise money for new brakes and a transmission for the van. Every gift moves us forward.";
 assert.equal(findEchoedSentences(echoed,details).length,1);
 const fresh="The van is how thirty kids get to tutoring, practice and home again. Its brakes are worn and the transmission is slipping, and the repair bill is what stands between those kids and their afternoons.";
 assert.equal(findEchoedSentences(fresh,details).length,0);
 assert.match(EXPERT_CAMPAIGN_WRITER_METHOD,/professional campaign manager/i);
 assert.match(ANTI_ECHO_RULES,/restating/i);
 const messages=storyMessages({details,section:null},{research:null});
 assert.match(messages[0].content,/UNDERSTAND/);
 assert.match(messages[0].content,/Do not reuse the organizer's sentences/);
});
test("public-facing discretion catches pleading, internal objectives, amount begging and self-purchase framing",()=>{
 const cases=[
  ["I need money to keep the lights on this winter.",/pleading/],
  ["We need users for Interplanetary Fund to keep growing.",/internal_objective/],
  ["Help me raise $10,000 for the youth center roof.",/pleading/],
  ["Please donate to me so I can fix my truck.",/pleading/],
  ["Your gift will buy myself a car for the commute.",/self_purchase/],
  ["We need to raise $5,000 for the van repairs.",/amount_pleading/],
  ["Help us raise $2,000 for the shelter this month.",/amount_pleading/],
  ["Give me money and I will put it to good use.",/pleading/],
  ["The platform needs users before it can expand.",/internal_objective/],
 ];
 for(const [text] of cases)
  assert.ok(findPublicFacingViolations(text,"").length>=1,text);
 assert.equal(findPublicFacingViolations("Help me raise $10,000 for the youth center roof.","")[0].rule,"pleading");
 assert.equal(findPublicFacingViolations("Your gift will buy myself a car for the commute.","")[0].rule,"self_purchase");
});
test("public-facing discretion passes honest narrative, beneficiary needs and impact framing",()=>{
 const passing=[
  "After my accident I couldn't get to work, and the bus does not run to the warehouse district.",
  "I needed help learning to walk again, and the county clinic guided every step of my recovery.",
  "Maria needs a wheelchair-accessible van to reach her dialysis appointments three times a week.",
  "We need volunteers to staff the food bank on Saturdays and sort donations on Sundays.",
  "Your $25 covers a week of groceries for one family in the neighborhood.",
  "Help us raise awareness for childhood cancer screening in rural clinics.",
  "The contractor quoted $10,000: materials, labor and repair of the water damage underneath.",
  "Together we can raise the roof fund one bundle of shingles at a time.",
  "When the goal is met, every kid in the program gets a safe ride home after practice.",
 ];
 for(const text of passing)
  assert.deepEqual(findPublicFacingViolations(text,""),[],text);
});
test("raw-need echoes of the organizer's own declared needs are caught in new words",()=>{
 const source="I want a bigger venue for the fundraiser dinner. The hall holds eighty people today.";
 const echoed="We want a bigger venue for the fundraiser dinner this spring.";
 assert.ok(findPublicFacingViolations(echoed,source).some(v=>v.rule==="need_echo"));
 const reframed="A larger hall would seat every family that comes to the fundraiser dinner, with room for the kids' art display.";
 assert.deepEqual(findPublicFacingViolations(reframed,source),[]);
});
test("discretion scan tags the field each violation appears in and stripping removes only violating sentences",()=>{
 const output={
  titles:["A fresh start for the community kitchen","Second distinct title here","Third title with its own hook","Fourth title about the people","Fifth title looking ahead"],
  summaries:["A clear summary of the plan and the people it serves.","Another summary with a different angle on the effort."],
  story:"The kitchen serves forty families every week. I need money to keep it running. Every dollar restocks the shelves with fresh food."
 };
 const found=findCampaignCopyDiscretionViolations(output,"");
 assert.deepEqual(found.map(v=>v.field),["story"]);
 assert.equal(found[0].rule,"pleading");
 const cleaned=stripPublicFacingViolations(output.story,"");
 assert.doesNotMatch(cleaned,/need money/i);
 assert.match(cleaned,/forty families/);
 assert.match(cleaned,/restocks the shelves/);
});
test("story prompts carry the public-facing discretion rules",()=>{
 assert.match(PUBLIC_FACING_DISCRETION_RULES,/input intelligence/i);
 assert.match(PUBLIC_FACING_DISCRETION_RULES,/never plead/i);
 assert.match(PUBLIC_FACING_DISCRETION_RULES,/goal field/i);
 const messages=storyMessages({details:"I need users for Interplanetary Fund to grow the platform.",section:null},{research:null});
 assert.match(messages[0].content,/Public-facing discretion/);
 assert.match(messages[0].content,/never public wording/i);
});
