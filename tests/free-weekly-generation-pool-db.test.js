import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, as } from "./fixtures/storyDatabase.js";
import { applyMigrations } from "./helpers/pglite.js";

// Owner directive 2026-11-28: non-subscribers (free accounts and basic
// trials) share ONE pool of 15 AI generations per rolling 7 days, spendable
// on any generation kind. Subscribers, day passes and the referral
// machinery keep their prior behavior. These tests run the real migration
// chain in PGlite: referral/subscription (20261120194050), the original
// trial pool (20261122123000), paid monthly credits (20261122150000), then
// the weekly-pool migration (20261128120000) on top.
const OWNER = "11111111-1111-4111-8111-111111111111"; // basic/active subscriber
const FREE = "22222222-2222-4222-8222-222222222222"; // entitlement deleted below
const TRIAL = "33333333-3333-4333-8333-333333333333";
const DAYPASS = "44444444-4444-4444-8444-444444444444";
const INTENT = "55555555-5555-4555-8555-555555555555";
const PAYMENT = "66666666-6666-4666-8666-666666666666";

async function setup() {
  const db = await fixture();
  await db.exec(`
    alter table auth.users add column created_at timestamptz not null default now();
    create or replace function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('sub', current_setting('test.uid', true), 'is_anonymous', false)
    $$;
    -- Minimal shapes of the billing tables the Premium payment resolver
    -- joins; the paid generations table FK-references the ledger, so the
    -- stub must exist before the paid-credits migration applies.
    create table public.ifund_subscription_ledger (
      id uuid primary key, intent_id uuid, member_id uuid, entry_type text,
      amount_cents integer, currency text, environment text,
      provider_resource_id text, provider_occurred_at timestamptz,
      parent_provider_resource_id text);
    create table public.ifund_subscription_intents (
      id uuid primary key, member_id uuid, tier text, interval text,
      status text, currency text, amount_cents integer, paypal_plan_id text);
    -- The two account guards the allowance RPCs call. Their canonical
    -- definitions live outside the story fixture's migration set (pending
    -- member schema completion; legal terms sync), so they are stubbed
    -- here with the same semantics against the fixture's tables, the same
    -- way the fixture itself stubs ifund_current_user_is_verified_admin.
    create or replace function public.ifund_current_account_is_active()
    returns boolean language sql stable security definer set search_path = public, pg_temp as $$
      select exists (
        select 1 from public.ifund_profiles p
        where p.id = (select auth.uid())
          and p.account_status = 'active'
          and p.account_deletion_pending = false
      );
    $$;
    create or replace function public.ifund_current_user_has_current_terms()
    returns boolean language sql stable set search_path = '' as $$
      select exists (
        select 1 from public.ifund_legal_acceptances la
        where la.owner_id = (select auth.uid())
          and la.terms_version = '2026-10-13-v3'
          and la.explicit_consent is true
      );
    $$;
  `);
  await applyMigrations(db, [
    "supabase/migrations/20261120194050_ifund_agent_trial_referrals_20261120.sql",
    "supabase/migrations/20261122123000_ifund_trial_shared_15_ai_generations.sql",
    "supabase/migrations/20261122150000_ifund_paid_monthly_50_content_credits.sql",
    "supabase/migrations/20261128120000_ifund_free_weekly_generation_pool.sql",
  ]);
  await db.exec("reset role");
  // FREE: no subscription at all.
  await db.query("delete from ifund_access.member_entitlements where owner_id=$1", [FREE]);
  // TRIAL + DAYPASS: extra members with their own entitlement shapes.
  for (const id of [TRIAL, DAYPASS]) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.ifund_profiles(id,account_status,account_deletion_pending) values($1,'active',false)",
      [id],
    );
    await db.query("insert into public.ifund_legal_acceptances values($1,'2026-10-13-v3',true)", [id]);
  }
  await db.query(
    `insert into ifund_access.member_entitlements
       (owner_id,tier,status,trial_started_at,trial_end,verified_at,valid_until,provider,receipt_id)
     values($1,'basic','trialing',now()-interval '1 hour',now()+interval '23 hours',now(),now()+interval '1 day','paypal','trial-test')`,
    [TRIAL],
  );
  await db.query(
    `insert into ifund_access.member_entitlements
       (owner_id,tier,status,day_pass_expires_at,verified_at,valid_until,provider,receipt_id)
     values($1,'basic','expired',now()+interval '12 hours',now(),now()+interval '1 day','paypal','daypass-test')`,
    [DAYPASS],
  );
  // OWNER: a verified Premium monthly payment, so the paid path is live.
  await db.query(
    `insert into public.ifund_subscription_intents
       (id,member_id,tier,interval,status,currency,amount_cents,paypal_plan_id)
     values($1,$2,'basic','monthly','active','USD',499,'P-8RG59105D5286480MNMBOKJA')`,
    [INTENT, OWNER],
  );
  await db.query(
    `insert into public.ifund_subscription_ledger
       (id,intent_id,member_id,entry_type,amount_cents,currency,environment,provider_resource_id,provider_occurred_at)
     values($1,$2,$3,'payment',499,'USD','live','PAY-TEST-1',now())`,
    [PAYMENT, INTENT, OWNER],
  );
  return db;
}

