import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = (name) => readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), "utf8");
const manualOnly = (source) => {
  assert.match(source, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s+(?:push|pull_request):/m);
};
const node24 = (source) => {
  assert.match(source, /node-version:\s*['"]?24['"]?/);
  assert.doesNotMatch(source, /node-version:\s*['"]?(?:18|20|22)['"]?/);
};
test("native acceptance must build the requested exact commit, never an old hardcoded SHA", () => {
  const source = workflow("ifund-native-acceptance-20261115");
  manualOnly(source);
  node24(source);
  assert.equal((source.match(/uses: actions\/checkout@v4/g) || []).length, 2);
  assert.equal((source.match(/persist-credentials: false/g) || []).length, 2);
  assert.doesNotMatch(source, /^\s+ref:\s*[a-f0-9]{40}\s*$/m);
  assert.doesNotMatch(source, /npm install --package-lock-only/);
  assert.match(source, /npm run test:mobile/);
  assert.match(source, /npm run build:mobile/);
});
for (const platform of ["android", "ios"]) {
  test(`unsigned ${platform} candidate uses locked dependencies and Node 24`, () => {
    const source = workflow(`ifund-native-${platform}`);
    manualOnly(source);
    node24(source);
    assert.doesNotMatch(source, /npm install --package-lock-only/);
    assert.match(source, /npm ci --legacy-peer-deps/);
    assert.match(source, /npm run test:mobile/);
    assert.match(source, /npm run build:mobile/);
    assert.match(source, /com\.interplanetaryfund\.app/);
  });
  test(`signed ${platform} candidate retains owner-controlled release gate`, () => {
    const source = workflow(`ifund-native-${platform}-signed`);
    manualOnly(source);
    node24(source);
    assert.match(source, /environment: native-store-release/);
    assert.match(source, /verify-mobile\.mjs --store/);
    assert.match(source, /npm ci --legacy-peer-deps/);
    assert.doesNotMatch(source, /npm install --package-lock-only/);
  });
}

test("retired native lockfile workflow only verifies exact-head dependencies", () => {
  const source = workflow("ifund-native-refresh-lock");
  manualOnly(source);
  node24(source);
  assert.match(source, /permissions:\s*\n\s*contents: read/);
  assert.match(source, /persist-credentials: false/);
  assert.doesNotMatch(source, /\bcontents: write\b/);
  assert.doesNotMatch(source, /git push|git commit|npm install --package-lock-only/);
  assert.doesNotMatch(source, /^\s+ref:\s*(?:feature\/|[a-f0-9]{40})/m);
  assert.match(source, /npm ci --legacy-peer-deps --ignore-scripts/);
  assert.match(source, /git -C \.\.\/\.\. diff --exit-code/);
});

test("manual Pages release and source security QA use Node 24", () => {
  for (const name of [
    "deploy-web-pages",
    "frontend-main-build",
    "ifund-document-security-tests",
    "ifund-continuous-repair-qa",
    "ifund-payment-reconciliation",
    "ifund-atlas-source-tests",
    "ifund-native-associations",
    "main-release-candidate-checks",
  ]) {
    const source = workflow(name);
    node24(source);
    manualOnly(source);
  }
});
