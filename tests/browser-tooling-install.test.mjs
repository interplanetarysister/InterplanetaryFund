import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

test("stable local Playwright is a pinned development dependency with a synchronized npm lock", () => {
  const version = packageJson.devDependencies.playwright;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.packages[""].devDependencies.playwright, version);
  assert.equal(lock.packages["node_modules/playwright"].version, version);
  assert.equal(lock.packages["node_modules/playwright-core"].version, version);
  assert.equal(lock.packages["node_modules/playwright"].dependencies["playwright-core"], version);
  for (const name of ["playwright", "playwright-core"]) {
    assert.match(lock.packages["node_modules/" + name].integrity, /^sha512-/);
    assert.equal(lock.packages["node_modules/" + name].dev, true);
  }
});

test("browser audits are explicit, do not run on application build or automatically download Chromium", () => {
  assert.match(packageJson.scripts["audit:browser:mobile"], /agent-browser-audit\.mjs --mobile/);
  assert.match(packageJson.scripts["audit:browser:desktop"], /agent-browser-audit\.mjs/);
  assert.equal(packageJson.scripts["setup:browser"], "playwright install chromium");
  assert.equal(packageJson.scripts["test:browser:policy"], "node --test tests/agent-browser-policy.test.mjs");
  assert.doesNotMatch(packageJson.scripts.build, /playwright|chromium/i);
  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.equal(packageJson.scripts.prepare, undefined);
});

test("untrusted browser calls remain read-only and no paid remote browser tools are dependencies", () => {
  const source = readFileSync(new URL("../scripts/agent-browser-policy.mjs", import.meta.url), "utf8");
  assert.match(source, /new Set\(\["GET","HEAD","OPTIONS"\]\)/);
  assert.doesNotMatch(source, /"POST","PUT","PATCH","DELETE"/);
  for (const name of ["@playwright/mcp", "browserbase", "browserless", "puppeteer"]) {
    assert.equal(Object.hasOwn(packageJson.dependencies || {}, name), false);
  }
});
