import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../src/components/agents/AgentSidePanel.jsx", import.meta.url), "utf8");
const identities = readFileSync(new URL("../src/components/agents/AgentIdentityIcon.jsx", import.meta.url), "utf8");

test("persistent agent panel uses every registered identity instead of a stale subset", () => {
  assert.match(panel, /const choices = \[\.\.\.new Set\(Object\.keys\(AGENT_IDENTITIES\)\.map\(frontAgentForSpecialist\)\)\]/);
  assert.match(panel, /choices\.map\(id =>/);
  assert.match(identities, /discover:\s*\{\s*name: "DISCOVER"/);
});
