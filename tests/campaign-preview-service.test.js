import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignPreview,
  campaignPreviewInput,
  basicCampaignOutline,
} from "../worker/services/campaign-preview.js";
import { serviceGateway } from "../worker/services/gateway.js";
import { reserveTrialContent } from "../worker/trialAiContent.js";

const ID = "33333333-3333-4333-8333-333333333333";
const RECEIPT = "44444444-4444-4444-8444-444444444444";
const input = {
  details: "McEve Community Center needs equipment for an accessible garden.",
  answers: {
    beneficiary: "McEve Community Center",
    need: "iPhone accessibility equipment",
    cause: "community",
  },
  goal: 1250,
  request_id: ID,
};
const copy = {
  titles: ["One", "Two", "Three", "Four", "Five"],
  summaries: ["First summary", "Second summary"],
  story: "A truthful account of the community garden needs and organizer-provided plan. ".repeat(21).trim(),
  image_prompt: "A symbolic community garden.",
};
const request = (body = input, overrides = {}) =>
  new Request("https://ifund.test/api/services/story_agent/campaign-preview", {
    method: "POST",
    headers: {
      authorization: "Bearer own.test.jwt",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    ...overrides,
  });
function binding({
  access = { active: true, level: 1 },
  accessStatus = 200,
  nativeStatus = 201,
  native = { draft: { id: RECEIPT, payload: copy } },
  throws = false,
  reserve = {allowed:true,state:"reserved",limit:15,remaining:14},
  reserveStatus = 200,
} = {}) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, init) => {
      const endpoint=String(url);
      assert.equal(init?.headers?.Authorization,"Bearer own.test.jwt");
      if(endpoint.endsWith("/ifund_ai_content_reserve"))
        return Response.json(reserve,{status:reserveStatus});
      if(endpoint.endsWith("/ifund_ai_content_complete"))
        return Response.json(true);
      if(endpoint.endsWith("/ifund_trial_ai_generation_release"))
        return Response.json(true);
      throw new Error("Unexpected trial quota RPC: "+endpoint);
    },
    env: {
      SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      IFUND_STORY_AGENT: {
        fetch: async (forwarded) => {
          const path = new URL(forwarded.url).pathname;
          const body =
            forwarded.method === "POST" ? await forwarded.json() : null;
          calls.push({ path, method: forwarded.method, body });
          assert.equal(
            forwarded.headers.get("authorization"),
            "Bearer own.test.jwt",
          );
          if (throws)
            throw Object.assign(new Error("private-provider-credential"), {
              status: 400,
            });
          if (path.endsWith("/subscription"))
            return Response.json(access, { status: accessStatus });
          assert.equal(path, "/api/agents/story/drafts");
          return Response.json(native, { status: nativeStatus });
        },
      },
    },
  };
}

