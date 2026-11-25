#!/usr/bin/env node
// Deliberately local-only. This script NEVER calls a deployment API or pushes code.
// Any unavailable command, failed test or missing dependency blocks the release.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checks = [
  { label: "Root unit/security/integration tests", cwd: root, args: ["test"] },
  { label: "Scoped release contract tests", cwd: root, args: ["run", "test:release"] },
  { label: "Release dependency and authorization audit", cwd: root, args: ["run", "audit:release"] },
  { label: "Web complete regression suite", cwd: resolve(root, "apps/web"), args: ["test"] },
  { label: "Web production compilation (local only)", cwd: resolve(root, "apps/web"), args: ["run", "build"] },
  { label: "Root production compilation (local only)", cwd: root, args: ["run", "build"] },
];
for (const check of checks) {
  process.stdout.write("\n[PREFLIGHT] " + check.label + "\n");
  const result = spawnSync("npm", check.args, { cwd: check.cwd, stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (result.error || result.status !== 0) {
    console.error("\n[BLOCKED] " + check.label + " failed. Production deployment is prohibited.");
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }
}
console.log("\n[PREFLIGHT PASS] All configured local checks passed. This is NOT browser, provider, payment, security penetration, or production verification. A separate human-reviewed release decision is still required.");
