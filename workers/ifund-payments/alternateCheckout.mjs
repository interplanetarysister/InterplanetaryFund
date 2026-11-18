// Independent Stripe-hosted wallets and merchant-eligible stablecoin checkout.
// Source-only integration: fail closed until the canonical atomic ledger binding
// has accepted reserve/settle contracts and the merchant has provider clearance.
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE_RE=/^[a-f0-9]{32,128}$/i;
const SESSION_RE=/^cs_live_[A-Za-z0-9_]{12,}$/;
const PI_RE=/^pi_[A-Za-z0-9]{12,}$/;
const STRIPE_API="https://api.stripe.com/v1";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const fail=(error,status=503)=>json({ok:false,error},status);
const secret=async source=>typeof source==="string"?source:typeof source?.get==="function"?await source.get():"";
const money=(gift,tip)=>Number.isSafeInteger(gift)&&gift>=100&&gift<=100000000&&Number.isSafeInteger(tip)&&tip>=0&&tip<=Math.round(gift*.1)&&Number.isSafeInteger(gift+tip);
function configured(env,channel) {
  return env.IFUND_ALTERNATE_PAYMENTS_ENABLED==="true"
    &&env.IFUND_ALTERNATE_LEDGER_CONTRACT==="accepted-v1"
    &&!!env.IFUND_ALTERNATE_LEDGER
    &&env.IFUND_STRIPE_MODE==="live"
    &&(channel!=="crypto"||env.IFUND_STRIPE_CRYPTO_APPROVED==="true");
}
async function stripe(env,path,options={}) {
  const key=await secret(env.IFUND_STRIPE_SECRET_KEY);
  if(!/^sk_live_[A-Za-z0-9]{16,}$/.test(key))throw Error("stripe_live_credentials_unavailable");
  const response=await fetch(STRIPE_API+path,{...options,headers:{
    "authorization":"Bearer "+key,"stripe-version":"2025-06-30.basil",...(options.headers||{})
  }});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error("stripe_provider_unavailable");
  return data;
}
async function ledger(env,action,body) {
  // Service binding is intentionally required. It must atomically enforce
  // owner campaign status, source/provider identity, replay and cumulative caps.
  const svc=env.IFUND_ALTERNATE_LEDGER;
  if(!svc||env.IFUND_ALTERNATE_LEDGER_CONTRACT!=="accepted-v1")throw Error("atomic_ledger_unavailable");
  const response=await svc.fetch("https://ifund-internal/alternate/"+action,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true)throw Error("atomic_ledger_rejected");
  return data;
}
function checkoutOrigin(request,env) {
  const origin=request.headers.get("origin")||"";
  const allowed=String(env.IFUND_ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin)&&origin==="https://interplanetaryfund.com"?origin:null;
}
async function start(request,env) {
  const origin=checkoutOrigin(request,env);
  if(!origin)return fail("origin_not_allowed",403);
  const input=await request.text();
  if(input.length>4096)return fail("invalid_checkout_request",400);
  let p;try{p=JSON.parse(input)}catch{return fail("invalid_checkout_request",400)}
  const channel=p.channel;
  if(!["wallet","crypto"].includes(channel)||!configured(env,channel))
    return fail("alternate_checkout_unavailable");
  if(!UUID_RE.test(p.campaign_id||"")||!NONCE_RE.test(p.request_key||"")||!money(p.gift_cents,p.optional_support_cents))
    return fail("invalid_checkout_request",400);
  const gift=p.gift_cents,tip=p.optional_support_cents,total=gift+tip;
  // Reserve first; no Stripe session is created without a durable canonical intent.
  const reservation=await ledger(env,"reserve",{
    provider:"stripe",environment:"live",channel,campaign_id:p.campaign_id,
    gift_cents:gift,optional_support_cents:tip,total_cents:total,
    currency:"USD",request_key:p.request_key,
    authorization:request.headers.get("authorization")||null
  });
  if(!NONCE_RE.test(reservation.reservation_id||"")||
     reservation.campaign_id!==p.campaign_id||
     reservation.total_cents!==total||reservation.environment!=="live")
    return fail("ledger_reservation_mismatch");
  const form=new URLSearchParams();
  form.set("mode","payment");
  form.set("client_reference_id",reservation.reservation_id);
  form.set("success_url",origin+"/giving?external_checkout=pending");
  form.set("cancel_url",origin+"/campaign/"+encodeURIComponent(p.campaign_id)+"?external_checkout=cancelled");
  form.set("line_items[0][price_data][currency]","usd");
  form.set("line_items[0][price_data][unit_amount]",String(total));
  form.set("line_items[0][price_data][product_data][name]","Interplanetary Fund campaign gift");
  form.set("line_items[0][quantity]","1");
  form.set("metadata[ifund_reservation]",reservation.reservation_id);
  form.set("metadata[ifund_channel]",channel);
  form.set("payment_intent_data[metadata][ifund_reservation]",reservation.reservation_id);
  // Stripe's dynamic method eligibility decides whether Google Pay and, for
  // approved merchants, crypto/stablecoins are offered. No fake wallet button.
  const session=await stripe(env,"/checkout/sessions",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",
      "idempotency-key":"ifund-alt-"+reservation.reservation_id},
    body:form.toString()
  });
  if(!SESSION_RE.test(session.id||"")||session.livemode!==true||
     session.mode!=="payment"||session.currency!=="usd"||
     session.amount_total!==total||session.client_reference_id!==reservation.reservation_id||
     !/^https:\/\/checkout\.stripe\.com\//.test(session.url||""))
    return fail("checkout_session_unverified");
  await ledger(env,"attach-session",{
    reservation_id:reservation.reservation_id,session_id:session.id,
    provider:"stripe",environment:"live",total_cents:total
  });
  return json({ok:true,provider:"stripe",environment:"live",url:session.url});
}
async function verifyStripeSignature(request,env,raw) {
  const header=request.headers.get("stripe-signature")||"";
  const timestamp=/(?:^|,)t=(\d+)(?:,|$)/.exec(header)?.[1];
  const signatures=[...header.matchAll(/(?:^|,)v1=([a-f0-9]{64})(?=,|$)/g)].map(x=>x[1]);
  const stamp=Number(timestamp),now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(stamp)||Math.abs(now-stamp)>300||!signatures.length)return false;
  const value=await secret(env.IFUND_STRIPE_WEBHOOK_SECRET);
  if(!/^whsec_[A-Za-z0-9]{16,}$/.test(value))return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(value),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+raw)));
  const actual=[...signed].map(x=>x.toString(16).padStart(2,"0")).join("");
  // Avoid attacker-controlled early-return prefix comparisons.
  return signatures.some(candidate=>{
    let diff=0;for(let i=0;i<64;i++)diff|=candidate.charCodeAt(i)^actual.charCodeAt(i);
    return diff===0;
  });
}
async function webhook(request,env) {
  if(!configured(env,"wallet"))return fail("alternate_ledger_unavailable");
  const raw=await request.text();
  if(raw.length>65536)return fail("webhook_body_too_large",413);
  if(!await verifyStripeSignature(request,env,raw))return fail("unsigned_webhook",401);
  let event;try{event=JSON.parse(raw)}catch{return fail("invalid_webhook",400)}
  if(event.livemode!==true||!/^evt_[A-Za-z0-9]{12,}$/.test(event.id||""))
    return fail("webhook_environment_mismatch",409);
  const events=["checkout.session.completed","checkout.session.async_payment_succeeded"];
  if(!events.includes(event.type))return json({ok:true,ignored:true});
  const signedSession=event.data?.object;
  if(!SESSION_RE.test(signedSession?.id||""))return fail("webhook_session_invalid",409);
  // Verify independent live provider receipt; NEVER trust redirect parameters,
  // browser assertions, or unsigned metadata as proof of payment.
  const session=await stripe(env,"/checkout/sessions/"+encodeURIComponent(signedSession.id));
  if(session.id!==signedSession.id||session.livemode!==true||
     session.payment_status!=="paid"||session.mode!=="payment"||
     session.currency!=="usd"||!Number.isSafeInteger(session.amount_total)||
     !NONCE_RE.test(session.client_reference_id||"")||
     session.metadata?.ifund_reservation!==session.client_reference_id||
     !PI_RE.test(session.payment_intent||""))
    return fail("provider_receipt_unverified",409);
  // The ledger must compare the capture to the originally reserved campaign,
  // exact USD amount, Stripe session, payment intent and environment atomically.
  const applied=await ledger(env,"settle",{
    provider:"stripe",environment:"live",event_id:event.id,
    session_id:session.id,payment_intent_id:session.payment_intent,
    reservation_id:session.client_reference_id,captured_cents:session.amount_total,
    currency:"USD",status:"paid"
  });
  if(!applied.donation_id)return fail("ledger_settlement_unverified");
  return json({ok:true,recorded:true});
}
export async function handleAlternatePayments(request,env) {
  const path=new URL(request.url).pathname;
  if(path==="/api/payments/alternatives/config"&&request.method==="GET"){
    const hasKey=Boolean(await secret(env.IFUND_STRIPE_SECRET_KEY));
    const hasWebhook=Boolean(await secret(env.IFUND_STRIPE_WEBHOOK_SECRET));
    const ready=hasKey&&hasWebhook&&configured(env,"wallet");
    return json({ok:true,provider:"stripe",environment:"live",wallet_enabled:ready,
      crypto_enabled:ready&&configured(env,"crypto"),status:ready?"provider_configured":"unavailable"});
  }
  if(path==="/api/payments/alternatives/create-session"&&request.method==="POST"){
    try{return await start(request,env)}catch{return fail("alternate_checkout_unavailable")}
  }
  if(path==="/api/payments/alternatives/webhook"&&request.method==="POST"){
    try{return await webhook(request,env)}catch{return fail("webhook_retry_required")}
  }
  return fail("not_found",404);
}
