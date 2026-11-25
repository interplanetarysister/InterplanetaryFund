import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateImageRequest, IMAGE_STYLES} from "../../../worker/imageStudio.js";
import {campaignSetupPayload} from "../src/api/campaignSetup.js";

const source = path => readFileSync(new URL(path,import.meta.url),"utf8");
const base={title:"Help our neighborhood garden",description:"A garden initiative for community food and science learning."};

test("campaign cover always uses one cohesive IFund visual direction",()=>{
 const valid=validateImageRequest({...base,style:"ifund",purpose:"campaign-cover"});
 assert.equal(valid.style,"ifund");
 for(const reference of ["cosmic-geometry","interstellar","futuristic","cyberpunk","graphic-novel"])
  assert.match(valid.prompt,new RegExp(reference,"i"));
 for(const style of ["interstellar","futuristic","cyberpunk","comic","hyper-realistic-simulated-event"])
  assert.throws(()=>validateImageRequest({...base,style,purpose:"campaign-cover"}),/valid campaign/);
});

test("distinct media styles remain allowed while synthetic event is explicitly identified",()=>{
 for(const style of ["interstellar","futuristic","cyberpunk","comic","ifund","hyper-realistic-simulated-event"])
  assert.equal(validateImageRequest({...base,style,purpose:"media"}).style,style);
 assert.ok(Object.hasOwn(IMAGE_STYLES,"hyper-realistic-simulated-event"));
 const simulated=validateImageRequest({...base,style:"hyper-realistic-simulated-event",purpose:"media"});
 assert.match(simulated.prompt,/fictional.*photorealistic/i);
 assert.match(simulated.prompt,/not.*documentary/i);
});

test("campaign creation has no split style selector and explicitly sends cover purpose",()=>{
 const ui=source("../src/components/campaigns/CampaignImageChoices.jsx");
 assert.match(ui,/const CAMPAIGN_STYLE="ifund"/);
 assert.match(ui,/purpose:"campaign-cover"/);
 assert.match(ui,/Interplanetary Fund signature/);
 assert.doesNotMatch(ui,/<select value={style}/);
 const data=campaignSetupPayload({ai_profile:{image_style:"cyberpunk",image_caption:"Make this possible"}});
 assert.equal(data.ai_profile.image_style,"ifund");
 assert.equal(data.ai_profile.image_caption,"Make this possible");
});

test("general media exposes simulated-event style but never passes unsupported purpose to image improvement",()=>{
 const ui=source("../src/pages/AIImageStudio.jsx");
 assert.match(ui,/\["hyper-realistic-simulated-event", "Hyper-realistic simulated event"\]/);
 assert.match(ui,/!improve \? \{ purpose: "media" \} : \{\}/);
 assert.match(ui,/AI-simulated event/);
 assert.match(ui,/style !== "hyper-realistic-simulated-event"/);
});
