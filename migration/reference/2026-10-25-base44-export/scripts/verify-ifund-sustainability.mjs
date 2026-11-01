import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const campaign = JSON.parse(read("base44/entities/Campaign.jsonc"));
const audit = JSON.parse(read("base44/entities/SustainabilityAudit.jsonc"));
const card = read("src/components/campaigns/CampaignCard.jsx");
const create = read("src/pages/CreateCampaign.jsx");
const discover = read("src/pages/Discover.jsx");
const app = read("src/App.jsx");
const layout = read("src/components/Layout.jsx");
const page = read("src/pages/SustainabilityAdmin.jsx");
const about = read("src/pages/About.jsx");
const image = read("src/components/ui/image.jsx");

assert.ok(campaign.properties.category.enum.includes("environment"), "Environment must be persisted by the Campaign schema");
for (const existing of ["medical", "emergency", "education", "community", "animals", "business", "memorial", "disaster_relief", "creative", "other"]) {
  assert.ok(campaign.properties.category.enum.includes(existing), `Lost existing category: ${existing}`);
}
assert.match(card, /environment: "Planet & Environment"/);
assert.match(create, /Object.entries\(categoryLabels\)/, "New category must be selectable in creation");
assert.match(discover, /const category = categoryLabels\[requestedCategory\]/, "Discover must support environmental deep links");
assert.match(discover, /setSearchParams/, "Changing category must update query");
assert.match(app, /AdminRoute[\s\S]*path="\/admin\/sustainability" element=\{<SustainabilityAdmin/, "Tracker must require admin");
assert.match(layout, /to: "\/admin\/sustainability", label: "Planet Impact"/);
for (const action of ["create", "read", "update", "delete"]) {
  assert.equal(audit.rls[action]?.user_condition?.role, "admin", `SustainabilityAudit ${action} must require admin`);
}
assert.match(page, /sampleBrowserTransfer/);
assert.match(page, /verification_status: "unverified"/);
assert.match(page, /verification_status: evidence \? "documented" : "unverified"/);
assert.match(page, /not an energy or carbon calculation/);
assert.match(about, /hosting energy use and overall emissions have not yet been independently verified/);
assert.match(image, /navigator\.connection\?\.saveData === true/);
assert.match(image, /dataSaver \? Math\.min\(quality, 65\) : quality/);
assert.match(image, /!dataSaver && \(/, "Do not request blur placeholder on reduced-data clients");
console.log("PASS: IFund sustainability schemas, admin guard, campaign category, evidence integrity, and reduced-data image behavior contracts.");
