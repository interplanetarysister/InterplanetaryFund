// Disaster-response workflow, Phase 1 — DB slice (PGlite).
//
// Applies the disaster migrations against a real Postgres engine and proves
// the tables/constraints, the owner-scoped check-in RPCs, the yes/no side
// effects, and the super-admin gate. Skips cleanly when
// @electric-sql/pglite is not installed.
//
// Fixture notes:
// - The harness's auth.uid() reads the test.uid setting; auth.jwt() and the
//   verified-admin check are stand-ins defined here (the applied migrations
//   do not define them), driven by the test.role setting so the super-admin
//   gate can be exercised: role 'super_admin' passes both halves of
//   ifund_current_user_is_verified_super_admin(), anything else fails it.
// - The vault-dependent accept path of ifund_disaster_authorize cannot run
//   in PGlite (no vault extension): the function fails closed and returns
//   false for every token here. The accept path is only exercisable against
//   hosted Supabase, where the vault secret exists.

import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_MIGRATIONS,
  actAs,
  applyMigrations,
  freshDb,
  loadPGlite,
} from "./helpers/pglite.js";

const PGlite = await loadPGlite();
const SKIP = PGlite ? false : "@electric-sql/pglite is not installed";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const CAMPAIGN = "44444444-4444-4444-8444-444444444444";
const CAMPAIGN_TWO = "55555555-5555-4555-8555-555555555555";
const CAMPAIGN_OTHER = "55555555-5555-4555-8555-555555555556";
const ALERT = "66666666-6666-4666-8666-666666666666";
const ALERT_TWO = "77777777-7777-4777-8777-777777777777";
const CHECKIN = "88888888-8888-4888-8888-888888888888";
const CHECKIN_NO = "99999999-9999-4999-8999-999999999999";
const CHECKIN_OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHECKIN_ANSWERED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const DEPENDENCIES = [
  // Verified super-admin check used by ifund_disaster_relief_campaigns().
  "supabase/migrations/20261103120000_ifund_studio_super_admin.sql",
  // Editorial review table the 'yes' answer inserts the promotion draft into.
  "supabase/migrations/20261113_ifund_prepublication_quality_and_agent_review.sql",
];

const DISASTER_MIGRATIONS = [
  "supabase/migrations/20261126190000_ifund_disaster_response.sql",
  // pg_cron is absent in PGlite; the migration must apply as a no-op there.
  "supabase/migrations/20261126191000_ifund_disaster_watch_cron.sql",
];

