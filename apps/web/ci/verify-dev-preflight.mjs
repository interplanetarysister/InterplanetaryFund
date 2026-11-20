#!/usr/bin/env node
/**
 * Isolated development preflight. This DOES NOT replace verify-route-readiness.mjs.
 * It validates source manifest integrity and essential source-to-route wiring
 * without asserting that all historical routes are release-ready.
 *
 * Example: node apps/web/ci/verify-dev-preflight.mjs
 */
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const problems = [];
let app = "", layout = "", register;
let loaded = false;
try {
  app = read("src/App.jsx");
  layout = read("src/components/Layout.jsx");
  register = JSON.parse(read("ci/route-acceptance.json"));
  loaded = true;
} catch (error) {
  problems.push("Unreadable source or route inventory: " + error.message);
}
if (loaded) {
  if (!register || typeof register !== "object" || Array.isArray(register) || register.schema_version !== 1 || !Array.isArray(register.routes))
    problems.push("Unsupported route acceptance schema");
  else {
    const seen = new Set();
    const roles = new Set(["public", "member", "admin", "super_admin"]);
    const states = new Set(["not_implemented", "not_verified", "source_ready"]);
    const declared = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]));
    const placeholders = new Set();
    const nav = new Set([...layout.matchAll(/\{\s*to:\s*"(\/[^"]+)"/g)].map(m => m[1]));
    for (const row of register.routes) {
      if (!row || typeof row.route !== "string" || !row.route) {
        problems.push("Invalid route entry");
        continue;
      }
      if (seen.has(row.route)) problems.push("Duplicate route: " + row.route);
      seen.add(row.route);
      if (!roles.has(row.role)) problems.push("Invalid role for " + row.route);
      if (!states.has(row.source_status)) problems.push("Invalid source status for " + row.route);
      // Release evidence remains checked by verify-route-readiness.mjs.
      if (row.source_status === "source_ready" &&
          (typeof row.source_evidence !== "string" || !row.source_evidence.trim() ||
          typeof row.behavior_evidence !== "string" || !row.behavior_evidence.trim() ||
          (row.role !== "public" && (typeof row.backend_evidence !== "string" || !row.backend_evidence.trim()))))
        problems.push("Invalid claimed source readiness: " + row.route);
    }
    for (const route of declared) if (!seen.has(route)) problems.push("Untracked source route: " + route);
    for (const route of nav) if (!declared.has(route)) problems.push("Unmapped navigation route: " + route);
    for (const key of ["STANDALONE_COMING_SOON", "LAYOUT_COMING_SOON"]) {
      const block = app.match(new RegExp("const\\s+" + key + "\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;"));
      if (!block) problems.push("Missing placeholder inventory: " + key);
      else for (const m of block[1].matchAll(/["'](\/[^"']+)["']/g)) {
        placeholders.add(m[1]);
        if (!seen.has(m[1])) problems.push("Untracked placeholder route: " + m[1]);
      }
    }
    for (const route of seen) if (!declared.has(route) && !placeholders.has(route)) problems.push("Stale tracked route: " + route);
    process.stdout.write("Development manifest inventory: " + seen.size +
      " tracked routes; " + [...register.routes].filter(r => r.source_status === "source_ready").length +
      " source_ready. Other routes remain unverified for release.\n");
  }
}
if (problems.length) {
  process.stderr.write("DEV ONLY — NOT RELEASE CERTIFIED: preflight FAILED\n" +
    problems.map(x => " - " + x).join("\n") + "\n");
  process.exitCode = 1;
} else {
  process.stdout.write("DEV ONLY — NOT RELEASE CERTIFIED: manifest/source wiring passed. " +
    "Run full release gate, RLS, financial and authenticated browser acceptance before promotion.\n");
}
