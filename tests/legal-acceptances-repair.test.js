// Production's public.ifund_legal_acceptances was created outside this
// repository's migrations, and it is missing its primary key.
//
// Measured against ssibsfmtodgximseeqsv with scripts/reconcile-production-schema.mjs,
// the table exists with owner_id, terms_version, explicit_consent and accepted_at,
// and WITHOUT id and WITHOUT created_at. The member-schema migration declares the
// table with `create table if not exists`, which against that table does nothing at
// all, so the declared primary key, defaults and unique constraint are silently
// discarded.
//
// 20261102_ifund_legal_acceptances_repair.sql fixes the existing table. These tests
// prove it repairs the exact shape production has, that it is idempotent, that it
// preserves rows, that it does not fire when there is nothing to repair, and -
// the point of the exercise - that it lets the member-schema preflight pass
// afterwards instead of refusing.
//
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMigrations,
  actAs,
  freshDb,
  loadPGlite,
} from "./helpers/pglite.js";

const BASE = ["supabase/migrations/20261025011400_initial.sql"];
const REPAIR =
  "supabase/migrations/pending/20261102_ifund_legal_acceptances_repair.sql";
const MEMBER_SCHEMA =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

/**
 * Reproduce exactly the table production holds.
 *
 * Verified column by column against ssibsfmtodgximseeqsv with
 * scripts/reconcile-production-schema.mjs: present are owner_id, terms_version,
 * explicit_consent, accepted_at, acceptance_method, terms_path and privacy_path;
 * absent are id and created_at. Getting this wrong in either direction would make
 * the tests prove something about a database that does not exist.
 */
async function productionShape(db) {
  await db.exec(`
    create table public.ifund_legal_acceptances (
      owner_id uuid not null,
      terms_version text not null,
      explicit_consent boolean not null,
      accepted_at timestamptz not null default now(),
      acceptance_method text not null default 'explicit_checkbox',
      terms_path text not null default '/terms',
      privacy_path text not null default '/privacy'
    );
  `);
}

async function columnsOf(db, table) {
  const { rows } = await db.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function primaryKeyColumns(db, table) {
  const { rows } = await db.query(
    `select a.attname
       from pg_constraint c
       join unnest(c.conkey) as k(attnum) on true
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.conrelid = $1::regclass and c.contype = 'p'
      order by a.attname`,
    [`public.${table}`],
  );
  return rows.map((r) => r.attname);
}

test("repairs the exact shape production holds", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);

  const before = await columnsOf(db, "ifund_legal_acceptances");
  assert.ok(!before.has("id"), "precondition: production has no id");
  assert.ok(!before.has("created_at"), "precondition: production has no created_at");
  assert.deepEqual(await primaryKeyColumns(db, "ifund_legal_acceptances"), [],
    "precondition: production has no primary key");

  await applyMigrations(db, [REPAIR]);

  const after = await columnsOf(db, "ifund_legal_acceptances");
  assert.ok(after.has("id"), "id must be added");
  assert.ok(after.has("created_at"), "created_at must be added");
  assert.deepEqual(await primaryKeyColumns(db, "ifund_legal_acceptances"), ["id"],
    "id must become the primary key");

  // created_at must be NOT NULL, matching the declaration the no-op discarded.
  const { rows } = await db.query(
    `select is_nullable from information_schema.columns
      where table_schema='public' and table_name='ifund_legal_acceptances'
        and column_name='created_at'`,
  );
  assert.equal(rows[0].is_nullable, "NO", "created_at must be NOT NULL");
});

test("preserves existing rows and gives each a distinct id", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);

  const user = "11111111-1111-4111-8111-111111111111";
  await db.exec(`
    insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent)
    values ('${user}', 'v1', true);
  `);

  await applyMigrations(db, [REPAIR]);

  const { rows } = await db.query(
    `select id, owner_id, terms_version, explicit_consent, created_at
       from public.ifund_legal_acceptances`,
  );
  assert.equal(rows.length, 1, "the existing row must survive");
  assert.ok(rows[0].id, "the existing row must have been given an id");
  assert.equal(rows[0].explicit_consent, true, "consent must not be altered");
  assert.ok(rows[0].created_at, "created_at must have been populated");
});

test("collapses duplicate acceptances so the unique constraint can be added", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);

  const user = "22222222-2222-4222-8222-222222222222";
  // Two duplicates, one of which wrongly records no consent.
  await db.exec(`
    insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent, accepted_at)
    values
      ('${user}', 'v1', true,  '2026-01-01T00:00:00Z'),
      ('${user}', 'v1', false, '2026-01-02T00:00:00Z'),
      ('${user}', 'v1', true,  '2026-01-03T00:00:00Z');
  `);

  await applyMigrations(db, [REPAIR]);

  const { rows } = await db.query(
    `select explicit_consent, accepted_at from public.ifund_legal_acceptances
      where owner_id = '${user}'`,
  );
  assert.equal(rows.length, 1, "duplicates must be collapsed to one row");
  assert.equal(rows[0].explicit_consent, true,
    "the retained row must be one that records consent");
});

test("the unique constraint makes a duplicate insert raise 23505", { skip: SKIP }, async () => {
  // The client ignores error code 23505 on insert, which is only correct if the
  // database actually enforces uniqueness. Without the constraint the client would
  // accumulate duplicate consent rows and its maybeSingle() read would then error
  // on multiple rows.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);
  await applyMigrations(db, [REPAIR]);

  const user = "33333333-3333-4333-8333-333333333333";
  await db.exec(`
    insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent)
    values ('${user}', 'v1', true);
  `);

  let code = null;
  try {
    await db.exec(`
      insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent)
      values ('${user}', 'v1', true);
    `);
  } catch (cause) {
    code = cause.code ?? String(cause.message).match(/23505/)?.[0] ?? null;
  }
  assert.equal(code, "23505", "a duplicate acceptance must raise unique_violation");
});