async function fixture() {
  const db = await freshDb(PGlite);
  await db.exec(`
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('sub', current_setting('test.uid', true),
        'app_metadata', jsonb_build_object('role', current_setting('test.role', true)),
        'is_anonymous', false)
    $$;
    -- Stand-in for the hosted verified-admin check: only the super_admin
    -- role counts as a verified admin in this harness.
    create or replace function public.ifund_current_user_is_verified_admin()
    returns boolean language sql stable set search_path = '' as $$
      select current_setting('test.role', true) = 'super_admin'
    $$;
  `);
  await applyMigrations(db, [
    ...COMMITTED_MIGRATIONS,
    ...DEPENDENCIES,
    ...DISASTER_MIGRATIONS,
  ]);
  await db.query(
    "insert into auth.users(id, email) values ($1, 'owner@example.test'), ($2, 'other@example.test'), ($3, 'admin@example.test')",
    [OWNER, OTHER, ADMIN],
  );
  await db.query(
    `insert into public.ifund_campaigns(id, owner_id, title, summary, story, category, goal_amount, status)
     values ($1, $2, 'Flood relief for Everett', 'Help after the flood', 'A campaign story.', 'emergency', 5000, 'draft'),
            ($3, $2, 'Second campaign', 'Second summary', 'A second campaign story.', 'emergency', 1000, 'draft'),
            ($4, $5, 'Other user campaign', 'Other summary', 'Another campaign story.', 'emergency', 1000, 'draft')`,
    [CAMPAIGN, OWNER, CAMPAIGN_TWO, CAMPAIGN_OTHER, OTHER],
  );
  await db.query(
    `insert into public.ifund_disaster_alerts(id, source, source_event_id, disaster_type, severity, title, area_description, geometry, started_at)
     values ($1, 'nws', 'nws-flash-flood-1', 'flood', 'Severe', 'Flash Flood Warning', 'Everett, WA',
             '{"type":"Polygon","coordinates":[[[-122.3,47.9],[-122.1,47.9],[-122.1,48.0],[-122.3,48.0],[-122.3,47.9]]]}'::jsonb, now()),
            ($2, 'usgs', 'usgs-eq-1', 'earthquake', 'Severe', 'M5.4 earthquake', 'Snohomish County, WA', null, now())`,
    [ALERT, ALERT_TWO],
  );
  // One check-in per (alert, campaign) — the unique constraint enforces it,
  // so each seeded row uses a distinct pair.
  await db.query(
    `insert into public.ifund_disaster_checkins(id, alert_id, campaign_id, owner_id, status, dedupe_key)
     values ($1, $2, $3, $4, 'pending', 'campaign-flood-everett'),
            ($5, $6, $3, $4, 'pending', 'campaign-earthquake-everett'),
            ($7, $2, $8, $9, 'pending', 'campaign-flood-other'),
            ($10, $6, $11, $4, 'yes', 'campaign-earthquake-second')`,
    [CHECKIN, ALERT, CAMPAIGN, OWNER, CHECKIN_NO, ALERT_TWO, CHECKIN_OTHER, CAMPAIGN_OTHER, OTHER, CHECKIN_ANSWERED, CAMPAIGN_TWO],
  );
  // The pre-seeded 'yes' check-in above is a bare row (no flag/draft side
  // effects applied); the flag assertions use the check-in answered by the
  // RPC in the tests below.
  return db;
}

/** Act as a user, with an optional JWT role for the super-admin gate. */
async function asUser(db, uid, jwtRole = "") {
  await actAs(db, "authenticated", uid);
  await db.query("select set_config('test.role', $1, false)", [jwtRole]);
}

test("disaster tables, flag columns, constraints and RLS exist", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    const { rows } = await db.query(`
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('ifund_disaster_alerts', 'ifund_disaster_checkins')
      order by table_name, ordinal_position`);
    const columns = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r]));
    for (const column of [
      "ifund_disaster_alerts.source",
      "ifund_disaster_alerts.source_event_id",
      "ifund_disaster_alerts.disaster_type",
      "ifund_disaster_alerts.severity",
      "ifund_disaster_alerts.title",
      "ifund_disaster_alerts.area_description",
      "ifund_disaster_alerts.geometry",
      "ifund_disaster_alerts.started_at",
      "ifund_disaster_alerts.expires_at",
      "ifund_disaster_checkins.alert_id",
      "ifund_disaster_checkins.campaign_id",
      "ifund_disaster_checkins.owner_id",
      "ifund_disaster_checkins.notification_id",
      "ifund_disaster_checkins.status",
      "ifund_disaster_checkins.dedupe_key",
      "ifund_disaster_checkins.asked_at",
      "ifund_disaster_checkins.answered_at",
    ]) {
      assert.ok(columns.has(column), `${column} must exist`);
    }
    assert.equal(columns.get("ifund_disaster_alerts.geometry").data_type, "jsonb");
    assert.equal(columns.get("ifund_disaster_checkins.notification_id").is_nullable, "YES");
    assert.equal(columns.get("ifund_disaster_checkins.dedupe_key").is_nullable, "YES");

    const flag = await db.query(`
      select column_name, data_type, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ifund_campaigns'
        and column_name in ('disaster_relief', 'disaster_relief_since')`);
    assert.equal(flag.rows.length, 2);
    assert.equal(
      flag.rows.find((r) => r.column_name === "disaster_relief").column_default,
      "false",
    );

    // Unique (source, source_event_id) and unique (alert_id, campaign_id).
    const uniques = await db.query(`
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.constraint_type = 'UNIQUE'
        and tc.table_name in ('ifund_disaster_alerts', 'ifund_disaster_checkins')
      order by tc.table_name, kcu.ordinal_position`);
    const pairs = uniques.rows.map((r) => `${r.table_name}.${r.column_name}`);
    assert.ok(pairs.includes("ifund_disaster_alerts.source"));
    assert.ok(pairs.includes("ifund_disaster_alerts.source_event_id"));
    assert.ok(pairs.includes("ifund_disaster_checkins.alert_id"));
    assert.ok(pairs.includes("ifund_disaster_checkins.campaign_id"));

    // The dedupe-key index exists and is deliberately NOT unique.
    const index = await db.query(`
      select indexname, indexdef from pg_indexes
      where schemaname = 'public'
        and tablename = 'ifund_disaster_checkins'
        and indexname = 'ifund_disaster_checkins_dedupe_key_idx'`);
    assert.equal(index.rows.length, 1);
    assert.doesNotMatch(index.rows[0].indexdef, /unique/i);

    // RLS is on for both tables.
    const rls = await db.query(`
      select relname, relrowsecurity from pg_class
      where relname in ('ifund_disaster_alerts', 'ifund_disaster_checkins')`);
    assert.deepEqual(
      rls.rows.map((r) => r.relname).sort(),
      ["ifund_disaster_alerts", "ifund_disaster_checkins"],
    );
    assert.ok(rls.rows.every((r) => r.relrowsecurity));

    // No direct table grants to the browser roles (server-side only).
    const grants = await db.query(`
      select table_name, grantee from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('ifund_disaster_alerts', 'ifund_disaster_checkins')
        and grantee in ('anon', 'authenticated')`);
    assert.equal(grants.rows.length, 0);
  } finally {
    await db.close();
  }
});

