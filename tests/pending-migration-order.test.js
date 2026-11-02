// The two pending migrations are documented as independent, so either apply
// order should work. That was asserted in prose before it was tested; this suite
// makes it an executable claim.
//
// It also checks that the security effect of each migration survives the other
// order, so "independent" means "still correct", not merely "still parses".
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_MIGRATIONS,
  applyMigrations,
  freshDb,
  actAs,
  loadPGlite,
} from "./helpers/pglite.js";

const MEMBER_SCHEMA =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";
const BLOG_OWNERSHIP =
  "supabase/migrations/pending/20261102_ifund_blog_entry_ownership_fix.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OFFICIAL_BLOG = "6ac9c315a7434f25c88834b5";

async function build(order) {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, order);
  await db.exec(
    `insert into auth.users(id,email) values ('${OWNER}','o@example.com'),('${OTHER}','b@example.com')`,
  );
  await db.exec(
    `insert into public.ifund_profiles(id,account_status,account_deletion_pending)
     values ('${OWNER}','active',false),('${OTHER}','active',false)`,
  );
  await db.exec(
    `insert into public.ifund_blogs(id,title,owner_auth_user_id,legacy_owner_user_id,type,status)
     values ('${OFFICIAL_BLOG}','Reporter','${OWNER}','legacy-1','report','active')`,
  );
  return db;
}

const ORDERS = [
  ["member schema, then blog ownership", [MEMBER_SCHEMA, BLOG_OWNERSHIP]],
  ["blog ownership, then member schema", [BLOG_OWNERSHIP, MEMBER_SCHEMA]],
];

for (const [label, order] of ORDERS) {
  test(
    `both pending migrations apply cleanly: ${label}`,
    { skip: SKIP },
    async () => {
      const db = await build(order);
      // The member tables exist.
      for (const table of [
        "ifund_follows",
        "ifund_notifications",
        "ifund_inbox_items",
        "ifund_legal_acceptances",
        "ifund_official_publications",
      ]) {
        const found = await db.query(
          `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
          [table],
        );
        assert.equal(found.rows.length, 1, `${table} must exist`);
      }
      // And the lifecycle helper exists.
      const fn = await db.query(
        `select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='ifund_current_account_is_active'`,
      );
      assert.equal(fn.rows.length, 1, "the lifecycle helper must exist");
    },
  );

  test(
    `the blog ownership fix still holds: ${label}`,
    { skip: SKIP },
    async () => {
      const db = await build(order);
      await actAs(db, "authenticated", OTHER);
      let injected = false;
      try {
        await db.exec(
          `insert into public.ifund_blog_entries
         (id,blog_id,owner_auth_user_id,legacy_owner_user_id,type,title,summary,body,status)
         values ('forged','${OFFICIAL_BLOG}','${OTHER}','legacy-b','article','Fake','F','B','published')`,
        );
        injected = true;
      } catch {
        /* expected */
      }
      assert.equal(
        injected,
        false,
        "a non-owner must not be able to inject a published entry",
      );
    },
  );

  test(
    `the account-lifecycle write gate still holds: ${label}`,
    { skip: SKIP },
    async () => {
      const db = await build(order);
      await actAs(db, "postgres");
      await db.exec(
        `update public.ifund_profiles set account_status='suspended' where id='${OWNER}'`,
      );
      // Seed the draft as the server so the lifecycle gate is what refuses, not insert.
      await db.exec(
        `insert into public.ifund_campaigns(owner_id,title,summary,story,goal_amount,status)
       values ('${OWNER}','T','S','Story',100,'draft')`,
      );
      await actAs(db, "authenticated", OWNER);
      const published = await db.query(
        `update public.ifund_campaigns set status='active' where owner_id='${OWNER}' returning id`,
      );
      assert.equal(
        published.rows.length,
        0,
        "a suspended owner must not publish by update",
      );
    },
  );
}
