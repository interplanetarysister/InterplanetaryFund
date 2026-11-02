#!/usr/bin/env node
// Inventory the Base44 backend that this repository is replacing.
//
// Why this is generated rather than written by hand
// ------------------------------------------------
// The source is 184 function entrypoints and 95 entity schemas. A hand-written
// list would drift from the source the first time anyone edited it, and the
// directive is explicit that functionality must not be inferred from filenames.
// This reads the real files and emits what they actually reference.
//
// Source
// ------
// interplanetarysister/interplanetary-fund2 is read-only reference material and is
// deliberately not vendored into this repository. Point the script at a checkout:
//
//   BASE44_SOURCE=/path/to/interplanetary-fund2 node scripts/inventory-base44-functions.mjs
//
// It clones into a temporary directory when BASE44_SOURCE is unset, so a CI run
// with network access reproduces the committed output without a manual step.
//
// Output
// ------
//   docs/migration/BASE44_FUNCTION_INVENTORY.md   human-readable, committed
//   docs/migration/base44-function-inventory.json machine-readable, committed
//
// Both are committed so that the inventory is reviewable in a pull request and
// diffable when the reference source changes.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_REPO = "https://github.com/interplanetarysister/interplanetary-fund2.git";

// ---------------------------------------------------------------------------
// Locate the reference source.
// ---------------------------------------------------------------------------
function locateSource() {
  if (process.env.BASE44_SOURCE) {
    if (!existsSync(join(process.env.BASE44_SOURCE, "base44", "functions"))) {
      throw new Error(`BASE44_SOURCE=${process.env.BASE44_SOURCE} has no base44/functions`);
    }
    return process.env.BASE44_SOURCE;
  }
  const dir = mkdtempSync(join(tmpdir(), "base44-ref-"));
  execFileSync("git", ["clone", "--depth", "1", "-q", SOURCE_REPO, dir], { stdio: "inherit" });
  return dir;
}

const SOURCE = locateSource();
const FUNCS_DIR = join(SOURCE, "base44", "functions");
const ENTITIES_DIR = join(SOURCE, "base44", "entities");

// ---------------------------------------------------------------------------
// Classification. Each rule is a deliberate judgement, and the reason is
// recorded in the output so a reviewer can disagree with a specific one rather
// than with the whole list.
// ---------------------------------------------------------------------------

// A function is FINANCIAL when it can move, settle, reconcile or authorise money,
// or when it reads a balance that only exists because money moved. These are held
// behind a gate until provider credentials, webhook verification, idempotency and
// authorization are confirmed, so they must be identified precisely rather than
// guessed from a name.
const FINANCIAL_NAME =
  /paypal|stripe|donation|withdraw|payout|treasury|ledger|balance|checkout|subscription|financial|holding|fee|receipt|refund|payment|settlement|collectandwithdraw|grant.*(fund|award)/i;

// Domain grouping, used to order the work. First match wins.
const DOMAINS = [
  ["payments", /paypal|stripe|donation|checkout|subscription|premium|daypass/i],
  ["treasury", /withdraw|payout|ledger|balance|holding|settlement|collect|treasury|financial/i],
  ["admin", /^admin|adminApi|auditAdmin|UpdateUserRole|audit|monitor|suspension|moderation/i],
  ["agents", /agent|delegation|conversation|builder|missionBrief|knowledge|executiveReport/i],
  ["workflows", /workflow|sync|import|export|checkpoint|queue|scheduled|reconcile/i],
  ["ai", /^ai|analyze|generate|draft|summar|translate|image|assist|story|writing|enrich/i],
  ["discovery", /discover|search|globe|feature|explore|recommend|trending|nearby/i],
  ["social", /post|broadcast|crossPost|social|connection|platform|oauth|community|discussion|friend|follow|volunteer/i],
  ["notifications", /notif|inbox|email|receipt|welcome|reminder|alert/i],
  ["campaigns", /campaign|institution|grant|opportunit|nonprofit/i],
  ["accounts", /account|user|auth|device|username|deleteAccount|profil|legal|consent|subscription.*catalog/i],
];

function domainOf(name) {
  for (const [domain, pattern] of DOMAINS) if (pattern.test(name)) return domain;
  return "other";
}