const reserve = async (db, kind, id = randomUUID()) =>
  (await db.query("select public.ifund_ai_content_reserve($1,$2) r", [id, kind])).rows[0].r;
const complete = async (db, kind, id) =>
  (await db.query("select public.ifund_ai_content_complete($1,$2) r", [id, kind])).rows[0].r;
const status = async (db) =>
  (await db.query("select public.ifund_ai_content_status() r")).rows[0].r;
// The pool table is revoked from authenticated by design, so row counts
// are read as the server role; callers re-`as()` before acting again.
const poolRows = async (db, owner) => {
  await db.exec("reset role");
  return (await db.query("select count(*)::int c from public.ifund_trial_ai_generations where owner_id=$1", [owner])).rows[0].c;
};

test("free account draws every generation kind from one shared weekly pool", async () => {
  const db = await setup();
  try {
    await as(db, FREE);
    const kinds = ["campaign_story", "image", "video", "image_edit", "audio", "marketing"];
    for (let i = 0; i < 15; i++) {
      const kind = kinds[i % kinds.length];
      const id = randomUUID();
      const r = await reserve(db, kind, id);
      assert.equal(r.allowed, true, `generation ${i + 1} (${kind}) should be allowed`);
      assert.equal(r.state, "reserved");
      assert.equal(r.remaining, 14 - i);
      assert.equal(await complete(db, kind, id), true);
    }
    const s = await status(db);
    assert.equal(s.limit, 15);
    assert.equal(s.used, 15);
    assert.equal(s.remaining, 0);
    assert.equal(s.free_pool, true);
    assert.equal(s.window, "rolling_7_day");
    assert.equal(await poolRows(db, FREE), 15);
  } finally {
    await db.close();
  }
});

test("the 16th generation inside the window is denied as trial_limit", async () => {
  const db = await setup();
  try {
    await as(db, FREE);
    for (let i = 0; i < 15; i++) {
      const id = randomUUID();
      assert.equal((await reserve(db, "image", id)).allowed, true);
      assert.equal(await complete(db, "image", id), true);
    }
    const denied = await reserve(db, "campaign_story");
    assert.equal(denied.allowed, false);
    assert.equal(denied.state, "trial_limit");
    assert.equal(denied.remaining, 0);
    // A live (uncompleted) reservation also counts against the pool.
    await db.exec("reset role");
    await db.query("delete from public.ifund_trial_ai_generations where owner_id=$1", [FREE]);
    await as(db, FREE);
    const held = await reserve(db, "video");
    assert.equal(held.allowed, true);
    assert.equal((await status(db)).remaining, 14);
  } finally {
    await db.close();
  }
});

