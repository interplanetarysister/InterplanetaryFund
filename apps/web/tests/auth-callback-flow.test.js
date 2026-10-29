import test from "node:test";
import assert from "node:assert/strict";
import {
  authCallbackUrl, callbackParameters, completeAuthCallback,
  strippedAuthCallbackLocation,
} from "../src/lib/authCallback.js";

test("signup callback URL is fixed to the same-origin onboarding route", () => {
  assert.equal(
    authCallbackUrl("https://interplanetaryfund.com"),
    "https://interplanetaryfund.com/auth/callback?next=/onboarding",
  );
  assert.equal(
    authCallbackUrl("https://interplanetaryfund.com", { recovery: true }),
    "https://interplanetaryfund.com/auth/callback?next=/reset-password",
  );
  assert.throws(() => authCallbackUrl("http://evil.example"));
  assert.throws(() => authCallbackUrl("javascript:alert(1)"));
});

test("callback parser supports single-use code, email OTP hash, and implicit session", () => {
  assert.deepEqual(
    callbackParameters("https://interplanetaryfund.com/auth/callback?code=one-time-code&next=%2Fonboarding"),
    { type: "code", code: "one-time-code", next: "/onboarding" },
  );
  assert.deepEqual(
    callbackParameters("https://interplanetaryfund.com/auth/callback?token_hash=hash123&type=signup&next=%2Fonboarding"),
    { type: "token_hash", token_hash: "hash123", token_type: "signup", next: "/onboarding" },
  );
  const session = callbackParameters("https://interplanetaryfund.com/auth/callback?next=%2Fonboarding#access_token=access123&refresh_token=refresh123");
  assert.equal(session.type, "session");
  assert.equal(session.access_token, "access123");
  assert.equal(session.refresh_token, "refresh123");
});

test("callback rejects incomplete token pairs and unsupported token types", () => {
  assert.equal(
    callbackParameters("https://interplanetaryfund.com/auth/callback?token_hash=hash123&type=unknown").type,
    "error",
  );
  assert.equal(
    callbackParameters("https://interplanetaryfund.com/auth/callback#access_token=access123").type,
    "error",
  );
});

test("callback verifies the provider session and confirmed email before onboarding", async () => {
  let exchanged = "";
  const auth = {
    exchangeCodeForSession: async code => { exchanged = code; return { data: { session: {} }, error: null }; },
    getUser: async () => ({ data: { user: { id: "verified-user", email_confirmed_at: "2026-10-29T00:00:00Z" } }, error: null }),
  };
  const next = await completeAuthCallback(auth, { type: "code", code: "single-use", next: "/onboarding" });
  assert.equal(exchanged, "single-use");
  assert.equal(next, "/onboarding");
});

test("callback refuses onboarding when the email remains unconfirmed", async () => {
  const auth = {
    exchangeCodeForSession: async () => ({ data: { session: {} }, error: null }),
    getUser: async () => ({ data: { user: { id: "unconfirmed-user", email_confirmed_at: null } }, error: null }),
  };
  await assert.rejects(
    completeAuthCallback(auth, { type: "code", code: "single-use", next: "/onboarding" }),
    /email confirmation is not complete/,
  );
});

test("recovery callbacks route only to password reset and strip query/hash credentials", async () => {
  const auth = {
    verifyOtp: async () => ({ data: { session: {} }, error: null }),
    getUser: async () => ({ data: { user: { id: "recovery-user", email_confirmed_at: null } }, error: null }),
  };
  const next = await completeAuthCallback(auth, {
    type: "token_hash", token_hash: "recovery-hash", token_type: "recovery", next: "/reset-password",
  });
  assert.equal(next, "/reset-password");
  assert.equal(strippedAuthCallbackLocation("https://interplanetaryfund.com"), "/auth/callback");
});
