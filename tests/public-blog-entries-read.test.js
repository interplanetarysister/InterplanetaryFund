// The public Stories read path.
//
// apps/web/src/lib/editorial.js calls rpc("ifund_public_blog_entries_read", ...)
// for every public story, and that function does not exist in production:
//
//   POST /rest/v1/rpc/ifund_public_blog_entries_read -> 404 PGRST202
//
// so the Stories pages render their error state. The existing parity test only
// reads editorial.js as text and checks the call is spelled correctly, which is
// why a missing function passed for so long. These tests call the function.
//
// They also pin the reason it has to be a function rather than a table read: the
// author identity columns are not granted to anon, so an author-filtered public
// read cannot be expressed as a direct query. If that ever changes, the last test
// here fails and says so.
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

const BASE = [
  "supabase/migrations/20261025011400_initial.sql",
  "supabase/migrations/20261030175218_ifund_blog_migration_foundation_20261030.sql",
];
const RPC = "supabase/migrations/pending/20261102_ifund_public_blog_entries_read.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACTIVE_BLOG = "blog-active-0001";
const ARCHIVED_BLOG = "blog-archived-0002";

async function build() {
  const db = await freshDb(PGlite);
  await applyMigrations(db, BASE);
  await db.exec(
    `insert into auth.users(id,email)
     values ('${OWNER}','owner@example.com'),('${OTHER}','other@example.com')`,
  );
  await db.exec(`
    insert into public.ifund_blogs
      (id,owner_auth_user_id,legacy_owner_user_id,type,title,status)
    values
      ('${ACTIVE_BLOG}','${OWNER}','legacy-owner-1','report','The Reporter','active'),
      ('${ARCHIVED_BLOG}','${OWNER}','legacy-owner-1','report','Retired','archived');
  `);
  await db.exec(`
    insert into public.ifund_blog_entries
      (id,blog_id,owner_auth_user_id,legacy_owner_user_id,type,title,summary,body,status,featured,published_at)
    values
      ('entry-published-1','${ACTIVE_BLOG}','${OWNER}','legacy-owner-1','article',
       'First Story','A summary','Body text one.','published',true,'2026-01-01T00:00:00Z'),
      ('entry-published-2','${ACTIVE_BLOG}','${OWNER}','legacy-owner-1','article',
       'Second Story','Another','Body text two.','published',false,'2026-02-01T00:00:00Z'),
      ('entry-draft-1','${ACTIVE_BLOG}','${OWNER}','legacy-owner-1','article',
       'Unfinished','Draft summary','Not for the public.','draft',false,null),
      ('entry-in-archived','${ARCHIVED_BLOG}','${OWNER}','legacy-owner-1','article',
       'Hidden','Hidden','Under an archived publication.','published',false,'2026-03-01T00:00:00Z');
  `);
  return db;
}

async function call(db, args, as = "anon") {
  await actAs(db, as);
  const { rows } = await db.query(
    `select * from public.ifund_public_blog_entries_read($1,$2,$3,$4)`,
    args,
  );
  return rows;
}

test("lists published entries from the active publication, for anon", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  const rows = await call(db, [null, null, null, 100]);
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids, ["entry-published-2", "entry-published-1"],
    "published entries, newest first");
});

test("never returns drafts or entries under an archived publication", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  const ids = (await call(db, [null, null, null, 100])).map((r) => r.id);
  assert.ok(!ids.includes("entry-draft-1"), "a draft must never be public");
  assert.ok(!ids.includes("entry-in-archived"),
    "an entry under an archived publication must never be public");
});

test("nests the parent blog so the client can check blog.status", { skip: SKIP }, async () => {
  // editorialContracts.verifiedPublishedEntries drops any row whose
  // blog.status is not "active", so the nesting is part of the contract.
  const db = await build();
  await applyMigrations(db, [RPC]);
  const [row] = await call(db, [null, null, "entry-published-1", 1]);
  assert.equal(row.blog.status, "active");
  assert.equal(row.blog.id, ACTIVE_BLOG);
  assert.equal(row.blog.title, "The Reporter");
  assert.equal(row.blog.type, "report");
});

test("does not return author identity columns", { skip: SKIP }, async () => {
  // The tables withhold owner_auth_user_id and legacy_owner_user_id from anon.
  // The function resolves them internally to filter by author, so it must not
  // hand them back, or it would become a way around that grant.
  const db = await build();
  await applyMigrations(db, [RPC]);
  const [row] = await call(db, [null, null, "entry-published-1", 1]);
  assert.ok(!("owner_auth_user_id" in row), "owner_auth_user_id must not be returned");
  assert.ok(!("legacy_owner_user_id" in row), "legacy_owner_user_id must not be returned");
  assert.ok(!("legacy_created_by_id" in row), "legacy_created_by_id must not be returned");
});