test("campaign writing is authenticated, method-bound and bounded before service execution", async () => {
  const forbidden = {
    IFUND_STORY_AGENT: { fetch: () => assert.fail("No service request") },
  };
  assert.equal(
    (
      await campaignPreview(
        request(input, { headers: { "content-type": "application/json" } }),
        forbidden,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await campaignPreview(
        new Request("https://ifund.test/", { method: "GET" }),
        forbidden,
      )
    ).status,
    405,
  );
  assert.equal(
    (
      await campaignPreview(
        request({ ...input, details: "x".repeat(64001) }),
        forbidden,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await campaignPreview(
        request({ ...input, provider: "paid-model" }),
        forbidden,
      )
    ).status,
    400,
  );
  assert.equal((await campaignPreview(request(input), {})).status, 503);
});
test("unverified access never becomes a free-outline success or an inference attempt", async () => {
  for (const options of [
    { accessStatus: 403 },
    { accessStatus: 401 },
    { access: { active: true, level: 0 } },
    { access: { active: false, level: 2 } },
    { throws: true },
  ]) {
    const f = binding(options);
    const result = await campaignPreview(request(), f.env, f.fetcher);
    assert.ok([401, 403, 503].includes(result.status));
    assert.equal(f.calls.length, 1);
    assert.doesNotMatch(await result.text(), /private-provider-credential/);
  }
});
test("the preserved free outline uses only supplied facts and never calls the model", async () => {
  const f = binding({ access: { active: false, level: 0 } });
  const response = await serviceGateway(request(), f.env, f.fetcher);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.assistance, "outline");
  assert.equal(body.ai_inference, false);
  assert.equal(body.image_rendered, false);
  assert.equal(body.titles.length, 5);
  assert.equal(body.summaries.length, 2);
  assert.ok(body.story.includes(input.details));
  assert.ok(body.story.includes("McEve Community Center"));
  assert.ok(body.story.includes("iPhone accessibility equipment"));
  assert.deepEqual(
    f.calls.map((call) => call.path),
    ["/api/agents/story/subscription"],
  );
});
test("outlines fit campaign bounds for every existing category without inventing results", () => {
  for (const cause of [
    "medical",
    "emergency",
    "education",
    "community",
    "animals",
    "business",
    "creative",
    "memorial",
    "disaster_relief",
    "environment",
    "other",
  ]) {
    const result = basicCampaignOutline(
      campaignPreviewInput({
        ...input,
        answers: { cause, beneficiary: "B".repeat(100), need: "N".repeat(100) },
        details: "D".repeat(1500),
      }),
    );
    assert.equal(result.titles.length, 5);
    assert.ok(result.titles.every((title) => title.length <= 150));
    assert.ok(result.summaries.every((summary) => summary.length <= 600));
    assert.ok(result.image_prompt.length <= 2000);
    assert.ok(result.story.includes("D".repeat(1500)));
    assert.doesNotMatch(
      result.story,
      /already raised|donors have|deadline|endorsed/,
    );
  }
});
test("eligible requests use the existing guarded Story execution with the same request reference", async () => {
  const f = binding();
  const response = await serviceGateway(request(), f.env, f.fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.assistance, "assisted");
  assert.equal(result.ai_inference, true);
  assert.equal(result.story, copy.story);
  assert.equal(f.calls[1].body.request_id, ID);
  assert.equal(f.calls[1].body.campaign_id, null);
  for (const value of [
    input.details,
    input.answers.beneficiary,
    input.answers.need,
    String(input.goal),
  ])
    assert.ok(f.calls[1].body.details.includes(value));
  assert.equal(
    "model" in f.calls[1].body || "provider" in f.calls[1].body,
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /44444444|implementation|lease|provider/,
  );
});
test("quota and provider failures do not silently replace the requested service with an outline", async () => {
  for (const status of [403, 409, 429, 502, 503]) {
    const f = binding({
      nativeStatus: status,
      native: {
        error: "private-provider-credential",
        code: "new_request_required",
      },
    });
    const result = await campaignPreview(request(), f.env, f.fetcher);
    assert.equal(result.status, status);
    assert.equal(f.calls.length, 2);
    const body = await result.json();
    assert.equal(body.titles, undefined);
    assert.equal(body.code, "new_request_required");
    assert.doesNotMatch(JSON.stringify(body), /private-provider-credential/);
  }
});
test("queued requests preserve the caller reference and never report generated copy", async () => {
  const f = binding({
    nativeStatus: 202,
    native: { state: "queued", request_id: ID },
  });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.state, "queued");
  assert.equal(body.request_id, ID);
  assert.equal(body.story, undefined);
  const wrong = binding({
    nativeStatus: 202,
    native: { state: "queued", request_id: RECEIPT },
  });
  assert.equal((await campaignPreview(request(), wrong.env, wrong.fetcher)).status, 502);
});
test("rewrites retain the whole native section, while free outlines are never called rewrites", async () => {
  const section =
    "A revised paragraph.\n\nA second paragraph preserving the facts.";
  const f = binding({
    native: { draft: { id: RECEIPT, payload: { section } } },
  });
  const result = await campaignPreview(
    request({ ...input, section: "Original section" }),
    f.env,
    f.fetcher,
  );
  assert.equal((await result.json()).section, section);
  assert.equal(f.calls[1].body.section, "Original section");
  const basic = binding({ access: { active: false, level: 0 } });
  const unavailable = await campaignPreview(
    request({ ...input, section: "Original section" }),
    basic.env,
    basic.fetcher,
  );
  assert.equal(unavailable.status, 409);
  assert.equal((await unavailable.json()).code, "section_unavailable");
  assert.equal(basic.calls.length, 1);
});
test("a confirmed stored receipt and complete output are required before success", async () => {
  for (const native of [
    { draft: { payload: copy } },
    { draft: { id: RECEIPT, payload: { ...copy, titles: ["Only one"] } } },
  ]) {
    const f = binding({ native });
    assert.equal((await campaignPreview(request(), f.env, f.fetcher)).status, 502);
  }
});
test("malformed inputs and non-JSON service replies fail closed", async () => {
  for (const change of [
    { details: "short" },
    { details: "A hidden\u0000control" },
    { answers: [] },
    { answers: { need: "x".repeat(101) } },
    { goal: Infinity },
    { section: "x".repeat(4001) },
  ])
    assert.throws(() => campaignPreviewInput({ ...input, ...change }));
  const env = {
    IFUND_STORY_AGENT: {
      fetch: () =>
        new Response("private-provider-credential", {
          headers: { "content-type": "text/html" },
        }),
    },
  };
  const response = await campaignPreview(request(), env);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-provider-credential/);
});

