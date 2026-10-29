import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedEmailUser, resolveVerifiedEmailUser } from "../src/lib/verifiedEmailUser.js";

test("confirmed email users can be considered for IFund member routes", () => {
  assert.equal(isVerifiedEmailUser({
    id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391",
    email_confirmed_at: "2026-10-29T12:00:00.000Z",
  }), true);
});

test("sessions without provider email confirmation fail closed", () => {
  assert.equal(isVerifiedEmailUser({ id: "user-id", email_confirmed_at: null }), false);
  assert.equal(isVerifiedEmailUser({ id: "user-id" }), false);
  assert.equal(isVerifiedEmailUser(null), false);
  assert.equal(isVerifiedEmailUser({ email_confirmed_at: "2026-10-29T12:00:00.000Z" }), false);
});

test("signed-out visitor is distinct from an authentication verification failure", async () => {
  const user = await resolveVerifiedEmailUser({
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => { throw new Error("must not query user without a session"); },
  });
  assert.equal(user, null);
});

test("a present local session still requires provider-confirmed user verification", async () => {
  const user = await resolveVerifiedEmailUser({
    getSession: async () => ({ data: { session: { access_token: "opaque" } }, error: null }),
    getUser: async () => ({ data: { user: {
      id: "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391",
      email_confirmed_at: "2026-10-29T12:00:00.000Z",
    } }, error: null }),
  });
  assert.equal(user.id, "b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391");
});

test("provider verification errors fail closed instead of treating the visitor as signed out", async () => {
  await assert.rejects(() => resolveVerifiedEmailUser({
    getSession: async () => ({ data: { session: { access_token: "opaque" } }, error: null }),
    getUser: async () => ({ data: { user: null }, error: new Error("provider unavailable") }),
  }), /provider unavailable/);
});
