// The Base44 entity tables.
//
// The reference backend has 184 function entrypoints that read and write 76
// distinct entities, and only 10 of those entities had a table in this repository.
// A function cannot be ported without its storage, so this storage gap is the
// critical path of the backend migration. The migration under test closes it.
//
// These tests check the things that would be expensive to discover later:
//
//   * every referenced entity is now backed by a table, either created here or
//     mapped to one that already existed, so the coverage claim is measured rather
//     than asserted;
//   * the committed SQL and the committed manifest agree, so the generated
//     migration cannot silently drift from the file the tests read;
//   * the tables are deny-by-default, because a generated table that happens to be
//     readable is a data-exposure bug, not a convenience;
//   * declared enums are actually enforced, and everything else is permissive, so
//     the tables neither accept nonsense nor reject data the application stores.
//
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyMigrations,
  actAs,
  freshDb,
  loadPGlite,
  COMMITTED_MIGRATIONS,
} from "./helpers/pglite.js";

const ENTITY_TABLES =
  "supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql";
const MANIFEST = "docs/migration/base44-entity-tables.json";
const INVENTORY = "docs/migration/base44-function-inventory.json";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const inventory = JSON.parse(readFileSync(INVENTORY, "utf8"));
const sql = readFileSync(ENTITY_TABLES, "utf8");

// The columns every generated table carries, on top of its declared properties.
const IMPLICIT = ["created_date", "updated_date", "created_by_id",
                  "created_at", "updated_at", "source_system", "migrated_at"];

async function build() {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, [ENTITY_TABLES]);
  return db;
}

// ---------------------------------------------------------------------------
// Coverage: the point of the migration
// ---------------------------------------------------------------------------

test("every entity the backend references is now backed by a table", { skip: SKIP }, async () => {
  const referenced = Object.keys(inventory.summary.entityUsageCounts);
  const created = new Set(manifest.entityTables.map((t) => t.entity));
  const mapped = new Set(manifest.existingTables.map((t) => t.entity));
  const uncovered = referenced.filter((e) => !created.has(e) && !mapped.has(e));
  assert.deepEqual(uncovered, [],
    `these referenced entities have no table:\n  ${uncovered.join("\n  ")}`);
});

test("the number of tables created matches the reference gap", { skip: SKIP }, async () => {
  const referenced = Object.keys(inventory.summary.entityUsageCounts).length;
  assert.equal(manifest.totals.created + manifest.totals.mappedToExisting, referenced,
    "created plus mapped must account for every referenced entity exactly once");
});

test("created tables all exist in a real database", { skip: SKIP }, async () => {
  const db = await build();
  const { rows } = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const present = new Set(rows.map((r) => r.table_name));
  const missing = manifest.entityTables.map((t) => t.table).filter((t) => !present.has(t));
  assert.deepEqual(missing, [], `these generated tables were not created:\n  ${missing.join("\n  ")}`);
});

test("no entity was created twice under a different name", { skip: SKIP }, async () => {
  const names = manifest.entityTables.map((t) => t.table);
  assert.equal(new Set(names).size, names.length, "table names must be unique");
  const entities = manifest.entityTables.map((t) => t.entity);
  assert.equal(new Set(entities).size, entities.length, "entity names must be unique");
});

// ---------------------------------------------------------------------------
// Drift: the committed SQL must match the committed manifest
// ---------------------------------------------------------------------------

