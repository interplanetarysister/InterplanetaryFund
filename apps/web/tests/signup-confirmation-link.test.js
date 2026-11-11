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
