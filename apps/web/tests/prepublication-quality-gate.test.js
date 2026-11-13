import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MIN_PUBLICATION_STORY_CHARACTERS,
  reviewCampaignPublication,
  publicationAgentTasks,
  proposePunctuationRepair,
} from "../src/lib/prepublicationReview.mjs";
import { validateCampaignForm, publishReadiness } from "../src/lib/campaignLifecycle.js";

const base = story => ({
  title:"Neighborhood Community Aid",
  summary:"A community funding project with a documented need and a clear plan.",
  story,
  category:"community",
  goal_amount:"5000",
  cover_image_url:"https://example.org/cover.jpg",
});

test("3500 characters are required for publishing but drafts remain editable",()=>{
  assert.equal(MIN_PUBLICATION_STORY_CHARACTERS,3500);
  assert.equal(reviewCampaignPublication(base("A".repeat(3499))).remainingCharacters,1);
  assert.equal(publishReadiness(base("A".repeat(3499))).ready,false);
  assert.ok(validateCampaignForm(base("A".repeat(3499)),{publish:true}).some(v=>/3,500/.test(v)));
  assert.deepEqual(validateCampaignForm(base("A".repeat(3499)),{publish:false}),[]);
  assert.equal(publishReadiness(base("A".repeat(3500))).ready,true);
});
test("unicode characters are counted consistently with PostgreSQL char_length",()=>{
  assert.equal(reviewCampaignPublication(base("🚀".repeat(3499))).storyCharacters,3499);
  assert.equal(reviewCampaignPublication(base("🚀".repeat(3500))).reviewReady,true);
});
test("punctuation and repeated story/summary sentences yield nonblocking editorial improvements",()=>{
  const sentence="Community funds will support verified lighting work for the neighborhood.";
  const story=(sentence+" "+sentence+" ").repeat(55)+"Please help!!!!";
  const review=reviewCampaignPublication(base(story));
  const keys=review.findings.map(v=>v.id);
  assert.ok(keys.includes("repeated_sentences"));
  assert.ok(keys.includes("excess_punctuation"));
  assert.ok(review.reviewReady);
});
test("cross-field duplicate summary and unusually long passages are identified",()=>{
  const summary="A community funding project with a documented need and a clear plan.";
  const story=(summary+" "+ "The team will provide updates and show costs. ").repeat(80);
  const findings=reviewCampaignPublication({...base(story),summary}).findings.map(v=>v.id);
  assert.ok(findings.includes("summary_repeated"));
  assert.ok(!findings.includes("story_depth"));
});
test("punctuation is never applied silently and does not remove factual sentences",()=>{
  const source="Verified progress will be reported!!!\nWe expect to share monthly updates";
  const value=proposePunctuationRepair(source);
  assert.equal(value.changed,true);
  assert.ok(value.proposal.includes("Verified progress will be reported!"));
  assert.ok(value.proposal.endsWith("updates."));
  assert.equal(source.endsWith("updates."),false);
});
test("agent review packets contain issue metadata and no private source content",()=>{
  const secret="private note for local inspection only";
  const packets=publicationAgentTasks(base(secret));
  assert.ok(packets.length>0);
  assert.ok(packets.every(p=>!JSON.stringify(p).includes(secret)));
  assert.ok(packets.every(p=>["story","polaris","echo","nexus","orbit"].includes(p.agent)));
});
test("SQL gate preserves existing published campaigns and enforces new transitions",()=>{
  const source=readFileSync(new URL("../../../supabase/migrations/20261113_ifund_prepublication_quality_and_agent_review.sql",import.meta.url),"utf8");
  assert.match(source,/if new\.status = 'active'/);
  assert.match(source,/char_length\(btrim\(coalesce\(new\.story,''\)\)\) < 3500/);
  assert.match(source,/old\.status is distinct from 'active'/);
  assert.match(source,/ifund_prepublication_story_gate_trigger/);
  assert.match(source,/ifund_current_account_is_active\(\)/);
  assert.match(source,/u\.email_confirmed_at is not null/);
  assert.match(source,/revoke all on public\.ifund_editorial_agent_reviews from public,anon,authenticated/);
  assert.match(source,/where r\.owner_id=v_owner/);
});
