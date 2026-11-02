#!/usr/bin/env node
// Generate the Postgres tables for the Base44 entities the backend reads and
// writes, from the reference entity schemas.
//
// Why generated
// -------------
// The reference application has 95 entity schemas and the backend functions
// reference 76 of them. Hand-writing the tables would drift from the source, and
// the directive requires the original behaviour to be reproduced rather than
// inferred. This reads the real .jsonc schemas and emits the DDL, so the columns
// are the columns the functions actually use.
//
// Source
// ------
// interplanetarysister/interplanetary-fund2 is read-only reference material and is
// not vendored here. Point the script at a checkout, or let it clone:
//
//   BASE44_SOURCE=/path/to/interplanetary-fund2 node scripts/generate-entity-tables.mjs
//
// Output
// ------
//   supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql
//   docs/migration/base44-entity-tables.json
//
// What it does NOT do
// -------------------
// It does not grant any table privilege to anon or authenticated, and it does not
// create a policy. Every table is deny-by-default with RLS enabled, so a table
// cannot become readable by accident before its access rules are written
// deliberately. The ported handlers are expected to reach these tables with a
// service-role client, never a browser key.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const SOURCE_REPO = "https://github.com/interplanetarysister/interplanetary-fund2.git";

function locateSource() {
  if (process.env.BASE44_SOURCE) {
    if (!existsSync(join(process.env.BASE44_SOURCE, "base44", "entities"))) {
      throw new Error(`BASE44_SOURCE=${process.env.BASE44_SOURCE} has no base44/entities`);
    }
    return process.env.BASE44_SOURCE;
  }
  const dir = mkdtempSync(join(tmpdir(), "base44-entities-"));
  execFileSync("git", ["clone", "--depth", "1", "-q", SOURCE_REPO, dir], { stdio: "inherit" });
  return dir;
}

const SOURCE = locateSource();

// ---------------------------------------------------------------------------
// Entities that already have a table in this repository. Creating a second table
// for them would produce two sources of truth, so they are mapped to the existing
// table instead. The mapping is curated because the naming is not mechanical:
// DiscussionPost is ifund_posts, User is ifund_profiles, and BlogEntry is
// ifund_blog_entries.
// ---------------------------------------------------------------------------
const EXISTING_TABLES = {
  Campaign: "ifund_campaigns",
  PlatformConnection: "ifund_connections",
  User: "ifund_profiles",
  FollowedCampaign: "ifund_follows",
  InboxItem: "ifund_inbox_items",
  LegalAcceptance: "ifund_legal_acceptances",
  DiscussionPost: "ifund_posts",
  BlogEntry: "ifund_blog_entries",
  Notification: "ifund_notifications",
  OfficialPublication: "ifund_official_publications",
};

// The entity names the backend functions actually reference, taken from the
// function inventory so this script cannot disagree with it about the set.
const INVENTORY = join(REPO, "docs/migration/base44-function-inventory.json");
if (!existsSync(INVENTORY)) {
  throw new Error(
    "docs/migration/base44-function-inventory.json is missing; run " +
    "scripts/inventory-base44-functions.mjs first",
  );
}
const inventory = JSON.parse(readFileSync(INVENTORY, "utf8"));
const referenced = new Set(Object.keys(inventory.summary.entityUsageCounts));

// ---------------------------------------------------------------------------
// Base44's implicit columns. These are not declared as properties but are present
// on every record, and the backend reads them: 184 of 184 functions are compiled
// against the SDK's record shape, 75 reference created_by_id and 53 reference
// created_date. Omitting them would break those functions in a way that is hard
// to trace, so every generated table carries them.
// ---------------------------------------------------------------------------
const IMPLICIT_COLUMNS = [
  { name: "created_date", sql: "timestamptz" },
  { name: "updated_date", sql: "timestamptz" },
  { name: "created_by_id", sql: "text" },
];