test("a retry holding an already-reserved allowance for the same request still reaches generation", async () => {
  // Regression (allowance state drift): both reserve RPCs answer a repeated
  // request reference with already_reserved while the reservation is live.
  // The /create flow reuses the reference per input, so a member whose first
  // attempt failed downstream retried into "Your AI generation allowance
  // could not be verified." The allowance HAS verified; generation proceeds.
  const f = binding({ reserve: { allowed: false, state: "already_reserved", limit: 15 } });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.assistance, "assisted");
  assert.equal(result.ai_inference, true);
  assert.equal(result.story, copy.story);
  assert.equal(f.calls.length, 2);
});

test("a retry after the allowance was already completed replays the generation", async () => {
  const f = binding({ reserve: { allowed: false, state: "already_completed", limit: 50 } });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.assistance, "assisted");
  assert.equal(result.ai_inference, true);
});

test("a genuine allowance RPC failure fails closed as unverifiable, never as a denial or outline", async () => {
  const f = binding({ reserve: { message: "upstream exploded" }, reserveStatus: 500 });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "unavailable");
  assert.match(body.error, /could not be verified/);
  // Generation was never attempted: only the subscription check ran.
  assert.equal(f.calls.length, 1);
});

test("a membership denial keeps the denial path, not the unverifiable one", async () => {
  const f = binding({ reserve: { allowed: false, state: "membership_required", limit: 50 } });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "membership_required");
  assert.match(body.error, /needs a trial or a subscription/);
  assert.doesNotMatch(body.error, /could not be verified/);
  assert.equal(f.calls.length, 1);
});

test("a trial limit keeps its 429 denial path through the service", async () => {
  const f = binding({ reserve: { allowed: false, state: "trial_limit", limit: 15, remaining: 0 } });
  const response = await campaignPreview(request(), f.env, f.fetcher);
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.code, "trial_limit");
  assert.doesNotMatch(body.error, /could not be verified/);
  assert.equal(f.calls.length, 1);
});

test("reserveTrialContent maps every reserve RPC state to the right allowance state", async () => {
  const env = { SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co", SUPABASE_PUBLISHABLE_KEY: "k" };
  const rpc = (payload, status = 200) => async () => Response.json(payload, { status });
  // Verified allowances.
  assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: true, state: "reserved", remaining: 3 }))).tracked, true);
  assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: true, state: "admin_exempt" }))).allowed, true);
  assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: true, state: "paid_or_admin_exempt" }))).allowed, true);
  // Idempotent retries: the allowance verified for this very request.
  const held = await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: false, state: "already_reserved" }));
  assert.deepEqual([held.allowed, held.tracked], [true, true]);
  const spent = await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: false, state: "already_completed" }));
  assert.deepEqual([spent.allowed, spent.tracked], [true, false]);
  // Denials stay denials.
  for (const state of ["trial_limit", "monthly_limit", "membership_required"])
    assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: false, state }))).code, state);
  // Unrecognized shapes stay unverifiable, and a failing RPC throws so the
  // caller can fail closed in the same unverifiable state.
  assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({ allowed: false, state: "surprise" }))).code, "unavailable");
  assert.equal((await reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({}))).code, "unavailable");
  await assert.rejects(reserveTrialContent(env, "jwt", "campaign_story", ID, rpc({}, 500)), /could not be verified/);
});

test("saved campaign reference is forwarded to owner-verified Story and invalid IDs are rejected",async()=>{
 const f=binding();
 const response=await campaignPreview(request({...input,campaign_id:RECEIPT}),f.env,f.fetcher);
 assert.equal(response.status,200);
 const routed=f.calls.find(call=>call.path==="/api/agents/story/drafts");
 assert.equal(routed.body.campaign_id,RECEIPT);
 const invalid=await campaignPreview(request({...input,campaign_id:"another-user"}),f.env,f.fetcher);
 assert.equal(invalid.status,400);
});

