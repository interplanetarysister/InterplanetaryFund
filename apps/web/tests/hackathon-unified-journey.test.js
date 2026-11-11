import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHOWCASE_CAMPAIGNS, DEMO_STEPS } from "../src/lib/unifiedDemoJourney.mjs";
import { financeDemoRows } from "../src/lib/hackathonFinanceDemo.mjs";
const page = readFileSync(new URL("../src/pages/HackathonDemo.jsx", import.meta.url), "utf8");
const journey = readFileSync(new URL("../src/components/hackathon/DemoJourney.jsx", import.meta.url), "utf8");

test("One hackathon entrypoint connects six public guide stages", () => {
  assert.deepEqual(DEMO_STEPS.map(s => s.id), ["journey","ai-workshop","promote","sandbox-checkout","finance-demo","mission-control"]);
  assert.match(page, /<DemoJourney onFinanceFilter=\{setFinanceSearch\}/);
  for (const { id } of DEMO_STEPS) {
    assert.ok(page.includes(`id="${id}"`) || journey.includes(`id="${id}"`), `missing stage ${id}`);
  }
});
test("Scenario selection is safely fictional and matches the AG Grid examples", () => {
  assert.equal(SHOWCASE_CAMPAIGNS.length, 4);
  const titles = new Set(financeDemoRows.map(x=>x.campaign));
  assert.ok(SHOWCASE_CAMPAIGNS.every(c=>titles.has(c.title)));
  for(const campaign of SHOWCASE_CAMPAIGNS){
    assert.equal(campaign.titles.length,5);
    assert.equal(campaign.summaries.length,2);
    assert.ok(campaign.sections.length>=3);
    assert.ok(campaign.id.startsWith("story-"));
  }
  assert.match(journey,/FICTIONAL SHOWCASE DATA/);
  assert.match(journey,/not an AI inference call/);
  assert.match(journey,/NOT PUBLISHED/);
  assert.doesNotMatch(journey,/post\(["']orders/);
});
test("Sandbox checkout is only routed through the verified sandbox API and not fake data",()=>{
  assert.match(page,/fetch\("\/api\/paypal\/sandbox\/status"/);
  assert.match(page,/sandboxReady\s*=\s*ready\?\.mode\s*===\s*"sandbox"/);
  assert.match(page,/\beq\("status","active"\)/);
  assert.match(page,/post\("orders",\{campaign_id:campaignId,amount_cents:cents\}\)/);
  assert.match(page,/sandbox\.paypal\.com/);
  assert.match(page,/live_payments_enabled\s*===\s*false/);
  assert.match(page,/window\.location\.hostname\.endsWith\("\.interplanetaryfund-migration\.pages\.dev"\)/);
  assert.doesNotMatch(page, /sandboxReady\s*\|\|\s*true/);
});
test("Demo exposes original optional features and sponsor artifacts without permissions bypass",()=>{
  assert.match(page, /id="mission-control"/);
  assert.match(page, /Postman sandbox collection/);
  assert.match(page, /FinanceDataGrid/);
  assert.match(page, /\/create/);
  assert.match(page, /\/agents/);
  assert.match(page, /\/connections/);
  assert.match(page, /\/discover/);
  assert.match(journey, /\[FICTIONAL JUDGE DEMO\]/);
});
