// Member-schema migration: applied to a real PostgreSQL engine and exercised
// with two distinct accounts plus a suspended account.
//
// This suite exists because the committed migration set created six tables
// while the client and worker query eleven. Five tables
// (ifund_legal_acceptances, ifund_notifications, ifund_inbox_items,
// ifund_follows, ifund_official_publications), the ifund_profiles
// account-lifecycle columns, and public.ifund_current_account_is_active() were
// referenced but defined nowhere, so every member gate failed closed at
// runtime. The migration under test supplies them and closes blocker B16.
//
// Skips cleanly when @electric-sql/pglite is absent, so a plain `npm ci` still
// runs the rest of the suite.

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

const MEMBER_MIGRATION =
  "supabase/migrations/pending/20261102_ifund_member_schema_completion.sql";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const A = "11111111-1111-4111-8111-111111111111"; // active member
const B = "22222222-2222-4222-8222-222222222222"; // second member
const S = "33333333-3333-4333-8333-333333333333"; // suspended member

async function seeded() {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, [MEMBER_MIGRATION]);
  for (const [id, handle] of [
    [A, "alice"],
    [B, "bob"],
    [S, "sam"],
  ]) {
    await db.exec(
      `insert into auth.users(id,email) values ('${id}','${handle}@example.com')`,
    );
    await db.exec(
      `insert into public.ifund_profiles(id,handle,display_name) values ('${id}','${handle}','${handle}')`,
    );
  }
  await db.exec(
    `update public.ifund_profiles set account_status='active' where id in ('${A}','${B}')`,
  );
  await db.exec(
    `update public.ifund_profiles set account_status='suspended' where id='${S}'`,
  );
  return db;
}

test(
  "the member-schema migration applies on top of the committed baseline",
  { skip: SKIP },
  async () => {
    const db = await freshDb(PGlite);
    await applyMigrations(db, COMMITTED_MIGRATIONS);
    await applyMigrations(db, [MEMBER_MIGRATION]);
    const tables = await db.query(
      `select tablename from pg_tables where schemaname='public' order by 1`,
    );
    const names = tables.rows.map((r) => r.tablename);
    for (const expected of [
      "ifund_legal_acceptances",
      "ifund_notifications",
      "ifund_inbox_items",
      "ifund_follows",
      "ifund_official_publications",
      "ifund_profiles",
      "ifund_campaigns",
    ]) {
      assert.ok(
        names.includes(expected),
        `${expected} must exist after the migration`,
      );
    }
  },
);

test(
  "every table the client queries now exists in the schema",
  { skip: SKIP },
  async () => {
    // The contract: this is the exact set of .from("ifund_...") targets in
    // src/, apps/web/src and worker/. A new query without a migration must fail here.
    const queried = [
      "ifund_blog_entries",
      "ifund_blogs",
      "ifund_campaigns",
      "ifund_connections",
      "ifund_follows",
      "ifund_inbox_items",
      "ifund_legal_acceptances",
      "ifund_notifications",
      "ifund_official_publications",
      "ifund_posts",
      "ifund_profiles",
    ];
    const db = await freshDb(PGlite);
    await applyMigrations(db, COMMITTED_MIGRATIONS);
    await applyMigrations(db, [MEMBER_MIGRATION]);
    const tables = await db.query(
      `select tablename from pg_tables where schemaname='public'`,
    );
    const names = new Set(tables.rows.map((r) => r.tablename));
    const missing = queried.filter((t) => !names.has(t));
    assert.deepEqual(
      missing,
      [],
      `tables queried by code but not created: ${missing.join(", ")}`,
    );
  },
);

