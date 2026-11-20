import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, as } from "./fixtures/storyDatabase.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261120194050_ifund_agent_trial_referrals_20261120.sql",
    import.meta.url,
  ),
  "utf8",
);

async function setup() {
  const db = await fixture();
  await db.exec(`
    alter table auth.users add column created_at timestamptz not null default now();
    update auth.users set created_at=now();
    update auth.users set created_at=now()-interval '2 days' where id='${OWNER}';
  `);
  await db.exec(`create or replace function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('sub', current_setting('test.uid', true), 'is_anonymous', false)
  $$;`);
  await db.exec(migration);
  return db;
}

const status = async (db) =>
  (await db.query("select public.ifund_agent_referral_status() result")).rows[0]
    .result;
const claim = async (db, code) =>
  (await db.query("select public.ifund_claim_campaign_referral($1) result", [code]))
    .rows[0].result;

test("referral trial SQL applies and issues a stable owner-scoped code while inactive", async () => {
  const db = await setup();
  try {
    await as(db, OWNER);
    const first = await status(db);
    assert.match(first.referral_code, /^[A-F0-9]{12}$/);
    assert.equal(first.trial_enabled, false);
    assert.equal(first.trial_started_at, null);
    assert.equal(
      (await db.query("select (ifund_story_runtime.subscription()->>'level')::int level"))
        .rows[0].level,
      1,
    );

    await as(db, OWNER);
    assert.equal((await status(db)).referral_code, first.referral_code);

    await as(db, OTHER);
    assert.notEqual((await status(db)).referral_code, first.referral_code);

    await as(db, null, "anon");
    await assert.rejects(status(db), /permission denied|Verified member required/);
  } finally {
    await db.close();
  }
});

test("referral claims reject self and unknown codes, accept once and credit only after publication", async () => {
  const db = await setup();
  try {
    await as(db, OWNER);
    const code = (await status(db)).referral_code;
    await db.exec("reset role");
    await db.query(
      "update public.ifund_referral_trial_accounts set created_at=now()-interval '1 day' where owner_id=$1",
      [OWNER],
    );
    await as(db, OWNER);

    assert.deepEqual(await claim(db, code), {
      accepted: false,
      reason: "not_eligible",
    });

    await as(db, OTHER);
    assert.deepEqual(await claim(db, "000000000000"), {
      accepted: false,
      reason: "not_eligible",
    });
    assert.deepEqual(await claim(db, code), {
      accepted: true,
      reward_pending: true,
    });
    assert.deepEqual(await claim(db, code), {
      accepted: false,
      reason: "already_claimed",
    });

    await db.exec("reset role");
    const before = await db.query(
      "select rewarded_at from public.ifund_referral_claims where referred_id=$1",
      [OTHER],
    );
    assert.equal(before.rows[0].rewarded_at, null);

    await db.query(
      "insert into public.ifund_campaigns(id,owner_id,title,status) values($1,$2,$3,'active')",
      [CAMPAIGN, OTHER, "Fictional pantry"],
    );

    const after = await db.query(
      "select rewarded_at,qualifying_campaign_id from public.ifund_referral_claims where referred_id=$1",
      [OTHER],
    );
    assert.ok(after.rows[0].rewarded_at);
    assert.equal(after.rows[0].qualifying_campaign_id, CAMPAIGN);

    const referrer = await db.query(
      "select successful_referrals,pending_hours from public.ifund_referral_trial_accounts where owner_id=$1",
      [OWNER],
    );
    assert.equal(referrer.rows[0].successful_referrals, 1);
    assert.equal(referrer.rows[0].pending_hours, 24);
  } finally {
    await db.close();
  }
});
