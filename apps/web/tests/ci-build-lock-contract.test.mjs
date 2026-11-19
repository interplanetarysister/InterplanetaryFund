import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = name => readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), "utf8");
const exactManual = source => {
  assert.match(source, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s+(?:push|pull_request):/m);
};
test("web lock verifier cannot write to branches or regenerate its lockfile", () => {
  const source=workflow("update-web-lock");
  exactManual(source);
  assert.match(source,/permissions:\s*\n\s*contents: read/);
  assert.match(source,/persist-credentials: false/);
  assert.match(source,/node-version:\s*['"]?24['"]?/);
  assert.match(source,/npm ci --legacy-peer-deps/);
  assert.match(source,/git -C \.\.\/\.\. diff --exit-code/);
  assert.doesNotMatch(source,/npm install --package-lock-only|git push|git commit|contents: write/);
});
test("current maintenance workflows use manual Node 24 checks and immutable dependencies", () => {
  for (const name of ["migration-phase1-checks","reporter-blog-checks"]) {
    const source=workflow(name);
    exactManual(source);
    assert.match(source,/node-version:\s*['"]?24['"]?/);
    assert.match(source,/npm ci --no-audit --no-fund/);
    assert.doesNotMatch(source,/npm install --package-lock-only|git push/);
  }
});
