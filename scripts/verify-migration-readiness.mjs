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
const android = load("docs/migration/contracts/android.json");
const schemaTypes = load("docs/migration/contracts/schema-type-crosswalk.json");
const dataMigration = load("docs/migration/contracts/data-migration-checkpoint.json");
const authEvidence = load("docs/migration/contracts/auth-verification.json");
const legalEvidence = load("docs/migration/contracts/legal-acceptance-evidence.json");
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
if (schemaTypes.static_field_count !== 1126 || schemaTypes.sql_field_count_matched !== 1126 ||
    schemaTypes.timestamp_fields?.length !== 75)
  errors.push("Source-to-SQL field type crosswalk incomplete or unexpectedly changed");
unique(functions.items, "name", 184, "Function contracts");
unique(automations.agents, "name", 10, "AI agent contracts");
unique(automations.workflows, "name", 17, "Workflow contracts");
unique(automations.connectors, "name", 11, "Connector contracts");
const triggerKinds = automations.workflows.reduce((acc, item) => {
  const kind = item.source_trigger_spec?.type;
  acc[kind] = (acc[kind] || 0) + 1;
  if (!item.all_source_handlers_in_inventory) errors.push("Missing historical handler mapping: " + item.name);
  return acc;
}, {});
if (triggerKinds.scheduled !== 11 || triggerKinds.entity !== 6)
  errors.push("Historical schedule and entity-event trigger counts do not match 11/6");
if (!Array.isArray(launch.gates) || launch.gates.length < 19)
  errors.push("Required comprehensive launch goals are missing");


const registered = new Map(HISTORICAL_ROUTES.map(page => [page.path, page]));
const knownFunctions = new Set(functions.items.map(item=>item.name));
const knownEntities = new Set(entities.items.map(item=>item.name));
for (const page of evidence.pages) {
  if (!page.source_static_dependencies?.source_page_file)
    errors.push("Original page dependency mapping missing: " + page.path);
  for (const handler of page.source_static_dependencies?.functions || [])
    if (!knownFunctions.has(handler)) errors.push(page.path + ": unknown source backend function " + handler);
  for (const entity of page.source_static_dependencies?.entities || [])
    if (!knownEntities.has(entity)) errors.push(page.path + ": unknown source entity " + entity);
}
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

// A missing or mislabeled Cloudflare branch variable must never bypass
// production evidence checks. Every build is blocked until all gates pass.
// For inventory-only development use --inventory without compiling the app.
const production = process.argv.includes("--release") || process.argv.includes("--build");

if (production) {
  for (const [name,value] of Object.entries(authEvidence.provider_configuration)) {
    if (name.endsWith("_verified") && value !== true)
      errors.push("Auth provider configuration missing: " + name);
  }
  for (const [name,value] of Object.entries(authEvidence.real_world_qa)) {
    if (value !== true)
      errors.push("First signup/login verification missing: " + name);
  }
  for (const [name,value] of Object.entries(legalEvidence.proof_requirements)) {
    if (value !== true)
      errors.push("Versioned account legal acceptance unverified: " + name);
  }
  if (dataMigration.owner_identity_match_verified !== true ||
      dataMigration.all_source_campaigns_accounted_for !== true ||
      dataMigration.source_ledger_integrity_verified !== true ||
      dataMigration.stage_to_runtime_import_approved !== true)
    errors.push("Historical campaign ownership and ledger reconciliation incomplete; no production cutover.");
  const screens = ["desktop_light","desktop_dark","tablet_light","tablet_dark",
    "mobile_light","mobile_dark","android_light","android_dark"];
  const roles = ["visitor","member","admin","super_admin"];
  for (const page of evidence.pages) {
    if (page.current_state !== "implemented_full") errors.push(page.path + ": feature implementation still partial/placeholder");
    if (page.source_backend_calls_verified !== true || page.source_ui_parity_verified !== true)
      errors.push(page.path + ": original page's backend and UI dependency proof missing");
    if (page.release_status !== "verified") errors.push(page.path + ": full parity not verified");
    for (const s of screens) if (!page.proof?.visual?.[s]) errors.push(page.path + ": missing " + s);
    for (const role of roles) if (!page.proof?.role_matrix?.[role])
      errors.push(page.path + ": missing access proof for " + role);
    for (const field of ["functional","persistence","source_assets","reviewer_approval"])
      if (!page.proof?.[field]) errors.push(page.path + ": missing " + field + " proof");
  }
  if (schemaTypes.enum_and_default_semantics_verified !== true ||
      schemaTypes.other_type_roundtrip_verified !== true ||
      schemaTypes.timestamp_fields.some(field => field.roundtrip_verified !== true))
    errors.push("Source-to-SQL serialization, timestamp, enum and default behavior not verified");
  const canonical = "ssibsfmtodgximseeqsv.supabase.co";
  for (const name of ["VITE_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_JWKS_URL"]) {
    try {
      if (new URL(process.env[name]).hostname !== canonical) throw Error("Not canonical");
    } catch { errors.push("Cloudflare build binding missing or mismatched: " + name); }
  }
  for (const e of entities.items) if (!e.runtime_table || !e.staging_field_names_verified || !e.migration_table || !e.rls_verified ||
      !e.fields_verified || !e.read_write_verified || !e.data_verified)
    errors.push("Entity not independently reconciled: " + e.name);
  for (const f of functions.items) if (!((f.retired_by_owner === true && f.retirement_evidence && f.retirement_approved_by) ||
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
  for (const field of ["native_source_imported", "native_project_buildable",
    "gradle_wrapper_restored", "app_id_consistency_verified",
    "app_link_intent_filters_verified", "signing_key_identity_verified",
    "permissions_tested", "android_login_tested", "android_deep_links_tested",
    "android_light_dark_tested", "native_share_intents_tested",
    "roll_back_signed_artifact_available", "release_verified"]) {
    if (android[field] !== true) errors.push("Android release gate not verified: " + field);
  }
  if (!android.signed_artifact_sha256 || !android.android_assetlinks_sha256)
    errors.push("Android signing and digital asset links evidence missing");
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
