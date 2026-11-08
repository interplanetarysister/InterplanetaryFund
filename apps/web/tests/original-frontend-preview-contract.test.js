import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../../.github/workflows/original-frontend-preview.yml", import.meta.url), "utf8");

test("original frontend preview is explicitly dispatched and isolated from production", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule):/m);
  assert.match(workflow, /repository:\s*interplanetarysister\/interplanetary-fund2/);
  assert.match(workflow, /ref:\s*\$\{\{ inputs\.source_ref \}\}/);
  assert.match(workflow, /--branch original-frontend-preview/);
  assert.doesNotMatch(workflow, /--branch (?:main|production)\b/);
});

test("original source provenance and Base44 settings are mandatory", () => {
  assert.match(workflow, /CANONICAL_MAIN_SHA/);
  assert.match(workflow, /VITE_BASE44_APP_BASE_URL/);
  assert.match(workflow, /VITE_BASE44_APP_ID/);
  assert.match(workflow, /source_commit/);
  assert.match(workflow, /base44-preserved/);
  assert.match(workflow, /ifund-source\.json/);
});

test("preview rejects recursive SPA redirects and validates live bundles", () => {
  assert.match(workflow, /test ! -e dist\/_redirects/);
  assert.match(workflow, /test ! -e dist\/404\.html/);
  assert.match(workflow, /\/ifund-source\.json/);
  assert.match(workflow, /content-type:/i);
  assert.match(workflow, /\/assets/);
});
