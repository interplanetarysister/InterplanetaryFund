// Sandbox-only PayPal Orders v2 proof for the 2026 PayPal AI Hackathon.
// This cannot create live orders or write to the real IFund donation ledger.
// Release gate: IFUND_PAYPAL_SANDBOX_ENABLED=enabled plus matching sandbox secrets.
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "x-content-type-options":"nosniff"}
});
const fail = (message, status=400) => json({ok:false,error:message},status);
const centsString = n => (n/100).toFixed(2);
const configReady = env => env.IFUND_PAYPAL_SANDBOX_ENABLED === "enabled"
  && !!env.PAYPAL_CLIENT_ID && !!env.PAYPAL_CLIENT_SECRET
  && !!env.SUPABASE_URL && !!env.SUPABASE_SECRET_KEY;
const safeId = s => typeof s==="string" && /^[A-Za-z0-9-]{8,128}$/.test(s);
async function readJson(request) {
  if (Number(request.headers.get("content-length")||0)>32768) throw Error("Payload too large");
  const raw=await request.text();
  if(raw.length>32768) throw Error("Payload too large");
  return JSON.parse(raw);
}
async function db(env,table,method,filter="",body) {
  const url=env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+table+filter;
  const response=await fetch(url,{method,headers:{
    apikey:env.SUPABASE_SECRET_KEY,Authorization:"Bearer "+env.SUPABASE_SECRET_KEY,
    "content-type":"application/json",Prefer:"return=representation"
  },...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok) throw Error("Database operation not confirmed");
  return response.json();
}
async function token(env) {
  const response=await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token",{
    method:"POST",
    headers:{Authorization:"Basic "+btoa(env.PAYPAL_CLIENT_ID+":"+env.PAYPAL_CLIENT_SECRET),
      "content-type":"application/x-www-form-urlencoded"},
    body:"grant_type=client_credentials"
  });
  if(!response.ok)throw Error("PayPal sandbox authentication unavailable");
  const data=await response.json();
  if(!data.access_token)throw Error("PayPal sandbox authentication unavailable");
  return data.access_token;
}
async function paypal(env,accessToken,method,path,body,requestId) {
  const response=await fetch("https://api-m.sandbox.paypal.com"+path,{
    method,headers:{"authorization":"Bearer "+accessToken,
      "content-type":"application/json",
      ...(requestId?{"PayPal-Request-Id":requestId}:{} )},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok || !data)throw Error("PayPal sandbox request not confirmed");
  return data;
}
async function create(env,request) {
  const input=await readJson(request);
  if(!/^[a-f0-9-]{36}$/i.test(input?.campaign_id||""))return fail("Valid campaign required");
  const n=input?.amount_cents;
  if(!Number.isSafeInteger(n)||n<100||n>10000)return fail("Choose a demo amount from $1.00 to $100.00");
  const campaign=await db(env,"ifund_campaigns","GET","?select=id,status&id=eq."+encodeURIComponent(input.campaign_id)+"&limit=1");
  if(campaign.length!==1||campaign[0].status!=="active")return fail("Campaign not accepting demo payments",409);
  const access=await token(env);
  const order=await paypal(env,access,"POST","/v2/checkout/orders",{
    intent:"CAPTURE",purchase_units:[{reference_id:"ifund-hackathon",
      custom_id:input.campaign_id,description:"IFund sandbox demo (no real money)",
      amount:{currency_code:"USD",value:centsString(n)}}],
    application_context:{brand_name:"Interplanetary Fund Demo",user_action:"PAY_NOW"}
  },"ifund-demo-"+crypto.randomUUID());
  if(!safeId(order.id)||order.status!=="CREATED")throw Error("PayPal order was not confirmed");
  await db(env,"ifund_paypal_sandbox_orders","POST","",{
    paypal_order_id:order.id,campaign_id:input.campaign_id,gift_cents:n,
    currency:"USD",status:"created"
  });
  const approval=(order.links||[]).find(l=>l.rel==="approve"&&typeof l.href==="string"
    && /^https:\/\/(www\.)?sandbox\.paypal\.com\//.test(l.href));
  if(!approval)throw Error("PayPal approval link was not confirmed");
  return json({ok:true,mode:"sandbox",order_id:order.id,approval_url:approval.href,
    note:"Sandbox only: no real donation or withdrawable balance."});
}
function completedCapture(order,expected) {
  const unit=order?.purchase_units?.[0];
  const capture=unit?.payments?.captures?.find(c=>c.status==="COMPLETED");
  if(order?.status!=="COMPLETED"||!safeId(capture?.id))return null;
  if(unit.custom_id!==expected.campaign_id||capture.amount?.currency_code!=="USD"
     ||capture.amount?.value!==centsString(expected.gift_cents))throw Error("Payment does not match expected sandbox order");
  return capture;
}
async function capture(env,request) {
  const input=await readJson(request);
  if(!safeId(input?.order_id))return fail("Valid order required");
  const records=await db(env,"ifund_paypal_sandbox_orders","GET",
    "?select=paypal_order_id,campaign_id,gift_cents,status,paypal_capture_id&paypal_order_id=eq."+encodeURIComponent(input.order_id)+"&limit=1");
  if(records.length!==1)return fail("Order not found",404);
  const record=records[0],access=await token(env);
  let order=await paypal(env,access,"GET","/v2/checkout/orders/"+encodeURIComponent(input.order_id));
  if(order.status!=="COMPLETED") {
    // A repeated request uses a stable idempotency key to avoid double capture.
    await paypal(env,access,"POST","/v2/checkout/orders/"+encodeURIComponent(input.order_id)+"/capture",{}, "ifund-capture-"+input.order_id);
    order=await paypal(env,access,"GET","/v2/checkout/orders/"+encodeURIComponent(input.order_id));
  }
  const matched=completedCapture(order,record);
  if(!matched)return fail("Payment has not been confirmed by PayPal",409);
  if(record.status!=="captured") {
    const saved=await db(env,"ifund_paypal_sandbox_orders","PATCH",
      "?paypal_order_id=eq."+encodeURIComponent(input.order_id),
      {status:"captured",paypal_capture_id:matched.id,captured_at:new Date().toISOString()});
    if(saved.length!==1||saved[0].status!=="captured")throw Error("Sandbox receipt persistence not confirmed");
  }
  return json({ok:true,mode:"sandbox",status:"captured",order_id:input.order_id,
    capture_id:matched.id,amount_cents:record.gift_cents,
    note:"Sandbox receipt only. Real campaign totals and payouts are unchanged."});
}
async function webhook(env,request) {
  if(!env.PAYPAL_WEBHOOK_ID)return fail("PayPal webhook is not configured",503);
  const raw=await request.text();
  if(raw.length>65536)return fail("Payload too large",413);
  let event;try{event=JSON.parse(raw)}catch{return fail("Invalid JSON")}
  const h=request.headers,keys=["paypal-transmission-id","paypal-transmission-time",
    "paypal-cert-url","paypal-auth-algo","paypal-transmission-sig"];
  if(keys.some(k=>!h.get(k)))return fail("Missing verification headers",400);
  const cert=h.get("paypal-cert-url");
  if(!/^https:\/\/api-m\.sandbox\.paypal\.com\//.test(cert)
    && !/^https:\/\/api\.sandbox\.paypal\.com\//.test(cert))return fail("Invalid certificate URL",400);
  const access=await token(env);
  const checked=await paypal(env,access,"POST","/v1/notifications/verify-webhook-signature",{
    transmission_id:h.get("paypal-transmission-id"),
    transmission_time:h.get("paypal-transmission-time"),
    cert_url:cert,auth_algo:h.get("paypal-auth-algo"),
    transmission_sig:h.get("paypal-transmission-sig"),
    webhook_id:env.PAYPAL_WEBHOOK_ID,webhook_event:event
  });
  if(checked.verification_status!=="SUCCESS")return fail("Signature verification failed",401);
  if(!safeId(event?.id)||typeof event?.event_type!=="string")return fail("Invalid event");
  // Event receipts have a unique event ID. No ledger updates from untrusted notifications.
  const encoded=encodeURIComponent(event.id);
  const existing=await db(env,"ifund_paypal_sandbox_events","GET",
    "?select=paypal_event_id&paypal_event_id=eq."+encoded+"&limit=1");
  if(!existing.length) {
    try { await db(env,"ifund_paypal_sandbox_events","POST","",{
      paypal_event_id:event.id,event_type:event.event_type,
      paypal_resource_id:String(event.resource?.id||"").slice(0,128),
      verified_at:new Date().toISOString()
    }); } catch(e) {
      const duplicate=await db(env,"ifund_paypal_sandbox_events","GET",
        "?select=paypal_event_id&paypal_event_id=eq."+encoded+"&limit=1");
      if(!duplicate.length)throw e;
    }
  }
  return json({ok:true,verified:true,mode:"sandbox"});
}
export async function onRequest({request,env,params}) {
  const path=Array.isArray(params.path)?params.path.join("/"):String(params.path||"");
  if(path==="status"&&request.method==="GET")return json({
    mode:"sandbox",enabled:configReady(env),webhook_ready:configReady(env)&&!!env.PAYPAL_WEBHOOK_ID,
    live_payments_enabled:false});
  if(!["orders","capture","webhook"].includes(path))return fail("Route not found",404);
  if(request.method!=="POST")return fail("Method not allowed",405);
  if(!configReady(env))return fail("PayPal sandbox is not configured",503);
  try {
    if(path==="orders")return await create(env,request);
    if(path==="capture")return await capture(env,request);
    return await webhook(env,request);
  }catch(e){
    // Never return credentials, PayPal response bodies or DB errors to callers.
    return fail("Sandbox operation could not be verified; please retry or check status.",502);
  }
}
