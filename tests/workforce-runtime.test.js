import test from "node:test";
import assert from "node:assert/strict";
import { storyRoute } from "../worker/agents/story.js";
import { invokeImplementation } from "../worker/workforce/runtime.js";
import { serviceGateway } from "../worker/services/gateway.js";

const uid = "11111111-1111-4111-8111-111111111111",
  rid = "22222222-2222-4222-8222-222222222222";
const secret = "e".repeat(64);
const suggestion = {
  titles: ["A", "B", "C", "D", "E"],
  summaries: ["One", "Two"],
  story: "A truthful story.",
  image_prompt: "A mission-specific scene.",
};
const input = {
  details: "Our community needs school supplies.",
  request_id: rid,
};
const candidate = {
  id: "writer_v1",
  revision: "1",
  provider: "cloudflare",
  adapter: "workers_ai",
  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  registered: true,
  available: true,
  tested: true,
  assigned_positions: ["story_agent"],
  capabilities: ["story.draft.v1"],
  tested_capabilities: ["story.draft.v1"],
  permissions: ["owner_context"],
  security: "supabase_owner_scoped_v1",
  max_complexity: 2,
  max_input_bytes: 24000,
  max_output_tokens: 2200,
  estimated_units: 1200,
  quality: 0.9,
  reliability: 0.9,
  latency_ms: 100,
  cost: {
    verified: true,
    additional_cost: 0,
    trial: false,
    hard_stop: true,
    evidence: "official free pricing",
    expires_at: "2099-01-01T00:00:00Z",
  },
  evaluation: {
    passed: true,
    revision: "1",
    evidence: "verified contract fixture",
    expires_at: "2099-01-01T00:00:00Z",
  },
};
const env = {
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "public-key",
  IFUND_STORY_ENABLED: "enabled",
  IFUND_STORY_AI_ENABLED: "enabled",
  IFUND_WORKFORCE_ENABLED: "enabled",
  IFUND_WORKFORCE_EXECUTOR_KEY: secret,
};
const request = () =>
  new Request("https://ifund.test/api/agents/story/drafts", {
    method: "POST",
    headers: {
      authorization: "Bearer owner.jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
function fetcher(calls, overrides = {}) {
  return async (url, init) => {
    const name = url.split("/").pop();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ name, body });
    assert.equal(init.headers.Authorization, "Bearer owner.jwt");
    if (
      [
        "ifund_workforce_snapshot",
        "ifund_workforce_begin",
        "ifund_workforce_started",
        "ifund_workforce_finish",
      ].includes(name)
    )
      assert.equal(init.headers["x-ifund-workforce-key"], secret);
    else assert.equal(init.headers["x-ifund-workforce-key"], undefined);
    if (overrides[name]) return overrides[name](body);
    if (name === "user")
      return Response.json({ id: uid, email_confirmed_at: "2026-01-01" });
    if (name === "ifund_story_context")
      return Response.json({ campaign: null, research: null });
    if (name === "ifund_workforce_snapshot")
      return Response.json({
        policy: { enabled: true, remaining_units: 5000 },
        implementations: [candidate],
      });
    if (name === "ifund_workforce_begin")
      return Response.json({
        state: "claimed",
        lease: rid,
        implementation: candidate,
      });
    if (name === "ifund_workforce_started") return Response.json(true);
    if (name === "ifund_workforce_finish")
      return Response.json({
        id: rid,
        status: "draft",
        payload: body.p_result,
      });
    throw Error("Unexpected endpoint " + name);
  };
}

test("Story keeps its service contract while procurement and private executor proof stay behind the gateway", async () => {
  const calls = [];
  let inference = 0;
  const response = await storyRoute(
    request(),
    {
      ...env,
      AI: {
        run: async (model, args) => {
          inference++;
          assert.equal(model, candidate.model);
          assert.equal(args.max_tokens, 2200);
          assert.ok(!JSON.stringify(args).includes(secret));
          assert.ok(!JSON.stringify(args).includes("owner.jwt"));
          return { response: suggestion };
        },
      },
    },
    fetcher(calls),
  );
  assert.equal(response.status, 201);
  assert.equal(inference, 1);
  const body = await response.json();
  assert.deepEqual(body.draft.payload, suggestion);
  assert.ok(!JSON.stringify(body).includes("writer_v1"));
  assert.ok(!JSON.stringify(body).includes("lease"));
  assert.equal(
    calls.find((c) => c.name === "ifund_workforce_finish").body.p_outcome,
    "succeeded",
  );
  assert.equal(
    calls.find((c) => c.name === "ifund_workforce_begin").body
      .p_implementation_id,
    "writer_v1",
  );
});

test("missing proof, free attestation, tested capability or native binding never invokes a fallback", async () => {
  for (const change of [
    { environment: { IFUND_WORKFORCE_EXECUTOR_KEY: undefined } },
    {
      overrides: {
        ifund_workforce_snapshot: () =>
          Response.json({
            policy: { enabled: false },
            implementations: [candidate],
          }),
      },
    },
    {
      overrides: {
        ifund_workforce_snapshot: () =>
          Response.json({
            policy: { enabled: true, remaining_units: 5000 },
            implementations: [{ ...candidate, tested: false }],
          }),
        ifund_workforce_begin: (body) => {
          assert.equal(body.p_implementation_id, null);
          return Response.json({ state: "queued", retry_after: "2026-11-05" });
        },
      },
    },
    {
      environment: { AI: undefined },
      overrides: {
        ifund_workforce_begin: (body) => {
          assert.equal(body.p_implementation_id, null);
          return Response.json({ state: "queued" });
        },
      },
    },
  ]) {
    const response = await storyRoute(
      request(),
      {
        ...env,
        AI: { run: () => assert.fail("unverified inference") },
        ...change.environment,
      },
      fetcher([], change.overrides),
    );
    assert.ok([202, 503].includes(response.status));
  }
});

test("replayed and queued requests do not dispatch; uncertain provider failure is recorded without retry", async () => {
  for (const state of ["completed", "queued"]) {
    const response = await storyRoute(
      request(),
      { ...env, AI: { run: () => assert.fail("duplicate execution") } },
      fetcher([], {
        ifund_workforce_begin: () =>
          Response.json({
            state,
            draft: { id: rid },
            retry_after: "2026-11-05",
          }),
      }),
    );
    assert.equal(response.status, state === "queued" ? 202 : 200);
  }
  const calls = [];
  let runs = 0;
  const response = await storyRoute(
    request(),
    {
      ...env,
      AI: {
        run: async () => {
          runs++;
          throw Error("provider secret must not leak");
        },
      },
    },
    fetcher(calls),
  );
  assert.equal(response.status, 503);
  assert.equal(runs, 1);
  assert.equal(
    calls.find((c) => c.name === "ifund_workforce_finish").body.p_outcome,
    "unknown",
  );
  assert.ok(!(await response.text()).includes("provider secret"));
});

test("interchangeable service-binding adapter receives bounded task input without actor credentials", async () => {
  const local = {
    ...candidate,
    id: "local_writer",
    provider: "self_hosted",
    adapter: "service_binding",
    binding: "IFUND_MODEL_LOCAL",
  };
  let calls = 0;
  const response = await storyRoute(
    request(),
    {
      ...env,
      IFUND_MODEL_LOCAL: {
        fetch: async (url, init) => {
          calls++;
          assert.equal(url, "https://ifund-inference.internal/v1/generate");
          assert.deepEqual(init.headers, {
            "content-type": "application/json",
          });
          assert.ok(!init.body.includes("owner.jwt"));
          assert.ok(!init.body.includes(secret));
          return Response.json({ response: suggestion });
        },
      },
    },
    fetcher([], {
      ifund_workforce_snapshot: () =>
        Response.json({
          policy: { enabled: true, remaining_units: 5000 },
          implementations: [local],
        }),
      ifund_workforce_begin: () =>
        Response.json({ state: "claimed", lease: rid, implementation: local }),
    }),
  );
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  await assert.rejects(
    invokeImplementation(
      { ...local, binding: "https://untrusted.test" },
      env,
      {},
    ),
  );
  await assert.rejects(
    invokeImplementation(
      local,
      {
        IFUND_MODEL_LOCAL: {
          fetch: async () => new Response("x".repeat(64001)),
        },
      },
      {},
    ),
    /incomplete draft/,
  );
});

test("central service addresses preserve authorization and never expose the private builder or provider registry", async () => {
  const calls = [];
  const bindings = {
    IFUND_STORY_AGENT: {
      fetch: async (req) => {
        calls.push(new URL(req.url).pathname);
        assert.equal(req.headers.get("authorization"), "Bearer owner.jwt");
        return Response.json({ tier: "basic" });
      },
    },
  };
  assert.equal(
    (
      await serviceGateway(
        new Request("https://ifund.test/api/services"),
        bindings,
      )
    ).status,
    401,
  );
  const catalog = await serviceGateway(
    new Request("https://ifund.test/api/services", {
      headers: { authorization: "Bearer owner.jwt" },
    }),
    bindings,
  );
  const body = await catalog.json();
  assert.equal(body.services.length, 9);
  assert.ok(!JSON.stringify(body).includes("admin_builder_agent"));
  await serviceGateway(
    new Request("https://ifund.test/api/services/story_agent/drafts", {
      headers: { authorization: "Bearer owner.jwt" },
    }),
    bindings,
  );
  assert.deepEqual(calls, [
    "/api/agents/story/subscription",
    "/api/agents/story/drafts",
  ]);
  assert.equal(
    (
      await serviceGateway(
        new Request(
          "https://ifund.test/api/services/admin_builder_agent/drafts",
        ),
        bindings,
      )
    ).status,
    404,
  );
});

test("queue erasure remains authenticated without inference, execution enablement or executor key", async () => {
  let called = false;
  const req = new Request("https://ifund.test/api/agents/story/cancel-queued", {
    method: "POST",
    headers: {
      authorization: "Bearer owner.jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify({ request_id: rid }),
  });
  const response = await storyRoute(
    req,
    {
      ...env,
      IFUND_STORY_ENABLED: "disabled",
      IFUND_WORKFORCE_ENABLED: "disabled",
      IFUND_WORKFORCE_EXECUTOR_KEY: undefined,
    },
    fetcher([], {
      ifund_workforce_cancel_queued: (body) => {
        called = true;
        assert.equal(body.p_request_id, rid);
        return Response.json({ status: "cancelled" });
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(called, true);
});