test("the pool replenishes on the rolling 7-day window", async () => {
  const db = await setup();
  try {
    await as(db, FREE);
    for (let i = 0; i < 15; i++) {
      const id = randomUUID();
      assert.equal((await reserve(db, "campaign_story", id)).allowed, true);
      assert.equal(await complete(db, "campaign_story", id), true);
    }
    assert.equal((await reserve(db, "image")).state, "trial_limit");
    // Five completions age out of the window: exactly five slots return.
    await db.exec("reset role");
    await db.query(
      `update public.ifund_trial_ai_generations
         set completed_at=statement_timestamp()-interval '8 days'
       where owner_id=$1 and request_id in
         (select request_id from public.ifund_trial_ai_generations
          where owner_id=$1 order by completed_at limit 5)`,
      [FREE],
    );
    await as(db, FREE);
    assert.equal((await status(db)).remaining, 5);
    const again = await reserve(db, "video");
    assert.equal(again.allowed, true);
    assert.equal(again.remaining, 4);
  } finally {
    await db.close();
  }
});

test("an expired reservation stops counting and can be reserved again", async () => {
  const db = await setup();
  try {
    await as(db, FREE);
    const id = randomUUID();
    assert.equal((await reserve(db, "image", id)).allowed, true);
    assert.equal((await status(db)).remaining, 14);
    await db.exec("reset role");
    await db.query(
      "update public.ifund_trial_ai_generations set reserved_until=statement_timestamp()-interval '1 minute' where owner_id=$1",
      [FREE],
    );
    await as(db, FREE);
    assert.equal((await status(db)).remaining, 15);
    const replay = await reserve(db, "image", id);
    assert.equal(replay.allowed, true);
    assert.equal(replay.state, "reserved");
  } finally {
    await db.close();
  }
});

test("trialing members use the same weekly pool, and idempotency is preserved", async () => {
  const db = await setup();
  try {
    await as(db, TRIAL);
    const id = randomUUID();
    const first = await reserve(db, "campaign_story", id);
    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 14);
    const dup = await reserve(db, "campaign_story", id);
    assert.equal(dup.allowed, false);
    assert.equal(dup.state, "already_reserved");
    await assert.rejects(reserve(db, "image", id), /idempotency conflict/);
    assert.equal(await complete(db, "campaign_story", id), true);
    const done = await reserve(db, "campaign_story", id);
    assert.equal(done.allowed, false);
    assert.equal(done.state, "already_completed");
    const s = await status(db);
    assert.equal(s.trial, true);
    assert.equal(s.free_pool, true);
    assert.equal(s.used, 1);
  } finally {
    await db.close();
  }
});

test("subscriber path is untouched: Premium draws monthly credits, never the free pool", async () => {
  const db = await setup();
  try {
    await as(db, OWNER);
    const id = randomUUID();
    const r = await reserve(db, "image", id);
    assert.equal(r.allowed, true);
    assert.equal(r.state, "reserved");
    assert.equal(r.limit, 50);
    assert.equal(r.remaining, 49);
    assert.equal(await complete(db, "image", id), true);
    assert.equal(await poolRows(db, OWNER), 0);
    const paid = await db.query(
      "select count(*)::int c from public.ifund_paid_ai_generations where owner_id=$1 and state='completed'",
      [OWNER],
    );
    assert.equal(paid.rows[0].c, 1);
    await as(db, OWNER);
    const s = await status(db);
    assert.equal(s.paid, true);
    assert.equal(s.limit, 50);
    assert.equal(s.remaining, 49);
  } finally {
    await db.close();
  }
});

test("day-pass behavior is preserved: membership_required, no pool access", async () => {
  const db = await setup();
  try {
    await as(db, DAYPASS);
    const r = await reserve(db, "image");
    assert.equal(r.allowed, false);
    assert.equal(r.state, "membership_required");
    assert.equal(await poolRows(db, DAYPASS), 0);
  } finally {
    await db.close();
  }
});

test("referral machinery still issues codes after the pool change", async () => {
  const db = await setup();
  try {
    await as(db, FREE);
    const referral = (await db.query("select public.ifund_agent_referral_status() r")).rows[0].r;
    assert.match(referral.referral_code, /^[A-F0-9]{12}$/);
    assert.equal(referral.trial_enabled, false);
  } finally {
    await db.close();
  }
});