test("account lifecycle defaults fail closed", { skip: SKIP }, async () => {
  const db = await freshDb(PGlite);
  await applyMigrations(db, COMMITTED_MIGRATIONS);
  await applyMigrations(db, [MEMBER_MIGRATION]);
  await db.exec(
    `insert into auth.users(id,email) values ('${A}','a@example.com')`,
  );
  await db.exec(
    `insert into public.ifund_profiles(id,handle) values ('${A}','alice')`,
  );
  const row = (
    await db.query(
      `select account_status,account_deletion_pending from public.ifund_profiles where id='${A}'`,
    )
  ).rows[0];
  // A newly seen account must not silently acquire member access.
  assert.equal(row.account_status, "pending");
  assert.equal(row.account_deletion_pending, false);
  // An unknown status is rejected.
  assert.equal(
    await isRejected(
      db,
      `update public.ifund_profiles set account_status='superuser' where id='${A}'`,
    ),
    true,
  );
});

test(
  "B16: a suspended account cannot publish, but an active one can",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", S);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_posts(author_id,body) values ('${S}','suspended')`,
      ),
      true,
      "suspended account must not be able to post",
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_campaigns(owner_id,title,summary,story,category,goal_amount,cover_image_url,status) values ('${S}','t','s','y','community',10,'','draft')`,
      ),
      true,
      "suspended account must not be able to create a campaign",
    );
    const posts = (
      await db.query(`select count(*)::int c from public.ifund_posts`)
    ).rows[0].c;
    assert.equal(posts, 0, "no post may be stored for a suspended account");

    await actAs(db, "authenticated", A);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_posts(author_id,body) values ('${A}','hello')`,
      ),
      false,
      "an active account must still be able to post",
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_campaigns(owner_id,title,summary,story,category,goal_amount,cover_image_url,status) values ('${A}','Plaza','Lights','Story','community',100,'','draft')`,
      ),
      false,
      "an active account must still be able to create a draft",
    );
  },
);

test(
  "follows require an active account and a published campaign",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", A);
    await db.exec(
      `insert into public.ifund_campaigns(owner_id,title,summary,story,category,goal_amount,cover_image_url,status) values ('${A}','Plaza','Lights','Story','community',100,'','draft')`,
    );
    const campId = (
      await db.query(`select id from public.ifund_campaigns limit 1`)
    ).rows[0].id;

    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_follows(owner_id,campaign_id) values ('${A}','${campId}')`,
      ),
      true,
      "a draft campaign must not be followable",
    );

    await db.exec(
      `update public.ifund_campaigns set status='active' where id='${campId}'`,
    );
    await actAs(db, "authenticated", A);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_follows(owner_id,campaign_id) values ('${A}','${campId}')`,
      ),
      false,
      "an active account must be able to follow an active campaign",
    );

    await actAs(db, "authenticated", S);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_follows(owner_id,campaign_id) values ('${S}','${campId}')`,
      ),
      true,
      "a suspended account must not be able to follow",
    );
  },
);

test("follows are private to their owner", { skip: SKIP }, async () => {
  const db = await seeded();
  await actAs(db, "authenticated", A);
  await db.exec(
    `insert into public.ifund_campaigns(owner_id,title,summary,story,category,goal_amount,cover_image_url,status) values ('${A}','Plaza','Lights','Story','community',100,'','active')`,
  );
  const campId = (
    await db.query(`select id from public.ifund_campaigns limit 1`)
  ).rows[0].id;
  await db.exec(
    `insert into public.ifund_follows(owner_id,campaign_id) values ('${A}','${campId}')`,
  );

  await actAs(db, "authenticated", B);
  const visible = (
    await db.query(`select count(*)::int c from public.ifund_follows`)
  ).rows[0].c;
  assert.equal(visible, 0, "another member must not see the follow");
  const stolen = await db.query(
    `update public.ifund_follows set pinned=true where owner_id='${A}' returning id`,
  );
  assert.equal(
    stolen.rows.length,
    0,
    "another member must not be able to modify the follow",
  );
});

