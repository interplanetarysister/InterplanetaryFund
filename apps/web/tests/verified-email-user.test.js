import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedEmailUser } from "../src/lib/verifiedEmailUser.js";

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