test("authorize fails closed without vault and rejects wrong/empty tokens", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    // Service-role only: an ordinary authenticated caller cannot execute
    // it at all. (In PGlite there is no service_role, so the postgres
    // superuser stands in for the service role below.)
    await asUser(db, OWNER);
    await assert.rejects(
      db.query("select public.ifund_disaster_authorize($1) as ok", ["a".repeat(64)]),
      /permission denied/,
    );
    await actAs(db, "postgres");
    for (const token of ["", "short", "x".repeat(63), "x".repeat(65), null]) {
      const { rows } = await db.query(
        "select public.ifund_disaster_authorize($1) as ok",
        [token],
      );
      assert.equal(rows[0].ok, false, `token ${JSON.stringify(token)} must be rejected`);
    }
    // No vault extension exists in PGlite, so even a well-formed 64-hex
    // token fails closed. The accept path (matching vault secret) is only
    // exercisable against hosted Supabase.
    const { rows } = await db.query(
      "select public.ifund_disaster_authorize($1) as ok",
      ["a".repeat(64)],
    );
    assert.equal(rows[0].ok, false);
  } finally {
    await db.close();
  }
});

test("my check-ins list only the caller's pending rows", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    await asUser(db, OWNER);
    const { rows } = await db.query("select * from public.ifund_my_disaster_checkins()");
    // Two pending rows for the owner; the pre-answered 'yes' row is excluded.
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => r.checkin_id).sort(),
      [CHECKIN, CHECKIN_NO].sort(),
    );
    const row = rows.find((r) => r.checkin_id === CHECKIN);
    assert.equal(row.alert_id, ALERT);
    assert.equal(row.campaign_id, CAMPAIGN);
    assert.equal(row.campaign_title, "Flood relief for Everett");
    assert.equal(row.alert_title, "Flash Flood Warning");
    assert.equal(row.alert_area, "Everett, WA");
    assert.equal(row.disaster_type, "flood");
    assert.equal(row.severity, "Severe");
    assert.ok(row.asked_at);

    await asUser(db, OTHER);
    const other = await db.query("select * from public.ifund_my_disaster_checkins()");
    assert.equal(other.rows.length, 1);
    assert.equal(other.rows[0].checkin_id, CHECKIN_OTHER);

    await asUser(db, ADMIN);
    const admin = await db.query("select * from public.ifund_my_disaster_checkins()");
    assert.equal(admin.rows.length, 0);
  } finally {
    await db.close();
  }
});

