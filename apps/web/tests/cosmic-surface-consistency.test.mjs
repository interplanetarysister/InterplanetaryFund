import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const categories = read("../src/components/campaigns/CampaignCategoryGrid.jsx");
const missions = read("../src/pages/MyMissions.jsx");
const templates = read("../src/pages/CampaignTemplates.jsx");
const editor = read("../src/pages/CreateCampaign.jsx");
const terms = read("../src/pages/Terms.jsx");
const privacy = read("../src/pages/Privacy.jsx");

test("campaign category cards use the shared cosmic surface and touch target", () => {
  assert.match(categories, /ifund-tap ifund-cosmic-panel group flex min-h-\[92px\]/);
  assert.match(categories, /aria-pressed=\{active\}/);
});

test("private Mission and campaign editor surfaces use the shared cosmic panel", () => {
  assert.match(missions, /ifund-cosmic-panel space-y-4 rounded-2xl/);
  assert.match(missions, /ifund-cosmic-panel group flex min-h-48/);
  assert.match(editor,/stepNames=\["Your idea","Your story","Ready to share"\]/);
  assert.match(editor,/border border-cyan-300\/25 bg-slate-950 text-white shadow-2xl/);
  assert.equal((editor.match(/<section className=\{/g)||[]).length,1);
  assert.doesNotMatch(editor,/ifund-cosmic-panel space-y-5 rounded-2xl border border-border bg-card/);
  assert.match(templates, /details className="ifund-cosmic-panel rounded-2xl border/);
});

test("standalone legal pages use the public cosmic background", () => {
  assert.match(terms, /className="ifund-public min-h-screen/);
  assert.match(privacy, /className="ifund-public min-h-screen/);
});

test("template handoff remains visible and does not change creator safeguards", () => {
  assert.match(editor, /Starting layout: \{templateStyle\(previewStyle\)\.name\}/);
  assert.match(editor, /Publishing does not require an AI review or a story-length target\. You may improve your campaign afterward in Command Center\./);
  assert.match(editor, /Your existing draft is never overwritten|existing account drafts will not be overwritten/i);
});