const ID2 = "55555555-5555-4555-8555-555555555555";
// A deliberate re-produce is a NEW request reference: the allowance
// reserves (and charges) it as its own generation, the Story agent runs
// a fresh draft for it, and completing the first generation never locks
// the member out of the second.
function reproduceBinding(reserveStates) {
  const reserveCalls = [];
  const completeCalls = [];
  const draftCalls = [];
  return {
    reserveCalls, completeCalls, draftCalls,
    fetcher: async (url, init) => {
      const endpoint = String(url);
      if (endpoint.endsWith("/ifund_ai_content_reserve")) {
        const body = JSON.parse(init.body);
        reserveCalls.push(body.p_request_id);
        return Response.json(reserveStates[reserveCalls.length - 1]);
      }
      if (endpoint.endsWith("/ifund_ai_content_complete")) {
        completeCalls.push(JSON.parse(init.body).p_request_id);
        return Response.json(true);
      }
      throw new Error("Unexpected trial quota RPC: " + endpoint);
    },
    env: {
      SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      IFUND_STORY_AGENT: {
        fetch: async (forwarded) => {
          const path = new URL(forwarded.url).pathname;
          if (path.endsWith("/subscription")) return Response.json({ active: true, level: 1 });
          const body = await forwarded.json();
          draftCalls.push(body);
          return Response.json({
            draft: { id: RECEIPT, payload: { ...copy,
              story: ("Version for request " + body.request_id + ". ") + copy.story } },
          }, { status: 201 });
        },
      },
    },
  };
}

test("two regenerations in a row each reserve and generate fresh content (no lockout)", async () => {
  const f = reproduceBinding([
    { allowed: true, state: "reserved", limit: 15, remaining: 14 },
    { allowed: true, state: "reserved", limit: 15, remaining: 13 },
  ]);
  const first = await campaignPreview(request(input), f.env, f.fetcher);
  const second = await campaignPreview(request({ ...input, request_id: ID2 }), f.env, f.fetcher);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const firstBody = await first.json();
  const secondBody = await second.json();
  assert.equal(firstBody.assistance, "assisted");
  assert.equal(secondBody.assistance, "assisted");
  assert.match(firstBody.story, new RegExp(ID));
  assert.match(secondBody.story, new RegExp(ID2));
  assert.notEqual(firstBody.story, secondBody.story);
  // Each version was its own allowance reservation and completion.
  assert.deepEqual(f.reserveCalls, [ID, ID2]);
  assert.deepEqual(f.completeCalls, [ID, ID2]);
  assert.deepEqual(f.draftCalls.map(call => call.request_id), [ID, ID2]);
});

test("a regeneration denied by the allowance keeps the honest denial, not a broken control", async () => {
  const f = reproduceBinding([
    { allowed: true, state: "reserved", limit: 15, remaining: 14 },
    { allowed: false, state: "membership_required", limit: 50 },
  ]);
  const first = await campaignPreview(request(input), f.env, f.fetcher);
  assert.equal(first.status, 200);
  const second = await campaignPreview(request({ ...input, request_id: ID2 }), f.env, f.fetcher);
  assert.equal(second.status, 403);
  const denied = await second.json();
  assert.equal(denied.code, "membership_required");
  assert.match(denied.error, /needs a trial or a subscription/);
  assert.doesNotMatch(denied.error, /could not be verified/);
  // The denied regeneration never reached the Story agent.
  assert.equal(f.draftCalls.length, 1);

  const g = reproduceBinding([
    { allowed: true, state: "reserved", limit: 15, remaining: 1 },
    { allowed: false, state: "trial_limit", limit: 15, remaining: 0 },
  ]);
  await campaignPreview(request(input), g.env, g.fetcher);
  const limited = await campaignPreview(request({ ...input, request_id: ID2 }), g.env, g.fetcher);
  assert.equal(limited.status, 429);
  const limitedBody = await limited.json();
  assert.equal(limitedBody.code, "trial_limit");
  assert.match(limitedBody.error, /15 trial AI creations are used/);
  assert.doesNotMatch(limitedBody.error, /could not be verified/);
  assert.equal(g.draftCalls.length, 1);
});
