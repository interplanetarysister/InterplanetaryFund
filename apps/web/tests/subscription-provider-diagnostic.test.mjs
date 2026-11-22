import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const code=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");
test("owner plan can be independently verified without allowing enrollment",()=>{
  assert.match(code,/\/api\/payments\/subscriptions\/provider-readiness/);
  assert.match(code,/paypal\(env,"\/v1\/billing\/plans\/"/);
  assert.match(code,/paypal\(env,"\/v1\/notifications\/webhooks\/"/);
  assert.match(code,/exactBasicPlan\(plan\)/);
  assert.match(code,/SUBSCRIPTION_EVENTS/);
  assert.match(code,/atomic\.ready===true/);
  assert.match(code,/purchase_ready:exactBasicPlan\(plan\)&&webhookReady&&atomic\.ready===true/);
  assert.match(code,/IFUND_SUBSCRIPTION_ATOMIC_ENABLED/);
});
test("readiness route returns no merchant identity, secrets or subscription IDs",()=>{
  const from=code.indexOf('if(path==="/api/payments/subscriptions/provider-readiness"');
  const until=code.indexOf('if(path==="/api/payments/subscriptions/plans"',from);
  const route=code.slice(from,until);
  assert.ok(from>0 && until>from);
  assert.doesNotMatch(route,/signLedger|subscription_begin|subscription_bind|subscriptionAtomicEvent/);
  assert.doesNotMatch(route,/PAYPAL_CLIENT_SECRET/);
  assert.doesNotMatch(route,/merchant_id|access_token|subscription_id/);
  assert.match(route,/subscription_provider_readiness_unavailable/);
});