test("the committed SQL defines exactly the tables the manifest lists", { skip: SKIP }, async () => {
  const inSql = [...sql.matchAll(/create table if not exists public\.([a-z0-9_]+) \(/g)]
    .map((m) => m[1]).sort();
  const inManifest = manifest.entityTables.map((t) => t.table).sort();
  assert.deepEqual(inSql, inManifest,
    "the migration and the manifest were generated at different times");
});

test("the committed SQL defines exactly the columns the manifest lists", { skip: SKIP }, async () => {
  // Parses each create table block out of the SQL and compares its column names to
  // the manifest, so a hand edit to the generated file is caught.
  const blocks = new Map();
  const re = /create table if not exists public\.([a-z0-9_]+) \(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(re)) {
    const columns = [];
    for (const rawLine of m[2].split("\n")) {
      const line = rawLine.trim().replace(/^,/, "");
      if (!line || line.startsWith("constraint") || line.startsWith("--")) continue;
      const name = line.match(/^(?:"([^"]+)"|([a-z_][a-z0-9_]*))\s/);
      if (name) columns.push(name[1] || name[2]);
    }
    blocks.set(m[1], columns);
  }
  for (const t of manifest.entityTables) {
    const columns = blocks.get(t.table);
    assert.ok(columns, `${t.table} is in the manifest but not in the SQL`);
    assert.deepEqual(columns.slice().sort(), t.columns.slice().sort(),
      `${t.table} column list differs between the SQL and the manifest`);
  }
});

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

test("every table has a text primary key and the Base44 implicit columns", { skip: SKIP }, async () => {
  const db = await build();
  for (const t of manifest.entityTables) {
    const { rows: pk } = await db.query(
      `select a.attname, format_type(a.atttypid, a.atttypmod) as type
         from pg_constraint c
         join unnest(c.conkey) as k(attnum) on true
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
        where c.conrelid = $1::regclass and c.contype = 'p'`,
      [`public.${t.table}`],
    );
    assert.deepEqual(pk.map((r) => r.attname), ["id"], `${t.table} must have a single-column id key`);
    assert.equal(pk[0].type, "text", `${t.table}.id must be text, matching the original record ids`);

    for (const column of IMPLICIT) {
      const { rows } = await db.query(
        `select 1 from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name=$2`,
        [t.table, column],
      );
      assert.equal(rows.length, 1, `${t.table} is missing the implicit column ${column}`);
    }
  }
});

test("id is the only not-null column besides the implicit timestamps", { skip: SKIP }, async () => {
  // A declared property must not be silently made required. The reference accepts
  // partial records, and a not-null column would reject data the application stores.
  const db = await build();
  const { rows } = await db.query(`
    select table_name, column_name from information_schema.columns
     where table_schema = 'public' and is_nullable = 'NO'
       and table_name = any($1)
  `, [manifest.entityTables.map((t) => t.table)]);
  const allowed = new Set(["id", "created_at", "updated_at", "source_system", "migrated_at"]);
  const wrong = rows.filter((r) => !allowed.has(r.column_name));
  assert.deepEqual(wrong, [],
    `these columns are unexpectedly not-null: ${JSON.stringify(wrong)}`);
});

// ---------------------------------------------------------------------------
// Access: deny by default
// ---------------------------------------------------------------------------

test("RLS is enabled on every generated table", { skip: SKIP }, async () => {
  const db = await build();
  const { rows } = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = any($1) and c.relrowsecurity
  `, [manifest.entityTables.map((t) => t.table)]);
  const enabled = new Set(rows.map((r) => r.relname));
  const missing = manifest.entityTables.map((t) => t.table).filter((t) => !enabled.has(t));
  assert.deepEqual(missing, [], `RLS is not enabled on:\n  ${missing.join("\n  ")}`);
});

test("neither anon nor authenticated is granted anything on a generated table", { skip: SKIP }, async () => {
  const db = await build();
  for (const t of manifest.entityTables) {
    for (const role of ["anon", "authenticated"]) {
      const { rows } = await db.query(
        `select has_table_privilege($1, $2, 'select') as s,
                has_table_privilege($1, $2, 'insert') as i,
                has_table_privilege($1, $2, 'update') as u,
                has_table_privilege($1, $2, 'delete') as d`,
        [role, `public.${t.table}`],
      );
      const r = rows[0];
      assert.deepEqual(
        { select: r.s, insert: r.i, update: r.u, delete: r.d },
        { select: false, insert: false, update: false, delete: false },
        `${role} must not be granted anything on ${t.table}`,
      );
    }
  }
});

test("anon and authenticated cannot read or write a generated table", { skip: SKIP }, async () => {
  // The privilege check above reads the catalog; this one exercises the denial.
  const db = await build();
  const table = manifest.entityTables[0].table;
  for (const role of ["anon", "authenticated"]) {
    await actAs(db, role, "11111111-1111-4111-8111-111111111111");
    let denied = false;
    try {
      await db.query(`select * from public.${table} limit 1`);
    } catch {
      denied = true;
    }
    assert.equal(denied, true, `${role} must not be able to select from ${table}`);
  }
});

// ---------------------------------------------------------------------------
// Constraints: enums enforced, everything else permissive
// ---------------------------------------------------------------------------

test("a declared enum is enforced and a valid member is accepted", { skip: SKIP }, async () => {
  const db = await build();
  // ifund_withdrawal.status is declared as an enum in the reference schema.
  await db.exec(`
    insert into public.ifund_withdrawal (id, status) values ('w-ok', 'pending');
  `);
  const { rows } = await db.query(`select status from public.ifund_withdrawal where id = 'w-ok'`);
  assert.equal(rows[0].status, "pending");

  let code = null;
  try {
    await db.exec(`insert into public.ifund_withdrawal (id, status) values ('w-bad', 'not_a_status')`);
  } catch (cause) {
    code = cause.code ?? String(cause.message).match(/23514/)?.[0] ?? null;
  }
  assert.equal(code, "23514", "an out-of-enum value must raise check_violation");
});

test("a null enum column is allowed", { skip: SKIP }, async () => {
  // Most declared enums are optional in the reference. The check must not make them
  // required, or a partial record would be rejected.
  const db = await build();
  await db.exec(`insert into public.ifund_withdrawal (id) values ('w-null')`);
  const { rows } = await db.query(`select status from public.ifund_withdrawal where id = 'w-null'`);
  assert.equal(rows[0].status, null);
});

test("declared enums across many tables reject values outside their set", { skip: SKIP }, async () => {
  const db = await build();
  // Sample the generated enum constraints and confirm each rejects a bad value.
  const { rows: constraints } = await db.query(`
    select t.relname as table_name, c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and c.contype = 'c'
       and c.conname like 'ifund_%_enum' and t.relname = any($1)
     order by c.conname
  `, [manifest.entityTables.map((t) => t.table)]);
  assert.ok(constraints.length > 0, "expected the generated enum constraints to exist");

  // Read the column each constraint guards from the constraint definition, because
  // the constraint name is sanitised and cannot be reversed reliably.
  let checked = 0;
  const unparsed = [];
  for (const { table_name, conname } of constraints) {
    const { rows: def } = await db.query(
      `select pg_get_constraintdef(oid) as d from pg_constraint
        where conname = $1 and conrelid = $2::regclass`,
      [conname, `public.${table_name}`],
    );
    // Postgres rewrites `col in (...)` as `col = ANY (ARRAY[...])`, and the
    // generated constraint always has the form CHECK ((col IS NULL) OR ...), so the
    // identifier is read from the IS NULL prefix rather than from the membership
    // test.
    const columnName = def[0]?.d?.match(/check\s*\(+\s*"?([a-z0-9_]+)"?\s+is\s+null/i)?.[1];
    if (!columnName) {
      unparsed.push(`${table_name}.${conname}: ${def[0]?.d}`);
      continue;
    }
    let code = null;
    try {
      await db.exec(
        `insert into public.${table_name} (id, "${columnName}")
         values ('bad-${checked}', 'ZZZ_not_a_member')`,
      );
    } catch (cause) {
      code = cause.code ?? String(cause.message).match(/23514/)?.[0] ?? null;
    }
    assert.equal(code, "23514",
      `${table_name}.${columnName} accepted a value outside its declared enum`);
    checked += 1;
  }
  assert.deepEqual(unparsed, [], "every enum constraint's column must be identifiable");
  assert.equal(checked, constraints.length, "every sampled enum constraint was exercised");
});

test("a numeric column accepts decimals and a boolean column accepts both values", { skip: SKIP }, async () => {
  // Guards against narrowing the declared types: amount is a number in the
  // reference and must not become an integer.
  const db = await build();
  await db.exec(`
    insert into public.ifund_donation (id, amount, is_recurring)
    values ('d-1', 12.34, true), ('d-2', 0.5, false);
  `);
  const { rows } = await db.query(
    `select amount from public.ifund_donation where id = 'd-1'`,
  );
  assert.equal(Number(rows[0].amount), 12.34, "a fractional amount must be preserved");
});

test("an object-typed column accepts structured json", { skip: SKIP }, async () => {
  const db = await build();
  // PlatformConnection already exists, so pick a generated table with a jsonb
  // column from the manifest by finding one dynamically.
  const { rows: candidates } = await db.query(`
    select table_name, column_name from information_schema.columns
     where table_schema='public' and data_type='jsonb' and table_name = any($1)
     order by table_name limit 1
  `, [manifest.entityTables.map((t) => t.table)]);
  assert.ok(candidates.length > 0, "expected at least one jsonb column among the generated tables");
  const { table_name, column_name } = candidates[0];
  await db.exec(
    `insert into public.${table_name} (id, "${column_name}") values ('json-1', '{"a":[1,2],"b":"c"}'::jsonb)`,
  );
  const { rows } = await db.query(
    `select "${column_name}" as v from public.${table_name} where id = 'json-1'`);
  assert.deepEqual(rows[0].v, { a: [1, 2], b: "c" });
});

// ---------------------------------------------------------------------------
// Operability
// ---------------------------------------------------------------------------

test("applying the migration twice is safe", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [ENTITY_TABLES]); // must not throw
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.tables
      where table_schema='public' and table_name = any($1)`,
    [manifest.entityTables.map((t) => t.table)],
  );
  assert.equal(rows[0].n, manifest.entityTables.length, "no table may be lost on re-apply");
});

