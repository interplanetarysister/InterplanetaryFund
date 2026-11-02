// Real-Postgres test harness for the Supabase migrations.
//
// PGlite is PostgreSQL 16 compiled to WebAssembly, so the migration SQL is
// executed by an actual Postgres engine rather than pattern-matched. It is
// close to, but not identical to, a hosted Supabase database, so this proves
// syntax, constraints, triggers, RLS and privileges — not the provider's
// configuration. The differences that matter here:
//
//   * PGlite has no `pgcrypto`. Supabase does, but `gen_random_uuid()` is core
//     from PostgreSQL 13 on, which is what the migrations actually use, so
//     dropping the extension statement does not change behavior.
//   * Supabase ships its own `auth` schema. This harness creates the minimum
//     shape the migrations reference: `auth.users` and `auth.uid()`.
//   * PostgREST sets a role plus the JWT claims per request. `actAs()` models
//     that by switching role and stubbing `auth.uid()`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Absolute path of a repository-relative file. */
export const repoFile = (relative) => `${repoRoot}${relative}`;

export const readMigration = (relative) =>
  readFileSync(repoFile(relative), "utf8");

// Committed migrations, in application order.
export const COMMITTED_MIGRATIONS = [
  "supabase/migrations/20261025011400_initial.sql",
  "supabase/migrations/20261030175218_ifund_blog_migration_foundation_20261030.sql",
  "supabase/migrations/20261030175806_ifund_blog_rls_and_index_hardening_20261030.sql",
];

/** A fresh in-memory Postgres with the Supabase-shaped auth schema. */
export async function freshDb(PGlite) {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text);
    -- auth.uid() in Supabase reads the JWT sub claim. The test.uid setting
    -- stands in for it so a test can act as a specific user.
    create or replace function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create role anon;
    create role authenticated;
  `);
  return db;
}

/**
 * Act as a role, optionally with an auth.uid(). Session-level, not SET LOCAL:
 * each db.exec is its own implicit transaction, so SET LOCAL would be a no-op.
 * role may be "postgres" to return to the privileged server role, which is
 * how the service role seeds server-owned rows.
 */
export async function actAs(db, role, uid = "") {
  await db.exec(`reset role;`);
  await db.exec(`select set_config('test.uid', '${uid}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role};`);
}

/** Apply migrations in order, failing loudly on the first error. */
export async function applyMigrations(db, relativePaths) {
  for (const relative of relativePaths) {
    const sql = readMigration(relative).replace(
      /create extension if not exists pgcrypto;/gi,
      "",
    );
    try {
      await db.exec(sql);
    } catch (cause) {
      throw new Error(`Failed applying ${relative}: ${cause.message}`);
    }
  }
}

/** Run a statement and report whether Postgres rejected it. */
export async function isRejected(db, sql) {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
}

/** Resolve the PGlite module, or null when it is not installed. */
export async function loadPGlite() {
  try {
    const mod = await import("@electric-sql/pglite");
    return mod.PGlite;
  } catch {
    return null;
  }
}
