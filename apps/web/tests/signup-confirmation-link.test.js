import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/pages/AuthPage.jsx", import.meta.url), "utf8");
const callback = readFileSync(new URL("../src/lib/authFlow.js", import.meta.url), "utf8");

test("signup explains secure email-link confirmation without requiring a code on web", () => {
  assert.match(src, /<h2 className="font-semibold">Confirm your email<\/h2>/);
  assert.match(src, /click <strong>Confirm email address<\/strong>/);
  assert.match(src, /I clicked the email link — continue/);
  assert.match(src, /Resend confirmation link/);
  assert.match(src, /isNativeApp && isRegister && confirmationPending/);
  assert.match(src, /Some emails only contain a link; no code is required/);
});

test("email-link and optional native OTP confirmation require server-verified identity", () => {
  assert.match(src, /if \(confirmationPending\) \{/);
  assert.match(src, /auth\.verifyOtp\(\{/);
  assert.match(src, /type: "signup"/);
  assert.match(src, /await verifiedAuthUser\(auth\)/);
  assert.match(src, /await finalizeSignupAgreement\(authClient\(\), verified, sessionStorage\)/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /token_hash/);
});

test("signup and resend use the first-party callback URL builder", () => {
  assert.match(src, /emailRedirectTo: emailAuthRedirectUrl\(/);
  assert.match(src, /auth\.resend\(\{/);
  assert.match(src, /type: "signup"/);
  assert.match(src, /If this account still needs confirmation/);
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
