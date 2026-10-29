#!/usr/bin/env node
// Source-completeness and independent release gate. No network or mutations.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HISTORICAL_ROUTES } from "../apps/web/src/lib/historicalRoutes.js";

const root = new URL("../", import.meta.url);
const load = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const evidence = load("docs/migration/role-platform-evidence.json");
const entities = load("docs/migration/contracts/entities.json");
const functions = load("docs/migration/contracts/functions.json");
const automations = load("docs/migration/contracts/automations.json");
const launch = load("docs/migration/contracts/launch-evidence.json");
const app = readFileSync(new URL("apps/web/src/App.jsx", root), "utf8");
const errors = [];

function unique(items, key, expected, label) {
  if (!Array.isArray(items) || items.length !== expected) {
    errors.push(label + " count must be exactly " + expected);
    return;
  }
  if (new Set(items.map(item => item?.[key])).size !== expected ||
      items.some(item => !item?.[key])) errors.push(label + " has missing or duplicate identifiers");
}
unique(evidence.pages, "path", 59, "Historical routes");
unique(HISTORICAL_ROUTES, "path", 59, "Web route registry");
unique(entities.items, "name", 95, "Entity contracts");
unique(functions.items, "name", 184, "Function contracts");
unique(automations.agents, "name", 10, "AI agent contracts");
unique(automations.workflows, "name", 17, "Workflow contracts");
unique(automations.connectors, "name", 11, "Connector contracts");

const registered = new Map(HISTORICAL_ROUTES.map(page => [page.path, page]));
for (const page of evidence.pages) {
  const web = registered.get(page.path);
  if (!web || web.access !== page.access || web.source_component !== page.source_component)
    errors.push("Route registration mismatches original source: " + page.path);
}
for (const p of ["HISTORICAL_ROUTES","STANDALONE_PENDING","LAYOUT_PENDING","RequireAccess"]) {
  if (!app.includes(p)) errors.push("Web router is not enforcing " + p);
}
if (!app.includes("/embed/campaign/:id") || !app.includes("/download"))
  errors.push("Recovered embed/download routes are not mounted");

const production = process.argv.includes("--release") ||
  (process.argv.includes("--build") && (
    process.env.IFUND_RELEASE_MODE === "production" ||
    process.env.CF_PAGES_BRANCH === "main"
  ));

if (production) {
  const screens = ["desktop_light","desktop_dark","tablet_light","tablet_dark",
    "mobile_light","mobile_dark","android_light","android_dark"];
  const roles = ["visitor","member","admin","super_admin"];
  for (const page of evidence.pages) {
    if (page.release_status !== "verified") errors.push(page.path + ": full parity not verified");
    for (const s of screens) if (!page.proof?.visual?.[s]) errors.push(page.path + ": missing " + s);
    for (const role of roles) if (!page.proof?.role_matrix?.[role])
      errors.push(page.path + ": missing access proof for " + role);
    for (const field of ["functional","persistence","source_assets","reviewer_approval"])
      if (!page.proof?.[field]) errors.push(page.path + ": missing " + field + " proof");
  }
  for (const e of entities.items) if (!e.migration_table || !e.rls_verified ||
      !e.fields_verified || !e.read_write_verified || !e.data_verified)
    errors.push("Entity not independently reconciled: " + e.name);
  for (const f of functions.items) if (!(f.retired_by_owner ||
      (f.target_handler && f.caller_map_verified && f.authorization_verified &&
       f.side_effects_verified && f.integration_tests_verified)))
    errors.push("Backend handler not ported/approved for retirement: " + f.name);
  for (const a of automations.agents) if (!a.executor || !a.tools_authorized ||
      !a.audit_verified || !a.live_verified) errors.push("Agent not verified: " + a.name);
  for (const w of automations.workflows) if (!w.trusted_trigger || !w.handler ||
      !w.idempotency_verified || !w.consent_verified || !w.live_verified)
    errors.push("Workflow trigger/executor not verified: " + w.name);
  for (const c of automations.connectors) if (!c.provider_grant ||
      !c.credential_vault_verified || !c.live_verified)
    errors.push("Connector not verified: " + c.name);
  for (const gate of launch.gates) if (gate.verified !== true || !gate.evidence)
    errors.push("Launch gate not verified: " + gate.name);
}
const mode = production ? "PRODUCTION RELEASE" : "INVENTORY-ONLY";
console.log("IFund " + mode + ": 59 routes, 95 entities, 184 functions, 10 agents, 17 workflows, 11 connectors.");
if (errors.length) {
  console.error(errors.slice(0,30).join("\n"));
  if (errors.length > 30) console.error("... " + (errors.length - 30) + " further failed checks");
  process.exitCode = 1;
} else {
  console.log(production ? "Production evidence complete." :
    "Inventory consistent. This is NOT permission to deploy or proof of runtime feature parity.");
}
