// iFund Cloudflare payment API — verified PayPal Orders v2; no browser card data.
// Live activation requires IFUND_PAYMENTS_ENABLED=true after independent checkout
// and webhook/ledger verification. Existing secrets remain in Cloudflare Secrets Store.
const PAYPAL_API = "https://api-m.paypal.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_ID = /^[A-Za-z0-9_-]{8,100}$/;
const INTENT = /^[A-Za-z0-9_-]{16,100}$/;
const EDGE_FUNCTION = "/functions/v1/ifund-payment-ledger";
const SUBSCRIPTION_ID = /^I-[A-Z0-9]{10,30}$/;
const PAYPAL_PLAN_ID = /^P-[A-Z0-9]{20,32}$/;
const PAYPAL_EVENT_ID = /^WH-[A-Z0-9-]{8,90}$/;
const BASIC_MONTHLY_PLAN = Object.freeze({tier:"basic",interval:"monthly",amount_cents:1200,plan_id:"P-6YD2273006199630KNLDXBLA"});
const SUBSCRIPTION_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED","BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.SUSPENDED","BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED","BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED","PAYMENT.SALE.REFUNDED","PAYMENT.SALE.REVERSED"
]);

const asJson=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...headers}});
const asError=(code,status=400)=>asJson({ok:false,error:code},status);
const cents=value=>Math.round(Number(value)*100);
const encode64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const toHex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
const hash=async s=>toHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));

async function getSecret(binding) {
  if (!binding) return "";
  if (typeof binding==="string") return binding;
  return typeof binding.get==="function" ? await binding.get() : "";
}
async function signLedger(env,op,data) {
  const privateSource=await getSecret(env.IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK);
  if(!privateSource) throw new Error("ledger_signing_unavailable");
  const key=await crypto.subtle.importKey("jwk",JSON.parse(privateSource),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const body=JSON.stringify({op,data});
  const time=String(Math.floor(Date.now()/1000));
  const signature=encode64(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(time+"\n"+body)));
  const response=await fetch(String(env.IFUND_SUPABASE_URL)+EDGE_FUNCTION,{
    method:"POST",headers:{"content-type":"application/json","x-ifund-timestamp":time,"x-ifund-signature":signature},
    body,
  });
  const content=await response.json().catch(()=>({ok:false}));
  if(!response.ok||content.ok!==true){const error=new Error("ledger_rejected");error.status=response.status;throw error}
  return content;
}
async function accessToken(env) {
  const id=await getSecret(env.PAYPAL_CLIENT_ID), secret=await getSecret(env.PAYPAL_CLIENT_SECRET);
  if(!id||!secret) throw new Error("paypal_credentials_unavailable");
  const response=await fetch(PAYPAL_API+"/v1/oauth2/token",{
    method:"POST",headers:{"authorization":"Basic "+btoa(id+":"+secret),"content-type":"application/x-www-form-urlencoded"},
    body:"grant_type=client_credentials",
  });
  if(!response.ok)throw new Error("paypal_oauth_rejected");
  const data=await response.json(); if(!data.access_token)throw new Error("paypal_oauth_token_missing");
  return data.access_token;
}
async function paypal(env,path,method="GET",body,requestId) {
  const token=await accessToken(env);
  const headers={"authorization":"Bearer "+token,"content-type":"application/json"};
  if(requestId)headers["PayPal-Request-Id"]=requestId;
  const response=await fetch(PAYPAL_API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error("paypal_request_failed");error.status=response.status;throw error}
  return data;
}
// PayPal's U.S. terms prohibit adding a surcharge for accepting PayPal.
// The supporter pays only the chosen campaign gift and any explicitly opted-in
// platform contribution. Merchant processing costs are not donor surcharges.
function quote(gift,tip,channel) {
  return gift + tip;
}
function usd(centsValue) { return (centsValue / 100).toFixed(2); }
function paypalOrderBreakdown(gift,tip) {
  const amount = {currency_code:"USD",value:usd(gift+tip)};
  const items = [{
    name:"IFund campaign gift",quantity:"1",category:"DONATION",
    unit_amount:{currency_code:"USD",value:usd(gift)},
  }];
  if (tip > 0) items.push({
    name:"Optional IFund support",quantity:"1",category:"DONATION",
    unit_amount:{currency_code:"USD",value:usd(tip)},
  });
  return {amount:{...amount,breakdown:{item_total:amount}},items};
}


