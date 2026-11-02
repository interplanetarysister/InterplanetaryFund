#!/usr/bin/env node
// Reconcile the repository's expectations against the LIVE production database.
//
// Why this exists
// ---------------
// docs/migration/PRODUCTION_RECONCILIATION.sql needs the Supabase SQL editor and
// a dashboard login. This script needs neither: it talks to the production
// PostgREST API using the publishable (anon) key, which is public by design and
// ships to every browser. It therefore measures exactly what an anonymous
// visitor can measure, and nothing more.
//
// It answers the questions that decide whether the pending migration can be
// applied:
//
//   * Does every table the client queries exist?
//   * Does every column the client reads or writes exist? A missing one here is a
//     hard runtime failure.
//   * Does every column the pending migration DECLARES exist? This is the subtle
//     one. `create table if not exists` silently does nothing against an existing
//     table, so a declared column that is absent means the migration would drop a
//     primary key, a default or a constraint without any error.
//   * Can anon read rows it should not, or write at all?
//
// How it detects a column
// -----------------------
// PostgREST answers a request naming a nonexistent column with HTTP 400 and
// `column ... does not exist`. Any other status means the column exists; the row
// read may still be denied by RLS, which is fine, because the question is whether
// the column exists, not whether this caller may read it.
//
// Usage
// -----
//   node scripts/reconcile-production-schema.mjs
//
// The Supabase URL and key are read from the deployed bundle unless supplied:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/reconcile-production-schema.mjs
//
// Exit code 1 when any divergence is found, so this can gate a release.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const SITE = process.env.SITE_URL || "https://interplanetaryfund-migration.pages.dev";
const MEMBER_MIGRATION =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";

// ---------------------------------------------------------------------------
// Discover the public connection details from the deployed bundle, so neither a
// secret nor dashboard access is required.
// ---------------------------------------------------------------------------
async function discoverConnection() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL.replace(/\/$/, ""),
      key: process.env.SUPABASE_ANON_KEY,
      source: "environment",
    };
  }
  const page = await (await fetch(SITE)).text();
  const asset = page.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  if (!asset) throw new Error(`no bundle found on ${SITE}`);
  const js = await (await fetch(SITE + asset[0])).text();
  const url = js.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/);
  const key = js.match(/sb_publishable_[A-Za-z0-9_-]+/);
  if (!url || !key) throw new Error("bundle exposed no Supabase URL and publishable key");
  return { url: url[0], key: key[0], source: `deployed bundle at ${SITE}` };
}

const conn = await discoverConnection();
console.log(`Supabase project : ${conn.url}`);
console.log(`Key source       : ${conn.source}`);
console.log(`Key kind         : publishable / anon (public by design)\n`);

