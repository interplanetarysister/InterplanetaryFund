import test from "node:test";
import assert from "node:assert/strict";
import { legacyAuthLandingRedirect } from "../src/lib/legacyAuthLanding.js";

test("device pairing and feature codes are not consumed as Supabase Auth callbacks", () => {
  for (const path of [
    "/activate?code=ABCDE-12345", "/devices?code=ABCDE-12345",
    "/oauth/consent?code=one-time-grant", "/campaign/abc?code=share",
    "/download?code=install", "/admin/agent-api?code=invite",
  ]) {
    assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com" + path), null, path);
  }
});
test("known historical email landing routes still recover valid Auth callbacks", () => {
  assert.equal(
    legacyAuthLandingRedirect("https://interplanetaryfund.com/dashboard?code=single-use"),
    "/auth/callback?next=%2Fonboarding&code=single-use",
  );
  assert.equal(
    legacyAuthLandingRedirect("https://interplanetaryfund.com/reset-password?token_hash=hash123&type=recovery"),
    "/auth/callback?next=%2Freset-password&token_hash=hash123&type=recovery",
  );
  assert.match(
    legacyAuthLandingRedirect("https://interplanetaryfund.com/#access_token=abc&refresh_token=xyz"),
    /^\/auth\/callback\?next=%2Fonboarding#access_token=/,
  );
});
test("invalid schemes and callback route never trigger legacy redirect", () => {
  assert.equal(legacyAuthLandingRedirect("javascript:alert(1)"), null);
  assert.equal(legacyAuthLandingRedirect("http://interplanetaryfund.com/dashboard?code=x"), null);
  assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com/auth/callback?code=x"), null);
  assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com/dashboard"), null);
});
