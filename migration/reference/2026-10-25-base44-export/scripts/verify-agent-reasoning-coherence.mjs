import assert from "node:assert/strict";
import fs from "node:fs";
const dir = new URL("../base44/agents/", import.meta.url);
const expectedAgents = [
  // admin_builder_agent.jsonc: wired Admin Builder Coordinator (super-admin
  // only, server-side owner allowlist in managePlatformIncidents); added
  // 2026-10-11/12. Kept in the reviewed inventory with the same instruction
  // discipline as the other agents.
  "admin_builder_agent.jsonc",
  "chief_of_staff.jsonc",
  "communications_agent.jsonc",
  "connection_discovery_agent.jsonc",
  "finance_agent.jsonc",
  "growth_agent.jsonc",
  "managed_connection_agent.jsonc",
  "outreach_agent.jsonc",
  "story_agent.jsonc",
  "strategy_agent.jsonc",
];
const files = fs.readdirSync(dir).filter(n => n.endsWith(".jsonc")).sort();
assert.deepEqual(files, expectedAgents,
  "configured agents must match the reviewed nine-agent inventory; the deferred Builder must remain absent");
for (const file of files) {
  const cfg = JSON.parse(fs.readFileSync(new URL(file, dir), "utf8"));
  const i = cfg.instructions || "";
  assert.match(i, /REASONING AND CAPABILITY PRIORITY:/, `${file}: missing reasoning hierarchy`);
  assert.match(i, /ACTION DISCIPLINE:/, `${file}: missing action\/tool distinction`);
  assert.doesNotMatch(i, /Offer to do related tasks for users\. Then do them when accepted\./, `${file}: ambiguous action instruction remains`);
  assert.doesNotMatch(i, /Apply the shared training in docs\//, `${file}: runtime instruction must not depend on inaccessible repo docs`);
  assert.match(i, /Tool and authorization limits define what actions\/data you can actually access, not what concepts you can reason about/, `${file}: capability\/tool distinction missing`);
}
for (const n of ["chief_of_staff.jsonc","communications_agent.jsonc","finance_agent.jsonc","strategy_agent.jsonc"]) {
 const c=JSON.parse(fs.readFileSync(new URL(n,dir),"utf8"));
 assert.ok(c.memory_config?.enabled, `${n}: memory must remain enabled`);
 assert.match(c.memory_config.instructions||"",/Learning expands knowledge and reasoning, never permissions/);
}
console.log("Agent reasoning coherence contract passed for the full configured agent inventory");
