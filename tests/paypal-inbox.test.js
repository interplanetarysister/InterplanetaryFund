import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleUnifiedPayPalWebhook,inboxRpcPayload,storeVerifiedWebhook} from '../worker/paypalInbox.js';

const merchantId='QDGTZ7B92B9QT';
const env=()=>({
  IFUND_PAYPAL_INBOX_ENABLED:'enabled',IFUND_PAYPAL_MERCHANT_VERIFIED:'enabled',
  PAYPAL_VERIFIED_MERCHANT_ID:merchantId,PAYPAL_MODE:'sandbox',
  PAYPAL_WEBHOOK_ID:'webhook-id',PAYPAL_CLIENT_ID:'app',PAYPAL_CLIENT_SECRET:'client-secret',
  SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_private'
});
const event=(custom_id='ifund:platform-support:v1',payee=merchantId)=>({
  id:'WH-TEST123',event_type:'PAYMENT.CAPTURE.COMPLETED',
  resource:{id:'CAP123',custom_id,payee:{merchant_id:payee},
    status:'COMPLETED',amount:{value:'25.00',currency_code:'USD'}}
});
const headers=new Headers({'paypal-auth-algo':'SHA256withRSA',
  'paypal-cert-url':'https://api.sandbox.paypal.com/cert',
  'paypal-transmission-id':'T123','paypal-transmission-sig':'sig',
  'paypal-transmission-time':'2026-10-26T12:00:00Z'});
const request=e=>new Request('https://interplanetaryfund.com/api/paypal/unified-webhook',{
  method:'POST',headers,body:JSON.stringify(e)});
function fakeFetch(calls,invalidSignature=false,invalidDb=false) {
  return async (url,opt)=>{
    calls.push({url,opt});
    if(url.endsWith('/v1/oauth2/token'))
      return new Response(JSON.stringify({access_token:'oauth'}),{status:200});
    if(url.endsWith('/verify-webhook-signature'))
      return new Response(JSON.stringify({verification_status:invalidSignature?'FAILURE':'SUCCESS'}),{status:200});
    if(url.endsWith('/rpc/ifund_enqueue_verified_paypal_webhook'))
      return new Response(JSON.stringify('stored'),{status:invalidDb?503:200});
    throw new Error('unexpected URL');
  };
}
test('intake disabled until explicit operator approval and valid merchant id',async()=>{
  assert.equal((await handleUnifiedPayPalWebhook(request(event()),{})).status,503);
  assert.equal((await handleUnifiedPayPalWebhook(request(event()),{
    ...env(),PAYPAL_VERIFIED_MERCHANT_ID:'example'
  })).status,503);
});
test('signature is checked first and invalid signature never reaches Supabase',async()=>{
  const calls=[];
  const res=await handleUnifiedPayPalWebhook(request(event()),env(),fakeFetch(calls,true));
  assert.equal(res.status,400);
  assert.equal(calls.length,2);
  assert.equal(calls.filter(c=>c.url.includes('/rpc/')).length,0);
});
test('verified platform support event is retained for review, not financially booked',async()=>{
  const calls=[];
  const res=await handleUnifiedPayPalWebhook(request(event()),env(),fakeFetch(calls));
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,retained:true,reconciled:false});
  assert.equal(calls.length,3);
  const final=calls[2];
  const body=JSON.parse(final.opt.body);
  assert.equal(body.p.category,'platform_support');
  assert.equal(body.p.merchant_id,merchantId);
  assert.equal(body.raw.id,'WH-TEST123');
  assert.equal(final.opt.headers.Authorization,undefined,'secret key not used as JWT');
});
test('unattributed capture remains unapplied and visible for reconciliation',async()=>{
  const calls=[];
  const e=event();
  delete e.resource.custom_id;
  const res=await handleUnifiedPayPalWebhook(request(e),env(),fakeFetch(calls));
  assert.equal(res.status,200);
  assert.equal(JSON.parse(calls[2].opt.body).p.category,'unattributed');
});
test('merchant mismatch is quarantined as unattributed, never campaign funds',async()=>{
  const calls=[];
  const e=event('ifund:platform-support:v1','OTHER12345678');
  const res=await handleUnifiedPayPalWebhook(request(e),env(),fakeFetch(calls));
  assert.equal(res.status,200);
  assert.equal(JSON.parse(calls[2].opt.body).p.category,'unattributed');
});
test('signature-verified records retry on database failure',async()=>{
  const calls=[];
  const res=await handleUnifiedPayPalWebhook(request(event()),env(),fakeFetch(calls,false,true));
  assert.equal(res.status,503);
});
test('no public credentials or invalid event IDs accepted by intake',()=>{
  assert.throws(()=>inboxRpcPayload({id:'bad',event_type:'PAYMENT.CAPTURE.COMPLETED'},
    {type:'platform_support'},'sandbox'));
});
test('SQL inbox has RLS and server-only RPC permissions, and never credits a ledger',()=>{
  const sql=readFileSync('supabase/migrations/pending/paypal_business_webhook_inbox_001.sql','utf8');
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public.ifund_enqueue_verified_paypal_webhook/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public.ifund_enqueue_verified_paypal_webhook\(jsonb,jsonb\)\s+TO service_role/);
  assert.doesNotMatch(sql,/INSERT INTO ifund_finance\.(financial_operation|holding_ledger_entry|donation)/);
});
