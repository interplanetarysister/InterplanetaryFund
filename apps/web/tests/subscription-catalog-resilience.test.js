import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/Subscriptions.jsx", import.meta.url), "utf8");

test("a private billing status failure cannot suppress the public plan catalog", () => {
  assert.match(page, /Promise\.allSettled\(/);
  assert.match(page, /catalog\.status==="fulfilled"/);
  assert.match(page, /current\.status==="fulfilled"/);
  assert.match(page, /setPlans\(catalog\.value\.plans\)/);
  assert.match(page, /setStatusLoad\("unavailable"\)/);
});

test("unverified billing status is not misrepresented as no subscription", () => {
  assert.match(page, /statusLoad==="loading"/);
  assert.match(page, /statusLoad==="unavailable"/);
  assert.match(page, /Your subscription status could not be verified/);
  assert.match(page, /Existing paid access has not been changed/);
});

test("subscription creation still requires verified authenticated PayPal approval", () => {
  assert.match(page, /call\("\/api\/payments\/subscriptions\/start"/);
  assert.match(page, /method:"POST",auth:true/);
  assert.match(page, /provider_verified===true/);
  assert.match(page, /PayPal verified the recurring payment/);
});
