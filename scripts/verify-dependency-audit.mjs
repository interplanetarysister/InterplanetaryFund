#!/usr/bin/env node
// Read-only dependency review of the canonical application locks. An npm
// registry error is NOT a clean audit. No dependencies are installed or fixed.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const AUDIT_PROJECTS = Object.freeze([".", "apps/web", "apps/mobile"]);

export function evaluateAuditReport(stdout, status) {
  if (status !== 0 && status !== 1) throw Error("npm audit did not complete");
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw Error("npm audit returned invalid JSON");
  }
  if (
    !report ||
    report.error ||
    report.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    Array.isArray(report.vulnerabilities) ||
    typeof report.vulnerabilities !== "object"
  )
    throw Error("npm audit returned an error or unsupported report");
  const counts = report.metadata?.vulnerabilities;
  const severities = ["info", "low", "moderate", "high", "critical"];
  if (
    !counts ||
    ![...severities, "total"].every(
      (key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0,
    ) ||
    severities.reduce((sum, key) => sum + counts[key], 0) !== counts.total
  )
    throw Error("npm audit vulnerability counts are missing or invalid");
  const blocked = counts.high + counts.critical > 0;
  if (status !== (blocked ? 1 : 0))
    throw Error("npm audit exit status disagrees with its findings");
  return {
    high: counts.high,
    critical: counts.critical,
    total: counts.total,
    blocked,
  };
}

export function auditProjects({
  root = fileURLToPath(new URL("../", import.meta.url)),
  projects = AUDIT_PROJECTS,
  runner = spawnSync,
  hasFile = existsSync,
} = {}) {
  return projects.map((project) => {
    const cwd = resolve(root, project);
    if (!hasFile(join(cwd, "package-lock.json")))
      return { project, error: "A committed package-lock.json is required" };
    const result = runner(
      "npm",
      ["audit", "--omit=dev", "--audit-level=high", "--json"],
      {
        cwd,
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (result.error || result.signal)
      return { project, error: "npm audit could not complete" };
    try {
      return { project, ...evaluateAuditReport(result.stdout, result.status) };
    } catch (error) {
      return { project, error: error.message };
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--web")) {
    console.error("Usage: node scripts/verify-dependency-audit.mjs [--web]");
    process.exitCode = 2;
  } else {
    const results = auditProjects({
      projects:
        args[0] === "--web" ? AUDIT_PROJECTS.slice(0, 2) : AUDIT_PROJECTS,
    });
    for (const result of results) console.log(JSON.stringify(result));
    process.exitCode = results.some((result) => result.error || result.blocked)
      ? 1
      : 0;
  }
}
