import test from "node:test";
import assert from "node:assert/strict";
import {
  routeCaptionGeneration, captionAIReady, validateCaptionRequest,
  captionRejectionReasons, cleanCaptionCandidate,
} from "../worker/captionGeneration.js";

const API = "https://interplanetaryfund.com";
const OWNER = "11111111-1111-4111-8111-111111111111";
const JWT = "header.payload.signature-0123456789abcdef";
const TITLE = "Rebuild the Westside Playground";
const DESCRIPTION = "Our neighborhood is rebuilding the playground at Westside Park for local kids.";

function fakeFetcher({ consent = true } = {}) {
  return async (url) => {
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: OWNER, is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00Z" });
    if (url.includes("/rest/v1/ifund_profiles?"))
      return Response.json([{ account_status: "active", account_deletion_pending: false }]);
    if (url.includes("/rest/v1/ifund_ai_permission_preferences?"))
      return Response.json([{
        owner_id: OWNER,
        allow_ai_campaign_drafts: consent,
        allow_ai_outreach_drafts: consent,
        allow_future_internal_ai_assistance: consent,
      }]);
    throw Error("Unexpected external network call: " + url);
  };
}

function queueAi(outputs) {
  const state = { calls: 0, prompts: [] };
  return {
    state,
    run: async (model, input) => {
      state.calls++;
      state.prompts.push(input.messages.at(-1).content);
      const next = outputs[Math.min(state.calls - 1, outputs.length - 1)];
      if (next instanceof Error) throw next;
      return { response: next };
    },
  };
}

const env = (ai) => ({
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_public",
  AI: ai,
});
const generateRequest = (body = { title: TITLE, description: DESCRIPTION, kind: "image" }) =>
  new Request(API + "/api/ai/captions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + JWT },
    body: JSON.stringify(body),
  });

test("readiness needs the AI binding and canonical project only", () => {
  assert.equal(captionAIReady(env({ run: async () => ({}) })), true);
  assert.equal(captionAIReady(env(undefined)), false);
  assert.equal(captionAIReady({ ...env({ run: async () => ({}) }), SUPABASE_URL: "https://example.supabase.co" }), false);
});

test("unconfigured deployment reports honestly and refuses generation", async () => {
  const status = await routeCaptionGeneration(new Request(API + "/api/ai/captions/status"), {}, fakeFetcher());
  assert.equal((await status.json()).captionAi, "not_configured");
  const refused = await routeCaptionGeneration(generateRequest(), {}, fakeFetcher());
  assert.equal(refused.status, 503);
});

test("validation rejects short titles and unknown kinds", () => {
  assert.throws(() => validateCaptionRequest({ title: "abc" }));
  assert.throws(() => validateCaptionRequest({ title: TITLE, kind: "story" }));
  assert.throws(() => validateCaptionRequest({ title: TITLE, extra: 1 }));
});

test("candidate cleaning and rejection reasons cover nonsense and discretion", () => {
  assert.equal(cleanCaptionCandidate('  "Fresh paint, bright futures"\nsecond line'), "Fresh paint, bright futures");
  const context = { title: TITLE, description: DESCRIPTION };
  assert.deepEqual(captionRejectionReasons("Fresh paint, bright futures at Westside Park", context), []);
  assert.ok(captionRejectionReasons("Flibberty gibbet snizzle framdoodle", context).includes("nonsense wording"));
  assert.ok(captionRejectionReasons("Please help me raise money for my family", context).length > 0);
  assert.ok(captionRejectionReasons("", context).includes("empty"));
});

test("a coherent AI draft is returned as-is with one provider call", async () => {
  const ai = queueAi(["Fresh paint, bright futures at Westside Park"]);
  const result = await routeCaptionGeneration(generateRequest(), env(ai), fakeFetcher());
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.caption, "Fresh paint, bright futures at Westside Park");
  assert.equal(body.source, "ai");
  assert.equal(ai.state.calls, 1);
});

test("gibberish first draft triggers exactly one corrective regeneration", async () => {
  const ai = queueAi(["Flibberty gibbet snizzle framdoodle", "New swings, safe landings, happy kids"]);
  const result = await routeCaptionGeneration(generateRequest(), env(ai), fakeFetcher());
  const body = await result.json();
  assert.equal(body.caption, "New swings, safe landings, happy kids");
  assert.equal(body.source, "ai_corrected");
  assert.equal(ai.state.calls, 2);
  assert.match(ai.state.prompts[1], /rejected/);
});

test("a discretion-violating draft is never returned; two failures fall back to the title", async () => {
  const ai = queueAi(["Please help me raise money for my family", "Xqzwkj plmrt vbnm"]);
  const result = await routeCaptionGeneration(generateRequest(), env(ai), fakeFetcher());
  const body = await result.json();
  assert.equal(body.source, "fallback");
  assert.equal(body.caption, TITLE);
  assert.equal(ai.state.calls, 2);
});

test("provider failure is an honest 503, never a substituted caption", async () => {
  const ai = queueAi([new Error("provider down")]);
  const result = await routeCaptionGeneration(generateRequest(), env(ai), fakeFetcher());
  assert.equal(result.status, 503);
  assert.equal((await result.json()).caption, undefined);
});

test("consent-denied members get the AI Assistance message and no provider call", async () => {
  const ai = queueAi(["Fresh paint, bright futures"]);
  const result = await routeCaptionGeneration(generateRequest(), env(ai), fakeFetcher({ consent: false }));
  assert.equal(result.status, 403);
  assert.match((await result.json()).error, /AI Assistance/);
  assert.equal(ai.state.calls, 0);
});
