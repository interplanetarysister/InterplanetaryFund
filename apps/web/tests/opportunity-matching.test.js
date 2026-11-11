import test from "node:test";
import assert from "node:assert/strict";
import {matchOpportunity,publicCampaignTerms} from "../src/lib/opportunityMatch.js";

test("opportunity match uses published category and summary, not private donor metadata",()=>{
  const campaign={category:"education",title:"Mobile reading bus",summary:"Volunteer literacy lessons in rural community",
    donor_email:"private@example.com",private_story:"wildlife rescue operations"};
  const candidate={cause_tags:["education","volunteer","wildlife"]};
  const result=matchOpportunity(candidate,campaign);
  assert.deepEqual(result.tags,["education","volunteer"]);
  assert(result.score>=4);
  assert(!JSON.stringify(result).includes("private@example.com"));
});
test("an unpublished or missing campaign is not assigned imaginary eligibility",()=>{
  const result=matchOpportunity({cause_tags:["education"]},null);
  assert.equal(result.score,0);
  assert.match(result.summary,/Select a published campaign/);
});
test("aliases support disaster relief and medical programs without claiming eligibility",()=>{
  assert(matchOpportunity({cause_tags:["emergency"]},{category:"disaster_relief",title:"Storm relief"}).score>0);
  assert(matchOpportunity({cause_tags:["health"]},{category:"medical",title:"Care"}).score>0);
  assert.match(matchOpportunity({cause_tags:["environment"]},{category:"education",title:"Tutor"}).summary,/No direct topic overlap/);
});