function memberToken(req) {
  const header=req.headers.get("authorization")||"";
  if(!/^Bearer [A-Za-z0-9._-]{40,8192}$/.test(header)) return "";
  return header.slice(7);
}
function exactBasicPlan(plan) {
  const cycle=plan?.billing_cycles?.find(row=>row.tenure_type==="REGULAR");
  return Boolean(plan?.id===BASIC_MONTHLY_PLAN.plan_id&&plan?.status==="ACTIVE"&&
    cycle?.frequency?.interval_unit==="MONTH"&&Number(cycle?.frequency?.interval_count||1)===1&&
    Number(cycle?.total_cycles)===0&&cycle?.pricing_scheme?.fixed_price?.currency_code==="USD"&&
    cents(cycle?.pricing_scheme?.fixed_price?.value)===BASIC_MONTHLY_PLAN.amount_cents&&
    typeof plan?.product_id==="string"&&plan.product_id.length>=6);
}
async function subscriptionReadiness(env) {
  const webhookId=await getSecret(env.PAYPAL_WEBHOOK_ID);
  if(!webhookId)return {ready:false,plan_ready:false,webhook_ready:false};
  const [plan,hook]=await Promise.all([
    paypal(env,"/v1/billing/plans/"+encodeURIComponent(BASIC_MONTHLY_PLAN.plan_id)).catch(()=>null),
    paypal(env,"/v1/notifications/webhooks/"+encodeURIComponent(webhookId)).catch(()=>null),
  ]);
  const planReady=exactBasicPlan(plan);
  const names=new Set(Array.isArray(hook?.event_types)?hook.event_types.map(x=>x?.name):[]);
  const webhookReady=hook?.id===webhookId&&typeof hook?.url==="string"&&
    [...SUBSCRIPTION_EVENTS].every(name=>names.has(name)||names.has("*"));
  if(planReady){
    await signLedger(env,"subscription_plan_readiness",{
      tier:BASIC_MONTHLY_PLAN.tier,interval:BASIC_MONTHLY_PLAN.interval,
      amount_cents:BASIC_MONTHLY_PLAN.amount_cents,paypal_plan_id:BASIC_MONTHLY_PLAN.plan_id,
      paypal_product_id:plan.product_id,plan_ready:planReady,webhook_ready:webhookReady,
      paypal_webhook_id:webhookReady?webhookId:null
    });
  }
  return {ready:planReady&&webhookReady,plan_ready:planReady,webhook_ready:webhookReady};
}
async function reconcileSubscription(env,subscriptionReference,token="",providerReference=null) {
  const lookup=await signLedger(env,token?"subscription_get":"subscription_lookup",{
    paypal_subscription_id:subscriptionReference,
    ...(token?{member_access_token:token}:{})
  });
  const intent=lookup.intent;
  const subscription=await paypal(env,"/v1/billing/subscriptions/"+encodeURIComponent(subscriptionReference));
  if(subscription?.id!==subscriptionReference||subscription?.plan_id!==intent.paypal_plan_id||
    subscription?.custom_id!==intent.custom_id) throw new Error("subscription_provider_identity_mismatch");
  const payment=subscription?.billing_info?.last_payment;
  const amount=payment?.amount;
  const lastPaymentCents=amount?.currency_code==="USD"&&/^\d+(?:\.\d{1,2})?$/.test(String(amount?.value||""))
    ?cents(amount.value):null;
  const result=await signLedger(env,"subscription_reconcile",{
    paypal_subscription_id:subscriptionReference,paypal_plan_id:subscription.plan_id,
    custom_id:subscription.custom_id,provider_status:String(subscription.status||"").toUpperCase(),
    last_payment_cents:lastPaymentCents,last_payment_at:payment?.time||null,
    currency:amount?.currency_code||null,
    next_billing_time:subscription?.billing_info?.next_billing_time||null,
    failed_payments_count:Number(subscription?.billing_info?.failed_payments_count||0),
    provider_reference:providerReference
  });
  return {ok:true,status:result.status,tier:intent.tier,interval:intent.interval,
    subscription_id:subscriptionReference,next_billing_time:subscription?.billing_info?.next_billing_time||null};
}
async function subscriptionPlans(env) {
  const readiness=await subscriptionReadiness(env);
  const catalog=await signLedger(env,"subscription_plans",{});
  return {ok:true,readiness,plans:(catalog.plans||[]).map(row=>({
    tier:row.tier,interval:row.interval,amount_cents:row.amount_cents,currency:row.currency,
    available:Boolean(row.active&&row.paypal_plan_id&&readiness.webhook_ready),
    verified:Boolean(row.active&&row.verified_at)
  }))};
}
async function startSubscription(req,env,origin) {
  const token=memberToken(req);
  if(!token)return asError("sign_in_required",401);
  const body=await readBody(req);
  if(body.tier!=="basic"||body.interval!=="monthly")return asError("subscription_plan_unavailable",409);
  const readiness=await subscriptionReadiness(env);
  if(!readiness.ready)return asError("subscription_billing_not_ready",503);
  const intent=await signLedger(env,"subscription_begin",{
    member_access_token:token,tier:body.tier,interval:body.interval
  });
  const created=await paypal(env,"/v1/billing/subscriptions","POST",{
    plan_id:intent.plan_id,custom_id:intent.custom_id,
    application_context:{
      brand_name:"Interplanetary Fund",user_action:"SUBSCRIBE_NOW",
      return_url:origin+"/subscriptions?paypal_checkout=return",
      cancel_url:origin+"/subscriptions?paypal_checkout=cancel"
    }
  },"ifund-sub-"+intent.intent_id);
  const approve=Array.isArray(created?.links)?created.links.find(x=>x?.rel==="approve")?.href:"";
  if(!SUBSCRIPTION_ID.test(created?.id||"")||typeof approve!=="string")
    return asError("subscription_approval_unavailable",502);
  let approved;
  try{approved=new URL(approve)}catch(_){return asError("subscription_approval_unavailable",502)}
  if(approved.protocol!=="https:"||!["www.paypal.com","paypal.com"].includes(approved.hostname))
    return asError("subscription_approval_unavailable",502);
  await signLedger(env,"subscription_bind",{intent_id:intent.intent_id,paypal_subscription_id:created.id});
  return asJson({ok:true,approval_url:approve,subscription_id:created.id});
}
async function confirmSubscription(req,env) {
  const token=memberToken(req);
  if(!token)return asError("sign_in_required",401);
  const body=await readBody(req);
  if(!SUBSCRIPTION_ID.test(body.subscription_id||""))return asError("invalid_subscription_reference");
  return asJson(await reconcileSubscription(env,body.subscription_id,token));
}
async function subscriptionStatus(req,env) {
  const token=memberToken(req);
  if(!token)return asError("sign_in_required",401);
  const stored=await signLedger(env,"subscription_status",{member_access_token:token});
  if(!stored.subscription?.paypal_subscription_id)return asJson({ok:true,subscription:stored.subscription||null});
  try{
    const refreshed=await reconcileSubscription(env,stored.subscription.paypal_subscription_id,token);
    const latest=await signLedger(env,"subscription_status",{member_access_token:token});
    return asJson({ok:true,subscription:latest.subscription||null,provider_verified:true,provider_status:refreshed.status});
  }catch(_){
    return asJson({ok:true,subscription:stored.subscription,provider_verified:false});
  }
}
async function cancelSubscription(req,env) {
  const token=memberToken(req);
  if(!token)return asError("sign_in_required",401);
  const stored=await signLedger(env,"subscription_status",{member_access_token:token});
  const id=stored.subscription?.paypal_subscription_id;
  if(!SUBSCRIPTION_ID.test(id||""))return asError("no_active_subscription",409);
  await signLedger(env,"subscription_get",{paypal_subscription_id:id,member_access_token:token});
  await paypal(env,"/v1/billing/subscriptions/"+encodeURIComponent(id)+"/cancel","POST",
    {reason:"Canceled by Interplanetary Fund member"},"ifund-cancel-"+id);
  return asJson(await reconcileSubscription(env,id,token));
}
async function subscriptionWebhook(payload,env) {
  const kind=String(payload.event_type||"");
  const id=kind.startsWith("PAYMENT.SALE.")?String(payload.resource?.billing_agreement_id||""):
    String(payload.resource?.id||"");
  if(!SUBSCRIPTION_ID.test(id))return asJson({ok:true,ignored:true,reason:"no_subscription_reference"});
  if(!PAYPAL_EVENT_ID.test(String(payload.id||"")))return asError("invalid_paypal_event",400);
  if(kind==="PAYMENT.SALE.REFUNDED"||kind==="PAYMENT.SALE.REVERSED"){
    const amount=payload.resource?.amount;
    if(amount?.currency_code!=="USD"||!/^\d+(?:\.\d{1,2})?$/.test(String(amount?.value||"")))
      return asError("subscription_reversal_amount_unverified",409);
    await signLedger(env,"subscription_reversal",{
      paypal_subscription_id:id,paypal_event_id:payload.id,event_type:kind,
      amount_cents:cents(amount.value),currency:"USD",occurred_at:payload.create_time,
      provider_reference:payload.resource?.id||payload.id
    });
  }
  const providerReference=kind==="PAYMENT.SALE.COMPLETED"?payload.resource?.id||null:null;
  const reconciled=await reconcileSubscription(env,id,"",providerReference);
  await signLedger(env,"subscription_event",{
    paypal_event_id:payload.id,paypal_subscription_id:id,event_type:kind
  });
  return asJson({ok:true,subscription_status:reconciled.status});
}

