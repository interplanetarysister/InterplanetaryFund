import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { allServicePositions, serviceCatalog, servicePosition } from "../worker/services/catalog.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const exists = (path) => existsSync(new URL(path, root));

test("phase-1 matrix does not contradict the canonical service registry", () => {
  const matrix = read("docs/agents/AGENT_INTEGRATION_MATRIX_PHASE1_20261121.md");

  assert.equal(allServicePositions().length, 10);
  assert.equal(serviceCatalog().length, 9);
  assert.equal(servicePosition("managed_connection_agent").min_plan_level, 2);
  assert.equal(servicePosition("admin_builder_agent").min_plan_level, null);

  assert.doesNotMatch(matrix, /nine contracts with `min_plan_level: 1`/);
  assert.match(matrix, /ten preserved contracts \/ nine selectable positions/i);
});

test("phase-1 matrix preserves required historical contracts without stale absence claims", () => {
  const matrix = read("docs/agents/AGENT_INTEGRATION_MATRIX_PHASE1_20261121.md");

  assert.doesNotMatch(matrix, /are \*\*not present\*\* in this tree/);
  assert.doesNotMatch(matrix, /per-agent inference verified only where listed in §2\.3/);
  assert.doesNotMatch(matrix, /033000 before 034000/);
  assert.doesNotMatch(matrix, /\| OAuth refresh flows \|/);
  assert.match(matrix, /current reconciliation baseline/i);
  assert.match(matrix, /historical Phase 1 evidence/i);
  assert.match(matrix, /20261120114500_ifund_agent_operations_room\.sql/);
  assert.match(matrix, /20261120124500_ifund_agent_room_background_runtime\.sql/);
  assert.match(matrix, /IFUND_MODEL_LOCAL` is only an optional source\/test adapter/i);
  assert.match(matrix, /provider-verified OAuth refresh acceptance/i);

  for (const path of [
    "docs/operations/IFUND_STANDING_OWNER_RULES_20261120.md",
    "docs/operations/HISTORICAL_FILE_RESTORATION_AUDIT_20261120.md",
    "supabase/migrations/20261120114500_ifund_agent_operations_room.sql",
    "supabase/migrations/20261120124500_ifund_agent_room_background_runtime.sql",
    "supabase/migrations/20261120034000_ifund_guard_public_revocation.sql",
    "tests/skill-placement-contract.test.mjs",
  ]) {
    assert.equal(exists(path), true, `Missing required current-source file: ${path}`);
  }
});

test("current reconciliation evidence and tested commit hashes are preserved", () => {
  const matrix = read("docs/agents/AGENT_INTEGRATION_MATRIX_PHASE1_20261121.md");

  assert.match(matrix, /0e7b147d6932378cdbe95e3120088bf9e69e1990/);
  assert.match(matrix, /351a5005fec3fb04916b9b554deca565cfb54f3b/);
  assert.match(matrix, /1039\/1039 pass, 0 fail, 0 skipped/);
  assert.match(matrix, /1104\/1104 pass, 0 fail, 0 skipped/);
  assert.match(matrix, /inference_completed:true/);
  assert.match(matrix, /BLOCKED \/ UNVERIFIED/);
  assert.match(matrix, /public\.ifund_creator_mandate_ai_authorized/);
  assert.match(matrix, /`provider_verified:true` overstated/);
  assert.match(matrix, /Return `inference_completed:true`/);
  assert.doesNotMatch(matrix, /\|\s*Risk\s*\|/);
  assert.match(matrix, /\| Risk classification \| Next implementation priority \|/);
});

test("strategically duplicated skill and manifest contracts remain separate and protected", () => {
  const skillPlacement = read("tests/skill-placement-contract.test.mjs");
  const parity = read("tests/json-data-module-parity.test.js");

  assert.match(skillPlacement, /ifund-browser-access\/SKILL\.md/);
  assert.match(skillPlacement, /ifund-agent-browser-research/);
  assert.match(parity, /position-contracts\.json/);
  assert.equal(exists(".opencode/skills/ifund-browser-access/SKILL.md"), true);
  assert.equal(exists("docs/agents/skills/browser-access/SKILL.md"), true);
  assert.equal(exists("worker/services/position-contracts.js"), true);
  assert.equal(exists("worker/services/position-contracts.json"), true);
});
