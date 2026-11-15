// Offline, synthetic regression of subscription capture replay identity.
// No provider requests, payments, SQL writes, or production effects.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("../functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
const section=source.split('if(body.op==="subscription_reconcile"){')[1]?.split('if(body.op==="subscription_event"){')[0];
assert.ok(section,"current subscription reconcile source present");
const match=section.match(/}else if\((existing\.intent_id[\s\S]*?existing\.provider_reference!==p\.provider_reference\.trim\(\))\)\{/);
assert.ok(match,"actual source replay guard must normalize provider resource identity");
function conflict(existing,p,row,paymentAt) {
  return vm.runInNewContext(`(${match[1]})`,{existing,p,row,paymentAt});
}
const row={id:"intent-1",member_id:"member-1",paypal_subscription_id:"I-AAAAAAAAAA",amount_cents:1299};
const paymentAt=new Date("2026-11-15T12:00:00.000Z");
const existing={intent_id:row.id,member_id:row.member_id,paypal_subscription_id:row.paypal_subscription_id,
  entry_type:"payment",amount_cents:row.amount_cents,currency:"USD",environment:"live",
  provider_occurred_at:paymentAt.toISOString(),provider_reference:"CAPTURE-123"};
test("same canonical capture ID replay is idempotent even with padded input",()=>{
  assert.equal(conflict(existing,{provider_reference:" CAPTURE-123 "},row,paymentAt),false);
});
test("different capture identity or member/amount/time/environment must conflict",()=>{
  assert.equal(conflict(existing,{provider_reference:"CAPTURE-999"},row,paymentAt),true);
  for(const changes of [{member_id:"other"},{amount_cents:999},{environment:"sandbox"},
    {provider_occurred_at:"2026-11-15T13:00:00.000Z"},{entry_type:"refund"}]){
    assert.equal(conflict({...existing,...changes},{provider_reference:"CAPTURE-123"},row,paymentAt),true);
  }
});
