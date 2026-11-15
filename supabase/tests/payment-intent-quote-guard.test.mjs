// Pure offline regression for the actual signed-service begin quote guard.
// It does not sign requests, call payment providers, or create intents.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../functions/ifund-payment-ledger/index.ts", import.meta.url), "utf8");
const start = src.indexOf('if(body.op==="begin"){');
const guardStart = src.indexOf('if(!patternId.test(p.campaign_id', start);
const guardEnd = src.indexOf(') return fail("Invalid payment quote");', guardStart);
assert.ok(start >= 0 && guardStart > start && guardEnd > guardStart, "locate actual begin guard");
const guard = src.slice(guardStart + 3, guardEnd);
function rejects(p) {
  return vm.runInNewContext(`(${guard})`, { p, Number, Math,
    patternId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i });
}
function sample() {
  return { campaign_id:"12345678-1234-1234-1234-123456789abc",
    request_key:"synthetic_checkout_0001", payment_channel:"paypal",
    environment:"live", gift_cents:100, optional_support_cents:10,
    total_cents:110, checkout_token_hash:"a".repeat(64) };
}
test("synthetic: canonical signed checkout quote is accepted by real begin guard",()=>{
  assert.equal(rejects(sample()),false);
});
test("synthetic: any overcharge or undercharge fails the actual guard",()=>{
  for (const total of [0, 99, 100, 109, 111, 120, 1000000]) {
    assert.equal(rejects({...sample(),total_cents:total}),true,String(total));
  }
});
test("synthetic: quote rejects fractional, overflow and invalid support",()=>{
  for(const changes of [{gift_cents:99},{gift_cents:1.2},{gift_cents:100000001},
    {optional_support_cents:11},{optional_support_cents:-1},
    {optional_support_cents:1.1},{total_cents:NaN},
    {environment:"sandbox-other"},{checkout_token_hash:"bad"}]) {
    assert.equal(rejects({...sample(),...changes}),true,JSON.stringify(changes));
  }
});
