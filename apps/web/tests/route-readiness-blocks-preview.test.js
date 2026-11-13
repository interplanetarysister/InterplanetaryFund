import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const repoPath = name => new URL("../../../" + name, import.meta.url);
const webPath = name => new URL("../" + name, import.meta.url);
const acceptance = JSON.parse(readFileSync(webPath("ci/route-acceptance.json"), "utf8"));

test("all declared routes have a single source acceptance entry with explicit evidence", () => {
  assert.equal(acceptance.schema_version, 1);
  const seen = new Set();
  for (const record of acceptance.routes) {
    assert.equal(typeof record.route, "string");
    assert.ok(!seen.has(record.route), "duplicate route: " + record.route);
    seen.add(record.route);
    assert.ok(["not_implemented", "not_verified", "source_ready"].includes(record.source_status),
      "invalid source state for " + record.route);
    if (record.source_status === "source_ready") {
      assert.ok(record.source_evidence?.trim(), "source evidence missing for " + record.route);
      assert.ok(record.behavior_evidence?.trim(), "negative-case test evidence missing for " + record.route);
    }
  }
  assert.ok(seen.has("/oauth/consent") && seen.has("/community/:id") && seen.has("/ai-images"),
    "mapped legacy routes cannot disappear from the acceptance matrix");
});

test("manual Pages workflow runs route acceptance preflight before any npm/build/deploy step", () => {
  const workflow = readFileSync(repoPath(".github/workflows/deploy-web-pages.yml"), "utf8");
  const gate = workflow.indexOf("node apps/web/ci/verify-route-readiness.mjs");
  const install = workflow.indexOf("npm ci --no-audit --no-fund");
  const deploy = workflow.indexOf("pages deploy dist");
  assert.ok(gate >= 0 && install > gate && deploy > install,
    "gate must run before compilation and preview/production deployment");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /apps\/web\/dist\//, "archive the tested asset bundle for later approved promotion");
  assert.match(workflow, /--branch=preview/, "publish only the preview branch");
  assert.doesNotMatch(workflow, /--branch=main/, "production must require a separate evidence-based dispatch");
  assert.doesNotMatch(workflow, /^\s*(push|pull_request):\s*$/m,
    "release pipeline cannot run automatically on a source commit or pull request");
});

test("source preflight fails closed while any route is not independently accepted", () => {
  const result = spawnSync(process.execPath, [webPath("ci/verify-route-readiness.mjs").pathname], {
    encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.error, undefined, result.error?.message || "source preflight did not launch");
  const incomplete = acceptance.routes.some(row =>
    row.source_status !== "source_ready" ||
    !row.source_evidence?.trim() || !row.behavior_evidence?.trim());
  if (incomplete) {
    assert.notEqual(result.status, 0, "unverified routes must block compilation");
    assert.match(result.stderr, /route completion is NOT certified/i);
  } else {
    // When the registry is fully accepted, remaining placeholder/nav gates
    // may still legitimately block release. A pass alone is not browser QA.
    assert.ok([0,1].includes(result.status));
  }
});
