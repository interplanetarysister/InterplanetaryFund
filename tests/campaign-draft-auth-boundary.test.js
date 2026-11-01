import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../supabase/functions/ifund-campaign-draft/index.ts", import.meta.url), "utf8");
const uid = "a09c3b82-1758-454d-912c-e69ea4136daa";
const base = "https://ssibsfmtodgximseeqsv.supabase.co";
const payload = { answers: { cause: "Community initiative", beneficiary: "My community", need: "Equipment" },
  details: "We need safety equipment for a neighborhood cleanup event.", goal: 500 };
function harness({ key = "sb_publishable_test", url = base, authStatus = 200,
  confirmed = true, profile = "active", profileError = false } = {}) {
  const calls = [];
  let handler;
  const env = { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key };
  const fetcher = async (target, options) => {
    calls.push({ url: String(target), options });
    if (String(target).endsWith("/auth/v1/user")) {
      if (authStatus !== 200) return Response.json({ error: "unauthorized" }, { status: authStatus });
      return Response.json({ id: uid, email_confirmed_at: confirmed ? "2026-10-30T00:00:00Z" : null });
    }
    if (String(target).includes("/rest/v1/ifund_profiles?")) {
      if (profileError) return new Response("sensitive-provider-message", { status: 500 });
      return Response.json(profile === "missing" ? [] : [{
        id: uid, account_status: profile, account_deletion_pending: false,
      }]);
    }
    throw new Error("Unexpected outbound request");
  };
  runInNewContext(source, {
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    fetch: fetcher, Request, Response, URL, URLSearchParams, TextDecoder,
    Uint8Array, Set, Number, String, Array, Object, JSON,
  }, { filename: "ifund-campaign-draft/index.ts" });
  assert.equal(typeof handler, "function");
  const request = (data = payload, { token = "signed.test.jwt", origin = "https://interplanetaryfund.com",
    method = "POST", body, contentType = "application/json" } = {}) =>
    new Request("https://ifund.example/functions/v1/ifund-campaign-draft-preview", {
      method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(origin ? { Origin: origin } : {}), "Content-Type": contentType },
      ...(method === "POST" ? { body: body === undefined ? JSON.stringify(data) : body } : {}),
    });
  return { handler, calls, request };
}
test("missing or forged bearer cannot receive campaign suggestions", async () => {
  const h = harness();
  assert.equal((await h.handler(h.request(payload, { token: "" }))).status, 401);
  assert.equal(h.calls.length, 0);
  const forged = harness({ authStatus: 401 });
  const r = await forged.handler(forged.request());
  assert.equal(r.status, 401);
  assert.equal(forged.calls.length, 1);
  assert.ok(forged.calls[0].url.endsWith("/auth/v1/user"));
});
test("unconfirmed and inactive accounts fail closed before draft generation", async () => {
  for (const config of [{ confirmed: false }, { profile: "disabled" }, { profile: "missing" }]) {
    const h = harness(config);
    const r = await h.handler(h.request());
    assert.notEqual(r.status, 200);
    assert.ok(h.calls.length <= 2);
  }
});
test("provider failure is sanitized, not a successful draft", async () => {
  const h = harness({ profileError: true });
  const r = await h.handler(h.request());
  assert.equal(r.status, 503);
  assert.doesNotMatch(await r.text(), /sensitive-provider-message/);
});
test("valid owner with confirmed email gets exactly 5 titles, 2 summaries, 1 grounded story", async () => {
  const h = harness();
  const r = await h.handler(h.request());
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.titles.length, 5);
  assert.equal(new Set(body.titles).size, 5);
  assert.equal(body.summaries.length, 2);
  assert.match(body.story, /neighborhood cleanup/);
  assert.equal(body.ai_inference, false);
  assert.equal(body.image_rendered, false);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].options.headers.Authorization, "Bearer signed.test.jwt");
  assert.equal(h.calls[1].options.headers.apikey, "sb_publishable_test");
});
test("configuration must point to canonical Supabase project", async () => {
  const h = harness({ url: "https://evil.example" });
  assert.equal((await h.handler(h.request())).status, 503);
  assert.equal(h.calls.length, 0);
});
test("rejects unknown origin, malformed JSON, oversized actual stream, and fabricated detail", async () => {
  const h = harness();
  assert.equal((await h.handler(h.request(payload, { origin: "https://evil.example" }))).status, 403);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.handler(h.request(payload, { body: "{" }))).status, 400);
  assert.equal((await h.handler(h.request(payload, { body: "a".repeat(12001) }))).status, 413);
  assert.equal((await h.handler(h.request({ ...payload, details: "short" }))).status, 422);
  assert.equal((await h.handler(h.request({ ...payload, answers: { need: { inject: true } } }))).status, 422);
});
