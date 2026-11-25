import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TEMPLATE_CATEGORIES, TEMPLATE_STYLES, applyTemplateToForm, isTemplateCategory,
  isTemplateStyle, outlineToStory, recommendedTemplates, templateCategory,
  templateOutline, templateStyle,
} from "../src/lib/campaignTemplates.js";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

// These ids are the only values the canonical campaign schema accepts. A
// template must never widen the stored category set from the UI.
const CANONICAL_CATEGORIES = [
  "medical", "emergency", "education", "community", "animals", "business",
  "memorial", "disaster_relief", "creative", "environment", "other",
];

test("template categories stay within the campaign schema", () => {
  const ids = TEMPLATE_CATEGORIES.map(category => category.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate category id");
  assert.deepEqual([...ids].sort(), [...CANONICAL_CATEGORIES].sort());
  for (const category of TEMPLATE_CATEGORIES) {
    assert.ok(category.label && category.blurb, "category needs readable copy");
    assert.ok(isTemplateStyle(category.style), category.id + " maps to an unknown style");
  }
});

test("template styles are distinct and every category has a suggestion", () => {
  const ids = TEMPLATE_STYLES.map(style => style.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate style id");
  for (const style of TEMPLATE_STYLES) {
    assert.ok(style.name && style.short && style.description);
    assert.ok(style.surface && style.ring && style.accentBg);
  }
  for (const category of TEMPLATE_CATEGORIES) {
    assert.equal(recommendedTemplates(category.id)[0].id, category.style);
  }
});

test("unknown template values fail closed without changing the form", () => {
  const form = { title: "My own words", summary: "", story: "", category: "medical", goal_amount: "500" };
  assert.equal(isTemplateCategory("not-a-category"), false);
  assert.equal(isTemplateStyle("not-a-style"), false);
  assert.equal(templateCategory("not-a-category").id, "other");
  assert.equal(templateStyle("not-a-style").id, "clean");
  assert.deepEqual(applyTemplateToForm(form, { category: "not-a-category", template: "nope" }), {
    form: { ...form }, style: "clean",
  });
});

test("a template prefill selects a category but never overwrites typed content", () => {
  const typed = applyTemplateToForm(
    { title: "A real title", summary: "Real summary", story: "Real story", category: "community" },
    { category: "medical" },
  );
  assert.equal(typed.form.category, "medical");
  assert.equal(typed.form.title, "A real title");
  assert.equal(typed.form.summary, "Real summary");
  assert.equal(typed.form.story, "Real story");

  const blank = applyTemplateToForm(
    { title: "", summary: "", story: "", category: "community" },
    { category: "education", withOutline: true },
  );
  assert.equal(blank.form.category, "education");
  assert.match(blank.form.story, /What this is for/);
  assert.match(blank.form.story, /your own words/i);
});

test("writing outlines ask for facts instead of inventing them", () => {
  for (const category of TEMPLATE_CATEGORIES) {
    const outline = templateOutline(category.id);
    assert.ok(outline.length >= 4);
    for (const section of outline) {
      assert.ok(section.heading && section.prompt);
      assert.doesNotMatch(section.prompt, /\$\d|raised|donors|supporters have/i);
    }
    assert.equal(outlineToStory(category.id).split("\n\n").length, outline.length);
  }
});

test("the gallery and editor are linked without publishing anything", () => {
  const app = source("../src/App.jsx");
  const gallery = source("../src/pages/CampaignTemplates.jsx");
  const editor = source("../src/pages/CreateCampaign.jsx");
  assert.match(app, /path="\/templates" element=\{<CampaignTemplates \/>\}/);
  assert.match(gallery, /\/create\?manual=1&category=\$\{category\}&template=\$\{style\}/);
  assert.match(gallery, /Nothing is published until you decide/);
  assert.match(gallery, /never create donations or testimonials/i);
  assert.match(editor, /isTemplateCategory\(requestedCategory\)/);
  assert.match(editor, /previous\.title \|\| previous\.summary \|\| previous\.story/);
});

test("the homepage and dashboard use the shared prompt and real campaign data", () => {
  const home = source("../src/pages/Home.jsx");
  const dashboard = source("../src/pages/Dashboard.jsx");
  const preview = source("../src/components/campaigns/CampaignTemplatePreview.jsx");
  for (const page of [home, dashboard]) {
    assert.match(page, /PromptComposer/);
    assert.match(page, /min-h-12|ifund-tap|min-h-\[44px\]/);
  }
  // Sprint 3 (2026-11-25): Our Story no longer duplicates the homepage's
  // campaign browsing — real campaign data renders on Discover, and the
  // category grid lives on the campaign templates page. The story page
  // keeps the story copy, hero artwork and platform-support block.
  const discover = source("../src/pages/Discover.jsx");
  assert.match(discover, /listActiveCampaigns/);
  assert.match(discover, /CampaignCard/);
  const templates = source("../src/pages/CampaignTemplates.jsx");
  assert.match(templates, /CampaignCategoryGrid/);
  assert.match(home, /to="\/our-story"/);
  assert.match(dashboard, /AGENT_WORKSPACES\.map/);
  assert.match(dashboard, /AgentIdentityIcon/);
  assert.match(dashboard, /agentToolHref\(role\.identity\)/);
  // Financial areas are placeholders for verified data, never invented values.
  assert.match(preview, /Verified donations appear here after the payment provider confirms them/);
  assert.doesNotMatch(preview, /\$\s?\d[\d,]*\s*(raised|donated)/i);
});