function captureFromOrder(order) {
  const units=order?.purchase_units;
  if(!Array.isArray(units)||units.length!==1)return null;
  const captures=units[0]?.payments?.captures;
  if(!Array.isArray(captures)||captures.length!==1)return null;
  return {unit:units[0],capture:captures[0]};
}
async function verifyCapture(env,orderId,intent) {
  const order=await paypal(env,"/v2/checkout/orders/"+encodeURIComponent(orderId));
  const receipt=captureFromOrder(order);
  if(order.status!=="COMPLETED"||!receipt||receipt.capture.status!=="COMPLETED") throw new Error("paypal_capture_unconfirmed");
  const expectedCustom=["ifund",intent.campaign_id,intent.gift_cents,intent.optional_support_cents,intent.payment_channel].join("|");
  const amount=receipt.capture.amount;
  if(receipt.unit.custom_id!==expectedCustom
    || receipt.unit.reference_id!==intent.campaign_id
    || amount?.currency_code!=="USD"
    || !/^\d+(?:\.\d{1,2})?$/.test(String(amount.value||""))
    || cents(amount.value)!==intent.total_cents
    || !ORDER_ID.test(receipt.capture.id)) throw new Error("paypal_receipt_mismatch");
  return {order_id:orderId,capture_id:receipt.capture.id,cents:intent.total_cents};
}
async function finalize(env,reference,intent) {
  const proof=await verifyCapture(env,reference,intent);
  const applied=await signLedger(env,"finalize",{
    paypal_order_id:proof.order_id,paypal_capture_id:proof.capture_id,
    captured_cents:proof.cents,capture_status:"COMPLETED",currency:"USD",
  });
  return {ok:true,status:"captured",donation_id:applied.donation_id,order_id:reference,capture_id:proof.capture_id};
}
async function readBody(req) {
  const raw=await req.text();
  if(raw.length>32768)throw new Error("payload_too_large");
  return JSON.parse(raw);
}
async function webhook(req,env) {
  const webhookId=await getSecret(env.PAYPAL_WEBHOOK_ID);
  if(!webhookId)return asError("webhook_not_configured",503);
  const payload=await readBody(req);
  const headers=req.headers;
  const required=["paypal-transmission-id","paypal-transmission-time","paypal-cert-url","paypal-auth-algo","paypal-transmission-sig"];
  if(required.some(k=>!headers.get(k))) return asError("unsigned_webhook",401);
  const verification=await paypal(env,"/v1/notifications/verify-webhook-signature","POST",{
    transmission_id:headers.get("paypal-transmission-id"),transmission_time:headers.get("paypal-transmission-time"),
    cert_url:headers.get("paypal-cert-url"),auth_algo:headers.get("paypal-auth-algo"),
    transmission_sig:headers.get("paypal-transmission-sig"),webhook_id:webhookId,webhook_event:payload,
  });
  if(verification.verification_status!=="SUCCESS")return asError("invalid_paypal_signature",401);
  const kind=payload.event_type;
  if(SUBSCRIPTION_EVENTS.has(kind))return await subscriptionWebhook(payload,env);
  if(kind==="PAYMENT.CAPTURE.COMPLETED"){
    const orderId=payload.resource?.supplementary_data?.related_ids?.order_id;
    if(!ORDER_ID.test(orderId||""))return asError("webhook_order_unresolved",409);
    const claim=await signLedger(env,"get",{paypal_order_id:orderId});
    if(claim.intent.environment!=="live")return asError("unexpected_payment_environment",409);
    // Reject invalid capture references before any ledger mutation.
    if(!ORDER_ID.test(payload.id||"")||!ORDER_ID.test(payload.resource?.id||""))
      return asError("webhook_capture_reference_mismatch",409);
    // Check the signed notification's capture against PayPal's current order
    // BEFORE posting any financial ledger mutation.
    const proof=await verifyCapture(env,orderId,claim.intent);
    if(payload.resource.id!==proof.capture_id)
      return asError("webhook_capture_reference_mismatch",409);
    const completed=await finalize(env,orderId,claim.intent);
    await signLedger(env,"event",{paypal_event_id:payload.id,paypal_order_id:orderId,
      paypal_capture_id:completed.capture_id,event_type:kind});
    return asJson({ok:true,recorded:true,donation_id:completed.donation_id});
  }
  if(["PAYMENT.CAPTURE.REFUNDED","PAYMENT.CAPTURE.REVERSED"].includes(kind)){
    // A completed refund event identifies a REFUND in resource.id, not a capture.
    // Its canonical capture may be carried by the provider's rel=up link.
    const related=payload.resource?.supplementary_data?.related_ids?.capture_id;
    const links=Array.isArray(payload.resource?.links)?payload.resource.links:[];
    const linkedCaptures=new Set();
    for(const link of links){
      if(link?.rel!=="up"||typeof link.href!=="string")continue;
      try{
        const u=new URL(link.href);
        if(u.protocol!=="https:"||u.port||u.search||u.hash
          ||!["api.paypal.com","api-m.paypal.com"].includes(u.hostname))continue;
        const match=u.pathname.match(/^\/v2\/payments\/captures\/([A-Za-z0-9_-]{8,100})$/);
        if(match)linkedCaptures.add(match[1]);
      }catch(_){}
    }
    const linked=linkedCaptures.size===1?[...linkedCaptures][0]:null;
    const captureId=related||linked||(kind==="PAYMENT.CAPTURE.REVERSED"?payload.resource?.id:null);
    if(!ORDER_ID.test(captureId||"")||!ORDER_ID.test(payload.id||"")
      ||(linked&&related&&linked!==related)||linkedCaptures.size>1)
      return asError("reversal_reference_missing",409);
    // Supabase requires a verified amount to reject partial or mismatched reversals.
    // A signed event with missing amount must be reconciled, not silently accepted.
    const amount=payload.resource?.amount;
    if(amount?.currency_code!=="USD"||!/^\d+(?:\.\d{1,2})?$/.test(String(amount.value||""))
      ||cents(amount.value)<1)return asError("reversal_amount_unverified",409);
    const reversed=await signLedger(env,"reverse",{paypal_capture_id:captureId,
      paypal_event_id:payload.id,event_type:kind,refunded_cents:cents(amount.value)});
    return asJson({ok:true,reversed:true,donation_id:reversed.donation_id});
  }
  return asJson({ok:true,ignored:true});
}
async function createOrder(req,env) {
  const input=await readBody(req);
  const gift=input.gift_cents,tip=input.optional_support_cents||0,channel=input.payment_channel||"paypal";
  if(!UUID.test(input.campaign_id||"")||!INTENT.test(input.request_key||"")
   ||!["paypal","card","googlepay","applepay","venmo"].includes(channel)
   ||!Number.isSafeInteger(gift)||gift<100||gift>100000000
   ||!Number.isSafeInteger(tip)||tip<0||tip>Math.round(gift*0.1))return asError("invalid_donation_request");
  const total=quote(gift,tip,channel);
  // Carry a browser session only to the trusted signed-ledger broker. Never
  // trust a donor UUID supplied by checkout and never persist the bearer token.
  const authHeader=req.headers.get("authorization");
  if(authHeader && !/^Bearer [A-Za-z0-9._-]{40,8192}$/.test(authHeader))
    return asError("invalid_donor_session",401);
  const donorToken=authHeader?authHeader.slice(7):null;
  // The browser supplies a cryptographically random token that remains stable
  // across retries of the same payment request. Old clients can still use the
  // server-generated token until all existing deployments have refreshed.
  if(input.checkout_token!==undefined &&
     (typeof input.checkout_token!=="string"||!/^[a-f0-9]{64}$/.test(input.checkout_token)))
    return asError("invalid_checkout_token");
  const checkoutToken=input.checkout_token||
    (crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,""));
  const tokenHash=await hash(checkoutToken);
  const claim=await signLedger(env,"begin",{campaign_id:input.campaign_id,request_key:input.request_key,
    gift_cents:gift,optional_support_cents:tip,total_cents:total,
    payment_channel:channel,environment:"live",checkout_token_hash:tokenHash,
    donor_access_token:donorToken});
  // A completed bind is authoritative. Never create another PayPal order
  // after an HTTP timeout or retry with the same request key.
  if(claim.order_id){
    if(!ORDER_ID.test(claim.order_id)||!["created","approved","captured"].includes(claim.status))
      return asError("checkout_requires_reconciliation",409);
    return asJson({ok:true,id:claim.order_id,checkout_token:checkoutToken,
      amount_cents:total,gift_cents:gift,optional_support_cents:tip,currency:"USD",environment:"live"});
  }
  const customId=["ifund",input.campaign_id,gift,tip,channel].join("|");
  const order=await paypal(env,"/v2/checkout/orders","POST",{
    intent:"CAPTURE",
    purchase_units:[{reference_id:input.campaign_id,custom_id:customId,
      description:"Interplanetary Fund · campaign donation",
      ...paypalOrderBreakdown(gift,tip)}],
  },input.request_key);
  if(!ORDER_ID.test(order.id||""))return asError("invalid_provider_order",502);
  await signLedger(env,"bind",{request_key:input.request_key,paypal_order_id:order.id});
  return asJson({ok:true,id:order.id,checkout_token:checkoutToken,
    amount_cents:total,gift_cents:gift,optional_support_cents:tip,currency:"USD",environment:"live"});
}
async function captureOrder(req,env) {
  const p=await readBody(req);
  if(!ORDER_ID.test(p.order_id||"")||typeof p.checkout_token!=="string"
    ||p.checkout_token.length!==64)return asError("invalid_capture_request");
  const claim=await signLedger(env,"get",{paypal_order_id:p.order_id});
  const intent=claim.intent;
  if(intent.environment!=="live"||intent.checkout_token_hash!==await hash(p.checkout_token))
    return asError("checkout_not_authorized",403);
  if(!["created","approved","captured"].includes(intent.status))return asError("checkout_requires_reconciliation",409);
  if(intent.status==="captured")return asJson(await finalize(env,p.order_id,intent));
  try { await paypal(env,"/v2/checkout/orders/"+encodeURIComponent(p.order_id)+"/capture","POST",{},("capture-"+p.order_id).slice(0,108)); }
  catch(error) {
    // An earlier capture may have succeeded despite a timeout; look up provider evidence.
    try {return asJson(await finalize(env,p.order_id,intent));}
    catch(_) {return asError("capture_unverified_check_paypal_before_retry",502);}
  }
  return asJson(await finalize(env,p.order_id,intent));
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get("origin")||"";
    const permitted=String(env.IFUND_ALLOWED_ORIGINS||"").split(",").map(x=>x.trim());
    const cors=permitted.includes(origin)?{"access-control-allow-origin":origin,"vary":"Origin",
      "access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type,Authorization"}:{};
    if(request.method==="OPTIONS")return new Response(null,{status:permitted.includes(origin)?204:403,headers:cors});
    const path=url.pathname;
    if(path==="/api/payments/health")return asJson({ok:true,service:"ifund-payments",enabled:env.IFUND_PAYMENTS_ENABLED==="true",
      mode:env.IFUND_PAYPAL_MODE||"unset",version:"verified-ledger-v1"},200,cors);
    if(path==="/api/payments/subscriptions/plans"&&request.method==="GET"){
      try{const response=asJson(await subscriptionPlans(env),200,cors);return response}
      catch(_){return asJson({ok:false,error:"subscription_status_unavailable"},503,cors)}
    }
    if(path==="/api/payments/subscriptions/status"&&request.method==="GET"){
      try{const response=await subscriptionStatus(request,env);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"subscription_status_unavailable"},503,cors)}
    }
    if(path==="/api/payments/subscriptions/start"&&request.method==="POST"){
      if(env.IFUND_PAYMENTS_ENABLED!=="true"||env.IFUND_PAYPAL_MODE!=="live")
        return asJson({ok:false,error:"payments_disabled"},503,cors);
      if(!permitted.includes(origin))return asJson({ok:false,error:"origin_not_allowed"},403,cors);
      try{const response=await startSubscription(request,env,origin);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"subscription_start_unavailable"},503,cors)}
    }
    if(path==="/api/payments/subscriptions/confirm"&&request.method==="POST"){
      try{const response=await confirmSubscription(request,env);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"subscription_confirmation_unavailable"},503,cors)}
    }
    if(path==="/api/payments/subscriptions/cancel"&&request.method==="POST"){
      try{const response=await cancelSubscription(request,env);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"subscription_cancellation_unavailable"},503,cors)}
    }
    if(path==="/api/payments/webhook"&&request.method==="POST") {
      try {return await webhook(request,env)}catch(_) {return asError("webhook_retry_required",503)}
    }
    if(path==="/api/payments/capture-order"&&request.method==="POST") {
      // Webhook verification stays available while payments are paused, but
      // a paused payment switch must never allow another provider capture.
      if(env.IFUND_PAYMENTS_ENABLED!=="true"||env.IFUND_PAYPAL_MODE!=="live")
        return asJson({ok:false,error:"payments_disabled"},503,cors);
      try {const response=await captureOrder(request,env);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"capture_failed_check_receipt_before_retry"},502,cors)}
    }
    if(env.IFUND_PAYMENTS_ENABLED!=="true"||env.IFUND_PAYPAL_MODE!=="live")
      return asJson({ok:false,error:"payments_disabled"},503,cors);
    if(path==="/api/payments/config"&&request.method==="GET"){
      try{return asJson({ok:true,client_id:await getSecret(env.PAYPAL_CLIENT_ID),environment:"live",currency:"USD"},200,cors)}
      catch(_){return asJson({ok:false,error:"paypal_config_unavailable"},503,cors)}
    }
    if(path==="/api/payments/create-order"&&request.method==="POST"){
      try{const response=await createOrder(request,env);for(const [k,v] of Object.entries(cors))response.headers.set(k,v);return response}
      catch(_){return asJson({ok:false,error:"checkout_start_unavailable"},503,cors)}
    }
    return asJson({ok:false,error:"not_found"},404,cors);
  },
};
