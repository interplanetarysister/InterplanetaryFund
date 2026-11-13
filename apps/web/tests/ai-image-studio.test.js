import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeImageStudio, validateImageRequest, IMAGE_MODEL } from "../../../worker/imageStudio.js";

const API = "https://interplanetaryfund.com/api/ai/images/generate";
const OWNER = "11111111-1111-4111-8111-111111111111";
const payload = {
  title: "Help a family recover",
  description: "An illustrated cover supporting housing and emergency expenses.",
  style: "interstellar",
};
const validImage = "/9j/" + "A".repeat(80);
const baseEnv = {
  IFUND_IMAGE_AI_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_public",
};
const imageRequest = (value = payload, extra = {}) => new Request(API, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer signed.mock.jwt",
    ...extra },
  body: JSON.stringify(value),
});
function fakeServices({ quota = true, verified = true } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/v1/user"))
      return Response.json(verified ? { id: OWNER, app_metadata: { role: "member" } } : {}, {status: verified ? 200 : 401});
    if (url.endsWith("/rest/v1/rpc/ifund_ai_image_consume_free_quota"))
      return Response.json(quota);
    throw Error("Unexpected external network call.");
  };
  return { fetcher, calls };
}

test("validated image prompt has four approved styles, capped length, no custom model or actor", () => {
  const { prompt, style } = validateImageRequest(payload);
  assert.equal(style, "interstellar");
  assert.ok(prompt.length <= 2048);
  assert.match(prompt, /no.*real people/i);
  assert.equal(IMAGE_MODEL, "@cf/black-forest-labs/flux-1-schnell");
  for (const invalid of [
    { ...payload, style: "photorealistic" },
    { ...payload, title: "x" },
    { ...payload, description: "too short" },
    { ...payload, arbitrary_provider: "paid-model" },
    { ...payload, description: "x".repeat(901) },
  ]) assert.throws(() => validateImageRequest(invalid));
});

test("enabled image generation verifies owner, consumes quota before AI, and returns JPEG only", async () => {
  const service = fakeServices();
  let aiCalls = 0;
  const env = { ...baseEnv, AI: { run: async (model, options) => {
    aiCalls++;
    assert.equal(model, IMAGE_MODEL);
    assert.equal(options.steps, 4);
    assert.ok(options.prompt.includes(payload.title));
    assert.ok(service.calls.some(call => call.url.endsWith("/rpc/ifund_ai_image_consume_free_quota")),
      "inference must happen only after a server-verified quota result");
    return { image: validImage };
  } } };
  const result = await routeImageStudio(imageRequest(), env, service.fetcher);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const json = await result.json();
  assert.equal(json.mime_type, "image/jpeg");
  assert.equal(json.image_base64, validImage);
  assert.equal(json.generated, true);
  assert.equal(aiCalls, 1);
  assert.equal(service.calls.length, 2);
  assert.ok(!JSON.stringify(json).includes(OWNER), "owner identities must not be returned");
});

test("image generation refuses anonymous, malformed, over-quota and disabled requests", async () => {
  const ai = { run: async () => { throw Error("An unverified request must never infer."); } };
  const badAuth = fakeServices({ verified: false });
  assert.equal((await routeImageStudio(imageRequest(), { ...baseEnv, AI: ai }, badAuth.fetcher)).status, 401);
  const quota = fakeServices({ quota: false });
  assert.equal((await routeImageStudio(imageRequest(), { ...baseEnv, AI: ai }, quota.fetcher)).status, 429);
  assert.equal((await routeImageStudio(imageRequest(), { ...baseEnv, IFUND_IMAGE_AI_ENABLED: "off", AI: ai })).status, 503);
  const valid = fakeServices();
  assert.equal((await routeImageStudio(imageRequest({ ...payload, style: "unknown" }),
    { ...baseEnv, AI: ai }, valid.fetcher)).status, 422);
  assert.equal(valid.calls.length, 0);
  const badType = new Request(API, {method: "POST", headers: {"Content-Type": "text/plain"},
    body: JSON.stringify(payload) });
  assert.equal((await routeImageStudio(badType, { ...baseEnv, AI: ai })).status, 415);
});

test("invalid provider image is never returned as a successful cover", async () => {
  for (const image of ["bad", "A".repeat(84), "/9j/" + "A".repeat(7000000)]) {
    const service = fakeServices();
    const env = { ...baseEnv, AI: { run: async () => ({ image }) } };
    const result = await routeImageStudio(imageRequest(), env, service.fetcher);
    assert.equal(result.status, 502);
  }
});

test("page gates access and routes images into existing verified cover storage", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/pages/AIImageStudio.jsx", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../../../worker/index.js", import.meta.url), "utf8");
  assert.ok(app.includes('path="/ai-images" element={<MemberAccess><AIImageStudio'));
  assert.ok(worker.includes("routeImageStudio(request, env)"));
  assert.match(page, /uploadCampaignCover\(authClient\(\), file\)/);
  assert.match(page, /paste this link into the cover URL field/i);
  assert.doesNotMatch(page, /base44/i, "independent image studio must not depend on Base44");
});

test("staged quota SQL is atomic and does not grant anonymous image attempts", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/pending/20261113_ifund_ai_image_free_quota.sql", import.meta.url), "utf8");
  assert.match(sql, /ifund_ai_image_consume_free_quota/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_total >= 50/);
  assert.match(sql, /q\.attempts < 3/);
  assert.match(sql, /email_confirmed_at IS NOT NULL/);
  assert.match(sql, /is_anonymous/);
  assert.match(sql, /explicit_consent IS TRUE/);
  const policy = readFileSync(new URL("../src/lib/legalPolicy.js", import.meta.url), "utf8");
  const version = policy.match(/export const TERMS_VERSION = "([^"]+)"/)?.[1];
  assert.ok(version && sql.includes("accepted.terms_version = '" + version + "'"),
    "image quota must require current explicit legal agreement, not any historical terms");
  assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO authenticated;/);
});
