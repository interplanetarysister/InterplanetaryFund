import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
const isolated=source.replace("export default {","globalThis.worker = {");
function handler(env={}){
  const context=vm.createContext({URL,Response,Request,fetch:async()=>{throw Error("Provider should not be contacted");}});
  vm.runInContext(isolated,context);
  return {call:(path,method="GET")=>context.worker.fetch(new Request("https://interplanetaryfund.com"+path,{method}),env)};
}
test("Card checkout never creates a charge while atomic accounting is unaccepted",async()=>{
  const {call}=handler({IFUND_CARD_SUBSCRIPTIONS_ENABLED:"true",IFUND_CARD_LEDGER_ACCEPTED:"true"});
  const result=await call("/api/payments/card-subscriptions/start","POST");
  assert.equal(result.status,503);
  assert.equal((await result.json()).error,"card_subscription_atomic_accounting_not_accepted");
});
test("Webhook is never acknowledged before independent receipt verifier exists",async()=>{
  const {call}=handler();
  const result=await call("/api/payments/card-subscriptions/webhook","POST");
  assert.equal(result.status,503);
});
test("No provider readiness when absent secrets, price or accepted accounting",async()=>{
  const {call}=handler({IFUND_CARD_MODE:"test",IFUND_CARD_SUBSCRIPTIONS_ENABLED:"true"});
  const result=await call("/api/payments/card-subscriptions/readiness");
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.ready,false);
  assert.equal(body.amount_cents,499);
  assert.equal(body.currency,"USD");
  assert.equal(body.interval,"monthly");
  assert.equal(body.provider,"stripe");
});
test("No PAN/CVV capture and no checkout URL is emitted",()=>{
  assert.doesNotMatch(source,/card_number\s*:/);
  assert.doesNotMatch(source,/card_cvc\s*:/);
  assert.doesNotMatch(source,/checkout_url\s*:/);
});
