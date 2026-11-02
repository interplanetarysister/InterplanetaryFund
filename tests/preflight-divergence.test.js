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
