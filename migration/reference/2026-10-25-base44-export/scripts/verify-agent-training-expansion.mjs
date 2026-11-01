import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const dir = new URL("../base44/agents/", import.meta.url);
const files = fs.readdirSync(dir).filter((name) => name.endsWith(".jsonc"));
assert.ok(files.length >= 7, "expected the configured user-tier specialist agent team");
for (const file of files) {
  const config = JSON.parse(fs.readFileSync(new URL(file, dir), "utf8"));
  assert.match(config.instructions || "", /TRAINING EXPANSION:/, `${file} must include expanded training`);
  assert.match(config.instructions || "", /specialty is an area of depth, not a boundary on knowledge/i, `${file} must keep specialty additive rather than restrictive`);
  assert.ok(Array.isArray(config.tool_configs), `${file} must retain its tool configuration`);
}
const core = fs.readFileSync(new URL("../docs/AGENT_TRAINING_CORE.md", import.meta.url), "utf8");
assert.match(core, /Continuous learning/);
assert.match(core, /Domain expansion/);
assert.match(core, /must not artificially narrow/i);
console.log(`Agent training expansion contract passed for ${files.length} agents`);
