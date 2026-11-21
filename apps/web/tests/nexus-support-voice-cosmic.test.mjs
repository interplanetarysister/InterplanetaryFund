import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SUPPORT_NEEDS,supportNeed,missionGoalTypeForSupport,missionSupportFields,missionSupportPrompt,missionSupportSummary} from "../src/lib/supportNeeds.mjs";
import {campaignSetupPayload} from "../src/api/campaignSetup.js";
import {interpretVoiceSiteCommand,voiceSiteGuidance,goalPromptFromVoice} from "../src/lib/voiceSiteIntents.mjs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("request categories cover money and nonfinancial human needs without fake USD values",()=>{
 const ids=SUPPORT_NEEDS.map(item=>item.id);
 assert.deepEqual(ids,["unspecified","money","transport","essentials","home","care","people","skills","equipment","learning","community","other"]);
 assert.ok(SUPPORT_NEEDS.every(item=>item.label&&item.examples));
 assert.equal(supportNeed("transport").cash,undefined);
 assert.equal(supportNeed("money").cash,true);
 assert.equal(missionGoalTypeForSupport("essentials"),"emergency");
 assert.equal(missionGoalTypeForSupport("learning"),"education");
 const setup=campaignSetupPayload({writing_brief:{details:"Help a child",support_type:"transport"}});
 assert.equal(setup.ai_profile.writing_brief.support_type,"transport");
 assert.equal(campaignSetupPayload(setup,0).ai_profile.writing_brief.support_type,"transport");
 assert.equal(campaignSetupPayload({cover_image_is_ai:true,writing_brief:{support_type:"transport"}}).cover_image_is_ai,true);
 assert.equal(campaignSetupPayload({cover_image_is_ai:false}).cover_image_is_ai,false);
 assert.equal(campaignSetupPayload({writing_brief:{support_type:"INVALID"}}).ai_profile.writing_brief.support_type,"unspecified");
 assert.equal(missionSupportSummary("unspecified"),"");
 assert.deepEqual(missionSupportFields("unspecified"),{});
 assert.equal(missionSupportPrompt("unspecified"),"");
 assert.match(missionSupportSummary("transport"),/Vehicles and transportation/);
});
test("NEXUS spoken commands only navigate to existing user-reviewed endpoints",()=>{
 assert.equal(interpretVoiceSiteCommand("open signup")?.route,"/register");
 assert.equal(interpretVoiceSiteCommand("create a campaign")?.route,"/create?manual=1");
 assert.equal(interpretVoiceSiteCommand("publish my campaign",{authenticated:true})?.route,"/campaigns");
 assert.equal(interpretVoiceSiteCommand("publish my update",{authenticated:true})?.route,"/social?kind=update");
 assert.equal(interpretVoiceSiteCommand("publish my update",{authenticated:false})?.route,"/login?returnTo=%2Fsocial%3Fkind%3Dupdate");
 assert.equal(interpretVoiceSiteCommand("publish my campaign",{authenticated:true})?.requiresReview,true);
 for(const command of ["open my dashboard","show my connections","publish my update","post my campaign on facebook"]){
  const action=interpretVoiceSiteCommand(command,{authenticated:false});
  assert.equal(action?.signInRequired,true,command);
  assert.equal(action?.requiresReview,false,command);
  assert.match(action?.route,/^\/login\?returnTo=/u,command);
  assert.match(voiceSiteGuidance(action),/open secure sign in first\. No account action/u,command);
 }
 assert.equal(interpretVoiceSiteCommand("post my campaign on facebook",{authenticated:true})?.route,"/connections");
 assert.equal(interpretVoiceSiteCommand("withdraw all funds"),null);
 assert.match(voiceSiteGuidance(interpretVoiceSiteCommand("publish my campaign",{authenticated:true})),/confirm publication/);
});
test("NEXUS can introduce goals before account creation but never claims to save them",()=>{
 assert.match(goalPromptFromVoice("Hey Alexa, I want to help my kids start a lemonade stand without money"),/lemonade stand/);
 assert.equal(goalPromptFromVoice("publish everything right now"),null);
 assert.equal(goalPromptFromVoice("my password is 1234"),null);
 const mission=read("../src/pages/WhatIfStart.jsx");
 assert.match(mission,/missionGoalTypeForSupport\(supportType\)/);
 assert.match(mission,/missionSupportFields\(supportType\)/);
 assert.match(mission,/missionSupportPrompt\(supportType\)/);
 assert.match(mission,/supportType!=="unspecified"/);
 assert.match(mission,/return "unspecified"/);
 assert.doesNotMatch(mission,/summary:"Support wanted: "/);
 assert.match(mission,/money.*one kind of support/i);
});
test("real artwork is quota-gated and must be uploaded and applied by the owner",()=>{
 const creator=read("../src/pages/CreateCampaign.jsx");
 const art=read("../src/components/campaigns/CampaignImageChoices.jsx");
 assert.match(creator,/CampaignImageChoices/);
 assert.match(creator,/onApply=\{\(url,provenance\)=>\{applyCampaignFields\(\{cover_image_url:coverImageUrl\(url\),cover_image_is_ai:provenance\?\.cover_image_is_ai===true\}\)/);
 assert.match(art,/onApply\(url,\{cover_image_is_ai:true\}\)/);
 assert.match(read("../src/lib/campaignLifecycle.js"),/const aiCover = value\.cover_image_is_ai === true \|\| coverIsAI\(cover\)/);
 assert.match(read("../src/lib/campaignLifecycle.js"),/cover_image_url: withCoverProvenance\(cover, aiCover\)/);
 assert.match(read("../src/api/publicData.js"),/cover_image_is_ai: coverIsAI\(row\.cover_image_url/);
 assert.match(read("../src/pages/CampaignDetail.jsx"),/campaign\.cover_image_is_ai &&/);
 assert.match(art,/\/api\/ai\/images\/generate/);
 assert.match(art,/decodeGeneratedArtwork/);
 assert.match(art,/uploadCampaignCover/);
 assert.match(art,/Sign in with a verified account/);
 assert.match(art,/not a documentary photograph/);
 assert.doesNotMatch(art,/publishCampaign|sendExternal/);
});
test("replaced geometry and eclipse milestone preserve dashboard Earth surface",()=>{
 const css=read("../src/styles-cosmic-refinement.css");
 const shell=read("../src/components/agents/GlobalAgentCompanion.jsx");
 const creator=read("../src/pages/CreateCampaign.jsx");
 assert.match(css,/cosmic-symmetry\.svg/);
 assert.match(css,/cosmic-eclipse\.svg/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(shell,/pathname==="\/dashboard"\?" ifund-preserve-earth"/);
 assert.match(creator,/ifund-eclipse-moment/);
 assert.match(css,/ifund-symmetric-drift/);
});
test("NEXUS voice handoff stays in verified gateway and publishing review remains separate",()=>{
 const panel=read("../src/components/agents/AgentSidePanel.jsx");
 const training=read("../../../worker/agents/teamQuestion.js");
 const voice=read("../src/components/campaigns/CampaignVoiceGuide.jsx");
 assert.match(panel,/goalPromptFromVoice/);
 assert.match(panel,/interpretVoiceSiteCommand/);
 assert.match(panel,/availability\.enabled/);
 assert.match(panel,/handsFree/);
 assert.match(training,/IFund helps people ACHIEVE GOALS/);
 assert.match(voice,/onGoal/);
 assert.match(voice,/supportNeed\(supportType\)\.cash===true/);
 assert.match(voice,/onBeneficiary/);
 assert.match(voice,/No microphone is kept constantly active/);
 assert.doesNotMatch(voice,/publishCampaign\(/);
});
test("Alexa integration is preparation, not a misleading live device connection",()=>{
 const model=JSON.parse(read("../../../integrations/alexa/interaction-model.json"));
 assert.equal(model.interactionModel.languageModel.invocationName,"interplanetary fund");
 assert.ok(model.interactionModel.languageModel.intents.some(item=>item.name==="GoalSupportIntent"));
 assert.match(read("../../../integrations/alexa/README.md"),/not an active Alexa skill/i);
});
