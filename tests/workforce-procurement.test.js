import test from "node:test";
import assert from "node:assert/strict";
import { procureTeam } from "../worker/workforce/procurement.js";
import { serviceCatalog, servicePosition } from "../worker/services/catalog.js";

const now = Date.parse("2026-11-04T12:00:00Z");
const implementation = (changes = {}) => ({
  id: "tested-writer-v1",
  revision: "1",
  provider: "cloudflare",
  adapter: "workers_ai",
  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  registered: true,
  available: true,
  tested: true,
  assigned_positions: ["story_agent"],
  capabilities: ["story.draft.v1", "story.section.v1"],
  tested_capabilities: ["story.draft.v1", "story.section.v1"],
  permissions: ["owner_context"],
  security: "supabase_owner_scoped_v1",
  max_complexity: 2,
  max_input_bytes: 24000,
  max_output_tokens: 2200,
  cost: {
    verified: true,
    expires_at: "2026-11-11T00:00:00Z",
    additional_cost: 0,
    trial: false,
    hard_stop: true,
    evidence: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  },
  evaluation: {
    revision: "1",
    passed: true,
    evidence: "reviewed-contract-test",
    expires_at: "2026-11-11T00:00:00Z",
  },
  reliability: 0.9,
  quality: 0.9,
  latency_ms: 100,
  estimated_units: 1200,
  ...changes,
});
const task = {
  position_id: "story_agent",
  capabilities: ["story.draft.v1"],
  allowed_permissions: ["owner_context"],
  required_permissions: ["owner_context"],
  complexity: 2,
  input_bytes: 4000,
  max_output_tokens: 2200,
  remaining_units: 5000,
};

test("keeps all nine established positions and the separate private builder", () => {
  assert.deepEqual(
    serviceCatalog().map((p) => [p.id, p.title]),
    [
      ["chief_of_staff", "Chief of Staff"],
      ["strategy_agent", "Strategy"],
      ["growth_agent", "Growth"],
      ["communications_agent", "Communications"],
      ["story_agent", "Story"],
      ["finance_agent", "Finance"],
      ["outreach_agent", "Outreach"],
      ["connection_discovery_agent", "Discovery"],
      ["managed_connection_agent", "Managed Connections"],
    ],
  );
  assert.equal(servicePosition("admin_builder_agent").selectable, false);
  assert.equal(servicePosition("story_agent").id, "story_agent");
  assert.equal(servicePosition("invented_employee"), null);
  assert.ok(
    servicePosition("story_agent").contract_sha256.match(/^[a-f0-9]{64}$/),
  );
});

test("registered, available, tested and assigned are independently required", () => {
  for (const candidate of [
    implementation({ registered: false }),
    implementation({ available: false }),
    implementation({ tested: false }),
    implementation({ assigned_positions: [] }),
    implementation({ tested_capabilities: [] }),
    implementation({ revision: "2" }),
    implementation({
      evaluation: {
        passed: true,
        revision: "1",
        evidence: "",
        expires_at: "2026-11-11",
      },
    }),
  ]) {
    assert.equal(procureTeam(task, [candidate], { now }).state, "unavailable");
  }
});

test("never uses paid, trial, expired, unknown cost or unbounded capacity", () => {
  for (const cost of [
    { additional_cost: 1 },
    { trial: true },
    { verified: false },
    { hard_stop: false },
    { expires_at: "2026-11-01" },
    { expires_at: null },
    { evidence: "" },
  ]) {
    assert.equal(
      procureTeam(
        task,
        [implementation({ cost: { ...implementation().cost, ...cost } })],
        { now },
      ).state,
      "unavailable",
    );
  }
  assert.equal(
    procureTeam({ ...task, remaining_units: NaN }, [implementation()], { now })
      .state,
    "unavailable",
  );
  assert.equal(
    procureTeam({ ...task, remaining_units: 0 }, [implementation()], { now })
      .state,
    "capacity",
  );
});

test("replacement must pass the exact task contract, security and permissions", () => {
  const invalid = [
    implementation({ security: "other" }),
    implementation({ permissions: ["all_users"] }),
    implementation({ permissions: [] }),
    implementation({ max_complexity: 1 }),
    implementation({ max_input_bytes: 100 }),
    implementation({ max_output_tokens: 100 }),
    implementation({
      evaluation: { ...implementation().evaluation, expires_at: "2026-11-01" },
    }),
  ];
  assert.equal(procureTeam(task, invalid, { now }).state, "unavailable");
  const replacement = implementation({ id: "replacement-v2", quality: 0.95 });
  assert.equal(
    procureTeam(task, [implementation({ available: false }), replacement], {
      now,
    }).members[0].id,
    "replacement-v2",
  );
});

test("combines only tested capabilities within a bounded team and total budget", () => {
  const a = implementation({
    id: "a",
    capabilities: ["research.v1"],
    tested_capabilities: ["research.v1"],
    estimated_units: 400,
  });
  const b = implementation({
    id: "b",
    capabilities: ["writing.v1"],
    tested_capabilities: ["writing.v1"],
    estimated_units: 600,
  });
  const complex = { ...task, capabilities: ["research.v1", "writing.v1"] };
  assert.deepEqual(
    procureTeam(complex, [a, b], { now }).members.map((m) => m.id),
    ["a", "b"],
  );
  assert.equal(
    procureTeam(complex, [a, b], { now, max_members: 1 }).state,
    "unavailable",
  );
  assert.equal(
    procureTeam({ ...complex, remaining_units: 999 }, [a, b], { now }).state,
    "capacity",
  );
  assert.equal(
    procureTeam(complex, [a, { ...b, id: "a" }], { now }).state,
    "unavailable",
  );
});

test("selects by evidence-based quality and reliability with deterministic tie breaking", () => {
  const lower = implementation({ id: "lower", quality: 0.5, reliability: 0.5 });
  const best = implementation({ id: "best", quality: 1, reliability: 1 });
  assert.equal(procureTeam(task, [lower, best], { now }).members[0].id, "best");
  assert.deepEqual(
    procureTeam(task, [best, lower], { now }),
    procureTeam(task, [lower, best], { now }),
  );
});

test("a lower-ranked required specialist is retained when stronger candidates cover only the same skill", () => {
  const copies = Array.from({ length: 25 }, (_, i) =>
    implementation({
      id: "research_" + i,
      capabilities: ["research.v1"],
      tested_capabilities: ["research.v1"],
    }),
  );
  const writer = implementation({
    id: "writer",
    quality: 0.5,
    capabilities: ["writing.v1"],
    tested_capabilities: ["writing.v1"],
  });
  const result = procureTeam(
    { ...task, capabilities: ["research.v1", "writing.v1"] },
    [...copies, writer],
    { now },
  );
  assert.equal(result.state, "selected");
  assert.ok(result.members.some((m) => m.id === "writer"));
});
