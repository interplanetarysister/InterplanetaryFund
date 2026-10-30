import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
const publish=readFileSync(new URL("../src/lib/campaignPublication.js",import.meta.url),"utf8");

test("owner-only campaign creation loads and edits existing drafts",()=>{
  assert.match(source,/useSearchParams/);
  assert.match(source,/params\.get\("draft"\)/);
  assert.match(source,/\.eq\("owner_id",user\.id\)/);
  assert.match(source,/\.eq\("status","draft"\)/);
  assert.match(source,/persistCampaignContent/);
});
test("draft saving is separate from owner-confirmed content publication",()=>{
  assert.match(source,/save\(null, true\)/);
  assert.match(source,/Save private draft/);
  assert.match(source,/Publish campaign/);
  assert.match(publish,/status:publish\?"active":"draft"/);
  assert.doesNotMatch(publish,/paypal|stripe|capture|donor|external_sync/i);
});
test("campaign fields preserve all original categories and editor limits",()=>{
  assert.match(source,/Object\.entries\(categoryLabels\)/);
  assert.match(source,/maxLength=\{120\}/);
  assert.match(source,/maxLength=\{600\}/);
  assert.match(source,/maxLength=\{15000\}/);
  assert.match(publish,/publish && \(!title \|\| !summary \|\| !story \|\| goal_amount<=0\)/);
});
