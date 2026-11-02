// The member-schema migration is written to be applied to a database whose exact
// shape is not verifiable from this repository. It uses `create table if not
// exists` followed by column-level grants, and that combination is silently
// wrong against a database that already holds a table of the same name: the
// create does nothing, and the grant then fails on a missing column or succeeds
// while the application reads a column that is not there.
//
// So the migration now opens with a preflight that refuses to run at all when the
// live schema disagrees with it. These tests prove the preflight fires, and that
// it does not block the normal case. A guard that has never been observed
// rejecting anything is not evidence of anything.
//
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_MIGRATIONS,
  applyMigrations,
  freshDb,
  loadPGlite,
} from "./helpers/pglite.js";

/** Apply a migration file and report whether it was rejected, with its reason. */
async function rejectionOf(db, relative) {
  try {
    await applyMigrations(db, [relative]);
    return { rejected: false, message: "" };
  } catch (cause) {
    return { rejected: true, message: cause.message };
  }
}

const MEMBER_SCHEMA =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";
const BASE = ["supabase/migrations/20261025011400_initial.sql"];

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

test(
  "a clean schema applies without the preflight blocking it",
  { skip: SKIP },
  async () => {
    const db = await freshDb(PGlite);
    await applyMigrations(db, BASE);
    await applyMigrations(db, [MEMBER_SCHEMA]);
    const tables = await db.query(
      `select table_name from information_schema.tables
     where table_schema='public' and table_name in
       ('ifund_follows','ifund_notifications','ifund_inbox_items',
        'ifund_legal_acceptances','ifund_official_publications')`,
    );
    assert.equal(
      tables.rows.length,
      5,
      "all five tables must be created on a clean schema",
    );
  },
);

test(
  "naming divergence aborts before any DDL runs",
  { skip: SKIP },
  async () => {
    // A database that names the same concepts without the ifund_ prefix would
    // otherwise get a parallel, empty schema while the real data sat untouched.
    const db = await freshDb(PGlite);
    await db.exec(
      "create table if not exists public.campaigns(id uuid primary key, title text)",
    );
    const { rejected, message } = await rejectionOf(db, MEMBER_SCHEMA);
    assert.equal(
      rejected,
      true,
      "the migration must refuse to run on a differently-named schema",
    );
    assert.match(
      message,
      /NAMING/,
      "the failure must name the naming divergence",
    );
  },
);

test(
  "shape divergence aborts before any DDL runs",
  { skip: SKIP },
  async () => {
    // ifund_notifications exists but has no `read` column, which the migration's
    // `grant update(read)` and the client both require.
    const db = await freshDb(PGlite);
    await applyMigrations(db, BASE);
    await db.exec(
      "create table public.ifund_notifications(id uuid primary key, owner_id uuid)",
    );
    const { rejected, message } = await rejectionOf(db, MEMBER_SCHEMA);
    assert.equal(
      rejected,
      true,
      "the migration must refuse to run on a divergent table shape",
    );
    assert.match(
      message,
      /SHAPE/,
      "the failure must name the shape divergence",
    );
  },
);

test(
  "a failed preflight leaves the database untouched",
  { skip: SKIP },
  async () => {
    // The preflight runs inside the migration's own `begin`, so raising aborts
    // that transaction and every later statement in the file is refused. This test
    // proves the atomicity directly: roll the aborted transaction back and confirm
    // not one object from the migration survived.
    const db = await freshDb(PGlite);
    await db.exec(
      "create table if not exists public.campaigns(id uuid primary key, title text)",
    );
    const { rejected } = await rejectionOf(db, MEMBER_SCHEMA);
    assert.equal(rejected, true, "the migration must have been rejected");
    // Clear the aborted transaction left open by the raise.
    await db.exec("rollback;");
    const created = await db.query(
      `select table_name from information_schema.tables
     where table_schema='public' and table_name = 'ifund_follows'`,
    );
    assert.equal(
      created.rows.length,
      0,
      "no table may be created when the preflight fails",
    );
    // And the pre-existing table is still there, unchanged.
    const kept = await db.query(
      `select column_name from information_schema.columns
     where table_schema='public' and table_name='campaigns' order by column_name`,
    );
    assert.deepEqual(
      kept.rows.map((r) => r.column_name),
      ["id", "title"],
    );
  },
);

