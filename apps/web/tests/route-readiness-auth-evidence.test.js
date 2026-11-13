import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Exercise the actual release gate against isolated route-inventory fixtures.
// Never alter production acceptance entries to manufacture a passing result.
const gate = readFileSync(new URL("../ci/verify-route-readiness.mjs", import.meta.url), "utf8");
const accepted = (route, role, backend_evidence = "tests/negative-authorization.test.js") => ({
  route, role, component: "FixturePage", source_status: "source_ready",
  source_evidence: "src/App.jsx", behavior_evidence: "tests/negative-authorization.test.js",
  backend_evidence,
});
function evaluate(modify = rows => rows) {
  const workspace = mkdtempSync(join(tmpdir(), "ifund-route-auth-"));
  try {
    mkdirSync(join(workspace, "ci"));
    mkdirSync(join(workspace, "src", "components"), { recursive: true });
    writeFileSync(join(workspace, "ci", "verify-route-readiness.mjs"), gate);
    writeFileSync(join(workspace, "src", "App.jsx"), [
      "const STANDALONE_COMING_SOON = [];",
      "const LAYOUT_COMING_SOON = [];",
      '<Route path="/" element={<Home />} />',
      '<Route path="/admin/audit" element={<Audit />} />',
      '<Route path="/devices" element={<Devices />} />',
      '<Route path="/ops" element={<Ops />} />',
    ].join("\n"));
    writeFileSync(join(workspace, "src", "components", "Layout.jsx"),
      'const nav = [{ to: "/admin/audit" }, { to: "/devices" }, { to: "/ops" }];');
    const rows = [
      accepted("/", "public", ""),
      accepted("/admin/audit", "admin"),
      accepted("/devices", "member"),
      accepted("/ops", "super_admin"),
    ];
    writeFileSync(join(workspace, "ci", "route-acceptance.json"), JSON.stringify({
      schema_version: 1, routes: modify(rows),
    }));
    return spawnSync(process.execPath, [join(workspace, "ci", "verify-route-readiness.mjs")], {
      encoding: "utf8", timeout: 5000,
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

test("public routes need no auth backend evidence; guarded roles do", () => {
  const result = evaluate();
  assert.equal(result.status, 0, result.stderr);
});
for (const role of ["member", "admin", "super_admin"]) {
  test("missing " + role + " backend evidence blocks source preflight", () => {
    const result = evaluate(rows => rows.map(row => row.role === role ? {
      ...row, backend_evidence: "",
    } : row));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing backend authorization evidence:/);
  });
}
test("unknown route roles cannot bypass protected-route checks", () => {
  const result = evaluate(rows => rows.map(row => row.role === "admin" ? {
    ...row, role: "superuser",
  } : row));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid route role: \/admin\/audit/);
});
test("unverified and invented source states both block preview", () => {
  for (const state of ["not_verified", "pretend_ready"]) {
    const result = evaluate(rows => rows.map(row => row.route === "/devices" ? {
      ...row, source_status: state,
    } : row));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing source and test acceptance: \/devices/);
  }
});