test("answering yes flags the campaign, queues one draft, and is idempotent", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    await asUser(db, OWNER);
    const first = await db.query(
      "select * from public.ifund_disaster_checkin_answer($1, 'yes')",
      [CHECKIN],
    );
    assert.equal(first.rows.length, 1);
    assert.equal(first.rows[0].checkin_id, CHECKIN);
    assert.equal(first.rows[0].status, "yes");
    assert.equal(first.rows[0].campaign_id, CAMPAIGN);
    assert.equal(first.rows[0].disaster_relief, true);

    const campaign = await db.query(
      "select disaster_relief, disaster_relief_since from public.ifund_campaigns where id = $1",
      [CAMPAIGN],
    );
    assert.equal(campaign.rows[0].disaster_relief, true);
    assert.ok(campaign.rows[0].disaster_relief_since);

    // Direct reads of the server-side tables need the postgres role: the
    // editorial and check-in tables grant nothing to the browser roles.
    await actAs(db, "postgres");
    const drafts = await db.query(
      `select finding_id, lead_agent, review_status, task_title, suggested_action
       from public.ifund_editorial_agent_reviews
       where campaign_id = $1 and finding_id like 'disaster_promotion_%'`,
      [CAMPAIGN],
    );
    assert.equal(drafts.rows.length, 1);
    assert.equal(
      drafts.rows[0].finding_id,
      `disaster_promotion_${CHECKIN.slice(0, 8)}`,
    );
    assert.equal(drafts.rows[0].review_status, "queued");
    assert.ok(drafts.rows[0].task_title.length > 0);
    assert.ok(drafts.rows[0].suggested_action.length > 0);

    // Re-answering returns the current state and adds no second draft.
    await asUser(db, OWNER);
    const second = await db.query(
      "select * from public.ifund_disaster_checkin_answer($1, 'yes')",
      [CHECKIN],
    );
    assert.equal(second.rows[0].status, "yes");
    assert.equal(second.rows[0].disaster_relief, true);
    await actAs(db, "postgres");
    const again = await db.query(
      "select count(*)::int as n from public.ifund_editorial_agent_reviews where campaign_id = $1 and finding_id like 'disaster_promotion_%'",
      [CAMPAIGN],
    );
    assert.equal(again.rows[0].n, 1);
    const checkin = await db.query(
      "select status, answered_at from public.ifund_disaster_checkins where id = $1",
      [CHECKIN],
    );
    assert.equal(checkin.rows[0].status, "yes");
    assert.ok(checkin.rows[0].answered_at);
  } finally {
    await db.close();
  }
});

test("answering no records final with no flag and no draft; bad answers rejected", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    await asUser(db, OWNER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_checkin_answer($1, 'maybe')", [CHECKIN_NO]),
      /Answer must be yes or no/,
    );
    const answered = await db.query(
      "select * from public.ifund_disaster_checkin_answer($1, 'no')",
      [CHECKIN_NO],
    );
    assert.equal(answered.rows[0].status, "no");
    assert.equal(answered.rows[0].disaster_relief, false);

    const campaign = await db.query(
      "select disaster_relief, disaster_relief_since from public.ifund_campaigns where id = $1",
      [CAMPAIGN],
    );
    assert.equal(campaign.rows[0].disaster_relief, false);
    assert.equal(campaign.rows[0].disaster_relief_since, null);
    await actAs(db, "postgres");
    const drafts = await db.query(
      "select count(*)::int as n from public.ifund_editorial_agent_reviews where campaign_id = $1 and finding_id like 'disaster_promotion_%'",
      [CAMPAIGN],
    );
    assert.equal(drafts.rows[0].n, 0);

    // Re-answering a 'no' stays 'no' and still applies no side effects.
    await asUser(db, OWNER);
    const again = await db.query(
      "select * from public.ifund_disaster_checkin_answer($1, 'yes')",
      [CHECKIN_NO],
    );
    assert.equal(again.rows[0].status, "no");
    assert.equal(again.rows[0].disaster_relief, false);
  } finally {
    await db.close();
  }
});

