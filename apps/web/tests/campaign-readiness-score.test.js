import test from "node:test";
import assert from "node:assert/strict";
import { analyzeStoryStructure, calculateCampaignReadiness, READINESS_WEIGHTS } from "../src/lib/campaignReadinessScore.mjs";

const paragraph = "Our neighbors need support to recover from the storm. The funding will cover emergency supplies and repairs. We will provide monthly updates about verified expenses.";
const completeStory = paragraph+"\n\n"+paragraph;
const form = {
  title:"Help our neighborhood recover after the storm",
  summary:"This community effort supports families recovering from storm damage. Your support will cover repairs and essential supplies. We will share regular updates as plans are confirmed.",
  story:completeStory, goal_amount:"2500",category:"disaster_relief",
  cover_image_url:"https://example.org/campaign.jpg",
};

test("weights total exactly 100 and score stays in bounds", () => {
  assert.equal(Object.values(READINESS_WEIGHTS).reduce((a,b)=>a+b,0),100);
  for(const candidate of [{},form,{...form,story:"x"}, {...form,title:"x".repeat(2000)}]){
    const score=calculateCampaignReadiness(candidate);
    assert.ok(Number.isInteger(score.total) && score.total>=0 && score.total<=100);
    assert.equal(score.rows.reduce((a,r)=>a+r.earned,0),score.total);
    assert.ok(score.rows.every(r=>r.earned>=0&&r.earned<=r.max));
  }
});
test("structured full story requires two or three paragraphs of three to five sentences",()=>{
  assert.deepEqual(analyzeStoryStructure(completeStory).sentences,[3,3]);
  assert.equal(analyzeStoryStructure(completeStory).valid,true);
  assert.equal(analyzeStoryStructure(paragraph).valid,false);
  assert.equal(analyzeStoryStructure(completeStory+"\n\n"+paragraph+"\n\n"+paragraph).valid,false);
  assert.equal(analyzeStoryStructure("One. Two.\n\nThree. Four. Five.").valid,false);
  assert.equal(analyzeStoryStructure(paragraph+"\n\n"+paragraph+" Extra sentence. Extra sentence. Extra sentence.").valid,false);
});
test("sharing choice is self-declared and affects only its weighted category",()=>{
  const without=calculateCampaignReadiness(form);
  const withPlan=calculateCampaignReadiness(form,{sharingPlan:true});
  assert.equal(withPlan.total-without.total,READINESS_WEIGHTS.sharing);
  assert.equal(without.rows.find(r=>r.key==="sharing").earned,0);
  assert.match(withPlan.disclosure,/not a statistically validated/);
});
test("empty and misleading input cannot be declared 100% ready",()=>{
  assert.equal(calculateCampaignReadiness({}).total<20,true);
  assert.ok(calculateCampaignReadiness({...form,story:"",goal_amount:"0",cover_image_url:"not-an-image"}).total<75);
});
