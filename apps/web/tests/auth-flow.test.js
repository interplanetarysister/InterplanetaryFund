import test from "node:test";
import assert from "node:assert/strict";
import {
  authRedirectUrl,
  completeAuthCallback,
  confirmedUser,
  legacyAuthCallbackUrl,
} from "../src/lib/authFlow.js";
const user = { id: "owner", email_confirmed_at: "2026-01-01" };
const makeAuth = () => ({
  getUser: async () => ({ data: { user } }),
  exchangeCodeForSession: async () => ({ data: { session: { user } } }),
  verifyOtp: async () => ({ data: { session: { user } } }),
  setSession: async () => ({ data: { session: { user } } }),
});
test("callback URL is fixed and post-auth redirects cannot escape or loop", () => {
  const url = new URL(
    authRedirectUrl("https://interplanetaryfund.com", "/campaigns?tab=mine"),
  );
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("returnTo"), "/campaigns?tab=mine");
  for (const target of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%0a/evil.test",
    "/auth/callback",
    "/activate",
  ])
    assert.equal(
      new URL(
        authRedirectUrl("https://interplanetaryfund.com", target),
      ).searchParams.get("returnTo"),
      "/dashboard",
    );
  assert.equal(
    new URL(authRedirectUrl("https://interplanetaryfund.com", "/agents", true))
      .pathname,
    "/reset-password",
  );
});
test("PKCE code is consumed once under duplicate callback effects", async () => {
  const auth = makeAuth();
  let calls = 0;
  auth.exchangeCodeForSession = async (code) => {
    assert.equal(code, "one-time-code");
    calls++;
    return {};
  };
  const href =
    "https://interplanetaryfund.com/auth/callback?code=one-time-code&returnTo=%2Fagents";
  const results = await Promise.all([
    completeAuthCallback(auth, href),
    completeAuthCallback(auth, href),
  ]);
  assert.equal(calls, 1);
  assert.equal(results[0].returnTo, "/agents");
});
test("cross-device token-hash email verification and legacy implicit recovery links work", async () => {
  const auth = makeAuth();
  let otp;
  auth.verifyOtp = async (args) => {
    otp = args;
    return {};
  };
  await completeAuthCallback(
    auth,
    "https://interplanetaryfund.com/auth/callback?token_hash=hash&type=email",
  );
  assert.deepEqual(otp, { token_hash: "hash", type: "email" });
  const recovery = await completeAuthCallback(
    auth,
    "https://interplanetaryfund.com/reset-password#access_token=access&refresh_token=refresh&type=recovery",
  );
  assert.equal(recovery.recovery, true);
});
test("invalid credentials, unconfirmed accounts, provider errors and missing links fail closed", async () => {
  assert.equal(confirmedUser({ id: "owner" }), false);
  for (const href of [
    "https://interplanetaryfund.com/auth/callback",
    "https://interplanetaryfund.com/auth/callback?error=access_denied",
    "https://interplanetaryfund.com/auth/callback?token_hash=x&type=invite",
  ])
    await assert.rejects(completeAuthCallback(makeAuth(), href));
  const bad = makeAuth();
  bad.getUser = async () => ({ data: { user: { id: "owner" } } });
  await assert.rejects(
    completeAuthCallback(
      bad,
      "https://interplanetaryfund.com/auth/callback?code=x",
    ),
    /Confirm your email/,
  );
  const error = makeAuth();
  error.exchangeCodeForSession = async () => ({
    error: { message: "raw secret" },
  });
  await assert.rejects(
    completeAuthCallback(
      error,
      "https://interplanetaryfund.com/auth/callback?code=y",
    ),
    (error) => !error.message.includes("raw secret"),
  );
});

test("already-issued dashboard and login links are rescued before member guards", () => {
  const legacy = legacyAuthCallbackUrl(
    "https://interplanetaryfund.com/dashboard#access_token=access&refresh_token=refresh",
  );
  assert.equal(
    new URL(legacy, "https://interplanetaryfund.com").pathname,
    "/auth/callback",
  );
  assert.match(legacy, /returnTo=%2Fdashboard/);
  assert.match(legacy, /access_token=access/);
  assert.match(
    legacyAuthCallbackUrl(
      "https://interplanetaryfund.com/login?code=pkce&returnTo=%2Fagents",
    ),
    /code=pkce/,
  );
  assert.equal(
    legacyAuthCallbackUrl("https://interplanetaryfund.com/discover"),
    null,
  );
});

test("activation links are exchanged once and never redirect to the activation alias", async () => {
  const legacy = legacyAuthCallbackUrl("https://interplanetaryfund.com/activate?token_hash=hash&type=signup");
  assert.equal(new URL(legacy, "https://interplanetaryfund.com").pathname, "/auth/callback");
  assert.equal(new URL(legacy, "https://interplanetaryfund.com").searchParams.get("returnTo"), "/dashboard");
  const result = await completeAuthCallback(makeAuth(), "https://interplanetaryfund.com" + legacy);
  assert.equal(result.returnTo, "/dashboard");
});
