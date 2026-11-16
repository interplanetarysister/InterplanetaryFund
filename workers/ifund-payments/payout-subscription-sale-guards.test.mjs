// Synthetic provider verification only. Never makes a PayPal call, payout,
// charge, ledger mutation or environment deployment.
// node --test workers/ifund-payments/payout-subscription-sale-guards.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
function body(name,next){
 const start=source.indexOf("async function "+name+"(");
 const end=source.indexOf("\nasync function "+next+"(",start+1);
 assert.ok(start>=0&&end>start,"Expected current Worker source for "+name);
 return source.slice(start,end);
}
const payoutFactory=new Function(
 "asError","asJson","memberToken","readBody","UUID","payoutReadiness","signLedger",
 "reconcilePayoutBatch","paypalDetailed","payoutBatchIdFromLinks","usd","ORDER_ID",
 body("executePayout","subscriptionReadiness")+"; return executePayout;"
);
const withdrawal="11111111-1111-4111-8111-111111111111";
function payoutHarness(state,batchId=null){
 let providerPosts=0,ledgerWrites=0,reconciles=0;
 const payout={withdrawal_id:withdrawal,current_status:state,payout_batch_id:batchId};
 const handler=payoutFactory(
   (code,status=400)=>({error:code,status}),
   value=>({status:200,...value}),
   ()=> "verified-admin.jwt",
   async()=>({withdrawal_id:withdrawal}),
   /^[0-9a-f]{8}-[0-9a-f-]{27}$/i,
   async()=>({ready:true}),
   async(_env,kind)=>{ledgerWrites++;assert.equal(kind,"payout_prepare");return {payout}},
   async()=>{reconciles++;return {ok:true,status:"PENDING"}},
   async()=>{providerPosts++;throw Error("Provider payout POST must not run")},
   ()=>null,
   amount=>(amount/100).toFixed(2),
   /^[A-Za-z0-9_-]{8,100}$/
 );
 return {handler,stats:()=>({providerPosts,ledgerWrites,reconciles})};
}
test("provider-unknown payout never sends a second provider POST",async()=>{
 const h=payoutHarness("provider_status_unknown");
 const res=await h.handler(null,{
   IFUND_PAYOUT_EXECUTION_ENABLED:"true",IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live"
 });
 assert.equal(res.status,409);
 assert.equal(res.error,"payout_status_unknown_manual_provider_reconciliation_required");
 assert.equal(h.stats().providerPosts,0);
 assert.equal(h.stats().ledgerWrites,1);
});
test("provider-unknown payout with independently identified batch reconciles without resubmission",async()=>{
 const h=payoutHarness("provider_status_unknown","BATCH12345678");
 const result=await h.handler(null,{
   IFUND_PAYOUT_EXECUTION_ENABLED:"true",IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live"
 });
 assert.equal(result.status,200);
 assert.equal(h.stats().providerPosts,0);
 assert.equal(h.stats().reconciles,1);
});
test("disabled payout execution never prepares or sends provider payouts",async()=>{
 const h=payoutHarness("queued");
 const result=await h.handler(null,{
   IFUND_PAYOUT_EXECUTION_ENABLED:"false",IFUND_PAYMENTS_ENABLED:"true",IFUND_PAYPAL_MODE:"live"
 });
 assert.equal(result.status,503);
 assert.equal(h.stats().ledgerWrites,0);
 assert.equal(h.stats().providerPosts,0);
});