test(
  "the committed migration set alone is a clean schema",
  { skip: SKIP },
  async () => {
    // Guards against the preflight being triggered by the repository's own
    // committed migrations, which would make the guard useless in practice.
    const db = await freshDb(PGlite);
    await applyMigrations(db, COMMITTED_MIGRATIONS);
    const { rejected, message } = await rejectionOf(db, MEMBER_SCHEMA);
    assert.equal(
      rejected,
      false,
      `the pending migration must apply over the committed set: ${message}`,
    );
  },
);

test("the preflight shape list covers every declared column", { skip: SKIP }, async () => {
  // The preflight has to name every column a `create table if not exists` block
  // declares, or a column can be silently dropped by an existing table without
  // the guard noticing. Rather than trust the two lists to stay in step, compare
  // them: parse the DDL, parse the preflight, and require the preflight to be a
  // superset. This is the guard against the guard rotting.
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const sql = readFileSync(
    fileURLToPath(new URL("../" + MEMBER_SCHEMA, import.meta.url)), "utf8");

  // Columns declared by each `create table if not exists` block. A column line
  // is identified by naming a SQL type, which keeps CHECK-constraint bodies out:
  // a multi-line constraint contains lines like `and jsonb_typeof(x) = 'object'`
  // that a looser "identifier then word" match would mistake for columns.
  const declared = new Map();
  const TYPES =
    "uuid|text|boolean|jsonb|json|timestamptz|timestamp|integer|int|bigint|" +
    "numeric|decimal|date|time|smallint|real|double precision|serial|" +
    "bigserial|bytea|inet|varchar|character varying|char";
  const columnRe = new RegExp(`^([a-z_][a-z0-9_]*)\\s+(?:${TYPES})\\b`, "i");
  const createRe = /create table if not exists public\.(ifund_[a-z_]+)\s*\(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(createRe)) {
    const cols = [];
    for (const rawLine of m[2].split("\n")) {
      const cm = columnRe.exec(rawLine.trim());
      if (cm) cols.push(cm[1]);
    }
    declared.set(m[1], cols);
  }
  assert.ok(declared.size >= 5, `expected to parse 5 create-table blocks, found ${declared.size}`);

  // Pairs named in the preflight's shape-check values list.
  const checked = new Set();
  const preflight = sql.slice(0, sql.indexOf("-- 1. Account lifecycle columns"));
  for (const m of preflight.matchAll(/\('(ifund_[a-z_]+)',\s*'([a-z_]+)'\)/g)) {
    checked.add(`${m[1]}.${m[2]}`);
  }
  assert.ok(checked.size > 20, `expected the preflight to check many columns, found ${checked.size}`);

  const uncovered = [];
  for (const [table, cols] of declared) {
    for (const col of cols) {
      if (!checked.has(`${table}.${col}`)) uncovered.push(`${table}.${col}`);
    }
  }
  assert.deepEqual(uncovered, [],
    `these declared columns are not covered by the preflight shape check:\n  ${uncovered.join("\n  ")}`);
});

test("the guard fires on production's real ifund_legal_acceptances shape", { skip: SKIP }, async () => {
  // Reproduces what production actually holds, discovered by probing
  // ssibsfmtodgximseeqsv with the public anon key: the table exists with
  // owner_id, terms_version, explicit_consent and accepted_at, and WITHOUT id or
  // created_at. `create table if not exists` would silently skip it, discarding
  // the primary key, the defaults and the unique constraint. The preflight must
  // refuse instead.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await db.exec(`create table public.ifund_legal_acceptances (
    owner_id uuid not null,
    terms_version text not null,
    explicit_consent boolean not null,
    accepted_at timestamptz not null default now()
  )`);
  const { rejected, message } = await rejectionOf(db, MEMBER_SCHEMA);
  assert.equal(rejected, true, "production's actual shape must be refused");
  assert.match(message, /SHAPE/, "the failure must be reported as a shape divergence");
  assert.match(message, /"id"/, "the missing primary key must be named");
});
