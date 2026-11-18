import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { serviceSkill } from "../worker/services/skills/index.js";

async function assertModuleMatchesJson(jsonPath, modulePath) {
  const expected = JSON.parse(await readFile(new URL(jsonPath, import.meta.url), "utf8"));
  const actual = (await import(modulePath)).default;
  assert.deepEqual(actual, expected);
}

test("Pages-compatible provider catalog module matches the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/connections/provider-catalog.json", "../worker/connections/provider-catalog.js");
});

test("Pages-compatible agent position contracts match the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/services/position-contracts.json", "../worker/services/position-contracts.js");
});

test("Pages-compatible skills manifest matches the canonical JSON data", async () => {
  await assertModuleMatchesJson("../worker/services/skills/manifest.json", "../worker/services/skills/manifest.js");
});

test("runtime agent instructions are bound to current IFund policies, not legacy backend routes", async () => {
  const positions = JSON.parse(await readFile(new URL("../worker/services/position-contracts.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../worker/services/skills/manifest.json", import.meta.url), "utf8"));
  for (const position of positions.positions) {
    const digest = createHash("sha256").update(position.instructions, "utf8").digest("hex");
    const entry = manifest.agents.find(agent => agent.agent === position.id);
    assert.ok(entry, "missing skill manifest for " + position.id);
    assert.equal(position.policy_sha256, digest, "stale policy hash for " + position.id);
    assert.equal(entry.policy_sha256, digest, "manifest policy hash mismatch for " + position.id);
    assert.doesNotMatch(position.instructions, /base44/i, "legacy backend instructions remain for " + position.id);
    for (const tool of position.tools || []) assert.doesNotMatch(tool.description || "", /base44/i, "legacy tool description remains for " + position.id);
    assert.equal(serviceSkill(position.id).instructions, position.instructions);
  }
});