/** Entity name to table name. The ifund_ prefix matches the tables already here. */
function tableName(entity) {
  return "ifund_" + entity
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Strip // line comments so the .jsonc parses as JSON. */
function parseJsonc(text) {
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
}

function sqlString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/**
 * Map one declared property to a column.
 * Returns null when the property is one of the implicit columns, which are emitted
 * once per table rather than per declaration. 16 entities declare created_at and 12
 * declare updated_at; emitting those declarations would collide with the implicit
 * pair and fail the whole migration.
 */
function columnFor(name, spec) {
  if (["created_at", "updated_at"].includes(name)) return null;

  const type = spec.type;
  const parts = [`"${name}"`];
  let sql;

  if (Array.isArray(type)) {
    // A union. The Base44 schemas use unions such as ["string","null"], so the
    // narrowest useful type is the non-null member and the column stays nullable.
    const concrete = type.filter((t) => t !== "null");
    sql = concrete.length === 1 ? mapScalar(concrete[0], spec) : "jsonb";
  } else {
    sql = mapScalar(type, spec);
  }

  parts.push(sql);

  // A default is emitted only where it is unambiguous. String defaults are left
  // out: they encode business choices (an empty string versus a status word) that
  // belong to the handler, and a wrong default is harder to notice than a missing
  // one.
  if (typeof spec.default === "boolean") parts.push(`default ${spec.default}`);
  else if (typeof spec.default === "number") parts.push(`default ${spec.default}`);

  return { name, sql, definition: parts.join(" "), spec };
}

function mapScalar(type, spec) {
  switch (type) {
    case "string": return "text";
    case "integer": return "integer";
    case "number": return "numeric";
    case "boolean": return "boolean";
    case "object": return "jsonb";
    case "array": return "jsonb";
    default: return "jsonb";
  }
}

/** A check constraint for an enum, when every member is a usable literal. */
function enumCheck(entity, table, name, spec) {
  if (!Array.isArray(spec.enum) || spec.enum.length === 0) return null;
  if (!spec.enum.every((v) => typeof v === "string" && v.length > 0 && v.length <= 120)) return null;
  const values = [...new Set(spec.enum)];
  const rendered = values.map(sqlString).join(", ");
  if (rendered.length > 3000) return null;
  const constraint = `ifund_${table.replace(/^ifund_/, "")}_${name}_enum`;
  return {
    constraint,
    sql: `constraint ${constraint} check ("${name}" is null or "${name}" in (${rendered}))`,
  };
}

// ---------------------------------------------------------------------------
// Build the tables.
// ---------------------------------------------------------------------------
const entityFiles = readdirSync(join(SOURCE, "base44/entities"))
  .filter((f) => f.endsWith(".jsonc"))
  .sort();

const tables = [];
const skipped = [];
for (const file of entityFiles) {
  const entity = file.replace(/\.jsonc$/, "");
  if (!referenced.has(entity)) continue;              // no function uses it
  if (EXISTING_TABLES[entity]) {                       // a table already exists
    skipped.push({ entity, table: EXISTING_TABLES[entity] });
    continue;
  }
  const spec = parseJsonc(readFileSync(join(SOURCE, "base44/entities", file), "utf8"));
  const table = tableName(entity);
  const columns = [];
  const checks = [];
  for (const [name, property] of Object.entries(spec.properties || {})) {
    const column = columnFor(name, property);
    if (!column) continue;
    columns.push(column);
    const check = enumCheck(entity, table, name, property);
    if (check) checks.push(check);
  }
  tables.push({ entity, table, columns, checks, description: spec.description || "" });
}

// Two entities must not generate the same table name.
const seen = new Map();
for (const t of tables) {
  if (seen.has(t.table)) {
    throw new Error(`entity collision: ${t.entity} and ${seen.get(t.table)} both map to ${t.table}`);
  }
  seen.set(t.table, t.entity);
}

tables.sort((a, b) => a.table.localeCompare(b.table));

// ---------------------------------------------------------------------------
// Emit the migration.
// ---------------------------------------------------------------------------
const out = [];
const p = (s = "") => out.push(s);

p("-- ---------------------------------------------------------------------------");
p("-- Base44 entity tables");
p("-- ---------------------------------------------------------------------------");
p("-- Generated by scripts/generate-entity-tables.mjs from the reference entity");
p("-- schemas in interplanetarysister/interplanetary-fund2. Do not edit by hand;");
p("-- re-run the script. See docs/migration/base44-entity-tables.json for the");
p("-- machine-readable form of what follows.");
p("--");
p("-- Why these tables are needed");
p("--");
p("-- The reference backend has 184 function entrypoints that read and write 76");
p("-- distinct entities. Only 10 of those entities had a table in this repository,");
p("-- so a function could not be ported without its storage. That storage gap, not");
p("-- the handler code, is the critical path of the backend migration, and this");
p("-- migration closes it.");
p("--");
p("-- Column types follow the declared schema: string to text, number to numeric,");
p("-- boolean to boolean, integer to integer, and any object or array to jsonb,");
p("-- because the reference stores free-form structured values there and narrowing");
p("-- them would reject data the application already accepts. A declared enum becomes");
p("-- a check constraint, but only when every member is a usable string literal.");
p("--");
p("-- Every table also carries the Base44 implicit columns. They are not declared as");
p("-- properties, but every record has them and the backend reads them: 75 functions");
p("-- reference created_by_id and 53 reference created_date. created_at and updated_at");
p("-- are also emitted here, because 16 and 12 entities declare them as properties and");
p("-- the declared versions are skipped to avoid colliding with the implicit pair.");
p("--");
p("-- Access");
p("--");
p("-- Every table is deny-by-default: RLS is enabled and no privilege is granted to");
p("-- anon or authenticated, and no policy is created. Nothing can read or write these");
p("-- tables through a browser key until an access rule is written deliberately. The");
p("-- ported handlers are expected to use a service-role client. Tables that do need");
p("-- browser access, such as a member's own profile or follows, are granted in");
p("-- 20261102_ifund_member_schema_completion.sql, which states the policy for each.");
p("--");
p("-- Applying this migration is additive. It creates tables and touches nothing that");
p("-- already exists, so it is safe to apply before the reference data is imported.");
p("-- ---------------------------------------------------------------------------");
p();
p("-- id is the original Base44 record identifier, which is text, not a uuid. The blog");
p("-- tables already use this convention. Keeping the original id means imported rows");
p("-- keep the identity that cross-references in the functions rely on.");
p();

for (const t of tables) {
  p(`-- ${t.entity}${t.description ? ` - ${t.description.replace(/\s+/g, " ").slice(0, 200)}` : ""}`);
  p(`create table if not exists public.${t.table} (`);
  p("  id text primary key,");
  for (const c of t.columns) p(`  ${c.definition},`);
  for (const c of IMPLICIT_COLUMNS) p(`  ${c.name} ${c.sql},`);
  p("  created_at timestamptz not null default now(),");
  p("  updated_at timestamptz not null default now(),");
  p("  source_system text not null default 'base44',");
  p("  migrated_at timestamptz not null default now()");
  for (const c of t.checks) p(`  ,${c.sql}`);
  p(");");
  p(`alter table public.${t.table} enable row level security;`);
  p(`revoke all on public.${t.table} from public, anon, authenticated;`);
  p();
}

p("-- ---------------------------------------------------------------------------");
p("-- Entities that already have a table in this repository, and were therefore not");
p("-- created again:");
p("--");
for (const s of skipped.sort((a, b) => a.entity.localeCompare(b.entity))) {
  p(`--   ${s.entity.padEnd(24)} -> public.${s.table}`);
}
p("-- ---------------------------------------------------------------------------");
p();

writeFileSync(join(REPO, "supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql"),
  out.join("\n"));

// ---------------------------------------------------------------------------
// Machine-readable manifest, so tests can assert against the same source of truth.
// ---------------------------------------------------------------------------
writeFileSync(join(REPO, "docs/migration/base44-entity-tables.json"), JSON.stringify({
  generatedFrom: SOURCE_REPO,
  entityTables: tables.map((t) => ({
    entity: t.entity,
    table: t.table,
    columns: [
      "id",
      ...t.columns.map((c) => c.name),
      ...IMPLICIT_COLUMNS.map((c) => c.name),
      "created_at", "updated_at", "source_system", "migrated_at",
    ],
    checks: t.checks.map((c) => c.constraint),
  })),
  existingTables: Object.entries(EXISTING_TABLES)
    .map(([entity, table]) => ({ entity, table }))
    .sort((a, b) => a.entity.localeCompare(b.entity)),
  totals: {
    created: tables.length,
    mappedToExisting: Object.keys(EXISTING_TABLES).length,
    columns: tables.reduce((n, t) => n + t.columns.length, 0),
    checks: tables.reduce((n, t) => n + t.checks.length, 0),
  },
}, null, 1) + "\n");

console.log(`created tables: ${tables.length}`);
console.log(`mapped to existing tables: ${Object.keys(EXISTING_TABLES).length}`);
console.log(`declared columns: ${tables.reduce((n, t) => n + t.columns.length, 0)}`);
console.log(`enum check constraints: ${tables.reduce((n, t) => n + t.checks.length, 0)}`);
console.log("wrote supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql");
console.log("wrote docs/migration/base44-entity-tables.json");
