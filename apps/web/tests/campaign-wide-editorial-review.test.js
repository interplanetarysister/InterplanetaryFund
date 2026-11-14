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

test("minimum 3,500 full-story characters block new publishing without blocking drafts",()=>{
 const short={...base,story:"Useful details.".repeat(200)};
 assert.ok(reviewCampaignPublication(short).storyCharacters<3500);
 assert.equal(publishReadiness(short).ready,false);
 const long={...short,story:"Useful details.".repeat(250)};
 assert.equal(reviewCampaignPublication(long).storyCharacters, 3750);
 assert.equal(publishReadiness(long).ready,false, "A single repeated sentence does not satisfy the required structure");
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
 const editor=source("../src/pages/EditCampaign.jsx");
 const create=source("../src/pages/CreateCampaign.jsx");
 assert.match(ui,/select\("title,summary,story"\)/);
 assert.match(ui,/Save your current campaign edits before sending improvements/);
 assert.match(ui,/offset \+= 12/);
 assert.match(ui,/p_finding_ids: batch.map/);
 assert.match(ui,/onApplyFields\?\.\(campaignPunctuation\.after\)/);
 assert.match(ui,/onApplyFields\?\.\(campaignRepetition\.after\)/);
 assert.match(editor,/onApplyFields=\{/);
 assert.match(create,/onApplyFields=\{/);
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

test("server gate trims whitespace consistently before counting publication length",()=>{
 const sql=source("../../../supabase/migrations/20261113_ifund_prepublication_whitespace_alignment.sql");
 assert.match(sql,/regexp_replace/);
 assert.match(sql,/\[\[:space:\]\]/);
 assert.match(sql,/pg_catalog\.char_length\(v_story\)<3500/);
 assert.match(sql,/old\.status is distinct from 'active'/);
});

test("individual repeated sentences between summary and story are queued for review",()=>{
 const s="The community plans to document every repair expense and publish monthly progress reports.";
 const findings=reviewCampaignWideEditorial({
  title:"Neighborhood improvement",summary:s+" Additional context is here.",
  story:"The project was proposed by local neighbors. "+s+" Further details follow."
 });
 assert.ok(findings.some(f=>f.id==="cross_field_sentences"));
});
