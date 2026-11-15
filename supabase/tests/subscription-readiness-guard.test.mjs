// Synthetic source-contract regression; no provider requests or database writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src=readFileSync(new URL("../functions/ifund-payment-ledger/index.ts",import.meta.url),"utf8");
const start=src.indexOf('if(!["basic","outreach"');
const end=src.indexOf('return fail("Invalid subscription provider readiness")',start);
assert.ok(start>=0 && end>start,"locate real subscription readiness guard");
const expr=src.slice(start+3,end).trim().replace(/\)\s*$/,"");
function rejected(p) {
  return vm.runInNewContext("(" + expr + ")",{
    p,Number,planId:/^P-[A-Za-z0-9_-]{10,}$/
  });
}
const sample=()=>({tier:"basic",interval:"monthly",paypal_plan_id:"P-123456789012345678901234",
  paypal_product_id:"PROD-12345",amount_cents:100,plan_ready:true,webhook_ready:true,
  paypal_webhook_id:"WH-12345678"});
test("synthetic verified subscription plan requires a webhook ID",()=>{
  assert.equal(rejected(sample()),false);
  for(const id of [null,undefined,"","WH-1",1234])
    assert.equal(rejected({...sample(),paypal_webhook_id:id}),true,String(id));
});
test("synthetic incomplete readiness remains inactive and accepts absent webhook ID",()=>{
  assert.equal(rejected({...sample(),webhook_ready:false,paypal_webhook_id:null}),false);
  assert.equal(rejected({...sample(),plan_ready:false,webhook_ready:false,paypal_webhook_id:null}),false);
});
test("synthetic malformed amount and readiness types are rejected",()=>{
  for(const delta of [{amount_cents:0},{amount_cents:1.5},{webhook_ready:"true"},{plan_ready:1}])
    assert.equal(rejected({...sample(),...delta}),true,JSON.stringify(delta));
});
