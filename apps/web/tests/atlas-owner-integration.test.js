import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Atlas selects owner-verified campaigns for authenticated members and never mixes accounts", () => {
  const atlas=read("../src/pages/Atlas.jsx");
  assert.match(atlas,/listOwnerCampaigns\(authClient\(\)\)/);
  assert.match(atlas,/ownerCampaigns\.ownerId === user\.id/);
  assert.match(atlas,/sessionStatus === "signed-in"/);
  assert.match(atlas,/setSelectedScope\("public"\)/);
  assert.match(atlas,/setSelectedScope\("mine"\)/);
  assert.match(atlas,/scope === "mine"/);
});
test("Atlas offers explicit editor opt-in for unmapped published owner campaigns", () => {
  const atlas=read("../src/pages/Atlas.jsx");
  assert.match(atlas,/Campaigns missing map locations/);
  assert.match(atlas,/status==="active"&&!isApprovedAtlasLocation\(c\)/);
  assert.match(atlas,/campaigns\/.*\/edit/);
  assert.match(atlas,/No location is assigned automatically/);
});
test("Atlas geography renders without invoking payment aggregation", () => {
  const atlas=read("../src/pages/Atlas.jsx");
  const publicApi=read("../src/api/publicData.js");
  const geo=publicApi.slice(publicApi.indexOf("export async function listPublicAtlasCampaigns"));
  assert.match(atlas,/listPublicAtlasCampaigns\(/);
  assert.doesNotMatch(geo,/attachVerifiedFunding|ifund_public_campaign_funding_totals/);
  assert.doesNotMatch(atlas,/verifiedRaised|verifiedDonors|goalRows|progressRows/);
  assert.match(atlas,/Approved city \/ region/);
});
test("globe remains centered on North America until the user chooses to rotate", () => {
  const globe=read("../src/components/atlas/CampaignGlobe.jsx");
  assert.match(globe,/useState\(-100\)/);
  assert.match(globe,/useState\(false\)/);
  assert.match(globe,/Focus globe on North America/);
});
