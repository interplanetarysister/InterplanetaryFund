import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/pages/AuthPage.jsx", import.meta.url), "utf8");
const callback = readFileSync(new URL("../src/lib/authFlow.js", import.meta.url), "utf8");

test("signup explains Supabase's confirmation link rather than requiring a code", () => {
  assert.match(src, /Confirm your email using the link/);
  assert.match(src, /click <strong>Confirm email address<\/strong>/);
  assert.match(src, /I clicked the email link — continue/);
  assert.match(src, /Resend confirmation link/);
  assert.doesNotMatch(src, /Email confirmation code/);
  assert.doesNotMatch(src, /confirmationCode/);
});
test("email-link confirmation still verifies a server issued identity", () => {
  assert.match(src, /if \(confirmationPending\) \{\s*\/\/ Supabase sends a confirmation link/);
  assert.match(src, /await verifiedAuthUser\(auth\)/);
  assert.match(src, /await finalizeSignupAgreement\(authClient\(\), verified, sessionStorage\)/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /token_hash/);
});
test("signup and resends keep an approved first-party callback origin", () => {
  assert.match(src, /emailRedirectTo: authRedirectUrl\(/);
  assert.match(src, /auth\.resend\(\{/);
  assert.match(src, /type: "signup"/);
});

test("repeated signup does not falsely claim a confirmation email was sent", () => {
  assert.match(src, /Array\.isArray\(data\.user\.identities\) && data\.user\.identities\.length === 0/);
  assert.match(src, /setConfirmationPending\(false\);\s*setMessage\("No new registration was confirmed/);
  assert.match(src, /If no email arrives, try signing in or resetting your password/);
  assert.doesNotMatch(src, /We sent a confirmation link to \{email\}/);
  assert.match(src, /reset your password<\/Link>/);
});

test("expired signup callback directs members to supported link-based recovery", () => {
  const callbackPage = readFileSync(new URL("../src/pages/AuthCallback.jsx", import.meta.url), "utf8");
  assert.match(callbackPage, /Request a new confirmation link/);
  assert.match(callbackPage, /sign in and use password recovery/);
  assert.doesNotMatch(callbackPage, /enter the confirmation code on the signup page/);
});