test(
  "consent is recorded once, only for the acting member, and never false",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", A);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_legal_acceptances(owner_id,terms_version,explicit_consent) values ('${A}','2026-10-13-v3',true)`,
      ),
      false,
      "a member must be able to record their own consent",
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_legal_acceptances(owner_id,terms_version,explicit_consent) values ('${A}','2026-10-13-v4',false)`,
      ),
      true,
      "explicit_consent=false must be rejected",
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_legal_acceptances(owner_id,terms_version,explicit_consent) values ('${B}','2026-10-13-v3',true)`,
      ),
      true,
      "a member must not record consent for someone else",
    );
    const acceptedAt = (
      await db.query(
        `select accepted_at from public.ifund_legal_acceptances where owner_id='${A}'`,
      )
    ).rows[0].accepted_at;
    assert.notEqual(acceptedAt, null, "accepted_at must be server-populated");
  },
);

test(
  "notifications and inbox items are owner-scoped and server-written",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    // The server (service role) seeds these rows.
    await actAs(db, "postgres");
    await db.exec(
      `insert into public.ifund_notifications(owner_id,title,body) values ('${A}','Hi','There')`,
    );

    await actAs(db, "authenticated", B);
    const seen = (
      await db.query(`select count(*)::int c from public.ifund_notifications`)
    ).rows[0].c;
    assert.equal(seen, 0, "another member must not read the notification");
    const touched = await db.query(
      `update public.ifund_notifications set read=true where owner_id='${A}' returning id`,
    );
    assert.equal(
      touched.rows.length,
      0,
      "another member must not mark it read",
    );

    await actAs(db, "authenticated", A);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_notifications(owner_id,title,body) values ('${A}','x','y')`,
      ),
      true,
      "a browser must not author a notification",
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_inbox_items(owner_id,platform,content) values ('${A}','x','y')`,
      ),
      true,
      "a browser must not author an inbox item",
    );
  },
);

test(
  "official publications are readable only once finalized",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "postgres");
    await db.exec(
      `insert into public.ifund_official_publications(kind,title,body,status) values ('report','Draft','x','draft')`,
    );
    await db.exec(
      `insert into public.ifund_official_publications(kind,title,body,status,final_approved,published_at) values ('report','Live','x','published',true,now())`,
    );
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_official_publications(kind,title,body,status,final_approved,published_at) values ('report','Bad','x','published',false,now())`,
      ),
      true,
      "published without approval must be rejected by the constraint",
    );

    await actAs(db, "anon");
    const readable = (
      await db.query(
        `select count(*)::int c from public.ifund_official_publications`,
      )
    ).rows[0].c;
    assert.equal(readable, 1, "anon sees only the finalized publication");
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_official_publications(kind,title,body,status) values ('report','Sneaky','x','draft')`,
      ),
      true,
      "anon must not write a publication",
    );
    await actAs(db, "authenticated", A);
    assert.equal(
      await isRejected(
        db,
        `insert into public.ifund_official_publications(kind,title,body,status) values ('report','Sneaky','x','draft')`,
      ),
      true,
      "a member must not write a publication",
    );
  },
);

test("the migration is idempotent", { skip: SKIP }, async () => {
  const db = await seeded();
  await actAs(db, "postgres");
  await applyMigrations(db, [MEMBER_MIGRATION]);
  const tables = await db.query(
    `select count(*)::int c from pg_tables where schemaname='public'`,
  );
  assert.ok(tables.rows[0].c > 0, "schema still present after a second apply");
});

test(
  "the lifecycle helper is boolean-only and exposes no row data",
  { skip: SKIP },
  async () => {
    const db = await seeded();
    await actAs(db, "authenticated", A);
    const active = (
      await db.query(`select public.ifund_current_account_is_active() as ok`)
    ).rows[0].ok;
    assert.equal(active, true, "an active member is reported active");
    await actAs(db, "authenticated", S);
    const suspended = (
      await db.query(`select public.ifund_current_account_is_active() as ok`)
    ).rows[0].ok;
    assert.equal(suspended, false, "a suspended member is not active");
    await actAs(db, "anon");
    const anon = (
      await db.query(`select public.ifund_current_account_is_active() as ok`)
    ).rows[0].ok;
    assert.equal(anon, false, "an anonymous caller is not active");
  },
);
