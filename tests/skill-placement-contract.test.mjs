import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const builderPath = ".opencode/skills/ifund-browser-access/SKILL.md";
const memberPath = "docs/agents/skills/browser-access/SKILL.md";
const name = body => body.match(/^---\r?\nname:\s*([^\r\n]+)\r?\n/)?.[1];

test("both strategically located SKILL.md files must remain", () => {
  assert.equal(existsSync(new URL(builderPath, root)), true);
  assert.equal(existsSync(new URL(memberPath, root)), true);
  assert.notEqual(name(read(builderPath)), name(read(memberPath)));
  assert.equal(name(read(builderPath)), "ifund-browser-access");
  assert.equal(name(read(memberPath)), "ifund-agent-browser-research");
});

test("builder runs only pinned, existing read-only browser audit commands", () => {
  const builder = read(builderPath);
  const pkg = JSON.parse(read("package.json"));
  for (const key of ["test:browser:policy","audit:browser:mobile","audit:browser:desktop"]) {
    assert.ok(pkg.scripts[key], "Missing npm script " + key);
    assert.ok(builder.includes("npm run " + key), "Skill references missing npm script " + key);
  }
  assert.equal(pkg.devDependencies.playwright, "1.56.1");
  assert.match(builder, /unauthenticated and read-only/i);
  assert.match(builder, /OpenCode/);
});

test("member research contract is distinct from installed builder and remains unregistered", () => {
  const member = read(memberPath);
  const registry = read("worker/services/tool-registry.js");
  const runtime = read("worker/services/skills/index.js");
  assert.match(member, /not an automatically installed or enabled runtime tool/i);
  assert.match(member, /owner/i);
  assert.match(member, /provider/i);
  assert.match(member, /read-only/i);
  assert.doesNotMatch(registry, /ifund-agent-browser-research/);
  assert.doesNotMatch(runtime, /ifund-agent-browser-research/);
  assert.match(read("AGENTS.md"), /Never delete, merge, move, or overwrite seemingly duplicate files/);
});
