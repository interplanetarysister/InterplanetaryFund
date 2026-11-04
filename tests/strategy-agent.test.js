import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/agents/strategy.js";
import {
  strategyRequest,
  strategyMessages,
  strategyOutput,
  strategyResponseFormat,
  strategyBulk,
  strategyRoute,
  strategyEvidence,
} from "../worker/agents/strategy.js";
const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const rec = {
  campaign_id: uid,
  title: "Clarify the supply list",
  description: "Explain what supplies are needed.",
  reasoning: "Specific needs help people understand the purpose.",
  evidence: "The organizer is raising funds for school supplies.",
  confidence: "medium",
  expected_impact: "An estimate: clearer communication.",
  estimated_effort: "A short writing session.",
  agent: "story",
};
const plan = {
  summary: "Focus on making the campaign need clear.",
  today_priorities: ["Check the supplied facts.", "Clarify the need."],
  week_priorities: ["Review the story.", "Gather evidence."],
  long_term: ["Review outcomes.", "Reassess priorities."],
  risks: ["Donation activity is unavailable."],
  predictions: [
    {
      forecast: "Clearer copy may help understanding.",
      confidence: "low",
      evidence: "No outcome evidence is available.",
      recommended_action: "Review the copy.",
    },
  ],
  recommendations: [
    rec,
    { ...rec, title: "Review the existing cover" },
    { ...rec, title: "Plan a future review" },
  ],
};
const runtimeBasis = strategyEvidence({
  campaigns: [{ id: uid, title: "School supplies" }],
})[0];
const runtimePlan = {
  ...plan,
  predictions: plan.predictions.map((p) => ({ ...p, evidence: runtimeBasis })),
  recommendations: plan.recommendations.map((r) => ({
    ...r,
    evidence: runtimeBasis,
  })),
};
test("evidence is copied from supplied facts and anchored to the recommendation campaign",()=>{
 const contexts={campaigns:[{id:uid,title:'Supplies',goal_amount:500},{id:other,title:'Meals',goal_amount:200}]};
 const evidence=strategyEvidence(contexts);
 const result={...plan,predictions:plan.predictions.map(p=>({...p,evidence:evidence[0]})),recommendations:plan.recommendations.map(r=>({...r,evidence:evidence[0]}))};
 assert.equal(strategyOutput({response:result},[uid,other],evidence).recommendations.length,3);
 assert.throws(()=>strategyOutput({response:{...result,recommendations:result.recommendations.map(r=>({...r,evidence:'Campaigns with stories perform better'}))}},[uid,other],evidence));
 assert.throws(()=>strategyOutput({response:{...result,recommendations:[{...result.recommendations[0],campaign_id:other},...result.recommendations.slice(1)]}},[uid,other],evidence));
 assert.deepEqual(strategyResponseFormat(evidence).json_schema.properties.recommendations.items.properties.evidence.enum,evidence);
});
test("strategy request rejects authority and publishing options", () => {
  assert.throws(() =>
    strategyRequest({
      request_id: uid,
      objective: "A decision",
      publish: true,
    }),
  );
  assert.equal(
    strategyRequest({ request_id: uid, objective: " Where should I focus? " })
      .objective,
    "Where should I focus?",
  );
});
test("bulk validation rejects foreign options, duplicate IDs and oversized selections", () => {
  const item = { id: uid, revision: "2026-11-04T06:00:00.123456Z" };
  assert.equal(
    strategyBulk({ operation_id: other, items: [item], status: "accepted" })
      .p_items.length,
    1,
  );
  for (const body of [
    { operation_id: other, items: [item, item], status: "accepted" },
    { operation_id: other, items: [item], status: "published" },
    { operation_id: other, items: [item], status: "accepted", owner_id: uid },
    { operation_id: other, items: [], status: "open" },
  ])
    assert.throws(() => strategyBulk(body));
});
const env = {
  IFUND_STRATEGY_ENABLED: "enabled",
  IFUND_STRATEGY_AI_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
};
const http = (path, body) =>
  new Request("https://worker.test/api/agents/strategy/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer test.token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("Worker authenticates, reserves once, validates AI and requires persistence receipt", async () => {
  let runs = 0;
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push([url, init.body ? JSON.parse(init.body) : null]);
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: uid, email_confirmed_at: "2026-11-04" });
    if (url.endsWith("_context"))
      return Response.json({
        campaigns: [{ id: uid, title: "School supplies" }],
      });
    if (url.endsWith("_begin"))
      return Response.json({ state: "claimed", lease: other });
    if (url.endsWith("_finish"))
      return Response.json({
        brief: { summary: plan.summary },
        recommendations: [],
      });
    throw Error("unexpected");
  };
  const response = await strategyRoute(
    http("brief", { request_id: uid, objective: "Help me prioritize" }),
    {
      ...env,
      AI: {
        run: async () => {
          runs++;
          return { response: runtimePlan };
        },
      },
    },
    fetcher,
  );
  assert.equal(response.status, 201);
  assert.equal(runs, 1);
  assert.ok(calls.at(-1)[1].p_result.recommendations.length === 3);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const failed = await strategyRoute(
    http("brief", { request_id: uid, objective: "Help" }),
    { ...env, AI: { run: async () => ({ response: runtimePlan }) } },
    async (url, init) =>
      url.endsWith("_finish")
        ? Response.json({ error: "private SQL secret" }, { status: 500 })
        : fetcher(url, init),
  );
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("private SQL"));
});
test("replays, quota and in-progress states never call inference", async () => {
  for (const state of [
    "completed",
    "limited",
    "in_progress",
    "failed",
    "conflict",
  ]) {
    let runs = 0;
    const fetcher = async (url) =>
      Response.json(
        url.endsWith("/user")
          ? { id: uid, email_confirmed_at: "today" }
          : url.endsWith("_context")
            ? { campaigns: [{ id: uid }] }
            : {
                state,
                result: { brief: { summary: "Saved" }, recommendations: [] },
              },
      );
    const result = await strategyRoute(
      http("brief", { request_id: uid, objective: "Help" }),
      {
        ...env,
        AI: {
          run: async () => {
            runs++;
          },
        },
      },
      fetcher,
    );
    assert.equal(runs, 0);
    assert.equal(
      result.status,
      state === "completed" ? 200 : state === "limited" ? 429 : 409,
    );
  }
});
test("invalid AI output marks a failed attempt without saving a plan", async () => {
  let persisted;
  const fetcher = async (url, init) => {
    if (url.endsWith("_finish")) {
      persisted = JSON.parse(init.body);
      return Response.json({ status: "failed" });
    }
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : url.endsWith("_context")
          ? { campaigns: [{ id: uid }] }
          : { state: "claimed", lease: other },
    );
  };
  const result = await strategyRoute(
    http("brief", { request_id: uid, objective: "Help" }),
    {
      ...env,
      AI: {
        run: async () => ({
          response: {
            ...plan,
            recommendations: [{ ...rec, campaign_id: other }, rec, rec],
          },
        }),
      },
    },
    fetcher,
  );
  assert.equal(result.status, 502);
  assert.equal(persisted.p_result, null);
  assert.equal((await result.json()).code, "new_request_required");
});
test("unauthenticated, disabled, unconfirmed and oversized requests fail closed", async () => {
  assert.equal(
    (
      await strategyRoute(
        new Request("https://worker.test/api/agents/strategy/workspace"),
        env,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await strategyRoute(http("workspace"), {
        ...env,
        IFUND_STRATEGY_ENABLED: "disabled",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await strategyRoute(http("workspace"), env, async () =>
        Response.json({ id: uid }),
      )
    ).status,
    401,
  );
  const big = http("brief", { request_id: uid, objective: "x".repeat(20000) });
  assert.equal(
    (
      await strategyRoute(big, env, async () =>
        Response.json({ id: uid, email_confirmed_at: "today" }),
      )
    ).status,
    413,
  );
});
test("Cloudflare execution context is never treated as a fetch implementation", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      Response.json(
        url.endsWith("/user")
          ? { id: uid, email_confirmed_at: "today" }
          : { brief: null, recommendations: [] },
      );
    const result = await worker.fetch(http("workspace"), env, {
      waitUntil() {},
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { brief: null, recommendations: [] });
  } finally {
    globalThis.fetch = saved;
  }
});
test("brief requires owned campaign context and keeps unknown metrics unknown", () => {
  assert.throws(() =>
    strategyMessages({ objective: "Help" }, { campaigns: [] }),
  );
  const messages = strategyMessages(
    { objective: "Where should I focus?" },
    { campaigns: [{ id: uid, title: "School supplies" }] },
  );
  const data = JSON.parse(messages[1].content);
  assert.deepEqual(data.verified_donation_activity, { available: false });
  assert.equal("total_raised" in data, false);
  assert.match(messages[0].content, /not an executed handoff/);
});
test("structured plan cannot add foreign campaigns or confer another role", () => {
  assert.equal(
    strategyOutput({ response: plan }, [uid]).recommendations.length,
    3,
  );
  assert.throws(() =>
    strategyOutput(
      {
        response: {
          ...plan,
          recommendations: [{ ...rec, campaign_id: other }, rec, rec],
        },
      },
      [uid],
    ),
  );
  assert.throws(() =>
    strategyOutput(
      {
        response: {
          ...plan,
          recommendations: [{ ...rec, agent: "admin_builder_agent" }, rec, rec],
        },
      },
      [uid],
    ),
  );
});
test("plan validation rejects malformed results and removes model-invented action flags", () => {
  assert.throws(() => strategyOutput("not json", [uid]));
  const clean = strategyOutput(
    {
      response: {
        ...plan,
        published: true,
        recommendations: plan.recommendations.map((r) => ({
          ...r,
          publish: true,
          approved: true,
        })),
      },
    },
    [uid],
  );
  assert.equal("published" in clean, false);
  assert.equal("approved" in clean.recommendations[0], false);
  assert.equal(
    strategyResponseFormat().json_schema.additionalProperties,
    false,
  );
});
test("oversized stored campaign context never reaches inference", () => {
  assert.throws(
    () =>
      strategyMessages(
        { objective: "Help" },
        { campaigns: [{ id: uid, title: "x".repeat(30000) }] },
      ),
    /too much/,
  );
});
