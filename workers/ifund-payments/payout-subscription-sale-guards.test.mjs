// Synthetic provider verification only. Never makes a PayPal call, payout,
// charge, ledger mutation or environment deployment.
// node --test workers/ifund-payments/payout-subscription-sale-guards.test.mjs
import test from "node:test";
import vm from "node:vm";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("./worker.js",import.meta.url),"utf8");
function body(name,next){
 const start=source.indexOf("async function "+name+"(");
 let end=source.indexOf("\nasync function "+next+"(",start+1);
 if(end<0)end=source.indexOf("\nfunction "+next+"(",start+1);
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
 assert.equal(result.status,"PENDING");
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

// The reconciled contract uses the immutable sale receipt directly. Subscription
// summary last_payment may describe another recurring sale and is never economic evidence.
const subscriptionId="I-ABCDEFGHIJKL",saleId="SALE1234567";
const saleEvent=()=>({event_type:"PAYMENT.SALE.COMPLETED",id:"WH-EVENT-1234567",resource:{id:saleId,billing_agreement_id:subscriptionId}});
const validSale=()=>({id:saleId,billing_agreement_id:subscriptionId,state:"completed",payee:{merchant_id:"MERCHANT12345"},amount:{currency:"USD",total:"3.00"},create_time:"2026-11-15T12:00:00Z"});
function webhookHarness(sale){
 const writes=[],requests=[];
 const context=vm.createContext({Response,Request,URL,TextEncoder,crypto:globalThis.crypto,btoa,atob});
 vm.runInContext(source.replace("export default {","globalThis.__worker = {"),context);
 context.__paypal=async(_env,path)=>{
  requests.push(path);
  if(path.includes("/sale/"))return sale;
  if(path.includes("/subscriptions/"))return {id:subscriptionId,plan_id:"P-PLAN123",custom_id:"owner:synthetic",status:"ACTIVE",status_update_time:"2026-11-15T12:00:00Z",billing_info:{last_payment:{amount:{currency_code:"USD",value:"99.00"},time:"2026-11-15T14:00:00Z"}}};
  throw Error("Unexpected provider path");
 };
 context.__ledger=async(_env,op,data)=>{
  if(op==="subscription_atomic_readiness")return {enabled:true,version:1,merchant_id:"MERCHANT12345"};
  if(op==="subscription_lookup")return {intent:{id:"intent-A",member_id:"member-A",paypal_plan_id:"P-PLAN123",custom_id:"owner:synthetic"}};
  assert.equal(op,"subscription_atomic_event");writes.push(data);return {ok:true,status:"active"};
 };
 vm.runInContext("paypal=__paypal;signLedger=__ledger;",context);
 const fn=vm.runInContext("subscriptionWebhook",context);
 return {writes,requests,run:payload=>fn(payload,{IFUND_SUBSCRIPTION_ATOMIC_ENABLED:"true",IFUND_PAYPAL_MODE:"live"})};
}
for(const [name,mutate] of [
 ["wrong sale ID",s=>({...s,id:"OTHER1234567"})],
 ["wrong subscription",s=>({...s,billing_agreement_id:"I-OTHERACCT123"})],
 ["incomplete sale",s=>({...s,state:"pending"})],
 ["wrong currency",s=>({...s,amount:{currency:"EUR",total:"3.00"}})],
 ["zero amount",s=>({...s,amount:{currency:"USD",total:"0.00"}})]
])test(name+" never enters atomic accounting",async()=>{
 const h=webhookHarness(mutate(validSale()));const response=await h.run(saleEvent()).catch(()=>null);
 if(response)assert.equal(response.status,409);assert.equal(h.writes.length,0);
});
test("verified sale uses its own amount and time even when last_payment describes a newer sale",async()=>{
 const h=webhookHarness(validSale());assert.equal((await h.run(saleEvent())).status,200);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].event.resource_id,saleId);
 assert.equal(h.writes[0].event.amount_cents,300);assert.equal(h.writes[0].event.occurred_at,new Date(validSale().create_time).toISOString());
});
test("unbound signed events and delivery IDs masquerading as sale IDs never reach provider or ledger",async()=>{
 for(const event of [{...saleEvent(),resource:{id:saleId}},{...saleEvent(),resource:{id:"WH-EVENT-1234567",billing_agreement_id:subscriptionId}}]){
  const h=webhookHarness(validSale());assert.equal((await h.run(event)).status,409);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
 }
});
