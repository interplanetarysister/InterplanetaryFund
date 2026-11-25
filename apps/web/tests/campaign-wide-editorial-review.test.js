import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewCampaignWideEditorial, proposeCampaignWidePunctuation, proposeCampaignWideRedundancy } from "../src/lib/campaignEditorialImprovements.mjs";
import { reviewCampaignPublication } from "../src/lib/prepublicationReview.mjs";
import { publishReadiness } from "../src/lib/campaignLifecycle.js";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

const base={
 title:"A Community Fundraiser!!!!",
 summary:"Our neighborhood is raising funds for safer shared spaces",
 story:"Our neighborhood is raising funds for safer shared spaces. We plan to document known expenses and provide updates each month. "
   .repeat(37),
 category:"community",goal_amount:"1000",cover_image_url:"https://example.org/cover.jpg",
};

test("short stories are publishable; editorial length and repetition are advisory",()=>{
 const short={...base,story:"Useful details.".repeat(200)};
 assert.equal(publishReadiness({...base,story:"A short, factual campaign story."}).ready,true, "No minimum story length");
 assert.ok(reviewCampaignPublication(short).storyCharacters<3500);
 assert.equal(publishReadiness(short).ready,true);
 const long={...short,story:"Useful details.".repeat(250)};
 assert.equal(reviewCampaignPublication(long).storyCharacters, 3750);
 assert.equal(publishReadiness(long).ready,true, "Editorial repetition is advisory");
 const sentence="We will responsibly document the use of funds and keep our community informed "+ "x".repeat(550)+".";
 const structured=[sentence+" "+sentence+" "+sentence,sentence+" "+sentence+" "+sentence].join("\n\n");
 assert.ok(structured.length>=3500);
 assert.equal(publishReadiness({...base,story:structured}).ready,true);
});

test("campaign-wide checks include headline, summary, story and cross-field redundancy",()=>{
 const review=reviewCampaignWideEditorial({...base,title:"A   Community Fundraiser!!!!"});
 const ids=new Set(review.map(x=>x.id));
 for(const id of ["title_spacing","summary_punctuation","story_redundancy","cross_field_summary"])
   assert.ok(ids.has(id),id);
 assert.ok(review.every(x=>["title","summary","story"].includes(x.field)));
 assert.ok(review.every(x=>["echo","polaris","story"].includes(x.agent)));
});

test("punctuation proposals preserve factual words and require explicit organizer application",()=>{
 const original={title:"Community   Aid",summary:"We will share updates",story:"The budget is $500!!!!"};
 const patch=proposeCampaignWidePunctuation(original);
 assert.deepEqual(patch.changed.sort(),["story","summary","title"]);
 assert.equal(original.story,"The budget is $500!!!!");
 assert.ok(patch.after.story.includes("$500!"));
 assert.ok(patch.after.summary.endsWith("."));
 assert.equal(patch.after.title,"Community  Aid");
});

test("duplicate removal never silently changes cross-field content or deletes the only sentence",()=>{
 const s="Our neighborhood needs a documented plan for emergency resources and education.";
 const proposal=proposeCampaignWideRedundancy({title:"Emergency Fund",summary:s+" "+s,story:s+" "+s});
 assert.deepEqual(proposal.changed.sort(),["story","summary"]);
 assert.equal(proposal.removed.story,1);
 assert.equal(proposal.removed.summary,1);
 assert.ok(proposal.after.story.includes(s));
 assert.equal(proposal.before.story,s+" "+s);
});

test("agent submission validates saved owner campaign and batches all findings",()=>{
 const ui=source("../src/components/campaigns/PrepublicationGate.jsx");
 const editor=source("../src/pages/CampaignWorkspace.jsx");
 const create=source("../src/pages/CreateCampaign.jsx");
 assert.match(ui,/select\("title,summary,story"\)/);
 assert.match(ui,/Save your current campaign edits before sending improvements/);
 assert.match(ui,/offset \+= 12/);
 assert.match(ui,/p_finding_ids: batch.map/);
 assert.match(ui,/onApplyFields\?\.\(campaignPunctuation\.after\)/);
 assert.match(ui,/onApplyFields\?\.\(campaignRepetition\.after\)/);
 assert.match(editor,/onApplyFields=\{/);
 // Creator entry remains a simplified three-step editor; deep editorial
 // repairs are available after saving in Edit Campaign / Command Center.
 assert.match(create,/Publishing does not require an AI review or a story-length target/);
assert.match(create,/You may improve your campaign afterward in Command Center/);
assert.doesNotMatch(create,/CampaignReadinessScore/);
 assert.match(create,/Command Center/);
 assert.match(create,/!Number\.isInteger\(next\)\|\|next<0\|\|next>2/);
 assert.doesNotMatch(create,/<PrepublicationGate/);
});

test("owner-only discussion RPC rejects anonymous and cross-owner posting and avoids pretending AI execution",()=>{
 const sql=source("../../../supabase/migrations/20261113_ifund_editorial_campaignwide_discussions.sql");
 const board=source("../src/components/agents/EditorialAgentQueue.jsx");
 for(const id of ["title_spacing","summary_punctuation","story_punctuation",
  "summary_redundancy","story_redundancy","cross_field_summary","cross_field_title","cross_field_sentences"])
   assert.ok(sql.includes("'"+id+"'"),id);
 assert.match(sql,/ifund_current_account_is_active\(\)/);
 assert.match(sql,/u\.email_confirmed_at is not null/);
 assert.match(sql,/where r\.id=p_review_id and r\.owner_id=v_owner for update/);
 assert.match(sql,/revoke all on function public\.ifund_add_editorial_review_comment\(uuid,text\) from public,anon/);
 assert.match(sql,/rule_based_next_step/);
 assert.match(board,/ifund_add_editorial_review_comment/);
 assert.match(board,/not proof of live agent discussion/);
});

test("historical 3500-character SQL gate is superseded by current no-minimum policy",()=>{
 // This migration is immutable history, NOT the effective production trigger.
 // A live DB trigger inspection is required separately before release approval.
 const legacy=source("../../../supabase/migrations/20261113_ifund_prepublication_whitespace_alignment.sql");
 assert.match(legacy,/pg_catalog\.char_length\(v_story\)<3500/);
 assert.match(legacy,/old\.status is distinct from 'active'/);
 for(const story of ["A short, factual campaign story.", "  Useful details.  "]) {
   assert.equal(publishReadiness({...base,story}).ready,true,
     "Current client publication readiness must not impose the historical 3500-character minimum");
 }
 assert.equal(publishReadiness({...base,story:"   "}).ready,false,
   "Whitespace-only stories must still be rejected");
});

test("individual repeated sentences between summary and story are queued for review",()=>{
 const s="The community plans to document every repair expense and publish monthly progress reports.";
 const findings=reviewCampaignWideEditorial({
  title:"Neighborhood improvement",summary:s+" Additional context is here.",
  story:"The project was proposed by local neighbors. "+s+" Further details follow."
 });
 assert.ok(findings.some(f=>f.id==="cross_field_sentences"));
});
