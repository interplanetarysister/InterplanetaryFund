import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OAUTH_PROVIDERS,
  configuredProviders,
  oauthRedirectUrl,
  startOAuthSignIn,
} from "../src/lib/oauthProviders.js";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("only the authorized providers are offered", () => {
  assert.deepEqual(
    OAUTH_PROVIDERS.map((p) => p.id),
    ["google", "facebook"],
  );
  // AGENTS.md rules out Instagram for this migration.
  assert.ok(!OAUTH_PROVIDERS.some((p) => p.id === "instagram"));
});

test("configuration selects providers, dropping unknown and duplicate entries", () => {
  assert.deepEqual(
    configuredProviders("google").map((p) => p.id),
    ["google"],
  );
  assert.deepEqual(
    configuredProviders("facebook, google").map((p) => p.id),
    ["google", "facebook"],
  );
  assert.deepEqual(
    configuredProviders("GOOGLE ,facebook").map((p) => p.id),
    ["google", "facebook"],
  );
  // A typo hides one button rather than breaking sign-in.
  assert.deepEqual(
    configuredProviders("google,instagram").map((p) => p.id),
    ["google"],
  );
  assert.deepEqual(
    configuredProviders("google,google").map((p) => p.id),
    ["google"],
  );
  assert.deepEqual(configuredProviders(""), []);
  assert.deepEqual(configuredProviders(undefined), []);
  assert.deepEqual(configuredProviders("   "), []);
});

test("the redirect target is canonical and carries the post-login path", () => {
  assert.equal(
    oauthRedirectUrl("https://interplanetaryfund.com", "/dashboard"),
    "https://interplanetaryfund.com/login?returnTo=%2Fdashboard",
  );
  // A preview origin is allowed through so preview deploys can be tested.
  assert.equal(
    oauthRedirectUrl("https://preview.pages.dev", "/inbox"),
    "https://preview.pages.dev/login?returnTo=%2Finbox",
  );
  // No returnTo, and an unsafe one, both yield a clean redirect with no parameter.
  assert.equal(
    oauthRedirectUrl("https://interplanetaryfund.com", ""),
    "https://interplanetaryfund.com/login",
  );
  assert.equal(
    oauthRedirectUrl("https://interplanetaryfund.com", "https://evil.example"),
    "https://interplanetaryfund.com/login",
  );
});

test("a hostile origin cannot become the OAuth redirect target", () => {
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,x",
    "not a url",
    "",
  ]) {
    assert.equal(
      oauthRedirectUrl(bad, "/dashboard"),
      "https://interplanetaryfund.com/login?returnTo=%2Fdashboard",
    );
  }
  // http is refused off-localhost; the redirect must not be downgraded.
  assert.equal(
    oauthRedirectUrl("http://interplanetaryfund.com", "/dashboard"),
    "https://interplanetaryfund.com/login?returnTo=%2Fdashboard",
  );
});

test("an auth route is never used as the post-login destination", () => {
  // Redirecting back into /login would loop.
  for (const loop of [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/login?returnTo=/x",
  ]) {
    assert.equal(
      oauthRedirectUrl("https://interplanetaryfund.com", loop),
      "https://interplanetaryfund.com/login",
    );
  }
});

test("starting a sign-in passes the provider through and reports the redirect", async () => {
  const calls = [];
  const auth = {
    signInWithOAuth: async (arg) => {
      calls.push(arg);
      return { error: null };
    },
  };
  const result = await startOAuthSignIn({
    auth,
    provider: "google",
    origin: "https://interplanetaryfund.com",
    returnTo: "/inbox",
  });
  assert.equal(result.started, true);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    {
      provider: "google",
      options: {
        redirectTo: "https://interplanetaryfund.com/login?returnTo=%2Finbox",
      },
    },
  ]);
});

test("an unsupported provider is refused without calling Supabase", async () => {
  let called = false;
  const auth = {
    signInWithOAuth: async () => {
      called = true;
      return { error: null };
    },
  };
  for (const bad of ["instagram", "", null, undefined, "GOOGLE OLD"]) {
    const result = await startOAuthSignIn({
      auth,
      provider: bad,
      origin: "https://interplanetaryfund.com",
      returnTo: "/",
    });
    assert.equal(result.started, false, `${String(bad)} must not start`);
    assert.equal(result.ok, false);
  }
  assert.equal(
    called,
    false,
    "no request may be made for an unsupported provider",
  );
});

test("a provider error is reported without throwing", async () => {
  const auth = {
    signInWithOAuth: async () => ({
      error: { message: "Provider is not enabled" },
    }),
  };
  const result = await startOAuthSignIn({
    auth,
    provider: "facebook",
    origin: "https://interplanetaryfund.com",
    returnTo: "/",
  });
  assert.equal(result.started, false);
  assert.match(result.message, /Facebook is not enabled/);
});

test("a thrown error is caught and surfaced", async () => {
  const auth = {
    signInWithOAuth: async () => {
      throw new Error("network down");
    },
  };
  const result = await startOAuthSignIn({
    auth,
    provider: "google",
    origin: "https://interplanetaryfund.com",
    returnTo: "/",
  });
  assert.equal(result.started, false);
  assert.match(result.message, /Google sign-in could not be started/);
});

test("a missing auth client is handled rather than crashing the page", async () => {
  const result = await startOAuthSignIn({
    auth: null,
    provider: "google",
    origin: "https://interplanetaryfund.com",
    returnTo: "/",
  });
  assert.equal(result.started, false);
  assert.equal(result.message, "Social sign-in is unavailable.");
});

test("the auth page renders the provider buttons only when configured", () => {
  // Collapse whitespace so a Prettier reflow cannot break these assertions.
  const flat = (path) => source(path).replace(/\s+/g, " ");
  const page = flat("src/pages/AuthPage.jsx");
  const buttons = flat("src/components/auth/OAuthButtons.jsx");
  assert.match(
    page,
    /<OAuthButtons/,
    "AuthPage must render the provider buttons",
  );
  // Password reset is email-only: a provider round-trip cannot set a password.
  assert.match(
    page,
    /\{!isReset && \(? <OAuthButtons/,
    "reset mode must not offer social sign-in",
  );
  assert.match(
    buttons,
    /if \(providers\.length === 0\) return null;/,
    "with no provider configured, no controls are rendered",
  );
});

test("no credential is read from the browser bundle", () => {
  const mod = source("src/lib/oauthProviders.js");
  // Provider secrets are configured in the Supabase dashboard, never here.
  assert.doesNotMatch(mod, /CLIENT_SECRET|SERVICE_ROLE|clientSecret/i);
  assert.match(mod, /VITE_SUPABASE_OAUTH_PROVIDERS/);
});
