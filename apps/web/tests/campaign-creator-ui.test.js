import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("campaign creator restores the four source workflow stages", () => {
  for (const label of ["Your Details", "Basics", "Your Story", "Launch"]) assert.match(source, new RegExp(label));
  assert.match(source, /Campaign setup: step/);
  assert.match(source, /Save private draft/);
  assert.match(source, /Publish campaign/);
});

test("campaign creator does not claim independent AI generation is live", () => {
  assert.match(source, /AI title, description, and story generation are not connected/);
  assert.match(source, /AI cover generation and direct media upload are not enabled/);
  assert.doesNotMatch(source, /generateCampaignCover|invokeCampaignAssistant|base44/);
});

test("campaign creator keeps the owner email out of public campaign content", () => {
  assert.match(source, /Your email is not displayed on its public page/);
  assert.match(source, /persistCampaignContent/);
});
