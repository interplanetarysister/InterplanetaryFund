import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IFUND_MERCHANT_EMAIL, IFUND_BASIC_MONTHLY_PLAN_CANDIDATE, IFUND_CATALOG,
  subscriptionQuote, verifySubscriptionPlan, paypalUrl, requireMerchant,
  checkOwnerBasicPlan, giftQuote, donationOrder, verifyCampaignCapture,
  subscriptionOrder, withdrawalMath, reservedPayout, auctionPayoutMath
} from '../worker/paypalBusiness.js';
const merchant='cuddlemeplatonically@gmail.com';
const id='123e4567-e89b-12d3-a456-426614174000';
const quote=()=>giftQuote(2500,true,0.0349,49);
const plan={id:IFUND_BASIC_MONTHLY_PLAN_CANDIDATE,product_id:'PROD-VALID12',
  status:'ACTIVE',billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},
    total_cycles:0,pricing_scheme:{fixed_price:{currency_code:'USD',value:'12.00'}}}]};
test('merchant is explicitly fixed and sandbox requires credentials',()=>{
  assert.equal(IFUND_MERCHANT_EMAIL,merchant);
  assert.throws(()=>requireMerchant({PAYPAL_MERCHANT_EMAIL:'someone@example.com'}));
  assert.doesNotThrow(()=>requireMerchant({PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'id',
    PAYPAL_CLIENT_SECRET:'secret',PAYPAL_MERCHANT_EMAIL:merchant}));
  assert.throws(()=>paypalUrl('test'));
});
test('all source subscription tiers and cents are carried without silent changes',()=>{
  assert.deepEqual(Object.keys(IFUND_CATALOG),['basic','outreach','professional','enterprise','nonprofit']);
  assert.equal(subscriptionQuote('basic','monthly').cents,1200);
  assert.equal(subscriptionQuote('enterprise','annual').cents,191000);
  assert.equal(subscriptionQuote('invalid','monthly'),null);
});
test('candidate monthly plan must pass exact PayPal price check',()=>{
  assert.equal(verifySubscriptionPlan(plan,subscriptionQuote('basic','monthly')),true);
  assert.equal(verifySubscriptionPlan({...plan,status:'INACTIVE'},subscriptionQuote('basic','monthly')),false);
  assert.equal(verifySubscriptionPlan(plan,subscriptionQuote('basic','annual')),false);
  assert.equal(verifySubscriptionPlan({...plan,billing_cycles:[]},subscriptionQuote('basic','monthly')),false);
});
test('verification uses PayPal REST authentication and reads existing plan, no plan creation',async()=>{
  const calls=[];
  const fetcher=async(url,opts)=>{calls.push([url,opts]);return {ok:true,json:async()=>
    calls.length===1?{access_token:'sandbox-token'}:plan}};
  const res=await checkOwnerBasicPlan({PAYPAL_MODE:'sandbox',PAYPAL_CLIENT_ID:'app',
    PAYPAL_CLIENT_SECRET:'secret',PAYPAL_MERCHANT_EMAIL:merchant},fetcher);
  assert.equal(res.amount_cents,1200);
  assert.equal(calls.length,2);
  assert.match(calls[1][0],/\/v1\/billing\/plans\/P-/);
  assert.equal(calls[1][1].method,'GET');
});
test('donor full gift is preserved; optional 10% added and 3% withheld only at withdrawal',()=>{
  const q=quote();
  assert.equal(q.giftCents,2500);
  assert.equal(q.supportCents,250);
  assert.equal(q.withdrawalFeeCents,75);
  assert.equal(q.allocatedCents,2750);
  assert.equal(q.totalCents,q.allocatedCents+q.processorEstimateCents);
  assert.equal(giftQuote(2500,false,0.0349,49).supportCents,0);
  assert.deepEqual(withdrawalMath(2500),{giftCents:2500,feeCents:75,netCents:2425});
});
test('campaign order identifies PayPal merchant and immutable allocation',()=>{
  const q=quote();
  const order=donationOrder({campaignId:id,title:'Clean beach',intentId:'intent_00000000001',quote:q});
  assert.equal(order.purchase_units[0].payee.email_address,merchant);
  assert.match(order.purchase_units[0].custom_id,/gift_first_v2$/);
  assert.equal(order.purchase_units[0].amount.value,(q.totalCents/100).toFixed(2));
  assert.throws(()=>donationOrder({campaignId:'bad',title:'Fake',intentId:'intent_00000000001',quote:q}));
});
test('capture verification requires completed, correct merchant and exact amount',()=>{
  const q=quote();
  const customId=donationOrder({campaignId:id,title:'C',intentId:'intent_00000000001',quote:q})
    .purchase_units[0].custom_id;
  const order={id:'ORDER1',status:'COMPLETED',purchase_units:[{
    custom_id:customId,payee:{merchant_id:'MERCHANT123'},
    payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',
      amount:{currency_code:'USD',value:(q.totalCents/100).toFixed(2)}}]}
  }]};
  assert.equal(verifyCampaignCapture(order,customId,q.totalCents,'MERCHANT123').capture_id,'CAPTURE123');
  assert.throws(()=>verifyCampaignCapture(order,customId,q.totalCents,undefined));
  assert.throws(()=>verifyCampaignCapture(order,customId,q.totalCents,'OTHER'));
  assert.throws(()=>verifyCampaignCapture(order,customId,q.totalCents+1,'MERCHANT123'));
});
test('subscription request carries no arbitrary redirect and requires intent',()=>{
  const x=subscriptionOrder(IFUND_BASIC_MONTHLY_PLAN_CANDIDATE,'IFUND-ABCDEFGH12345678');
  assert.match(x.application_context.return_url,/^https:\/\/interplanetaryfund\.com/);
  assert.throws(()=>subscriptionOrder(IFUND_BASIC_MONTHLY_PLAN_CANDIDATE,'guess'));
});
test('withdrawal preparation is blocked without payout authorization',()=>{
  const x={email:'verified@example.com',reservationId:'reserved_0123456789',giftCents:2500,payoutsApproved:true};
  assert.throws(()=>reservedPayout({...x,payoutsApproved:false}));
  const p=reservedPayout(x);
  assert.equal(p.items[0].amount.value,'24.25');
  assert.equal(p.platform_fee_cents,75);
  assert.equal(p.sender_batch_header.sender_batch_id,'IFUND_W_reserved_0123456789');
});

test('auction fee is its own 10% hosting class and not the 3% campaign fee',()=>{
  assert.deepEqual(auctionPayoutMath(10000),{
    saleProceedsCents:10000,hostingFeeCents:1000,netCents:9000,currency:'USD'
  });
  assert.notEqual(auctionPayoutMath(10000).hostingFeeCents,withdrawalMath(10000).feeCents);
});
