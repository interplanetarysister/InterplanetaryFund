import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canStartVerifiedSubscription, verifiedSubscriptionPrice } from "../src/lib/subscriptionEnrollment.mjs";

const plan={tier:"basic",interval:"monthly",amount_cents:1200,currency:"USD",verified:true,available:true};
const options={plan,status:null,statusLoad:"ready",busy:"",native:false};
test("checkout can start only when verified plan and account status are ready",()=>{
  assert.equal(canStartVerifiedSubscription(options),true);
  for(const statusLoad of ["loading","unavailable",null,undefined]){
    assert.equal(canStartVerifiedSubscription({...options,statusLoad}),false,String(statusLoad));
  }
  for(const status of ["active","pending","past_due","approval_pending"]){
    assert.equal(canStartVerifiedSubscription({...options,status:{status}}),false,status);
  }
  assert.equal(canStartVerifiedSubscription({...options,native:true}),false);
  assert.equal(canStartVerifiedSubscription({...options,busy:"confirm"}),false);
  assert.equal(canStartVerifiedSubscription({...options,plan:{...plan,verified:false}}),false);
  assert.equal(canStartVerifiedSubscription({...options,plan:{...plan,available:false}}),false);
  assert.equal(canStartVerifiedSubscription({...options,plan:{...plan,currency:"EUR"}}),false);
  for(const amount_cents of [-1,0,NaN,1200.5,"1200",Infinity]){
    assert.equal(canStartVerifiedSubscription({...options,plan:{...plan,amount_cents}}),false,String(amount_cents));
  }
});
test("subscription price never trusts malformed provider amounts",()=>{
  assert.equal(verifiedSubscriptionPrice(plan),"$12.00");
  assert.equal(verifiedSubscriptionPrice({...plan,amount_cents:"1200"}),"Pricing unavailable");
  assert.equal(verifiedSubscriptionPrice({...plan,currency:"EUR"}),"Pricing unavailable");
});
test("subscription UI fails closed and supports explicit verified-status retry",()=>{
  const source=readFileSync(new URL("../src/pages/Subscriptions.jsx",import.meta.url),"utf8");
  assert.match(source,/const canBegin=canStartVerifiedSubscription\(\{plan,status,statusLoad,busy,native\}\)/);
  assert.match(source,/disabled=\{!canBegin\}/);
  assert.match(source,/Retry subscription verification/);
  assert.match(source,/Checkout is paused until account status is confirmed/);
  assert.match(source,/const available=plan\.available===true&&plan\.verified===true/);
  assert.doesNotMatch(source,/\$\{\(plan\.amount_cents\/100\)\.toLocaleString\(\)\}/);
});
