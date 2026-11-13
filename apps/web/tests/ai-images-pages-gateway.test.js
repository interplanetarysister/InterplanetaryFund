import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest } from "../functions/api/ai/images/[action].js";

const BASE = "https://preview.example/api/ai/images/";
const enabled = {
  IFUND_IMAGE_AI_ENABLED: "enabled",
  SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock_public",
  AI: { run: async () => { throw new Error("Authless request must never reach AI"); } },
};
const input = {
  title: "Help a family recover",
  description: "An illustrated campaign about emergency housing support.",
  style: "comic",
};
function request(action, method = "POST", auth = false) {
  return new Request(BASE + action, {
    method,
    headers: {
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: "Bearer signed.mock.token" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(input) } : {}),
  });
}

test("Pages routes both artwork actions through the canonical, default-disabled handlers", async () => {
  for (const action of ["generate", "improve"]) {
    const response = await onRequest({ request: request(action), env: {} });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match((await response.json()).error, /currently available|currently unavailable/i);
  }
});

test("Pages artwork gateway enforces exact actions and HTTP method boundaries", async () => {
  assert.equal((await onRequest({ request: request("other"), env: enabled })).status, 404);
  for (const action of ["generate", "improve"]) {
    assert.equal((await onRequest({ request: request(action, "GET"), env: enabled })).status, 405);
    assert.equal((await onRequest({ request: request(action), env: enabled })).status,
      action === "generate" ? 401 : 422,
      "unauthenticated or malformed image requests must not reach inference");
  }
});

test("Pages artwork gateway reuses the Worker security, quota and model implementations", () => {
  const gateway = readFileSync(new URL("../functions/api/ai/images/[action].js", import.meta.url), "utf8");
  assert.match(gateway, /routeImageStudio\(request, env\)/);
  assert.match(gateway, /routeImageImprove\(request, env\)/);
  assert.doesNotMatch(gateway, /SUPABASE_SECRET_KEY|OAUTH_ENCRYPTION_KEY|service_role|api\.cloudflare\.com/);
});
