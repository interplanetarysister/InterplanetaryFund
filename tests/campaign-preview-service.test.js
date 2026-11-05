import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignPreview,
  campaignPreviewInput,
  basicCampaignOutline,
} from "../worker/services/campaign-preview.js";
import { serviceGateway } from "../worker/services/gateway.js";

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
  story: "A truthful campaign story.",
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
} = {}) {
  const calls = [];
  return {
    calls,
    env: {
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
    const result = await campaignPreview(request(), f.env);
    assert.ok([401, 403, 503].includes(result.status));
    assert.equal(f.calls.length, 1);
    assert.doesNotMatch(await result.text(), /private-provider-credential/);
  }
});
test("the preserved free outline uses only supplied facts and never calls the model", async () => {
  const f = binding({ access: { active: false, level: 0 } });
  const response = await serviceGateway(request(), f.env);
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
  const response = await serviceGateway(request(), f.env);
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
    const result = await campaignPreview(request(), f.env);
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
  const response = await campaignPreview(request(), f.env);
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.state, "queued");
  assert.equal(body.request_id, ID);
  assert.equal(body.story, undefined);
  const wrong = binding({
    nativeStatus: 202,
    native: { state: "queued", request_id: RECEIPT },
  });
  assert.equal((await campaignPreview(request(), wrong.env)).status, 502);
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
  );
  assert.equal((await result.json()).section, section);
  assert.equal(f.calls[1].body.section, "Original section");
  const basic = binding({ access: { active: false, level: 0 } });
  const unavailable = await campaignPreview(
    request({ ...input, section: "Original section" }),
    basic.env,
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
    assert.equal((await campaignPreview(request(), f.env)).status, 502);
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