test("filters by the original text author reference", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  const mine = await call(db, ["legacy-owner-1", null, null, 100]);
  assert.equal(mine.length, 2, "the author's two published entries");
  const nobody = await call(db, ["legacy-owner-9", null, null, 100]);
  assert.deepEqual(nobody, [], "an unknown author reference returns nothing");
});

test("filters by the authenticated owner uuid as well", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  const rows = await call(db, [OWNER, null, null, 100]);
  assert.equal(rows.length, 2, "a uuid author reference resolves via owner_auth_user_id");
});

test("filters by publication and by entry id", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  const byBlog = await call(db, [null, ACTIVE_BLOG, null, 100]);
  assert.equal(byBlog.length, 2);
  const byEntry = await call(db, [null, null, "entry-published-2", 1]);
  assert.equal(byEntry.length, 1);
  assert.equal(byEntry[0].title, "Second Story");
});

test("clamps the limit instead of trusting it", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  // A negative or zero limit must not return everything; it clamps to 1.
  assert.equal((await call(db, [null, null, null, 0])).length, 1);
  assert.equal((await call(db, [null, null, null, -5])).length, 1);
  // A huge limit must not exceed the 100 the client also clamps to.
  assert.ok((await call(db, [null, null, null, 100000])).length <= 100);
  // A null limit falls back to the default rather than returning everything.
  assert.equal((await call(db, [null, null, null, null])).length, 2);
});

test("an unknown entry id returns nothing rather than an error", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  assert.deepEqual(await call(db, [null, null, "no-such-entry", 1]), []);
});

test("authenticated callers see only published entries too", { skip: SKIP }, async () => {
  // The function is definer, so the caller's role does not widen the result. A
  // signed-in reader must not see another author's drafts through it.
  const db = await build();
  await applyMigrations(db, [RPC]);
  const ids = (await call(db, [null, null, null, 100], "authenticated")).map((r) => r.id);
  assert.ok(!ids.includes("entry-draft-1"));
  assert.equal(ids.length, 2);
});

test("the author filter is necessary because anon cannot read the identity column", { skip: SKIP }, async () => {
  // This is the reason the function exists rather than a plain table read. If the
  // grant ever widens, the function could be replaced by a query and this test
  // says so rather than silently keeping dead weight.
  const db = await build();
  await applyMigrations(db, [RPC]);
  await actAs(db, "anon");
  let denied = false;
  try {
    await db.query(`select owner_auth_user_id from public.ifund_blog_entries limit 1`);
  } catch {
    denied = true;
  }
  assert.equal(denied, true,
    "anon can read owner_auth_user_id, so the author-filtered function is no longer required");
});

test("replacing the function is safe to re-run", { skip: SKIP }, async () => {
  const db = await build();
  await applyMigrations(db, [RPC]);
  await applyMigrations(db, [RPC]); // create or replace must not throw
  assert.equal((await call(db, [null, null, null, 100])).length, 2);
});

test("every rpc the client calls is defined by a migration", { skip: SKIP }, async () => {
  // The gap this whole file exists to close was not a wrong call, it was a call
  // with nothing behind it: editorial.js said rpc("ifund_public_blog_entries_read")
  // and no migration defined that function, while the parity test checked only the
  // spelling. This compares the two sides, so a call site cannot pass while the
  // function is absent.
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("../", import.meta.url));

  // Collects every file; the caller filters by extension. An earlier version
  // filtered to .js/.jsx here, which silently excluded the .sql migrations and
  // made the comparison meaningless.
  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else out.push(full);
    }
    return out;
  };

  const called = new Set();
  for (const tree of ["src", "apps/web/src"]) {
    let files;
    try { files = walk(join(root, tree)); } catch { continue; }
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/g)) {
        called.add(m[1]);
      }
    }
  }
  assert.ok(called.size > 0, "expected the client to call at least one rpc");

  const sqlFiles = walk(join(root, "supabase"), []).filter((f) => f.endsWith(".sql"));
  const defined = new Set();
  for (const file of sqlFiles) {
    for (const m of readFileSync(file, "utf8").matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi)) {
      defined.add(m[1]);
    }
  }

  const missing = [...called].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [],
    `these rpcs are called by the client but defined by no migration:\n  ${missing.join("\n  ")}`);
});