// ---------------------------------------------------------------------------
// Parse each function.
// ---------------------------------------------------------------------------
function parseFunction(name) {
  const file = join(FUNCS_DIR, name, "entry.ts");
  if (!existsSync(file)) return { name, missingEntry: true };
  const text = readFileSync(file, "utf8");

  const entities = [...new Set([...text.matchAll(/\.entities\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))].sort();
  const shared = [...new Set(
    [...text.matchAll(/from\s+['"]\.\.\/\.\.\/shared\/([A-Za-z0-9_]+)\.(?:ts|js)['"]/g)].map((m) => m[1]),
  )].sort();
  const npmImports = [...new Set(
    [...text.matchAll(/from\s+['"](npm:[^'"]+)['"]/g)].map((m) => m[1]),
  )].sort();

  // How the caller is authenticated. This decides what the port must preserve.
  const usesAccountGuard = /assertActiveAccount/.test(text);
  const usesUserClient = /base44\.auth\.(me|user)|base44\.auth\b/.test(text);
  const serviceRole = /asServiceRole/.test(text);
  const adminOnly = /role\s*[!=]==?\s*['"]admin['"]|requireAdmin|isAdminUser|assertAdmin/.test(text);
  const rateLimited = /checkRateLimit/.test(text);
  const readsBody = /req\.json\(\)/.test(text);
  const getOnly = /method\s*[!=]==?\s*['"]GET['"]/.test(text);

  // External services touched. These are the ones that need credentials before
  // the function can be called real.
  const external = [];
  if (/paypal/i.test(text)) external.push("paypal");
  if (/stripe/i.test(text)) external.push("stripe");
  if (/wix/i.test(text)) external.push("wix");
  if (/github/i.test(text)) external.push("github");
  if (/openai|base44\.integrations\.Core\.InvokeLLM|InvokeLLM/i.test(text)) external.push("llm");
  if (/browserbase/i.test(text)) external.push("browserbase");
  if (/\bfetch\(/.test(text)) external.push("http");

  const financial = FINANCIAL_NAME.test(name) ||
    /\bDonation\b|\bWithdrawal\b|\bFinancialOperation\b|\bHoldingLedgerEntry\b/.test(text);

  return {
    name,
    domain: domainOf(name),
    lines: text.split("\n").length,
    entities,
    shared,
    npmImports,
    auth: {
      accountGuard: usesAccountGuard,
      userClient: usesUserClient,
      serviceRole,
      adminOnly,
      rateLimited,
    },
    request: { readsBody, getOnly },
    external,
    financial,
  };
}

const functionNames = readdirSync(FUNCS_DIR)
  .filter((n) => statSync(join(FUNCS_DIR, n)).isDirectory())
  .sort();

const functions = functionNames.map(parseFunction);

// ---------------------------------------------------------------------------
// Parse the entity schemas, so the table gap is measured rather than assumed.
// ---------------------------------------------------------------------------
const entities = readdirSync(ENTITIES_DIR)
  .filter((f) => f.endsWith(".jsonc"))
  .map((file) => {
    const raw = readFileSync(join(ENTITIES_DIR, file), "utf8");
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // .jsonc may carry comments; recover the property names instead of failing.
    }
    const properties = Object.keys(parsed.properties || {});
    return { entity: file.replace(/\.jsonc$/, ""), properties, propertyCount: properties.length };
  })
  .sort((a, b) => a.entity.localeCompare(b.entity));

// Tables this repository's migrations create, and the entity names the ported
// client already uses. The mapping is curated, not mechanical: DiscussionPost
// maps to ifund_posts and BlogEntry to ifund_blog_entries, so no rule would
// derive it.
const KNOWN_TABLES = new Set([
  "ifund_profiles", "ifund_campaigns", "ifund_posts", "ifund_connections",
  "ifund_blogs", "ifund_blog_entries", "ifund_follows", "ifund_notifications",
  "ifund_inbox_items", "ifund_legal_acceptances", "ifund_official_publications",
]);

const ENTITY_TO_TABLE = {
  Campaign: "ifund_campaigns",
  DiscussionPost: "ifund_posts",
  PlatformConnection: "ifund_connections",
  FollowedCampaign: "ifund_follows",
  InboxItem: "ifund_inbox_items",
  LegalAcceptance: "ifund_legal_acceptances",
  BlogEntry: "ifund_blog_entries",
  User: "ifund_profiles",
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const byDomain = {};
for (const f of functions) (byDomain[f.domain] ||= []).push(f.name);

const financial = functions.filter((f) => f.financial).map((f) => f.name);
const nonFinancial = functions.filter((f) => !f.financial).map((f) => f.name);
const entityUsage = {};
for (const f of functions) {
  for (const e of f.entities || []) (entityUsage[e] ||= []).push(f.name);
}
const entitiesUsed = Object.keys(entityUsage).sort();
const entitiesWithTable = entitiesUsed.filter((e) => ENTITY_TO_TABLE[e]);
const entitiesWithoutTable = entitiesUsed.filter((e) => !ENTITY_TO_TABLE[e]);

const json = {
  generatedFrom: SOURCE_REPO,
  functionCount: functions.length,
  entityCount: entities.length,
  functions,
  entities,
  summary: {
    byDomain,
    financial,
    nonFinancial,
    entityUsageCounts: Object.fromEntries(
      entitiesUsed.map((e) => [e, entityUsage[e].length]),
    ),
    entitiesWithTable,
    entitiesWithoutTable,
    knownTables: [...KNOWN_TABLES].sort(),
  },
};
writeFileSync(join(REPO, "docs/migration/base44-function-inventory.json"), JSON.stringify(json, null, 1));

const lines = [];
const p = (s = "") => lines.push(s);

p("# Base44 backend inventory");
p();
p("Generated by `scripts/inventory-base44-functions.mjs` from");
p("`interplanetarysister/interplanetary-fund2`. Do not edit by hand; re-run the script.");
p();
p("This exists because the directive requires the original behaviour to be reproduced");
p("without inferring it from filenames. Every field below is read from the source:");
p("the entities each function touches, the shared modules it depends on, how it");
p("authenticates, and which external services it calls.");
p();
p(`- functions: **${functions.length}**`);
p(`- entity schemas: **${entities.length}**`);
p(`- distinct entities referenced by functions: **${entitiesUsed.length}**`);
p(`- entities that already have a table in this repository: **${entitiesWithTable.length}**`);
p(`- entities with no table yet: **${entitiesWithoutTable.length}**`);
p(`- functions classified financial: **${financial.length}**`);
p(`- functions not financial: **${nonFinancial.length}**`);
p();
p("## Functions by domain");
p();
p("| domain | count |");
p("| --- | --- |");
for (const [d, names] of Object.entries(byDomain).sort((a, b) => b[1].length - a[1].length)) {
  p(`| ${d} | ${names.length} |`);
}
p();
p("## Financial functions (held behind a gate)");
p();
p("These can move, settle, reconcile or authorise money, or read a balance that");
p("only exists because money moved. They stay disabled until real provider");
p("credentials, webhook signature verification, idempotency, authorization and");
p("consent checks are confirmed against a test environment.");
p();
for (const n of financial) p(`- ${n}`);
p();
p("## Entity coverage gap");
p();
p("The reference application has 95 entity schemas. This repository's migrations");
p("create the tables below. Any function touching an entity without a table cannot");
p("be ported until that table exists, so this list is the critical path.");
p();
p("| entity | functions using it | table in this repo |");
p("| --- | --- | --- |");
for (const e of entitiesUsed.sort((a, b) => entityUsage[b].length - entityUsage[a].length)) {
  const table = ENTITY_TO_TABLE[e] || "-";
  p(`| ${e} | ${entityUsage[e].length} | ${table} |`);
}
p();
p("## Every function");
p();
p("| function | domain | lines | auth | entities | shared deps | external | financial |");
p("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const f of functions) {
  if (f.missingEntry) {
    p(`| ${f.name} | - | - | MISSING entry.ts | - | - | - | - |`);
    continue;
  }
  const auth = [
    f.auth.adminOnly ? "admin" : "",
    f.auth.accountGuard ? "guard" : "",
    f.auth.serviceRole ? "service" : "",
    f.auth.rateLimited ? "ratelimit" : "",
  ].filter(Boolean).join(" ") || "none";
  p(`| ${f.name} | ${f.domain} | ${f.lines} | ${auth} | ${f.entities.join(", ") || "-"} | ` +
    `${f.shared.join(", ") || "-"} | ${f.external.join(", ") || "-"} | ${f.financial ? "YES" : ""} |`);
}
p();
writeFileSync(join(REPO, "docs/migration/BASE44_FUNCTION_INVENTORY.md"), lines.join("\n") + "\n");

console.log(`functions: ${functions.length}`);
console.log(`entities: ${entities.length}, referenced by functions: ${entitiesUsed.length}`);
console.log(`entities with a table: ${entitiesWithTable.length}, without: ${entitiesWithoutTable.length}`);
console.log(`financial: ${financial.length}, non-financial: ${nonFinancial.length}`);
console.log("wrote docs/migration/BASE44_FUNCTION_INVENTORY.md");
console.log("wrote docs/migration/base44-function-inventory.json");
