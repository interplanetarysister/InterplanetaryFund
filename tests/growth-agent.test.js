import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  growthRoute,
  growthMessages,
  growthEvidence,
} from "../worker/agents/growth.js";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const context = {
  campaigns: [
    {
      id: uid,
      title: "Supplies",
      status: "draft",
      goal_amount: 500,
      has_story: true,
      has_cover_image: true,
    },
  ],
  verified_donation_activity: {
    available: true,
    by_campaign_currency: [
      {
        campaign_id: uid,
        currency: "USD",
        captured_gifts: 2,
        gift_cents: "12525",
      },
    ],
  },
  connections: [
    {
      provider: "example",
      status: "connected",
      verified: true,
      access_token: "SECRET",
    },
  ],
};
const request = (path, body) =>
  new Request("https://worker.test/api/agents/growth/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer test.token",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const env = {
  IFUND_GROWTH_ENABLED: "enabled",
  IFUND_GROWTH_AI_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-test",
};
test("Growth uses actual captured amounts, separates currencies and never exposes connection secrets", () => {
  const evidence = growthEvidence(context);
  assert.match(evidence[0], /2 captured gifts totaling 125.25 USD/);
  const messages = growthMessages(
      { objective: "Where might supporters come from?" },
      context,
    ),
    data = JSON.parse(messages[1].content);
  assert.match(messages[0].content, /IFund Growth Agent/);
  assert.match(messages[0].content, /does not establish momentum/);
  assert.equal(data.connection_usage.available, false);
  assert.equal(data.connections[0].capabilities_available, false);
  assert.ok(!JSON.stringify(messages).includes("SECRET"));
  assert.match(
    growthEvidence({ campaigns: context.campaigns })[0],
    /unavailable; do not infer zero/,
  );
});
test("Growth rejects malformed financial evidence and foreign metrics cannot become campaign evidence", () => {
  const stale = {
    ...context,
    verified_donation_activity: {
      ...context.verified_donation_activity,
      available: false,
    },
  };
  assert.ok(!growthEvidence(stale)[0].includes("125.25"));
  assert.deepEqual(
    JSON.parse(growthMessages({ objective: "Help" }, stale)[1].content)
      .verified_donation_activity,
    { available: false },
  );
  assert.throws(() =>
    growthEvidence({
      ...context,
      verified_donation_activity: {
        available: true,
        by_campaign_currency: [
          {
            campaign_id: uid,
            currency: "USD",
            captured_gifts: 1,
            gift_cents: "not money",
          },
        ],
      },
    }),
  );
  const e = growthEvidence({
    ...context,
    verified_donation_activity: {
      available: true,
      by_campaign_currency: [
        {
          campaign_id: other,
          currency: "USD",
          captured_gifts: 10,
          gift_cents: "999999",
        },
      ],
    },
  });
  assert.ok(!e[0].includes("9999.99"));
});
test("Growth routes only its own paths/RPCs with independent activation", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : { brief: null, recommendations: [] },
    );
  };
  assert.equal(
    (await growthRoute(request("workspace"), env, fetcher)).status,
    200,
  );
  assert.ok(urls.at(-1).endsWith("ifund_growth_workspace"));
  assert.equal(
    (
      await growthRoute(
        new Request("https://worker.test/api/agents/strategy/workspace"),
        env,
        fetcher,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await growthRoute(
        request("workspace"),
        { ...env, IFUND_GROWTH_ENABLED: "disabled" },
        fetcher,
      )
    ).status,
    503,
  );
});
test("Growth Cloudflare entrypoint ignores execution context and unauthenticated requests fail closed", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async (url) =>
      Response.json(
        url.endsWith("/user")
          ? { id: uid, email_confirmed_at: "today" }
          : { brief: null, recommendations: [] },
      );
    assert.equal(
      (await worker.fetch(request("workspace"), env, { waitUntil() {} }))
        .status,
      200,
    );
  } finally {
    globalThis.fetch = saved;
  }
  assert.equal(
    (
      await growthRoute(
        new Request("https://worker.test/api/agents/growth/workspace"),
        env,
      )
    ).status,
    401,
  );
});
test("Growth inference uses its own context, quota and stored receipt with fact-bound schema", async () => {
  const basis = growthEvidence(context)[0],
    calls = [];
  const recommendation = {
    campaign_id: uid,
    title: "Test a clear message",
    description: "Run a voluntary small test",
    reasoning: "A hypothesis to test",
    evidence: basis,
    confidence: "low",
    expected_impact: "Unknown until measured",
    estimated_effort: "One hour",
    agent: "strategy",
  };
  const plan = {
    summary: "Try a small experiment",
    today_priorities: ["Define the test", "Review facts"],
    week_priorities: ["Compare response", "Review results"],
    long_term: ["Reassess", "Retain trust"],
    risks: ["Outcomes unknown"],
    predictions: [
      {
        forecast: "A clearer appeal may help",
        confidence: "low",
        evidence: basis,
        recommended_action: "Test voluntarily",
      },
    ],
    recommendations: [
      recommendation,
      { ...recommendation, title: "Compare an audience hypothesis" },
      { ...recommendation, title: "Review the result" },
    ],
  };
  const fetcher = async (url, init) => {
    calls.push(url);
    return Response.json(
      url.endsWith("/user")
        ? { id: uid, email_confirmed_at: "today" }
        : url.endsWith("ifund_growth_context")
          ? context
          : url.endsWith("ifund_growth_begin")
            ? { state: "claimed", lease: other }
            : { brief: { summary: plan.summary }, recommendations: [] },
    );
  };
  const r = await growthRoute(
    request("brief", {
      request_id: uid,
      objective: "Help me test a growth idea",
    }),
    {
      ...env,
      AI: {
        run: async (model, options) => {
          assert.match(options.messages[0].content, /IFund Growth Agent/);
          assert.deepEqual(
            options.response_format.json_schema.properties.predictions.items
              .properties.evidence.enum,
            [basis],
          );
          return { response: plan };
        },
      },
    },
    fetcher,
  );
  assert.equal(r.status, 201);
  assert.ok(calls.at(-1).endsWith("ifund_growth_finish"));
  assert.ok(calls.every((url) => !url.includes("ifund_strategy_")));
});
