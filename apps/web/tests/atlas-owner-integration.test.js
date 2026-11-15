import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Atlas selects owner-verified campaigns for authenticated members and never mixes accounts", () => {
  const atlas=read("../src/pages/Atlas.jsx");
  assert.match(atlas,/listOwnerAtlasCampaigns\(authClient\(\)\)/);
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

test("Atlas placement link deep-links to the campaign location fieldset",()=>{
  const atlas=read("../src/pages/Atlas.jsx");
  const edit=read("../src/pages/EditCampaign.jsx");
  const fields=read("../src/components/atlas/CampaignLocationFields.jsx");
  assert.match(atlas,/edit#campaign-atlas-location/);
  assert.match(edit,/campaign-atlas-location/);
  assert.match(fields,/id="campaign-atlas-location"/);
  assert.match(fields,/tabIndex=\{-1\}/);
});

test("globe selection does not retain a campaign from another authorization scope",()=>{
  const globe=read("../src/components/atlas/CampaignGlobe.jsx");
  assert.match(globe,/const \[selectedId, setSelectedId\] = useState\(null\)/);
  assert.match(globe,/campaigns\.find\(c => c\.id === selectedId\) \|\| null/);
  assert.doesNotMatch(globe,/setSelected\(campaign\)/);
});

test("Atlas pagination does not fetch financial fields or expose cross-owner records",()=>{
  const api=read("../src/api/ownerCampaigns.js");
  const part=api.slice(api.indexOf("export async function listOwnerAtlasCampaigns"),api.indexOf("export async function listMyCampaigns"));
  assert.match(part,/verifiedOwner\(client\)/);
  assert.match(part,/eq\("owner_id", owner\)/);
  assert.match(part,/\.range\(start, start \+ PAGE_SIZE - 1\)/);
  assert.match(part,/assertSessionUnchanged\(client, owner\)/);
  assert.match(part,/row\?\.owner_id !== owner/);
  assert.doesNotMatch(part,/story,|goal_amount|donor_count|raised_amount/);
});