test("answering another user's check-in is rejected and leaves it pending", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    await asUser(db, OTHER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_checkin_answer($1, 'yes')", [CHECKIN]),
      /Check-in not found/,
    );
    await actAs(db, "postgres");
    const { rows } = await db.query(
      "select status, answered_at from public.ifund_disaster_checkins where id = $1",
      [CHECKIN],
    );
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].answered_at, null);
  } finally {
    await db.close();
  }
});

test("relief-campaigns RPC is super-admin gated", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    // Flag the campaign through the owner's own yes first.
    await asUser(db, OWNER);
    await db.query("select * from public.ifund_disaster_checkin_answer($1, 'yes')", [CHECKIN]);

    await asUser(db, OWNER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_relief_campaigns()"),
      /Verified super-admin required/,
    );
    await asUser(db, OTHER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_relief_campaigns()"),
      /Verified super-admin required/,
    );

    await asUser(db, ADMIN, "super_admin");
    const { rows } = await db.query("select * from public.ifund_disaster_relief_campaigns()");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].campaign_id, CAMPAIGN);
    assert.equal(rows[0].campaign_title, "Flood relief for Everett");
    assert.equal(rows[0].owner_id, OWNER);
    assert.equal(rows[0].alert_title, "Flash Flood Warning");
    assert.equal(rows[0].alert_area, "Everett, WA");
    assert.equal(rows[0].disaster_type, "flood");
    assert.ok(rows[0].flagged_at);
  } finally {
    await db.close();
  }
});

test("revoke RPC clears the flag and queued drafts, super-admin gated", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    // Flag the campaign through the owner's own yes first.
    await asUser(db, OWNER);
    await db.query("select * from public.ifund_disaster_checkin_answer($1, 'yes')", [CHECKIN]);

    // Non-admin callers cannot revoke, and the flag survives the denial.
    await asUser(db, OWNER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_revoke_relief($1)", [CAMPAIGN]),
      /Verified super-admin required/,
    );
    await asUser(db, OTHER);
    await assert.rejects(
      db.query("select * from public.ifund_disaster_revoke_relief($1)", [CAMPAIGN]),
      /Verified super-admin required/,
    );
    await actAs(db, "postgres");
    let flag = await db.query(
      "select disaster_relief, disaster_relief_since from public.ifund_campaigns where id = $1",
      [CAMPAIGN],
    );
    assert.equal(flag.rows[0].disaster_relief, true);
    assert.ok(flag.rows[0].disaster_relief_since);
    let drafts = await db.query(
      "select count(*)::int as n from public.ifund_editorial_agent_reviews where campaign_id = $1 and finding_id like 'disaster_promotion\\_%'",
      [CAMPAIGN],
    );
    assert.equal(drafts.rows[0].n, 1);

    // Revoke as super-admin: flag clears, queued draft is deleted.
    await asUser(db, ADMIN, "super_admin");
    const { rows } = await db.query(
      "select * from public.ifund_disaster_revoke_relief($1)",
      [CAMPAIGN],
    );
    assert.equal(rows[0].campaign_id, CAMPAIGN);
    assert.equal(rows[0].disaster_relief, false);

    await actAs(db, "postgres");
    flag = await db.query(
      "select disaster_relief, disaster_relief_since from public.ifund_campaigns where id = $1",
      [CAMPAIGN],
    );
    assert.equal(flag.rows[0].disaster_relief, false);
    assert.equal(flag.rows[0].disaster_relief_since, null);
    drafts = await db.query(
      "select count(*)::int as n from public.ifund_editorial_agent_reviews where campaign_id = $1 and finding_id like 'disaster_promotion\\_%'",
      [CAMPAIGN],
    );
    assert.equal(drafts.rows[0].n, 0);

    // The campaign drops out of the super-admin relief list.
    await asUser(db, ADMIN, "super_admin");
    const listed = await db.query("select * from public.ifund_disaster_relief_campaigns()");
    assert.equal(listed.rows.length, 0);

    // Revoking again is a no-op, not an error.
    const again = await db.query(
      "select * from public.ifund_disaster_revoke_relief($1)",
      [CAMPAIGN],
    );
    assert.equal(again.rows[0].disaster_relief, false);

    // Unknown campaign ids are rejected.
    await assert.rejects(
      db.query(
        "select * from public.ifund_disaster_revoke_relief($1)",
        ["12345678-1234-4123-8123-123456789012"],
      ),
      /Campaign not found/,
    );
  } finally {
    await db.close();
  }
});

