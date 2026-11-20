import test from "node:test";
import assert from "node:assert/strict";
import {
  auditProjects,
  evaluateAuditReport,
  AUDIT_PROJECTS,
} from "../scripts/verify-dependency-audit.mjs";
import {join, resolve} from "node:path";

const report = (findings = {}) =>
  JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        total: 0,
        ...findings,
      },
    },
  });

test("completed audit distinguishes lower severity findings from release blockers", () => {
  assert.deepEqual(evaluateAuditReport(report({ moderate: 2, total: 2 }), 0), {
    high: 0,
    critical: 0,
    total: 2,
    blocked: false,
  });
  assert.deepEqual(
    evaluateAuditReport(report({ critical: 1, high: 2, total: 3 }), 1),
    { high: 2, critical: 1, total: 3, blocked: true },
  );
});

test("registry errors and incomplete audit reports never mean zero vulnerabilities", () => {
  for (const body of [
    "",
    "not JSON",
    "null",
    "{}",
    '{"error":{"code":"ENOTFOUND"}}',
    JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {},
      metadata: {},
    }),
    JSON.stringify({
      error: { code: "EAUDITNOLOCK" },
      ...JSON.parse(report()),
    }),
  ])
    assert.throws(() => evaluateAuditReport(body, 0));
  for (const invalid of [-1, null, "0", 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => evaluateAuditReport(report({ high: invalid }), 0));
  assert.throws(() => evaluateAuditReport(report({ high: 1, total: 0 }), 1));
  assert.throws(() => evaluateAuditReport(report(), 1));
  assert.throws(() => evaluateAuditReport(report({ high: 1, total: 1 }), 0));
  assert.throws(() => evaluateAuditReport(report(), null));
});

test("each canonical lock is audited independently and failures do not skip later projects", () => {
  // auditProjects resolves the project paths, so expectations must be built
  // the same way; "/example" is absolute, so this is identical on POSIX.
  const root = resolve("/example");
  const calls = [];
  const results = auditProjects({
    root,
    hasFile: () => true,
    runner: (command, args, options) => {
      calls.push({ command, args, ...options });
      return options.cwd === join(root, "apps/web")
        ? { error: Error("timeout"), status: null }
        : { stdout: report(), status: 0 };
    },
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => call.cwd),
    [root, join(root, "apps/web"), join(root, "apps/mobile")],
  );
  assert.ok(
    calls.every(
      (call) => call.command === "npm" && call.args.includes("--omit=dev"),
    ),
  );
  assert.ok(results[1].error);
  assert.equal(results[2].blocked, false);
  assert.deepEqual(
    results.map((result) => result.project),
    [...AUDIT_PROJECTS],
  );
});

test("a missing lock or terminated audit cannot receive a passing verdict", () => {
  const missing = auditProjects({
    hasFile: () => false,
    runner: () => assert.fail("no unlocked audit"),
  });
  assert.ok(missing.every((result) => result.error));
  const terminated = auditProjects({
    hasFile: () => true,
    runner: () => ({ signal: "SIGTERM", stdout: report(), status: 0 }),
  });
  assert.ok(terminated.every((result) => result.error));
});