const webhookFactory=new Function(
 "paypal","signLedger","reconcileSubscription","asError","asJson","cents",
 "SUBSCRIPTION_ID","PAYPAL_EVENT_ID","ORDER_ID",
 body("subscriptionWebhook","captureFromOrder")+"; return subscriptionWebhook;"
);
const subscriptionId="I-ABCDEFGHIJKL";
const saleId="SALE1234567";
const saleEvent=()=>({
 event_type:"PAYMENT.SALE.COMPLETED",id:"WH-EVENT-1234567",
 resource:{id:saleId,billing_agreement_id:subscriptionId}
});
const validSale=()=>({
 id:saleId,billing_agreement_id:subscriptionId,state:"completed",
 amount:{currency:"USD",total:"3.00"},create_time:"2026-11-15T12:00:00Z"
});
function webhookHarness(sale){
 let ledgerWrites=0,reconciliations=0,requests=0;
 const handler=webhookFactory(
   async()=>{requests++;return sale},
   async()=>{ledgerWrites++;return {}},
   async()=>{reconciliations++;return {status:"ACTIVE"}},
   (code,status=400)=>({status,error:code}),
   data=>({status:200,...data}),
   value=>Math.round(Number(value)*100),
   /^I-[A-Z0-9]{10,30}$/,
   /^WH-[A-Z0-9-]{8,90}$/,
   /^[A-Za-z0-9_-]{8,100}$/
 );
 return {handler,stats:()=>({ledgerWrites,reconciliations,requests})};
}
for(const [name,mutate] of [
 ["sale resource ID mismatches event",s=>({...s,id:"OTHER1234567"})],
 ["sale belongs to another subscription",s=>({...s,billing_agreement_id:"I-OTHERACCT123"})],
 ["sale is not completed",s=>({...s,state:"pending"})],
 ["sale currency is wrong",s=>({...s,amount:{currency:"EUR",total:"3.00"}})],
 ["sale amount is zero",s=>({...s,amount:{currency:"USD",total:"0.00"}})],
]){
 test(name+" and cannot enter the ledger",async()=>{
   const h=webhookHarness(mutate(validSale()));
   const res=await h.handler(saleEvent(),{});
   assert.equal(res.status,409);
   assert.equal(h.stats().reconciliations,0);
   assert.equal(h.stats().ledgerWrites,0);
 });
}
test("provider-verified sale may reach reconciliation, never based only on delivery ID",async()=>{
 const h=webhookHarness(validSale());
 const res=await h.handler(saleEvent(),{});
 assert.equal(res.status,200);
 assert.equal(h.stats().reconciliations,1);
 assert.equal(h.stats().ledgerWrites,1);
});
test("webhook delivery ID cannot masquerade as a sale ID",async()=>{
 const h=webhookHarness(validSale());
 const event=saleEvent();event.resource.id=event.id;
 const res=await h.handler(event,{});
 assert.equal(res.status,409);
 assert.equal(h.stats().requests,0);
 assert.equal(h.stats().ledgerWrites,0);
});

const reconcileFactory=new Function(
 "signLedger","paypal","cents",
 body("reconcileSubscription","subscriptionWebhook")+"; return reconcileSubscription;"
);
function subscriptionHarness({sale=validSale(),lastPayment="2026-11-15T12:00:00Z",lastAmount="3.00"}={}){
 let posted=0;
 const handler=reconcileFactory(
  async(_env,kind)=>{
    if(kind==="subscription_lookup")return {intent:{
      paypal_plan_id:"P-PLAN123",custom_id:"owner:synthetic",tier:"premium",interval:"month"
    }};
    assert.equal(kind,"subscription_reconcile");posted++;return {status:"active"};
  },
  async()=>({
    id:subscriptionId,plan_id:"P-PLAN123",custom_id:"owner:synthetic",
    status:"ACTIVE",billing_info:{last_payment:{
      amount:{currency_code:"USD",value:lastAmount},time:lastPayment
    }}
  }),
  value=>Math.round(Number(value)*100)
 );
 return {handler,posted:()=>posted,sale};
}
for(const [name,details] of [
 ["current amount differs from verified sale",{lastAmount:"4.00"}],
 ["current payment occurred much later than verified sale",{lastPayment:"2026-11-15T12:12:00Z"}],
 ["missing payment timestamp",{lastPayment:null}],
 ["sale was not completed",{sale:{...validSale(),state:"pending"}}]
]){
 test(name+" blocks subscription economic receipt",async()=>{
   const h=subscriptionHarness(details);
   await assert.rejects(h.handler({},subscriptionId,"",saleId,h.sale),/subscription_sale_last_payment_unverified/);
   assert.equal(h.posted(),0);
 });
}
test("matching provider sale and current billing timestamp may reach ledger",async()=>{
 const h=subscriptionHarness();
 const result=await h.handler({},subscriptionId,"",saleId,h.sale);
 assert.equal(result.status,"active");
 assert.equal(h.posted(),1);
});
