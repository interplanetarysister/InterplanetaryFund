import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnTo,
  signInWithPassword,
  requestPasswordRecovery,
  establishRecoverySession,
  completePasswordRecovery,
} from "../src/lib/authFlows.js";

test("return destination accepts only same-origin absolute paths", () => {
  assert.equal(safeReturnTo("/dashboard?tab=activity", "https://ifund.test"), "/dashboard?tab=activity");
  assert.equal(safeReturnTo("https://evil.test", "https://ifund.test"), "/mine");
  assert.equal(safeReturnTo("//evil.test/path", "https://ifund.test"), "/mine");
  assert.equal(safeReturnTo("/\\evil.test", "https://ifund.test"), "/mine");
  assert.equal(safeReturnTo("", "https://ifund.test"), "/mine");
});

test("password login trims email and requires a returned session", async () => {
  let input;
  const result = await signInWithPassword({
    async signInWithPassword(value) {
      input = value;
      return { data: { session: { access_token: "session-token" } }, error: null };
    },
  }, "  USER@EXAMPLE.COM ", "correct horse battery");
  assert.deepEqual(input, { email: "user@example.com", password: "correct horse battery" });
  assert.equal(result.session.access_token, "session-token");
});

test("password login rejects missing credentials and provider errors", async () => {
  await assert.rejects(signInWithPassword({ signInWithPassword() {} }, "", "x"), TypeError);
  await assert.rejects(signInWithPassword({
    async signInWithPassword() { return { data: {}, error: new Error("denied") }; },
  }, "user@example.com", "password"), /denied/);
});

test("recovery request uses the app-owned reset route and normalized email", async () => {
  let call;
  const result = await requestPasswordRecovery({
    async resetPasswordForEmail(...args) { call = args; return { error: null }; },
  }, " USER@EXAMPLE.COM ", "https://ifund.test/reset-password");
  assert.deepEqual(call, ["user@example.com", { redirectTo: "https://ifund.test/reset-password" }]);
  assert.deepEqual(result, { requested: true });
});

test("recovery request returns no account-existence information", async () => {
  const result = await requestPasswordRecovery({
    async resetPasswordForEmail() { return { error: null }; },
  }, "unknown@example.com", "https://ifund.test/reset-password");
  assert.deepEqual(result, { requested: true });
});

test("recovery callback exchanges a PKCE code and confirms a session", async () => {
  const calls = [];
  const result = await establishRecoverySession({
    async exchangeCodeForSession(code) { calls.push(["exchange", code]); return { error: null }; },
    async getSession() { return { data: { session: { access_token: "recovery" } }, error: null }; },
  }, "https://ifund.test/reset-password?code=pkce-code");
  assert.deepEqual(calls, [["exchange", "pkce-code"]]);
  assert.deepEqual(result, { ready: true, hasCallbackCredentials: true });
});

test("recovery callback verifies a recovery token hash", async () => {
  let input;
  const result = await establishRecoverySession({
    async verifyOtp(value) { input = value; return { error: null }; },
    async getSession() { return { data: { session: { access_token: "recovery" } }, error: null }; },
  }, "https://ifund.test/reset-password?token_hash=hashed&type=recovery");
  assert.deepEqual(input, { token_hash: "hashed", type: "recovery" });
  assert.deepEqual(result, { ready: true, hasCallbackCredentials: true });
});

test("email recovery code is verified before password update and sign-out", async () => {
  const calls = [];
  const result = await completePasswordRecovery({
    async verifyOtp(value) { calls.push(["verify", value]); return { data: { session: {} }, error: null }; },
    async updateUser(value) { calls.push(["update", value]); return { error: null }; },
    async signOut() { calls.push(["signOut"]); return { error: null }; },
  }, {
    email: " USER@EXAMPLE.COM ", token: "123456",
    password: "new-password-123", confirmPassword: "new-password-123",
  });
  assert.deepEqual(calls, [
    ["verify", { email: "user@example.com", token: "123456", type: "recovery" }],
    ["update", { password: "new-password-123" }],
    ["signOut"],
  ]);
  assert.deepEqual(result, { updated: true });
});

test("recovery link session can update password without a typed OTP", async () => {
  const calls = [];
  await completePasswordRecovery({
    async verifyOtp() { calls.push("verify"); },
    async updateUser(value) { calls.push(["update", value]); return { error: null }; },
    async signOut() { calls.push("signOut"); return { error: null }; },
  }, {
    password: "new-password-123", confirmPassword: "new-password-123",
    hasRecoverySession: true,
  });
  assert.deepEqual(calls, [["update", { password: "new-password-123" }], "signOut"]);
});

test("mismatched or short passwords fail before any auth operation", async () => {
  let updates = 0;
  const auth = {
    async verifyOtp() { return { data: { session: {} }, error: null }; },
    async updateUser() { updates++; return { error: null }; },
  };
  await assert.rejects(completePasswordRecovery(auth, {
    email: "user@example.com", token: "123456",
    password: "short", confirmPassword: "short",
  }), TypeError);
  await assert.rejects(completePasswordRecovery(auth, {
    email: "user@example.com", token: "123456",
    password: "new-password-123", confirmPassword: "different-password",
  }), TypeError);
  assert.equal(updates, 0);
});

test("invalid recovery code never updates the password", async () => {
  let updates = 0;
  await assert.rejects(completePasswordRecovery({
    async verifyOtp() { return { data: {}, error: new Error("invalid code") }; },
    async updateUser() { updates++; return { error: null }; },
  }, {
    email: "user@example.com", token: "123456",
    password: "new-password-123", confirmPassword: "new-password-123",
  }), /invalid code/);
  assert.equal(updates, 0);
});
