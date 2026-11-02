// Public read hardening, and the ownership lookup the Community page needs.
//
// Two problems are covered here, both measured against production project
// ssibsfmtodgximseeqsv:
//
//   1. src/pages/Community.jsx calls rpc("ifund_my_post_ids") to learn which posts
//      to offer a delete control for. Production answers 401 permission denied, and
//      no migration in this repository defines the function, so a database built
//      from these migrations would not have it at all.
//
//   2. The committed initial migration grants anon a table-wide select on
//      ifund_posts and ifund_campaigns, which exposes author_id and owner_id -
//      account uuids - on every public row. Production withholds both.
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
const HARDENING = "supabase/migrations/pending/20261102_ifund_public_read_hardening.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

async function build() {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await db.exec(
    `insert into auth.users(id,email)
     values ('${ME}','me@example.com'),('${OTHER}','other@example.com')`,
  );
  await db.exec(`
    insert into public.ifund_posts (id,author_id,body) values
      ('aaaaaaaa-0000-4000-8000-000000000001','${ME}','My first post'),
      ('aaaaaaaa-0000-4000-8000-000000000002','${ME}','My second post'),
      ('bbbbbbbb-0000-4000-8000-000000000001','${OTHER}','Someone else''s post');
  `);
  await db.exec(`
    insert into public.ifund_campaigns
      (id,owner_id,title,summary,story,category,goal_amount,status)
    values
      ('cccccccc-0000-4000-8000-000000000001','${ME}','Mine','Summary',
       'A story long enough to satisfy the check constraint.','community',100,'active'),
      ('cccccccc-0000-4000-8000-000000000002','${OTHER}','Theirs','Summary',
       'A story long enough to satisfy the check constraint.','medical',250,'active');
  `);
  return db;
}

/** Try a select and report whether it was allowed. */
async function canRead(db, sql) {
  try {
    await db.query(sql);
    return true;
  } catch {
    return false;
  }
}

test("ifund_my_post_ids returns only the caller's posts", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "authenticated", ME);
  const { rows } = await db.query(`select post_id from public.ifund_my_post_ids()`);
  assert.equal(rows.length, 2, "the caller authored two posts");
  for (const r of rows) assert.ok(String(r.post_id).startsWith("aaaaaaaa"),
    "only the caller's posts may be returned");
});

test("ifund_my_post_ids returns nothing for a member with no posts", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await db.exec(`insert into auth.users(id,email) values ('33333333-3333-4333-8333-333333333333','new@example.com')`);
  await actAs(db, "authenticated", "33333333-3333-4333-8333-333333333333");
  const { rows } = await db.query(`select post_id from public.ifund_my_post_ids()`);
  assert.deepEqual(rows, [], "a member with no posts owns nothing");
});

test("ifund_my_post_ids never returns another member's posts", { skip: SKIP }, async () => {
  // The function is definer, so the caller's role does not narrow it; the
  // auth.uid() comparison is the only thing that does. This is the test that
  // matters, because a mistake here would show a delete control on someone
  // else's post.
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "authenticated", OTHER);
  const { rows } = await db.query(`select post_id from public.ifund_my_post_ids()`);
  assert.equal(rows.length, 1);
  assert.ok(String(rows[0].post_id).startsWith("bbbbbbbb"));
});

test("the function exposes no author identity", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "authenticated", ME);
  const { rows } = await db.query(`select * from public.ifund_my_post_ids()`);
  assert.deepEqual(Object.keys(rows[0]), ["post_id"],
    "only the post id may be returned, never author_id");
});

test("anon may read the public columns of posts", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "anon");
  assert.equal(await canRead(db, `select id,body,created_at from public.ifund_posts`), true);
});

test("anon may not read author_id, and the function does not leak it", { skip: SKIP }, async () => {
  // This is the reason ifund_my_post_ids exists. If anon could read author_id, the
  // client could compare it directly and the function would be unnecessary.
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "anon");
  assert.equal(await canRead(db, `select author_id from public.ifund_posts`), false,
    "author_id must be withheld from anon");
  assert.equal(await canRead(db, `select * from public.ifund_posts`), false,
    "a wildcard select must not be a way around the column grant");
});

test("anon may read the public columns of campaigns but not owner_id", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "anon");
  assert.equal(
    await canRead(db, `select id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,updated_at from public.ifund_campaigns`),
    true, "every column the public pages and the worker select must remain readable");
  assert.equal(await canRead(db, `select owner_id from public.ifund_campaigns`), false,
    "owner_id must be withheld from anon");
});

test("authenticated members keep access to the identity columns", { skip: SKIP }, async () => {
  // The ownership policies and the owner-scoped reads are written against these
  // columns, so narrowing anon must not narrow authenticated.
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "authenticated", ME);
  assert.equal(await canRead(db, `select owner_id from public.ifund_campaigns`), true);
  assert.equal(await canRead(db, `select author_id from public.ifund_posts`), true);
});

test("the public pages' exact column lists still resolve", { skip: SKIP }, async () => {
  // Guards against narrowing anon below what the frontend actually selects. These
  // lists are copied from src/pages/Discover.jsx, src/pages/Community.jsx and
  // worker/reads.js.
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "anon");
  assert.equal(await canRead(db,
    `select id,title,summary,story,category,goal_amount,cover_image_url,status,created_at
       from public.ifund_campaigns where status = 'active'`), true);
  assert.equal(await canRead(db, `select id,body,created_at from public.ifund_posts`), true);
});

test("re-running the migration is safe", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [HARDENING]);
  await applyMigrations(db, [HARDENING]);
  await actAs(db, "authenticated", ME);
  const { rows } = await db.query(`select post_id from public.ifund_my_post_ids()`);
  assert.equal(rows.length, 2);
});
