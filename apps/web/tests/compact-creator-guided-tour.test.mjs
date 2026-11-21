import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");

test("public homepage keeps a login shortcut and does not show the agent launcher",()=>{
 const dock=read("../src/components/agents/GlobalAgentCompanion.jsx");
 const css=read("../src/styles/agent-companion.css");
 const actions=read("../src/components/QuickActions.jsx");
 assert.match(dock,/const isHome = pathname === "\/"/);
 assert.match(dock,/!isHome && activeAgent == null/);
 assert.match(dock,/signedIn \? "\/profile" : "\/login"/);
 assert.match(dock,/SiteTour/);
 assert.match(css,/ifund-global-account-launcher/);
 assert.match(css,/ifund-global-agent-launcher/);
 assert.match(actions,/left-3 md:left-6 right-auto/);
});
test("sign up gives a simple agent introduction and page tours are account-scoped and one-time",()=>{
 const onboarding=read("../src/pages/MemberOnboarding.jsx");
 const tour=read("../src/components/onboarding/SiteTour.jsx");
 assert.match(onboarding,/Meet your team/);
 assert.match(onboarding,/NEXUS/);
 assert.match(onboarding,/floating side by side/);
 assert.match(tour,/tourKey\(id\)/);
 assert.match(tour,/pageKey\(id,page\)/);
 assert.match(tour,/pathname === "\/onboarding"/);
 assert.match(tour,/localStorage\.setItem\(pageKey\(id,route\),"seen"\)/);
 assert.match(tour,/pathname === "\/"/);
 assert.doesNotMatch(tour,/fetch\(/);
});
test("creator presents only icon navigation, compact user parameters, and optional browser voice",()=>{
 const creator=read("../src/pages/CreateCampaign.jsx");
 const voice=read("../src/components/campaigns/CampaignVoiceInput.jsx");
 assert.match(creator,/stepIcons = \[Target, BookOpen, Rocket\]/);
 assert.match(creator,/aria-label=\{"Step "\+\(index\+1\)/);
 assert.match(creator,/What are we making possible\?/);
 assert.match(creator,/Who or what is this for\?/);
 assert.match(creator,/What feeling should the story and images convey/);
 assert.match(creator,/What resources or help would make this possible\?/);
 assert.match(creator,/CampaignVoiceInput/);
 assert.match(creator,/save\("active"\)/);
 assert.match(creator,/rememberBrowserCampaign\(sessionStorage, ownerId, form/);
 assert.match(voice,/SpeechRecognition \|\| window\.webkitSpeechRecognition/);
 assert.match(voice,/speechSynthesis/);
 assert.match(voice,/onChange\(/);
 assert.doesNotMatch(voice,/fetch\(|MediaRecorder|upload/);
});