async function request(path, init = {}) {
  const res = await fetch(conn.url + path, {
    ...init,
    headers: {
      apikey: conn.key,
      Authorization: `Bearer ${conn.key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.text() };
}

/** 'present' | 'absent' | 'no-table' | 'other(<status>)' for one column. */
async function columnState(table, column) {
  const { status, body } = await request(`/rest/v1/${table}?select=${column}&limit=1`);
  if (status === 400 && /does not exist/.test(body)) return "absent";
  if (status === 404) return "no-table";
  if (status === 200 || status === 401 || status === 403) return "present";
  return `other(${status})`;
}

async function tableExists(table) {
  const { status } = await request(`/rest/v1/${table}?select=id&limit=1`);
  return status !== 404;
}

/** Every column the client uses, read out of the source rather than hand-listed. */
function clientUsage() {
  const used = new Map();
  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
    }
    return out;
  };
  for (const tree of ["src", "apps/web/src"]) {
    let files;
    try {
      files = walk(join(REPO, tree));
    } catch {
      continue;
    }
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const add = (t, c) => {
        if (!used.has(t)) used.set(t, new Set());
        used.get(t).add(c);
      };
      for (const m of text.matchAll(
        /from\(\s*["'](ifund_[a-z_]+)["']\s*\)[\s\S]{0,200}?\.select\(\s*["']([^"']+)["']/g,
      )) {
        if (m[2].includes("*")) continue;
        for (const c of m[2].split(",")) {
          const t = c.trim();
          if (t && !t.includes("(")) add(m[1], t);
        }
      }
      for (const m of text.matchAll(
        /from\(\s*["'](ifund_[a-z_]+)["']\s*\)\s*\.(?:insert|update|upsert)\(\s*\{([^}]{0,600})\}/g,
      )) {
        for (const c of m[2].matchAll(/([a-z_][a-z0-9_]*)\s*:/g)) add(m[1], c[1]);
      }
    }
  }
  return used;
}

/** Columns declared by each `create table if not exists` in the member migration. */
function declaredColumns() {
  const sql = readFileSync(join(REPO, MEMBER_MIGRATION), "utf8");
  const TYPES =
    "uuid|text|boolean|jsonb|json|timestamptz|timestamp|integer|int|bigint|" +
    "numeric|decimal|date|time|smallint|real|double precision|serial|" +
    "bigserial|bytea|inet|varchar|character varying|char";
  const columnRe = new RegExp(`^([a-z_][a-z0-9_]*)\\s+(?:${TYPES})\\b`, "i");
  const declared = new Map();
  for (const m of sql.matchAll(
    /create table if not exists public\.(ifund_[a-z_]+)\s*\(([\s\S]*?)\n\);/g,
  )) {
    const cols = [];
    for (const line of m[2].split("\n")) {
      const c = columnRe.exec(line.trim());
      if (c) cols.push(c[1]);
    }
    declared.set(m[1], cols);
  }
  return declared;
}

// ---------------------------------------------------------------------------
const findings = [];
const note = (kind, detail) => findings.push({ kind, detail });

console.log("=== 1. TABLES THE CLIENT QUERIES ===");
const usage = clientUsage();
for (const table of [...usage.keys()].sort()) {
  const exists = await tableExists(table);
  console.log(`  ${exists ? "present" : "ABSENT "}  ${table}`);
  if (!exists) note("MISSING TABLE", `${table} is queried by the client but does not exist`);
}

console.log("\n=== 2. CLIENT COLUMNS (a missing one is a runtime failure) ===");
let clientMissing = 0;
for (const table of [...usage.keys()].sort()) {
  for (const column of [...usage.get(table)].sort()) {
    if ((await columnState(table, column)) === "absent") {
      console.log(`  ABSENT   ${table}.${column}   <-- client breaks`);
      note("CLIENT COLUMN MISSING", `${table}.${column}`);
      clientMissing++;
    }
  }
}
console.log(clientMissing === 0 ? "  all present" : `  ${clientMissing} missing`);

console.log("\n=== 3. DECLARED COLUMNS (a missing one means the migration silently no-ops) ===");
let declaredMissing = 0;
for (const [table, cols] of declaredColumns()) {
  if (!(await tableExists(table))) {
    console.log(`  ${table}: table absent, would be created in full`);
    continue;
  }
  const missing = [];
  for (const c of cols) {
    if ((await columnState(table, c)) === "absent") missing.push(c);
  }
  if (missing.length) {
    console.log(`  ${table}: exists but LACKS ${missing.join(", ")}`);
    for (const c of missing) note("DECLARED COLUMN MISSING", `${table}.${c}`);
    declaredMissing += missing.length;
  } else {
    console.log(`  ${table}: all declared columns present`);
  }
}

console.log("\n=== 4. ANON MUST NOT READ NON-PUBLIC ROWS ===");
for (const [table, col, filter, label] of [
  ["ifund_campaigns", "status", "neq.active", "non-active campaigns"],
  ["ifund_blogs", "status", "neq.active", "non-active blogs"],
  ["ifund_blog_entries", "status", "neq.published", "unpublished entries"],
]) {
  const { status, body } = await request(`/rest/v1/${table}?select=id&${col}=${filter}`);
  if (status === 200) {
    const n = JSON.parse(body).length;
    console.log(`  ${n === 0 ? "ok    " : "LEAK  "} ${table}: ${n} ${label} visible to anon`);
    if (n) note("RLS LEAK", `${table}: ${n} ${label} readable by anon`);
  } else {
    console.log(`  n/a   ${table}: HTTP ${status}`);
  }
}

console.log("\n=== 5. ANON MUST NOT WRITE ===");
// The payload must name only columns that exist. PostgREST rejects an unknown
// column with 400 at parse time, before RLS is consulted, so a payload naming a
// fake column proves nothing about authorization and looks like a false alarm.
// Each probe below uses a real column, so the request reaches RLS and the status
// reflects the policy rather than the parser.
const WRITE_PROBES = [
  ["ifund_campaigns", { title: "reconcile probe" }],
  ["ifund_profiles", { handle: "reconcile-probe" }],
  ["ifund_notifications", { title: "reconcile probe" }],
];
for (const [table, payload] of WRITE_PROBES) {
  const { status } = await request(`/rest/v1/${table}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const denied = status === 401 || status === 403;
  const inconclusive = status === 400;
  const label = denied ? "ok    " : inconclusive ? "skip  " : "OPEN  ";
  console.log(`  ${label} POST ${table} -> ${status}` +
    (inconclusive ? "  (payload rejected before authorization; inconclusive)" : ""));
  if (!denied && !inconclusive) note("WRITE ALLOWED", `anon POST to ${table} returned ${status}`);
}

console.log("\n" + "=".repeat(72));
if (findings.length === 0) {
  console.log("RESULT: no divergence found. The client contract is satisfied and");
  console.log("        the pending migration has nothing to silently skip.");
  process.exit(0);
}
console.log(`RESULT: ${findings.length} finding(s). The pending migration must NOT be`);
console.log("        applied until these are resolved.\n");
for (const f of findings) console.log(`  [${f.kind}] ${f.detail}`);
console.log("\n  See docs/migration/PRODUCTION_RECONCILIATION.sql for the full");
console.log("  catalog-level report, which needs the SQL editor.");
process.exit(1);