test("dedupe unique(alert_id, campaign_id) is enforced; dedupe_key may recur", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    await actAs(db, "postgres");
    await assert.rejects(
      db.query(
        `insert into public.ifund_disaster_checkins(alert_id, campaign_id, owner_id, dedupe_key)
         values ($1, $2, $3, 'another-key')`,
        [ALERT, CAMPAIGN, OWNER],
      ),
      /duplicate key|unique/i,
    );
    // Same dedupe_key on a different (alert, campaign) pair is allowed:
    // the key legitimately recurs after the 72h window.
    await db.query(
      `insert into public.ifund_disaster_checkins(alert_id, campaign_id, owner_id, dedupe_key)
       values ($1, $2, $3, 'campaign-flood-everett')`,
      [ALERT_TWO, CAMPAIGN_OTHER, OTHER],
    );
    const { rows } = await db.query(
      "select count(*)::int as n from public.ifund_disaster_checkins where dedupe_key = 'campaign-flood-everett'",
    );
    assert.equal(rows[0].n, 2);
    // Same source event cannot be stored twice.
    await assert.rejects(
      db.query(
        `insert into public.ifund_disaster_alerts(source, source_event_id, disaster_type, severity, title)
         values ('nws', 'nws-flash-flood-1', 'flood', 'Severe', 'Duplicate')`,
      ),
      /duplicate key|unique/i,
    );
  } finally {
    await db.close();
  }
});

test("promotion draft is visible to the owner in the editorial queue read path", { skip: SKIP }, async () => {
  const db = await fixture();
  try {
    // Stand-in for ifund_current_account_is_active(): its only definition
    // lives in the PENDING 20261102 migration, so no applied migration
    // creates it and the queue read RPC cannot run in this fixture without
    // it. Live the function exists (the editorial queue is live); this
    // mirrors the verified-admin stand-in pattern in fixture() above.
    await db.exec(`
      create or replace function public.ifund_current_account_is_active()
      returns boolean language sql stable set search_path = '' as $$
        select true
      $$;
    `);

    await asUser(db, OWNER);
    await db.query("select * from public.ifund_disaster_checkin_answer($1, 'yes')", [CHECKIN]);

    // The exact read path EditorialAgentQueue.jsx uses.
    const queue = await db.query("select * from public.ifund_my_editorial_agent_reviews()");
    assert.equal(queue.rows.length, 1);
    const draft = queue.rows[0];
    assert.equal(draft.finding_id, `disaster_promotion_${CHECKIN.slice(0, 8)}`);
    assert.equal(draft.campaign_id, CAMPAIGN);
    assert.equal(draft.lead_agent, "echo");
    assert.equal(draft.review_status, "queued");
    assert.equal(draft.task_title, "Draft disaster-relief promotion for the campaign");
    assert.ok(draft.suggested_action.includes("do not publish anything without the promotion flow"));
    const discussion = draft.discussion;
    assert.equal(Array.isArray(discussion), true);
    assert.equal(discussion.length, 1);
    assert.equal(discussion[0].agent, "echo");
    assert.equal(discussion[0].kind, "rule_based_proposal");

    // Another owner sees nothing: the queue read is owner-scoped.
    await asUser(db, OTHER);
    const other = await db.query("select * from public.ifund_my_editorial_agent_reviews()");
    assert.equal(other.rows.length, 0);

    // The owner can acknowledge the draft through the queue's RPC; the
    // row stays visible with status acknowledged.
    await asUser(db, OWNER);
    const ack = await db.query(
      "select public.ifund_acknowledge_editorial_review($1) as ok",
      [draft.review_id],
    );
    assert.equal(ack.rows[0].ok, true);
    const after = await db.query("select * from public.ifund_my_editorial_agent_reviews()");
    assert.equal(after.rows.length, 1);
    assert.equal(after.rows[0].review_status, "acknowledged");
  } finally {
    await db.close();
  }
});
