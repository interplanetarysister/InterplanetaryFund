import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../../../supabase/functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
test("signed Edge ledger enforces verified database merchant readiness with optional emergency off",()=>{
 assert.match(source,/verifiedBody\(req\)/);
 assert.match(source,/crypto\.subtle\.verify/);
 assert.match(source,/rpc\/ifund_subscription_atomic_readiness/);
 assert.match(source,/IFUND_SUBSCRIPTION_ATOMIC_ENABLED"\)==="false"/);
 assert.doesNotMatch(source,/IFUND_SUBSCRIPTION_ATOMIC_ENABLED"\)!=="true"/);
 assert.match(source,/ready\?\.enabled!==true\|\|ready\?\.version!==1/);
});
test("atomic event handler has no fallback and legacy financial review remains preserved",()=>{
 assert.match(source,/body\.op==="subscription_atomic_event"/);
 assert.match(source,/rpc\/ifund_apply_verified_subscription_event/);
 assert.match(source,/Non-atomic subscription accounting is retired/);
 assert.match(source,/body\.op==="financial_review_intake"/);
 assert.match(source,/rpc\/ifund_intake_signed_financial_incident/);
 assert.match(source,/body\.op==="subscription_plan_readiness"/);
 assert.match(source,/body\.op==="subscription_begin"/);
 assert.match(source,/body\.op==="subscription_bind"/);
});
