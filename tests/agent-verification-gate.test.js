import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { memberApi } from "../worker/agents/memberApi.js";
import { routeTeamQuestion } from "../worker/agents/teamQuestion.js";
import { storyRoute } from "../worker/agents/story.js";
import { fixture, as } from "./fixtures/storyDatabase.js";

// Owner directive 2026-11-27: account (email) verification is required for
// withdrawals/payouts only — never for the agent features. These tests pin
// the three-way split: (a) an identity-unverified (email-unconfirmed)
// member can use the agent features; (b) withdrawals keep their
// verification requirement; (c) subscription tier gating is unchanged —
// a free member still gets subscriber_required for in-depth research and
// a subscriber's tier is recognized, confirmed email or not.

const UID = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const SUPABASE = { SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test" };
// A signed-in member whose email is NOT confirmed.
const unconfirmedUser = { id: UID, is_anonymous: false };
const bearerReq = (url) => new Request(url, { headers: { authorization: "Bearer test.jwt.token" } });

function memberApiFetcher(user, active = true) {
  return async (url) => {
    const path = new URL(url).pathname;
    if (path === "/auth/v1/user") return Response.json(user);
    if (path === "/rest/v1/rpc/ifund_current_account_is_active") return Response.json(active);
    throw Error("Unexpected upstream path: " + path);
  };
}

test("memberApi admits an email-unconfirmed member to agent services", async () => {
  const api = await memberApi(bearerReq("https://ifund.test/api/agents/team/question"),
    SUPABASE, memberApiFetcher(unconfirmedUser));
  assert.equal(api.user.id, UID);
});

test("memberApi still rejects anonymous sessions and inactive accounts", async () => {
  await assert.rejects(
    memberApi(bearerReq("https://ifund.test/api/agents/team/question"), SUPABASE,
      memberApiFetcher({ id: UID, is_anonymous: true })),
    (error) => error.status === 401);
  await assert.rejects(
    memberApi(bearerReq("https://ifund.test/api/agents/team/question"), SUPABASE,
      memberApiFetcher(unconfirmedUser, false)),
    (error) => error.status === 403);
});

// --- Route level: team chat + Refine Knowledge tier behaviour. ---
function teamHarness({ subscription }) {
  const fetcher = async (url) => {
    if (url.endsWith("/auth/v1/user")) return Response.json(unconfirmedUser);
    if (url.endsWith("/rpc/ifund_current_account_is_active")) return Response.json(true);
    if (url.includes("/ifund_ai_permission_preferences?"))
      return Response.json([{ owner_id: UID, allow_ai_campaign_drafts: true, allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]);
    if (url.endsWith("/rpc/ifund_story_subscription")) return Response.json(subscription);
    if (url.endsWith("/rpc/ifund_reserve_agent_question")) return Response.json({ allowed: true, state: "reserved", remaining: 10 });
    if (url.endsWith("/rpc/ifund_complete_agent_question")) return Response.json(true);
    if (url.endsWith("/rpc/ifund_release_agent_question")) return Response.json(true);
    if (url.endsWith("/rpc/ifund_team_recent")) return Response.json([]);
    if (url.endsWith("/rpc/ifund_team_record_user") || url.endsWith("/rpc/ifund_team_record_agent")) return Response.json(UID);
    throw Error("Unexpected " + url);
  };
  const env = {
    ...SUPABASE,
    IFUND_TEAM_QUESTIONS_ENABLED: "enabled", IFUND_TEAM_CONTEXT_ENABLED: "enabled",
    IFUND_WORKFORCE_EXECUTOR_KEY: "a".repeat(64),
    AI: { run: async () => ({ response: "Here is focused help for your goal." }) },
  };
  return { env, fetcher };
}
const ask = (h, body) => routeTeamQuestion(new Request("https://ifund.test/api/agents/team/question", {
  method: "POST", headers: { authorization: "Bearer test.jwt.token", "content-type": "application/json" },
  body: JSON.stringify(body),
}), h.env, h.fetcher);

test("an unconfirmed member can use team chat", async () => {
  const h = teamHarness({ subscription: { tier: "free", level: 0, status: "inactive", active: false, admin_granted: false } });
  const response = await ask(h, { request_id: KEY, agent: "story", question: "How should I promote my campaign this week?" });
  assert.equal(response.status, 200);
});

test("tier gate intact: an unconfirmed FREE member still gets subscriber_required for in-depth research", async () => {
  const h = teamHarness({ subscription: { tier: "free", level: 0, status: "inactive", active: false, admin_granted: false } });
  const response = await ask(h, { request_id: KEY, agent: "auto", question: "Deep research my goal: surgery bills" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.goal_knowledge.status, "subscriber_required");
});

test("tier recognized: an unconfirmed SUBSCRIBER gets their Refine Knowledge plan prepared", async () => {
  const h = teamHarness({ subscription: { tier: "professional", level: 3, status: "active", active: true, admin_granted: false } });
  const response = await ask(h, { request_id: KEY, agent: "auto", question: "Deep research my goal: surgery bills" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.goal_knowledge.status, "prepared");
  assert.equal(body.goal_knowledge.subject.goal_title, "surgery bills");
});

// --- Story Forge route: unconfirmed member generates; anonymous cannot. ---
const storyEnv = {
  ...SUPABASE, IFUND_STORY_ENABLED: "enabled", IFUND_STORY_AI_ENABLED: "enabled",
  AI: { run: async () => ({ response: JSON.stringify({
    titles: ["A", "B", "C", "D", "E"], summaries: ["A summary", "B summary"],
    story: "A factual story with organizer-supplied facts and clear needs. ".repeat(26).trim(),
    image_prompt: "A mission-specific image." }) }) },
};
function storyFetcher(user) {
  return async (url, init) => {
    const name = url.split("/").pop();
    if (name === "ifund_current_account_is_active") return Response.json(true);
    if (name === "user") return Response.json(user);
    if (url.includes("/ifund_ai_permission_preferences?"))
      return Response.json([{ owner_id: UID, allow_ai_campaign_drafts: true, allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]);
    if (name === "ifund_story_begin") return Response.json({ state: "claimed", lease: KEY });
    if (name === "ifund_story_context") return Response.json({ campaign: null, research: null });
    if (name === "ifund_story_finish")
      return Response.json({ id: KEY, status: "draft", payload: JSON.parse(init.body).p_result });
    throw Error("Unexpected URL " + url);
  };
}
const storyRequest = () => new Request("https://preview.test/api/agents/story/drafts", {
  method: "POST",
  headers: { authorization: "Bearer test.jwt.token", "content-type": "application/json" },
  body: JSON.stringify({ details: "Our community needs school supplies.", request_id: KEY }),
});

test("an unconfirmed member can generate a Story Forge draft", async () => {
  const res = await storyRoute(storyRequest(), storyEnv, storyFetcher(unconfirmedUser));
  assert.equal(res.status, 201);
});

test("an anonymous session still cannot use the writing assistant", async () => {
  const res = await storyRoute(storyRequest(), storyEnv,
    storyFetcher({ id: UID, is_anonymous: true }));
  assert.equal(res.status, 401);
});

// --- SQL guards: the repair migration removes only the email condition. ---
const repairSql = readFileSync(new URL(
  "../supabase/migrations/20261127233000_ifund_agent_features_unverified_members.sql",
  import.meta.url), "utf8");
const teamSql = readFileSync(new URL(
  "../supabase/migrations/20261115094500_ifund_shared_agent_team_events.sql",
  import.meta.url), "utf8");

// The migration's prose header legitimately names what was removed and
// what was preserved; the contract assertions run on executable code only.
const repairCode = repairSql.split("\n")
  .filter((line) => !line.trimStart().startsWith("--")).join("\n");

test("the repair migration redefines every agent member guard without the email condition", () => {
  for (const fn of ["public.ifund_team_member_id", "ifund_story_runtime.subscription",
    "ifund_story_runtime.require_member", "ifund_strategy_runtime.require_member",
    "ifund_growth_runtime.require_member", "ifund_communications_runtime.require_member",
    "ifund_connections_runtime.require_member", "ifund_workforce_runtime.queued",
    "ifund_workforce_runtime.cancel_queued"])
    assert.match(repairCode, new RegExp("create or replace function " + fn.replace(/\./g, "\\.")));
  assert.doesNotMatch(repairCode, /email_confirmed_at/);
  // Tier and terms machinery is referenced, never weakened: the guards
  // still consult subscription() levels and current terms.
  assert.match(repairCode, /ifund_story_runtime\.subscription\(\)->>'level'/);
  assert.match(repairCode, /ifund_current_user_has_current_terms/);
});

test("withdrawal and payout verification is untouched by the repair", () => {
  assert.doesNotMatch(repairCode, /payout|withdraw/i);
  const payoutSql = readFileSync(new URL(
    "../supabase/migrations/20261112234000_ifund_live_paypal_payout_execution.sql",
    import.meta.url), "utf8");
  assert.match(payoutSql, /ifund_connect_paypal_payout_to_verified_email/);
  assert.match(payoutSql, /email_confirmed_at is not null/);
  const withdrawalPage = readFileSync(new URL(
    "../apps/web/src/pages/WithdrawalVerification.jsx", import.meta.url), "utf8");
  assert.match(withdrawalPage, /Step 1: Confirm your email account/);
});

test("SQL behaviour: unconfirmed active member passes the team and story guards after the repair", async () => {
  const db = await fixture({ workforce: true });
  try {
    await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$
      select jsonb_build_object('sub',current_setting('test.uid',true),
        'is_anonymous',coalesce(current_setting('test.anon',true),'false')::boolean) $$;`);
    await db.exec(teamSql);
    // Stubs so the repair migration's preflight sees the specialist guards
    // (their schemas are outside this fixture; the stubs are never called).
    await db.exec(`create schema ifund_strategy_runtime; create schema ifund_growth_runtime;
      create schema ifund_communications_runtime; create schema ifund_connections_runtime;
      create table public.ifund_referral_trial_accounts(owner_id uuid,trial_started_at timestamptz,trial_expires_at timestamptz);
      create table public.ifund_agent_trial_control(singleton boolean,enabled boolean);
      create function ifund_strategy_runtime.require_member() returns uuid language sql as $$select null::uuid$$;
      create function ifund_growth_runtime.require_member() returns uuid language sql as $$select null::uuid$$;
      create function ifund_communications_runtime.require_member(boolean,boolean) returns uuid language sql as $$select null::uuid$$;
      create function ifund_connections_runtime.require_member(boolean) returns uuid language sql as $$select null::uuid$$;`);
    await db.query("update auth.users set email_confirmed_at=null where id=$1", [UID]);
    await as(db, UID);
    await db.exec("reset role");
    // Before the repair: both guards reject the unconfirmed member.
    await assert.rejects(db.query("select public.ifund_team_member_id()"), /Verified member required/);
    await assert.rejects(db.query("select ifund_story_runtime.require_member()"), /Member access required/);
    await db.exec(repairSql);
    // After the repair: the same member passes both guards...
    assert.equal((await db.query("select public.ifund_team_member_id() id")).rows[0].id, UID);
    assert.equal((await db.query("select ifund_story_runtime.require_member() id")).rows[0].id, UID);
    // ...and reads their REAL tier (seeded basic entitlement), not an
    // exception and not a free downgrade.
    const sub = (await db.query("select ifund_story_runtime.subscription() s")).rows[0].s;
    assert.equal(sub.tier, "basic");
    assert.equal(sub.level, 1);
    // Preserved conditions: a suspended profile is still rejected...
    await db.query("update public.ifund_profiles set account_status='suspended' where id=$1", [UID]);
    await assert.rejects(db.query("select public.ifund_team_member_id()"), /Verified member required/);
    await db.query("update public.ifund_profiles set account_status='active' where id=$1", [UID]);
    // ...and an anonymous session is still rejected.
    await db.query("select set_config('test.anon','true',false)");
    await assert.rejects(db.query("select public.ifund_team_member_id()"), /Verified member required/);
  } finally { await db.close(); }
});
