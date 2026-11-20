import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("three-step creator keeps publishing gates but moves optional analysis away", () => {
  const creator = source("../src/pages/CreateCampaign.jsx");
  assert.match(creator, /WIZARD_STEPS/);
  assert.match(creator, /save\("draft"\)/);
  assert.match(creator, /save\("active"\)/);
  assert.match(creator, /!readiness\.ready/);
  assert.match(creator, /to="\/analytics"/);
  assert.match(creator, /minimum story length is required to publish/);
  assert.doesNotMatch(creator, /<PrepublicationGate/);
  assert.doesNotMatch(creator, /<CampaignReadinessScore/);
});

test("Command Center shows owner-scoped, optional readiness analysis", () => {
  const strategy = source("../src/pages/CampaignStrategy.jsx");
  const center = source("../src/pages/AnalyticsCenter.jsx");
  assert.match(center, /CampaignStrategy/);
  assert.match(strategy, /listOwnerCampaigns\(client\)/);
  assert.match(strategy, /owned\.has\(item\.campaign_id\)/);
  assert.match(strategy, /campaignForm:campaign/);
  assert.match(strategy, /<CampaignReadinessScore form=\{item\.campaignForm\}/);
  assert.match(strategy, /editPath=\{/);
  assert.match(strategy, /This score is advisory, not a publication condition/);
  const score = source("../src/components/campaigns/CampaignReadinessScore.jsx");
  assert.match(score, /editPath\+"#"\+row.field/);
  assert.match(score, /campaign-sharing-plan/);
  assert.doesNotMatch(strategy, /characters before publishing/);
});

test("reversible editorial tools and required publish validation remain available", () => {
  const editor = source("../src/pages/EditCampaign.jsx");
  const lifecycle = source("../src/lib/campaignLifecycle.js");
  const prepublication = source("../src/components/campaigns/PrepublicationGate.jsx");
  assert.match(editor, /<PrepublicationGate/);
  assert.match(editor, /onApplyFields/);
  assert.match(editor, /readiness\.ready/);
  assert.match(lifecycle, /validateCampaignForm\(form, \{ publish: true \}\)/);
  assert.match(prepublication, /onApplyFields\?\.\(campaignPunctuation\.after\)/);
  assert.match(prepublication, /Story length and paragraph structure are your choice/);
});

test("readiness deep links target actual editor fields, not missing anchors", () => {
  const score = source("../src/lib/campaignReadinessScore.mjs");
  const editor = source("../src/pages/EditCampaign.jsx");
  const calculatorFields = [...score.matchAll(/"campaign-(?:title|summary|cover|story|goal|category|sharing-plan)"/g)]
    .map(match => match[0].slice(1, -1));
  const targetFields = [...new Set(calculatorFields.filter(field => field !== "campaign-sharing-plan"))];
  assert.ok(targetFields.length >= 6, "Readiness category fields must remain covered");
  for (const field of targetFields) {
    assert.match(editor, new RegExp('id="' + field + '"'),
      "Readiness deep link #" + field + " must resolve to an actual editor control");
  }
});
