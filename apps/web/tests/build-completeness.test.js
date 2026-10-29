import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { HISTORICAL_ROUTES } from "../src/lib/historicalRoutes.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const evidence = read("../../../docs/migration/role-platform-evidence.json");

test("all 59 source paths have a single exact independent route contract", () => {
  assert.equal(HISTORICAL_ROUTES.length, 59);
  assert.equal(new Set(HISTORICAL_ROUTES.map(x => x.path)).size, 59);
  assert.deepEqual(new Set(HISTORICAL_ROUTES.map(x => x.path)),
    new Set(evidence.pages.map(x => x.path)));
});
test("source functions, entities, agents, triggers and connectors are fully enumerated", () => {
  assert.equal(read("../../../docs/migration/contracts/entities.json").items.length, 95);
  assert.equal(read("../../../docs/migration/contracts/functions.json").items.length, 184);
  const automation = read("../../../docs/migration/contracts/automations.json");
  assert.equal(automation.agents.length, 10);
  assert.equal(automation.workflows.length, 17);
  assert.equal(automation.connectors.length, 11);
});
test("inventory check is safe without executing any automation or build", () => {
  const output = spawnSync(process.execPath, ["../../scripts/verify-migration-readiness.mjs", "--inventory"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.equal(output.status, 0, output.stdout + output.stderr);
});
test("release gate denies deployment with missing proof", () => {
  const output = spawnSync(process.execPath, ["../../scripts/verify-migration-readiness.mjs", "--release"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.notEqual(output.status, 0);
  assert.match(output.stderr, /not verified|missing|not independently reconciled/);
});
test("the original member/admin paths use verified auth gate", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /RequireAccess/);
  assert.match(app, /HISTORICAL_ROUTES/);
  assert.match(app, /STANDALONE_PENDING/);
  assert.match(app, /LAYOUT_PENDING/);
});

test("the staging type crosswalk records all original field conversions", () => {
  const types = read("../../../docs/migration/contracts/schema-type-crosswalk.json");
  assert.equal(types.static_field_count, 1126);
  assert.equal(types.sql_field_count_matched, 1126);
  assert.equal(types.timestamp_fields.length, 75);
  assert.ok(types.timestamp_fields.every(item => item.roundtrip_verified === false));
});
test("draft management routes require owner verification", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /path="\/mine".*RequireAccess access="member"/);
  assert.match(app, /path="\/edit\/:id".*RequireAccess access="member"/);
  const client = readFileSync(new URL("../src/lib/ownerCampaigns.js", import.meta.url), "utf8");
  assert.match(client, /\.eq\("owner_id", user\.id\)/);
  assert.match(client, /\.eq\("status", "draft"\)/);
});
