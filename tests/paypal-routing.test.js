import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCampaignAllocation,classifyPayPalNotification,paypalReadiness} from '../worker/paypalRouting.js';
const cid='123e4567-e89b-12d3-a456-426614174000';
test('only full tagged server-generated campaign allocations can be decoded',()=>{
  const id=cid+'|2750|149|250|paypal|gift_first_v2';
  assert.deepEqual(parseCampaignAllocation(id),{campaign_id:cid,allocated_cents:2750,
    processing_cents:149,support_cents:250,gift_cents:2500,channel:'paypal',version:'gift_first_v2'});
  assert.equal(parseCampaignAllocation('x|2750|149|250|paypal|gift_first_v2'),null);
  assert.equal(parseCampaignAllocation(cid+'|2750|149|3500|paypal|gift_first_v2'),null);
  assert.equal(parseCampaignAllocation(cid+'|2750|NaN|250|paypal|gift_first_v2'),null);
  assert.equal(parseCampaignAllocation(cid+'|2750|149|250|bad|gift_first_v2'),null);
});
test('PayPal capture notifications cannot silently credit unrelated funds',()=>{
  const e=(custom_id)=>({id:'WH1',event_type:'PAYMENT.CAPTURE.COMPLETED',
    resource:{id:'CAPTURE1',custom_id}});
  assert.equal(classifyPayPalNotification(e()).type,'unattributed');
  assert.equal(classifyPayPalNotification(e('ifund:platform-support:v1')).type,'platform_support');
  assert.equal(classifyPayPalNotification(e(cid+'|2750|149|250|paypal|gift_first_v2')).type,'campaign');
  assert.equal(classifyPayPalNotification(e('mystery-checkout')).type,'unattributed');
});
test('refund, reversal, subscription and payouts are separated for reconciliation',()=>{
  const mk=(type)=>({id:'WH2',event_type:type,resource:{id:'PROVIDER1'}});
  assert.equal(classifyPayPalNotification(mk('PAYMENT.CAPTURE.REFUNDED')).type,'capture_reconciliation');
  assert.equal(classifyPayPalNotification(mk('PAYMENT.CAPTURE.REVERSED')).type,'capture_reconciliation');
  assert.equal(classifyPayPalNotification(mk('PAYMENT.SALE.COMPLETED')).type,'subscription_reconciliation');
  assert.equal(classifyPayPalNotification(mk('PAYMENT.SALE.COMPLETED')).subscription_id,null,
    'A sale ID must never grant subscription access');
  assert.equal(classifyPayPalNotification({id:'WH3',event_type:'PAYMENT.SALE.COMPLETED',
    resource:{id:'SALE123',billing_agreement_id:'I-SUBSCRIBER123'}}).subscription_id,
    'I-SUBSCRIBER123');
  assert.equal(classifyPayPalNotification(mk('BILLING.SUBSCRIPTION.ACTIVATED')).type,'subscription_reconciliation');
  assert.equal(classifyPayPalNotification(mk('PAYMENT.PAYOUTS-ITEM.FAILED')).type,'payout_reconciliation');
});
test('all live payment flows remain disabled by default even with API credentials',()=>{
  const env={PAYPAL_MODE:'live',PAYPAL_MERCHANT_EMAIL:'cuddlemeplatonically@gmail.com',
    PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret',PAYPAL_WEBHOOK_ID:'webhook',
    SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'server-only-key'};
  const x=paypalReadiness(env);
  assert.equal(x.credential_names_present,true);
  for(const v of ['merchant_provider_verified','campaigns','subscriptions','platform_support','payouts'])
    assert.equal(x[v],false,v+' must fail closed');
});
test('merchant parity and provider approval flags are independent',()=>{
  const env={PAYPAL_MODE:'sandbox',PAYPAL_MERCHANT_EMAIL:'cuddlemeplatonically@gmail.com',
    PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret',PAYPAL_WEBHOOK_ID:'webhook',
    SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'server-only-key',
    PAYPAL_VERIFIED_MERCHANT_ID:'CONFIRMED-ID',
    IFUND_PAYMENT_PARITY_VERIFIED:'enabled',IFUND_PAYPAL_MERCHANT_VERIFIED:'enabled',
    IFUND_PAYPAL_CAMPAIGNS_ENABLED:'enabled',IFUND_PAYPAL_SUBSCRIPTIONS_ENABLED:'enabled'};
  const x=paypalReadiness(env);
  assert.equal(x.campaigns,true);
  assert.equal(x.subscriptions,false,'Plan verification is required');
  assert.equal(x.payouts,false,'PayPal payouts approval and ledger test are required');
});
