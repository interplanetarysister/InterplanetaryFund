import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../base44/functions/listUntrackedPayPalReceipts/entry.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function scanner({ledgerFailed=false,role='admin',email='interplanetarysister@gmail.com'}={}) {
  const transactions=[
    {id:'DIRECT_DONATION',status:'S',transactionEventCode:'T0013',currency:'USD',amount:11,feeAmount:.5},
    {id:'CHECKOUT_CAP_01',status:'S',transactionEventCode:'T0006',currency:'USD',amount:12,feeAmount:.6,
     paypalReferenceIdType:'ODR',paypalReferenceId:'IFUNDORDER000001'},
    {id:'OTHER_01',status:'S',transactionEventCode:'T0007',currency:'USD',amount:22,feeAmount:.7},
    {id:'PENDING_01',status:'P',transactionEventCode:'T0013',currency:'USD',amount:44,feeAmount:.9},
  ];
  const mutationCount={value:0};
  const filter=async()=>ledgerFailed?Promise.reject(Error('Ledger unavailable')):[];
  const sr={entities:{
    FinancialOperation:{filter,create:async()=>{mutationCount.value++;}},
    Donation:{filter,create:async()=>{mutationCount.value++;}},
    HoldingLedgerEntry:{filter,create:async()=>{mutationCount.value++;}},
  }};
  const sdk={auth:{me:async()=>({id:'admin-id',role,email})},asServiceRole:sr};
  const exports={};
  new Function('require','exports','Response','console',js)(
    name=>{
      if(name.includes('base44/sdk'))return {createClientFromRequest:()=>sdk};
      if(name.endsWith('accountGuard.ts'))return {assertActiveAccount:async()=>({ok:true})};
      if(name.endsWith('paypal.ts'))return {IFUND_PAYPAL_ACCOUNT_REF:'ifund-business',listTransactions:async()=>transactions};
      throw Error('Unexpected import '+name);
    },exports,Response,{error:()=>{}},
  );
  return {fn:exports.default,mutationCount};
}
const req={json:async()=>({lookback_days:30})};
{
  const {fn,mutationCount}=scanner();
  const res=await fn(req);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.ok,true);
  assert.equal(data.checked_transactions,4);
  assert.equal(data.receipts.length,2);
  assert.equal(data.untracked_count,2);
  assert.equal(data.other_settled_payment_count,1);
  assert.equal(data.other_payments.length,1);
  assert.equal(data.other_payments[0].transaction_id,'OTHER_01');
  assert.equal(data.other_payments[0].assignable_to_campaign,false);
  const direct=data.receipts.find(r=>r.transaction_id==='DIRECT_DONATION');
  assert.equal(direct.recovery_method,'donation_receipt');
  const checkout=data.receipts.find(r=>r.transaction_id==='CHECKOUT_CAP_01');
  assert.equal(checkout.recovery_method,'ifund_checkout_order');
  assert.equal(checkout.paypal_order_id,'IFUNDORDER000001');
  assert.equal(checkout.tracked,false);
  assert.equal(mutationCount.value,0);
}
{
 const {fn}=scanner({ledgerFailed:true});
 const res=await fn(req);
 assert.equal(res.status,500,'Missing local ledger is an error, not an empty clean result');
}
{
 const {fn}=scanner({role:'user'});
 const res=await fn(req);
 assert.equal(res.status,403);
}
console.log('PASS: settled PayPal donations and ODR-linked checkout receipts classified; unrelated transactions cannot be auto-credited; failed scans error.');
