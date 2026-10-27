import test from "node:test";
import assert from "node:assert/strict";
import { TARGET_PROJECT_REF, verifySupabaseCohesion } from "../scripts/check-supabase-cohesion.mjs";

const target = "https://" + TARGET_PROJECT_REF + ".supabase.co";
const old = "https://tzehxfikoslihnclhxuz.supabase.co";

test("cohesive target browser/server/JWKS/Worker config passes", () => {
  assert.equal(verifySupabaseCohesion({
    VITE_SUPABASE_URL: target,
    SUPABASE_URL: target,
    SUPABASE_JWKS_URL: target + "/auth/v1/.well-known/jwks.json",
    IFUND_SUPABASE_PROJECT_REF: TARGET_PROJECT_REF,
  }).ok, true);
});
test("currently observed split Pages project fails closed", () => {
  const result = verifySupabaseCohesion({
    VITE_SUPABASE_URL: target,
    SUPABASE_URL: old,
    SUPABASE_JWKS_URL: old + "/auth/v1/.well-known/jwks.json",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /SUPABASE_URL/);
});
test("Worker project-ref drift is also rejected", () => {
  const result = verifySupabaseCohesion({
    VITE_SUPABASE_URL: target,
    IFUND_SUPABASE_PROJECT_REF: "tzehxfikoslihnclhxuz",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /IFUND_SUPABASE_PROJECT_REF/);
});
test("missing browser endpoint fails a production check", () => {
  assert.equal(verifySupabaseCohesion({ SUPABASE_URL: target }).ok, false);
});
test("local library/server-only verification can omit Vite endpoint", () => {
  assert.equal(verifySupabaseCohesion({
    IFUND_SUPABASE_PROJECT_REF: TARGET_PROJECT_REF,
  }, { requireFrontend: false }).ok, true);
});
test("reject malformed, non-HTTPS, credential-bearing or unrelated domains", () => {
  for (const url of [
    "http://" + TARGET_PROJECT_REF + ".supabase.co",
    "https://user:pass@" + TARGET_PROJECT_REF + ".supabase.co",
    "https://example.com",
    "https://" + TARGET_PROJECT_REF + ".supabase.co/not-root",
  ]) {
    assert.equal(verifySupabaseCohesion({ VITE_SUPABASE_URL: url }).ok, false, url);
  }
});
test("never inspect or reveal authentication secrets", () => {
  const r = verifySupabaseCohesion({
    VITE_SUPABASE_URL: old,
    SUPABASE_SECRET_KEY: "a-value-that-must-not-be-reported",
    VITE_SUPABASE_PUBLISHABLE_KEY: "a-value-that-must-not-be-reported",
  });
  assert.equal(JSON.stringify(r).includes("a-value-that-must-not-be-reported"), false);
});
