import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const plans = readFileSync(new URL("../src/pages/PublicSubscriptionPlans.jsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/components/Layout.jsx", import.meta.url), "utf8");
test("public plans route does not require account access", () => {
  assert.match(app, /path="\/plans" element=\{<PublicSubscriptionPlans \/>\}/);
  assert.match(app, /path="\/subscriptions" element=\{<MemberAccess><Subscriptions \/><\/MemberAccess>\}/);
  assert.match(layout, /to: "\/plans", label: "Plans"/);
  assert.match(app, /lazy\(\(\) => import\("\.\/pages\/PublicSubscriptionPlans"\)\)/);
});
test("read-only public catalog never grants billing access", () => {
  assert.match(plans, /GET|fetch\("\/api\/payments\/subscriptions\/plans"/);
  assert.doesNotMatch(plans, /\/subscriptions\/start|subscriptions\/confirm|\/subscriptions\/cancel/);
  assert.match(plans, /plan\.available === true && plan\.verified === true/);
  assert.match(plans, /Enrollment unavailable — provider verification pending/);
  assert.match(plans, /\.verified === true/);
});
test("public plans support retry and route members through sign-in", () => {
  assert.match(plans, /signal: controller\.signal/);
  assert.match(plans, /controller\.abort\(\)/);
  assert.match(plans, /setRetry\(n => n \+ 1\)/);
  assert.match(plans, /\/login\?returnTo=/);
  assert.match(plans, /\/register\?returnTo=/);
});
