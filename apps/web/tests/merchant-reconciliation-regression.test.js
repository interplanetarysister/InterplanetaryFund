import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantReceiptExceptions} from '../src/lib/merchantReconciliation.mjs';
import {sumVerifiedCents} from '../src/lib/verifiedMoney.mjs';
const receipt={paypal_transaction_id:'PAYPAL-SANDBOX-001',gross_cents:1000,processing_fee_cents:50,net_cents:950,source_site:'interplanetaryfund.com',allocation_status:'platform_support'};
test('duplicate provider transaction IDs are flagged',()=>{
 const result=merchantReceiptExceptions([receipt,{...receipt}]);
 assert.equal(result.length,2);
 assert.ok(result.every(row=>row.issues.some(issue=>/duplicate/i.test(issue))));
});
test('independent balanced receipt is accepted',()=>assert.deepEqual(merchantReceiptExceptions([receipt]),[]));
test('incorrect net is flagged',()=>assert.equal(merchantReceiptExceptions([{...receipt,net_cents:949}]).length,1));
test('missing origin is flagged',()=>assert.equal(merchantReceiptExceptions([{...receipt,source_site:null}]).length,1));
test('unattributed support receipt is flagged',()=>assert.equal(merchantReceiptExceptions([{...receipt,allocation_status:'unattributed'}]).length,1));
test('missing amount cannot be treated as zero',()=>assert.equal(sumVerifiedCents([{raised_cents:null}],'raised_cents'),null));
test('integer-cent totals reconcile',()=>assert.equal(sumVerifiedCents([{raised_cents:333},{raised_cents:667}],'raised_cents'),1000));
test('missing provider ID is never treated as verified',()=>assert.match(merchantReceiptExceptions([{...receipt,paypal_transaction_id:''}])[0].issues.join(' '),/Missing PayPal transaction identifier/));
test('duplicate provider ID with different whitespace is detected',()=>{
 const exceptions=merchantReceiptExceptions([receipt,{...receipt,paypal_transaction_id:' PAYPAL-SANDBOX-001 '}]);
 assert.equal(exceptions.length,2);
 assert.ok(exceptions.every(x=>x.issues.some(i=>/Duplicate PayPal/.test(i))));
});
test('processing fee greater than gross is flagged',()=>assert.equal(merchantReceiptExceptions([{...receipt,processing_fee_cents:1001,net_cents:0}]).length,1));
test('unverified receipt origin is not silently accepted',()=>assert.match(merchantReceiptExceptions([{...receipt,source_site:'unattributed'}])[0].issues.join(' '),/Originating site/));
