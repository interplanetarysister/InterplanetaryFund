import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("new public homepage keeps sign in prominent and the prompt launches the original editor", () => {
  const home = read("../src/pages/Home.jsx");
  const app = read("../src/App.jsx");
  assert.match(home, /to=\{signedIn \? "\/dashboard" : "\/login"\}/);
  assert.match(home, /to="\/register"/);
  assert.match(home, /navigate\("\/create\?manual=1", \{ state: \{ prompt, source: "home-what-if" \} \}\)/);
  assert.match(home, /PromptComposer/);
  assert.match(home, /Your idea stays private until you choose to publish/);
  assert.match(app, /<Route path="\/our-story" element=\{<OurStory \/>\}/);
});
test("the original homepage remains preserved as a distinct Our Story page", () => {
  const story=read("../src/pages/OurStory.jsx");
  const home=read("../src/pages/Home.jsx");
  const footer=read("../src/components/LegalFooter.jsx");
  assert.match(story, /Who is Interplanetary Fund/);
  assert.match(story, /The problem we're solving/);
  assert.match(story, /Turning What if into What happens next/);
  assert.match(story, /CampaignCategoryGrid/);
  assert.match(footer, /to="\/our-story"/);
  assert.doesNotMatch(home, /const STORY = \[/);
});
test("campaign prompt starts with prefilled words and optional refinements stay collapsed", () => {
  const creator=read("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /details:landingPrompt/);
  assert.match(creator, /summary:landingPrompt\.slice\(0, SUMMARY_MAX\)/);
  assert.match(creator, /aria-label="Your starting idea"/);
  assert.match(creator, /A little more context \(optional\)/);
  assert.match(creator, /CampaignVoiceInput/);
  assert.match(creator, /What resources or help would make this possible\?/);
  assert.match(creator, /stepIcons = \[Target, BookOpen, Rocket\]/);
  assert.match(creator, /Already fundraising somewhere else\? \(optional\)/);
  assert.match(creator, /restoreBrowserCampaign\(sessionStorage,ownerId\)/);
});
test("ORBIT uses member-facing language without changing authenticated finance permissions", () => {
  const workspaces=read("../src/lib/agentWorkspaces.mjs");
  const app=read("../src/App.jsx");
  assert.match(workspaces, /identity:"orbit".*tool:"Your fundraising finances and verified donations"/);
  assert.match(app, /<Route path="\/finances" element=\{<MemberAccess><FinanceDashboard \/><\/MemberAccess>\}/);
});
