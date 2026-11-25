import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const chooser=readFileSync(new URL("../src/components/subscriptions/PremiumBillingChoices.jsx",import.meta.url),"utf8");
const once=readFileSync(new URL("../src/components/subscriptions/PremiumOneTimeCheckout.jsx",import.meta.url),"utf8");
const edge=readFileSync(new URL("../../../supabase/functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
const worker=readFileSync(new URL("../../../workers/ifund-payments/worker.js",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261123000005_premium_owner_only_checkout_acceptance.sql",import.meta.url),"utf8");
const allowlist=readFileSync(new URL("../../../supabase/migrations/20261123000006_premium_private_trial_allowlist.sql",import.meta.url),"utf8");

test("Direct guest card option is prominent and defaults to one-time, not recurring",()=>{
  assert.match(chooser,/initialBillingChoice\("card"\)/);
  assert.ok(chooser.indexOf('id:"card"')<chooser.indexOf('id:"paypal"'));
  assert.match(chooser,/no PayPal account needed/);
  assert.match(once,/Pay by card · \$4\.99 USD once/);
  assert.match(once,/Pay \$4\.99 now — one month, no renewal/);
});
test("One-time readiness requires a verified signed-in member before hosted fields load",()=>{
  assert.match(once,/memberToken\(\)\.then\(token=>api\(API\+"\/readiness"/);
  assert.match(once,/authorization:"Bearer "\+token/);
  assert.match(once,/if\(!ready\)return/);
  assert.match(once,/card\.isEligible\(\)/);
  // Single-sheet checkout: the PayPal wallet renders alongside the card form
  // instead of behind a method tab, so there is no method-gated render.
  assert.match(once,/paypal\.Buttons\(\{/);
  assert.doesNotMatch(once,/if\(method==="paypal"\)/);
  assert.doesNotMatch(once,/if\(method==="googlepay"\)return/);
  assert.match(once,/if\(!ready\)return <div/);
  assert.match(once,/disabled aria-disabled="true"/);
  assert.match(once,/if\(activeSubscription\)return <div/);
  assert.match(once,/!cardReady\|\|busy/);
});
test("First live checkout requires verified super admin and atomic service role gate",()=>{
  assert.match(worker,/IFUND_PREMIUM_ONE_TIME_TEST_ONLY==="true"/);
  assert.match(worker,/premium_one_time_test_eligible/);
  assert.match(worker,/premium_one_time_merchant_not_ready/);
  assert.match(edge,/resolveVerifiedSuperAdmin\(p\.member_access_token\)/);
  assert.match(sql,/raw_app_meta_data->>'role'='super_admin'/);
  assert.match(sql,/premium_one_time_test_eligible\(p_member_id\)/);
  assert.match(sql,/revoke all on function public\.ifund_premium_one_time_test_eligible/);
  assert.doesNotMatch(sql,/grant execute.*to authenticated/);
  assert.match(allowlist,/premium_checkout_trial_members/);
  assert.match(allowlist,/grant select on ifund_subscription_runtime\.premium_checkout_trial_members to service_role/);
  assert.match(allowlist,/enable row level security/);
  assert.doesNotMatch(allowlist,/grant select on auth\.users/);
});
