// Regression tests for the account-lifecycle write gate (blocker B16).
//
// The original defect was that ifund_posts_insert and ifund_campaigns_insert
// checked only the ownership column, so a suspended account could still publish.
// The first fix guarded INSERT only. That was not enough: a suspended owner
// could still reach status='active' by updating a draft it created while active,
// and could still edit campaign content. These tests pin both halves of the fix.
//
// They also pin the deliberate asymmetry: campaigns may still be DELETED by a
// suspended owner (so a suspended account can clean up its own drafts), while
// publishing and editing are refused. Skips cleanly without @electric-sql/pglite.

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

const MEMBER_SCHEMA =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/**
 * A database with the member migration applied and one account whose status the
 * caller chooses. The account is seeded as an active owner of one draft campaign
 * so the "was active when created" scenario is reproducible.
 */
async function seeded({ status = "active", deletionPending = false } = {}) {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, [MEMBER_SCHEMA]);
  for (const [id, m] of [
    [OWNER, "owner@example.com"],
    [OTHER, "other@example.com"],
  ]) {
    await db.exec(`insert into auth.users(id,email) values ('${id}','${m}')`);
    await db.exec(
      `insert into public.ifund_profiles(id,account_status,account_deletion_pending)
       values ('${id}','active',false)`,
    );
  }
  // Created while active, exactly as a real draft would be.
  await actAs(db, "authenticated", OWNER);
  await db.exec(
    `insert into public.ifund_campaigns(owner_id,title,summary,story,goal_amount,status)
     values ('${OWNER}','T','S','Story',100,'draft')`,
  );
  if (status !== "active" || deletionPending) {
    await actAs(db, "postgres");
    await db.exec(`update public.ifund_profiles
      set account_status='${status}', account_deletion_pending=${deletionPending}
      where id='${OWNER}'`);
  }
  return db;
}

const rowsChanged = (result) => result.rows.length > 0;

test(
  "an active account can publish its own draft",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OWNER);
    const result = await db.query(
      `update public.ifund_campaigns set status='active' where owner_id='${OWNER}' returning id,status`,
    );
    assert.equal(
      rowsChanged(result),
      true,
      "an active owner must be able to publish",
    );
    assert.equal(result.rows[0].status, "active");
  },
);

test(
  "a suspended account cannot publish by updating a draft",
  { skip: SKIP },
  async () => {
    // This is the gap in the first version of the B16 fix.
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    const result = await db.query(
      `update public.ifund_campaigns set status='active' where owner_id='${OWNER}' returning id,status`,
    );
    assert.equal(
      rowsChanged(result),
      false,
      "a suspended owner must not reach status='active' by update",
    );
    // And the stored row is genuinely unchanged.
    await actAs(db, "postgres");
    const stored = (await db.query(`select status from public.ifund_campaigns`))
      .rows[0].status;
    assert.equal(stored, "draft", "the draft must still be a draft");
  },
);

test(
  "a suspended account cannot edit campaign content",
  { skip: SKIP },
  async () => {
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    const result = await db.query(
      `update public.ifund_campaigns set title='Hijacked' where owner_id='${OWNER}' returning id`,
    );
    assert.equal(
      rowsChanged(result),
      false,
      "a suspended owner must not edit content",
    );
    await actAs(db, "postgres");
    assert.equal(
      (await db.query(`select title from public.ifund_campaigns`)).rows[0]
        .title,
      "T",
    );
  },
);

test(
  "an account pending deletion cannot publish even while still active",
  { skip: SKIP },
  async () => {
    // The helper requires account_status='active' AND account_deletion_pending=false,
    // so a still-active account that has requested deletion must not publish.
    const db = await seeded({ deletionPending: true });
    await actAs(db, "authenticated", OWNER);
    assert.equal(
      rowsChanged(
        await db.query(
          `update public.ifund_campaigns set status='active' where owner_id='${OWNER}' returning id`,
        ),
      ),
      false,
      "a deletion-pending account must not publish",
    );
  },
);

test(
  "a suspended account cannot create a new campaign",
  { skip: SKIP },
  async () => {
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_campaigns(owner_id,title,summary,story,goal_amount,status)
       values ('${OWNER}','N','S','Story',50,'draft')`,
      ),
      true,
      "insert must be refused for a suspended account",
    );
  },
);

test(
  "a suspended account cannot publish to the community feed",
  { skip: SKIP },
  async () => {
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_posts(author_id,body) values ('${OWNER}','hello')`,
      ),
      true,
      "a suspended account must not post",
    );
  },
);

test(
  "a suspended account may still delete its own draft",
  { skip: SKIP },
  async () => {
    // Deliberate: deletion stays available so a suspended account can clean up.
    // Publishing and editing are what the lifecycle gate blocks.
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    const result = await db.query(
      `delete from public.ifund_campaigns where owner_id='${OWNER}' returning id`,
    );
    assert.equal(
      rowsChanged(result),
      true,
      "a suspended owner may still delete its own draft",
    );
  },
);

test(
  "an active account cannot touch another owner's campaign",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", OTHER);
    const result = await db.query(
      `update public.ifund_campaigns set status='active' where owner_id='${OWNER}' returning id`,
    );
    assert.equal(
      rowsChanged(result),
      false,
      "ownership is still enforced independently of status",
    );
  },
);

test(
  "the lifecycle helper reflects the profile row",
  { skip: SKIP },
  async () => {
    const db = await seeded({ status: "suspended" });
    await actAs(db, "authenticated", OWNER);
    const active = (
      await db.query(`select public.ifund_current_account_is_active() as a`)
    ).rows[0].a;
    assert.equal(active, false, "a suspended account is not active");
    await actAs(db, "postgres");
    await db.exec(
      `update public.ifund_profiles set account_status='active' where id='${OWNER}'`,
    );
    await actAs(db, "authenticated", OWNER);
    const now = (
      await db.query(`select public.ifund_current_account_is_active() as a`)
    ).rows[0].a;
    assert.equal(now, true, "an activated account is active");
  },
);

test("a member with no profile row is not active", { skip: SKIP }, async () => {
  // Fail-closed: an account seen by auth but not yet reconciled has no profile.
  const db = await seeded();
  const stranger = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  await actAs(db, "postgres");
  await db.exec(
    `insert into auth.users(id,email) values ('${stranger}','new@example.com')`,
  );
  await actAs(db, "authenticated", stranger);
  const active = (
    await db.query(`select public.ifund_current_account_is_active() as a`)
  ).rows[0].a;
  assert.equal(active, false, "an unreconciled account must not be active");
});
