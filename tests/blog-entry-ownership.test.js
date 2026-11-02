// Regression tests for the blog entry ownership policies (blocker B20).
//
// The committed blog migration's insert policy checked only
// `owner_auth_user_id = auth.uid()`, which is self-referential: it asks whether
// the row claims the actor owns it, not whether the actor owns the blog. So any
// authenticated account could file a published entry under the official
// Reporter blog and an anonymous visitor could read it.
//
// These tests apply the committed migrations, then the fix, and assert both
// that the hole is closed and that a legitimate owner keeps full control.
// Skips cleanly when @electric-sql/pglite is absent.

import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_MIGRATIONS,
  applyMigrations,
  freshDb,
  actAs,
  isRejected,
  loadPGlite,
} from "./helpers/pglite.js";

const FIX =
  "supabase/migrations/pending/20261102_ifund_blog_entry_ownership_fix.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const OFFICIAL_BLOG = "6ac9c315a7434f25c88834b5";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THIRD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** A database with the official blog owned by OWNER, plus the fix applied. */
async function seeded({ withFix = true } = {}) {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  if (withFix) await applyMigrations(db, [FIX]);
  for (const [id, m] of [
    [OWNER, "owner@example.com"],
    [OTHER, "other@example.com"],
    [THIRD, "third@example.com"],
  ]) {
    await db.exec(`insert into auth.users(id,email) values ('${id}','${m}')`);
  }
  await db.exec(
    `insert into public.ifund_blogs(id,title,owner_auth_user_id,legacy_owner_user_id,type,status)
     values ('${OFFICIAL_BLOG}','Interplanetary Fund Reporter','${OWNER}','legacy-owner-1','report','active')`,
  );
  // A second blog owned by OTHER, for cross-owner checks.
  await db.exec(
    `insert into public.ifund_blogs(id,title,owner_auth_user_id,legacy_owner_user_id,type,status)
     values ('other-blog-1','Other Blog','${OTHER}','legacy-owner-2','report','active')`,
  );
  return db;
}

/** A complete entry row for the given blog, owned by the given user. */
function entryRow({ id, blogId, owner, status = "published" }) {
  return `insert into public.ifund_blog_entries
    (id,blog_id,owner_auth_user_id,legacy_owner_user_id,type,title,summary,body,status)
    values ('${id}','${blogId}','${owner}','legacy-${id}','article','T','S','B','${status}')`;
}

test(
  "the vulnerability is real without the fix (regression guard)",
  { skip: SKIP },
  async () => {
    // This test pins the defect. If the committed migrations are ever corrected in
    // place, this assertion should be updated deliberately rather than deleted.
    const db = await seeded({ withFix: false });
    await actAs(db, "authenticated", OTHER);
    const rejected = await isRejected(
      db,
      entryRow({ id: "forged-1", blogId: OFFICIAL_BLOG, owner: OTHER }),
    );
    assert.equal(
      rejected,
      false,
      "without the fix, a non-owner can insert into the official blog — this is the defect being fixed",
    );

    await actAs(db, "anon");
    const visible = (
      await db.query(
        `select count(*)::int c from public.ifund_blog_entries where status='published'`,
      )
    ).rows[0].c;
    assert.equal(visible, 1, "and the forged entry is publicly readable");
  },
);

test(
  "a non-owner cannot insert an entry into the official blog",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OTHER);
    assert.equal(
      await isRejected(
        db,
        entryRow({ id: "forged-1", blogId: OFFICIAL_BLOG, owner: OTHER }),
      ),
      true,
      "filing an entry under a blog you do not own must be rejected",
    );
    // Also rejected when the row falsely claims the real owner, which is a
    // separate forgery attempt.
    assert.equal(
      await isRejected(
        db,
        entryRow({ id: "forged-2", blogId: OFFICIAL_BLOG, owner: OWNER }),
      ),
      true,
      "claiming another user's ownership must be rejected",
    );
  },
);

test(
  "the official blog stays clean and unreadable-to-anon after a forgery attempt",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OTHER);
    await isRejected(
      db,
      entryRow({ id: "forged-1", blogId: OFFICIAL_BLOG, owner: OTHER }),
    );
    await actAs(db, "anon");
    const visible = (
      await db.query(
        `select count(*)::int c from public.ifund_blog_entries where status='published'`,
      )
    ).rows[0].c;
    assert.equal(visible, 0, "no forged content is publicly readable");
  },
);