test("the whole pending chain applies in filename order", { skip: SKIP }, async () => {
  // The entity tables must compose with the other pending migrations, including the
  // public-read hardening, which narrows grants on tables this one creates nothing of.
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, [
    "supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
    "supabase/migrations/pending/20261102_ifund_blog_entry_ownership_fix.sql",
    "supabase/migrations/pending/20261102_ifund_legal_acceptances_repair.sql",
    "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql",
    "supabase/migrations/pending/20261102_ifund_public_blog_entries_read.sql",
    "supabase/migrations/pending/20261102_ifund_public_read_hardening.sql",
  ]);
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.tables
      where table_schema='public' and table_name = any($1)`,
    [manifest.entityTables.map((t) => t.table)],
  );
  assert.equal(rows[0].n, manifest.entityTables.length);
});

test("a generated table never collides with a mapped existing table", { skip: SKIP }, async () => {
  // A collision would matter because the generated DDL uses create table if not
  // exists: against a table that already exists it would do nothing, and the
  // generated shape would be silently discarded. This is a pure manifest check, so
  // it does not depend on which migration created the pre-existing tables.
  const generated = new Set(manifest.entityTables.map((t) => t.table));
  const mapped = new Set(manifest.existingTables.map((t) => t.table));
  const overlap = [...generated].filter((t) => mapped.has(t));
  assert.deepEqual(overlap, [], `these tables are both generated and mapped: ${overlap.join(", ")}`);
});

test("the generated DDL touches no pre-existing table", { skip: SKIP }, async () => {
  // The generated file must be purely additive. If it contained an alter, a drop or
  // a grant against a table created elsewhere, applying it could change a table it
  // does not own.
  const offenders = [];
  const re = /(alter\s+table|drop\s+table|grant\s+|revoke\s+[a-z ]+\s+on\s+table)\s+public\.([a-z0-9_]+)/gi;
  for (const m of sql.matchAll(re)) {
    offenders.push(`${m[1].trim()} ${m[2]}`);
  }
  // The only statements the generator emits are create table, enable row level
  // security and revoke all, all against tables it creates itself.
  for (const offender of offenders) {
    const table = offender.split(/\s+/).pop();
    assert.ok(manifest.entityTables.some((t) => t.table === table),
      `the generated DDL alters ${table}, which it does not create`);
  }
});
