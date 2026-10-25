import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function moduleFrom(path, stubs) {
  const src=fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  new Function('require','exports','Response','console',js)(
    name => {
      for(const [key,value] of Object.entries(stubs))if(name.includes(key))return value;
      throw Error('Unsupported unit-test dependency '+name);
    },
    exports,Response,{error(){},warn(){}},
  );
  return exports.default;
}

const order='PAYPAL_ORDER_12345';
const capture='CAPTURE_12345678';
const campaignId='campaign123';
const completed={
  status:'COMPLETED',capture_status:'COMPLETED',capture_id:capture,
  currency:'USD',amount:10,
  custom_id:`${campaignId}|940|60|0|paypal`,
};
const settled={
  id:capture,status:'S',currency:'USD',amount:10,transactionEventCode:'T0006',
  paypalReferenceIdType:'ODR',paypalReferenceId:order,
};
const body=(payload)=>({json:async()=>payload,headers:{get:()=>null}});
const payload={reconcile_only:true,order_id:order,campaign_id:campaignId,paypal_transaction_id:capture};
function captureHandler({role='admin',email='interplanetarysister@gmail.com',actual=completed,receipt=settled}={}) {
  const calls={captured:0,orders:0,receipts:0,canonical:0};
  const base44={
    auth:{me:async()=>({id:'admin-user',email,role})},
    asServiceRole:{entities:{Campaign:{get:async()=>({id:campaignId,created_by_id:'campaign-owner',status:'active',title:'Test'})},FinancialOperation:{filter:async()=>[]}}},
  };
  const handler=moduleFrom('base44/functions/capturePayPalOrder/entry.ts',{
    'npm:@base44/sdk':{createClientFromRequest:()=>base44},
    'base44:runtime':{secrets:{get:(key)=>key==='PAYPAL_MODE'?'live':null}},
    'shared/paypal.ts':{
      captureOrder:async()=>{calls.captured++;throw Error('Should never capture during recovery')},
      getOrder:async()=>{calls.orders++;return actual;},
      getTransaction:async()=>{calls.receipts++;return receipt;},
      IFUND_PAYPAL_ACCOUNT_REF:'ifund',
    },
    'shared/rateLimit.ts':{checkRateLimit:async()=>({allowed:true})},
    'shared/auditLog.ts':{logAudit:async()=>{}},
    'shared/fees.js':{round2:num=>Math.round((Number(num)+Number.EPSILON)*100)/100},
    'shared/paypalAllocation.js':{resolvePayPalCaptureAllocation:()=>({ok:true,amount:9.4,processingFee:.6,platformContribution:0})},
    'shared/accountGuard.ts':{assertActiveAccountIfSignedIn:async()=>({ok:true,donor:null})},
    'shared/base44Financial.ts':{
      ensureCanonicalCampaign:async()=>{calls.canonical++;throw Error('canonical-ledger-boundary');},
      recordCanonicalDonation:async()=>{calls.canonical++;throw Error('canonical-write-boundary')},
    },
    'shared/financialMirrors.ts':{reconcileDonationMirror:async()=>{},reconcileNotificationMirror:async()=>{}},
    'shared/sendDonationReceipt.ts':{sendDonationReceipt:async()=>{}},
  });
  return {handler,calls};
}
{
 const {handler,calls}=captureHandler({role:'user'});
 const res=await handler(body(payload));
 assert.equal(res.status,403);
 assert.equal(calls.captured,0);assert.equal(calls.orders,0);
}
{
 const {handler,calls}=captureHandler({email:'other@example.com'});
 const res=await handler(body(payload));
 assert.equal(res.status,403);assert.equal(calls.orders,0);
}
{
 const {handler,calls}=captureHandler();
 const res=await handler(body({...payload,paypal_transaction_id:'wrong_capture'}));
 assert.equal(res.status,409);
 assert.equal(calls.captured,0);
 assert.equal(calls.orders,1);
 assert.equal(calls.receipts,0);
}
{
 const {handler,calls}=captureHandler({receipt:{...settled,status:'P'}});
 const res=await handler(body(payload));
 assert.equal(res.status,409);assert.equal(calls.captured,0);
}
{
 const {handler,calls}=captureHandler({actual:{...completed,custom_id:'different_campaign|940|60|0|paypal'}});
 const res=await handler(body(payload));
 assert.equal(res.status,409);assert.equal(calls.captured,0);
}
{
 const {handler,calls}=captureHandler();
 const res=await handler(body(payload));
 assert.equal(res.status,503,'The financial-boundary stub intentionally rejects at the canonical write');
 assert.equal(calls.captured,0,'Read-only receipt recovery must never POST a new PayPal capture');
 assert.equal(calls.orders,1);assert.equal(calls.receipts,1);
 assert.equal(calls.canonical,1,'Only verified completed order and settled receipt reach canonical ledger logic');
}
console.log('PASS: Admin-only PayPal read-only recovery, receipt/order matching, immutable campaign evidence, no second capture.');