test(
  "a legitimate blog owner keeps full control of their entries",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OWNER);
    // create a draft
    assert.equal(
      await isRejected(
        db,
        entryRow({
          id: "real-1",
          blogId: OFFICIAL_BLOG,
          owner: OWNER,
          status: "draft",
        }),
      ),
      false,
      "an owner can create a draft",
    );
    // publish it
    assert.equal(
      await isRejected(
        db,
        `update public.ifund_blog_entries set status='published' where id='real-1'`,
      ),
      false,
      "an owner can publish",
    );
    // edit the body
    assert.equal(
      await isRejected(
        db,
        `update public.ifund_blog_entries set body='Updated' where id='real-1'`,
      ),
      false,
      "an owner can edit",
    );
    // and it is now publicly readable
    await actAs(db, "anon");
    const visible = (
      await db.query(
        `select count(*)::int c from public.ifund_blog_entries where status='published'`,
      )
    ).rows[0].c;
    assert.equal(visible, 1, "a published owner entry is publicly readable");
    // the owner can still delete it
    await actAs(db, "authenticated", OWNER);
    assert.equal(
      await isRejected(
        db,
        `delete from public.ifund_blog_entries where id='real-1'`,
      ),
      false,
      "an owner can delete their own entry",
    );
  },
);

test(
  "an entry cannot be retargeted onto a blog the actor does not own",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OTHER);
    await db.exec(
      entryRow({
        id: "other-1",
        blogId: "other-blog-1",
        owner: OTHER,
        status: "draft",
      }),
    );
    // Moving it onto the official blog must fail.
    assert.equal(
      await isRejected(
        db,
        `update public.ifund_blog_entries set blog_id='${OFFICIAL_BLOG}' where id='other-1'`,
      ),
      true,
      "an entry cannot be moved onto a blog the actor does not own",
    );
  },
);

test(
  "a third party cannot delete or edit someone else's entry",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OWNER);
    await db.exec(
      entryRow({
        id: "real-1",
        blogId: OFFICIAL_BLOG,
        owner: OWNER,
        status: "draft",
      }),
    );

    await actAs(db, "authenticated", THIRD);
    const edited = await db.query(
      `update public.ifund_blog_entries set title='Hacked' where id='real-1' returning id`,
    );
    assert.equal(
      edited.rows.length,
      0,
      "a third party must not be able to edit",
    );
    const removed = await db.query(
      `delete from public.ifund_blog_entries where id='real-1' returning id`,
    );
    assert.equal(
      removed.rows.length,
      0,
      "a third party must not be able to delete",
    );
  },
);

test(
  "an unpublished entry is private to its owner",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OWNER);
    await db.exec(
      entryRow({
        id: "real-1",
        blogId: OFFICIAL_BLOG,
        owner: OWNER,
        status: "draft",
      }),
    );

    await actAs(db, "anon");
    assert.equal(
      (await db.query(`select count(*)::int c from public.ifund_blog_entries`))
        .rows[0].c,
      0,
      "anon must not see a draft",
    );
    await actAs(db, "authenticated", OTHER);
    assert.equal(
      (await db.query(`select count(*)::int c from public.ifund_blog_entries`))
        .rows[0].c,
      0,
      "another member must not see someone else's draft",
    );
    await actAs(db, "authenticated", OWNER);
    assert.equal(
      (await db.query(`select count(*)::int c from public.ifund_blog_entries`))
        .rows[0].c,
      1,
      "the owner sees their own draft",
    );
  },
);

test("the fix is idempotent", { skip: SKIP }, async () => {
  const db = await seeded();
  await actAs(db, "postgres");
  await applyMigrations(db, [FIX]);
  await actAs(db, "authenticated", OTHER);
  assert.equal(
    await isRejected(
      db,
      entryRow({ id: "forged-3", blogId: OFFICIAL_BLOG, owner: OTHER }),
    ),
    true,
    "the hole stays closed after a second apply",
  );
});