test("is idempotent when applied twice", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);
  await applyMigrations(db, [REPAIR]);
  await applyMigrations(db, [REPAIR]); // must not throw

  assert.deepEqual(await primaryKeyColumns(db, "ifund_legal_acceptances"), ["id"]);
  assert.ok((await columnsOf(db, "ifund_legal_acceptances")).has("created_at"));
});

test("does nothing when the table does not exist", { skip: SKIP }, async () => {
  // On a fresh database the member-schema migration creates the table in full, so
  // the repair must be a clean no-op rather than an error.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await applyMigrations(db, [REPAIR]);

  const { rows } = await db.query(
    `select to_regclass('public.ifund_legal_acceptances') as t`,
  );
  assert.equal(rows[0].t, null, "the repair must not create the table");
});

test("leaves an already-correct table untouched", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  // A conforming table, as the member-schema migration would create it.
  await db.exec(`
    create table public.ifund_legal_acceptances (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null,
      terms_version text not null,
      explicit_consent boolean not null,
      accepted_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      unique (owner_id, terms_version)
    );
  `);
  await applyMigrations(db, [REPAIR]);

  assert.deepEqual(await primaryKeyColumns(db, "ifund_legal_acceptances"), ["id"]);
  const cols = await columnsOf(db, "ifund_legal_acceptances");
  assert.equal(cols.size, 6, `expected the 6 original columns, found ${[...cols].join(",")}`);
});

test("unblocks the member-schema preflight that would otherwise refuse", { skip: SKIP }, async () => {
  // This is the point of the repair. Before it, the member-schema migration
  // refuses because production's table lacks id and created_at. After it, the
  // preflight passes and the migration applies.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);

  // Before: refused. The refusal raises inside the migration's transaction, which
  // leaves that transaction aborted, so it must be rolled back before the next
  // statement can run.
  let refused = false;
  try {
    await applyMigrations(db, [MEMBER_SCHEMA]);
  } catch (cause) {
    refused = true;
    assert.match(cause.message, /SHAPE/, "the refusal must be a shape divergence");
    assert.match(cause.message, /"id"/, "the missing primary key must be named");
  }
  assert.equal(refused, true, "the member schema must refuse production's shape");
  await db.exec("rollback");

  // After the repair: accepted.
  await applyMigrations(db, [REPAIR]);
  await applyMigrations(db, [MEMBER_SCHEMA]); // must not throw

  const cols = await columnsOf(db, "ifund_legal_acceptances");
  for (const c of ["id", "owner_id", "terms_version", "explicit_consent",
                   "accepted_at", "created_at"]) {
    assert.ok(cols.has(c), `after repair the table must have ${c}`);
  }
});

test("the client's consent flow works end to end after the repair", { skip: SKIP }, async () => {
  // Mirrors apps/web/src/components/auth/MemberAccess.jsx: insert the three
  // columns a member supplies, then read them back for one terms version, then
  // confirm a repeat insert is the ignorable 23505.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);
  await applyMigrations(db, [REPAIR]);
  await applyMigrations(db, [MEMBER_SCHEMA]);

  const user = "44444444-4444-4444-8444-444444444444";
  await actAs(db, "authenticated", user);

  await db.exec(`
    insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent)
    values ('${user}', '2026-01', true);
  `);

  const { rows } = await db.query(
    `select owner_id, terms_version, explicit_consent
       from public.ifund_legal_acceptances
      where owner_id = '${user}' and terms_version = '2026-01'`,
  );
  assert.equal(rows.length, 1, "the member's acceptance must be readable");
  assert.equal(rows[0].explicit_consent, true, "consent must read back as true");

  let code = null;
  try {
    await db.exec(`
      insert into public.ifund_legal_acceptances (owner_id, terms_version, explicit_consent)
      values ('${user}', '2026-01', true);
    `);
  } catch (cause) {
    code = cause.code ?? String(cause.message).match(/23505/)?.[0] ?? null;
  }
  assert.equal(code, "23505", "a repeat acceptance must be the ignorable 23505");
});

test("filename ordering puts the repair before the member schema", { skip: SKIP }, async () => {
  // The repair only helps if it is applied first. Migration runners sort by
  // filename, so the ordering is a property of the names, and that property is
  // asserted here rather than left to a comment.
  const { readdirSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const dir = fileURLToPath(new URL("../supabase/migrations/pending/", import.meta.url));
  const sorted = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const repairAt = sorted.indexOf("20261102_ifund_legal_acceptances_repair.sql");
  const memberAt = sorted.indexOf("20261102_ifund_member_schema_completion.sql");
  assert.ok(repairAt !== -1, "the repair migration must exist");
  assert.ok(memberAt !== -1, "the member schema migration must exist");
  assert.ok(repairAt < memberAt,
    `the repair must sort before the member schema; sorted order is ${sorted.join(", ")}`);
});

test("applying the member schema before the repair is refused", { skip: SKIP }, async () => {
  // The dependency is real and directional: with production's shape and the wrong
  // order, the member schema refuses. This is why the repair must sort first, and
  // it documents that the failure is loud rather than silent.
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await productionShape(db);

  let refused = false;
  try {
    await applyMigrations(db, [MEMBER_SCHEMA]);
  } catch (cause) {
    refused = true;
    assert.match(cause.message, /SHAPE/);
  }
  assert.equal(refused, true,
    "with the wrong order the member schema must refuse rather than silently no-op");
});
