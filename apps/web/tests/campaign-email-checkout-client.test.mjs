import test from "node:test";
import assert from "node:assert/strict";
import {readRecurringEmailCheckoutService,beginRecurringEmailCheckout}
 from "../src/lib/campaignEmailCheckout.mjs";
const OWNER="11111111-1111-4111-8111-111111111111";
const REQUEST="22222222-2222-4222-8222-222222222222";
const SESSION="a".repeat(60);
const client={
 auth:{
  async getUser(){return {data:{user:{id:OWNER,email_confirmed_at:"2026-11-19T00:00:00Z",is_anonymous:false}},error:null}},
  async getSession(){return {data:{session:{user:{id:OWNER},access_token:SESSION}},error:null}}
 }
};
const ready={
 ok:true,monthly_amount_cents:100,currency:"USD",interval:"monthly",checkout_ready:true,
 provider:"paypal",activation_requires_completed_sale:true
};
test("The recurring checkout requires verified account access and exact USD $1 charge",async()=>{
 const mock=async path=>{assert.equal(path,"/api/payments/email-addon/status");return Response.json(ready)};
 assert.equal((await readRecurringEmailCheckoutService(client,mock)).checkout_ready,true);
 await assert.rejects(()=>readRecurringEmailCheckoutService({
   auth:{getUser:async()=>({data:{user:null}}),getSession:async()=>({data:{session:null}})}
 },mock));
 for(const altered of [{...ready,monthly_amount_cents:200},{...ready,provider:"card"},
   {...ready,activation_requires_completed_sale:false}]){
   await assert.rejects(()=>readRecurringEmailCheckoutService(client,async()=>Response.json(altered)));
 }
});
test("Only PayPal recurring approval URLs are accepted; return does not activate mailbox",async()=>{
 let calls=[];
 const fetcher=async(path,opts)=>{
  calls.push({path,opts});
  if(path.endsWith("/status"))return Response.json(ready);
  assert.equal(opts.method,"POST");
  assert.deepEqual(JSON.parse(opts.body),{request_id:REQUEST});
  return Response.json({ok:true,approval_url:"https://www.paypal.com/webapps/billing/subscriptions?ba_token=BA-TEST",
    subscription_id:"I-ABCDEFGHIJKLMNOP",addon_active:false,monthly_amount_cents:100});
 };
 const x=await beginRecurringEmailCheckout(client,{requestId:REQUEST,fetcher});
 assert.equal(new URL(x.approvalUrl).hostname,"www.paypal.com");
 assert.equal(calls.length,2);
 assert.equal(calls[1].opts.headers.Authorization,"Bearer "+SESSION);
});
test("Phishing approval, unverified state and inactive plan never initiate a redirect",async()=>{
 const badResponse=[
  {ok:true,approval_url:"https://paypal.com.evil.example/approve",subscription_id:"I-ABCDEFGHIJKLMNOP",addon_active:false,monthly_amount_cents:100},
  {ok:true,approval_url:"http://www.paypal.com/approve",subscription_id:"I-ABCDEFGHIJKLMNOP",addon_active:false,monthly_amount_cents:100},
  {ok:true,approval_url:"https://www.paypal.com/approve",subscription_id:"I-ABCDEFGHIJKLMNOP",addon_active:true,monthly_amount_cents:100},
  {ok:true,approval_url:"https://www.paypal.com/approve",subscription_id:"invalid",addon_active:false,monthly_amount_cents:100}
 ];
 for(const answer of badResponse){
  await assert.rejects(()=>beginRecurringEmailCheckout(client,{requestId:REQUEST,fetcher:async path=>
    Response.json(path.endsWith("/status")?ready:answer)}));
 }
 let sent=0;
 await assert.rejects(()=>beginRecurringEmailCheckout(client,{requestId:REQUEST,fetcher:async path=>{
  if(path.endsWith("/start"))sent++;
  return Response.json({...ready,checkout_ready:false});
 }}));
 assert.equal(sent,0);
 await assert.rejects(()=>beginRecurringEmailCheckout(client,{requestId:"bad",fetcher:async()=>Response.json(ready)}));
});
