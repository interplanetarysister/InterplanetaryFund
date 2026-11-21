import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("landing prompt opens the existing three-step campaign creator", () => {
 const home = read("../src/pages/Home.jsx");
 const creator = read("../src/pages/CreateCampaign.jsx");
 const wizard = read("../src/lib/campaignWizard.js");
 assert.match(home, /navigate\("\/create\?manual=1", \{ state: \{ prompt, source: "home-what-if" \} \}\)/);
 assert.match(home, /maxLength=\{1500\}/);
 assert.match(home, /submitLabel="Build my campaign"/);
 assert.match(home, /to=\{signedIn \? "\/dashboard" : "\/login"\}/);
 assert.match(home, /to="\/our-story"/);
 assert.match(creator, /location\.state\?\.source === "home-what-if"/);
 assert.match(creator, /details:landingPrompt/);
 assert.match(creator, /summary:landingPrompt\.slice\(0, SUMMARY_MAX\)/);
 assert.match(creator, /existing\.title\|\|existing\.summary\|\|existing\.story/);
 assert.match(wizard, /"Campaign basics","Your story","Review and publish"/);
});
test("owner drafts, AI story decisions and publication gates remain intact", () => {
 const creator=read("../src/pages/CreateCampaign.jsx");
 assert.match(creator, /restoreBrowserCampaign\(sessionStorage,ownerId\)/);
 assert.match(creator, /restoreWritingBrief\(sessionStorage,ownerId\)/);
 assert.match(creator, /if \(!draftId && params\.get\("manual"\) !== "1"/);
 assert.match(creator, /Generate campaign ideas/);
 assert.match(creator, /save\("active"\)/);
 assert.match(creator, /publishReadiness\(form\)/);
});

test("dashboard prompt uses the same direct three-stage AI editor handoff", () => {
 const dashboard=read("../src/pages/Dashboard.jsx");
 assert.match(dashboard,/navigate\("\/create\?manual=1", \{ state: \{ prompt, source: "home-what-if" \} \}\)/);
 assert.match(dashboard,/submitLabel="Continue"/);
});
