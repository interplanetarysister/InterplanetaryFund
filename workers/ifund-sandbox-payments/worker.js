// Sandbox-only Cloudflare Worker; service-bound from Pages, no production payment ledger writes.
// PayPal credentials held in Cloudflare account Secrets Store, never passed to Pages/browser.
// Pure, dependency-free validation for the isolated PayPal sandbox gateway.
// Never writes to the real donation ledger or authorizes a withdrawal.
class SandboxVerificationError extends Error {
  constructor(message) { super(message); this.name = "SandboxVerificationError"; }
}
const required = ["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET","PAYPAL_WEBHOOK_ID","SUPABASE_URL","SUPABASE_SECRET_KEY"];
const validId = value => typeof value === "string" && /^[A-Za-z0-9-]{8,128}$/.test(value);
const expectedAmount = cents => {
  if (!Number.isSafeInteger(cents) || cents < 100 || cents > 10000) throw new SandboxVerificationError("Invalid sandbox amount");
  return (cents / 100).toFixed(2);
};
function sandboxConfigured(env) {
  return env?.IFUND_PAYPAL_SANDBOX_ENABLED === "enabled" &&
    required.every(name => typeof env[name] === "string" && env[name].trim().length > 0) &&
    (() => { try { const u = new URL(env.SUPABASE_URL); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } })();
}
// The provider must confirm the registered webhook, its exact sandbox endpoint,
// and the event subscription. A configured ID alone is not readiness evidence.
function isRegisteredSandboxWebhook(webhook, id, expectedOrigin) {
  if (!validId(id) || webhook?.id !== id || typeof webhook?.url !== "string") return false;
  let endpoint;
  try { endpoint = new URL(webhook.url); } catch { return false; }
  if (typeof expectedOrigin !== "string" || endpoint.origin !== expectedOrigin) return false;
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.port || endpoint.search || endpoint.hash ||
      endpoint.pathname !== "/api/paypal/sandbox/webhook" ||
      !/^(?:[a-z0-9-]+\.)?interplanetaryfund-migration\.pages\.dev$/.test(endpoint.hostname)) return false;
  const names = Array.isArray(webhook.event_types) ? webhook.event_types.map(x => x?.name) : [];
  return names.includes("PAYMENT.CAPTURE.COMPLETED") || names.includes("*");
}

function confirmCapturedOrder(order, record) {
  if (!validId(record?.paypal_order_id) || order?.id !== record.paypal_order_id || order?.status !== "COMPLETED") {
    throw new SandboxVerificationError("Unconfirmed PayPal order");
  }
  const units = order.purchase_units;
  if (!Array.isArray(units) || units.length !== 1 || units[0]?.custom_id !== record.campaign_id) {
    throw new SandboxVerificationError("Order campaign mismatch");
  }
  const captures = units[0]?.payments?.captures;
  if (!Array.isArray(captures) || captures.length !== 1) {
    throw new SandboxVerificationError("Unexpected capture count");
  }
  const capture = captures[0];
  if (!validId(capture?.id) || capture.status !== "COMPLETED" ||
      capture.amount?.currency_code !== "USD" || capture.amount?.value !== expectedAmount(record.gift_cents) ||
      units[0]?.amount?.currency_code !== "USD" || units[0]?.amount?.value !== expectedAmount(record.gift_cents)) {
    throw new SandboxVerificationError("Capture amount or status mismatch");
  }
  return Object.freeze({ orderId: order.id, captureId: capture.id, amountCents: record.gift_cents });
}
function confirmedWebhookResource(event, orderRecord) {
  if (!validId(event?.id) || !orderRecord?.paypal_order_id) throw new SandboxVerificationError("Invalid webhook event");
  const type = event.event_type, resource = event.resource;
  // Refunds require a separate provider GET of the refund and original capture.
  // Do not infer financial transitions from webhook links or untrusted payloads.
  if (type !== "PAYMENT.CAPTURE.COMPLETED") throw new SandboxVerificationError("Unsupported webhook event");
  if (!validId(resource?.id) || resource.id !== orderRecord.paypal_capture_id) {
    throw new SandboxVerificationError("Unassociated capture event");
  }
  if (resource.amount?.currency_code !== "USD" || resource.amount?.value !== expectedAmount(orderRecord.gift_cents)) {
    throw new SandboxVerificationError("Webhook capture amount mismatch");
  }
  return { type, eventId: event.id, captureId: resource.id, status: "verified" };
}

const cookieName = orderId => {
  if (!validId(orderId)) throw new SandboxVerificationError("Invalid order ID");
  return "ifund_sandbox_" + orderId;
};
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function checkoutTokenHash(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new SandboxVerificationError("Invalid checkout token");
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))));
}
async function issueCheckoutBinding(orderId) {
  const name=cookieName(orderId);
  const token=toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hash=await checkoutTokenHash(token);
  return {
    checkoutTokenHash:hash,
    setCookie:`${name}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/paypal/sandbox; Max-Age=3600`
  };
}
async function requireCheckoutSession(request, orderRecord) {
  if (request.method !== "POST" || new URL(request.url).protocol !== "https:" ||
      request.headers.get("origin") !== new URL(request.url).origin)
    throw new SandboxVerificationError("Invalid checkout request origin");
  const name=cookieName(orderRecord?.paypal_order_id);
  const token=(request.headers.get("cookie")||"").split(";").map(c=>c.trim())
    .find(c=>c.startsWith(name+"="))?.slice(name.length+1);
  if (!token || !/^[a-f0-9]{64}$/.test(orderRecord?.checkout_token_hash||""))
    throw new SandboxVerificationError("Checkout session missing");
  const presented=await checkoutTokenHash(token);
  const expected=orderRecord.checkout_token_hash;
  let difference=0;
  for(let i=0;i<64;i++) difference |= presented.charCodeAt(i)^expected.charCodeAt(i);
  if(difference!==0) throw new SandboxVerificationError("Checkout session mismatch");
  return true;
}
function atomicCaptureUpdateFilter(record) {
  if (!validId(record?.paypal_order_id) || !/^[a-f0-9]{64}$/.test(record.checkout_token_hash||""))
    throw new SandboxVerificationError("Unbound capture attempt");
  return "?paypal_order_id=eq."+encodeURIComponent(record.paypal_order_id)+
    "&checkout_token_hash=eq."+record.checkout_token_hash+
    "&status=eq.created&paypal_capture_id=is.null";
}
function associatedCaptureWebhook(event, orderRecord) {
  if(event?.event_type!=="PAYMENT.CAPTURE.COMPLETED" ||
     event?.resource?.supplementary_data?.related_ids?.order_id!==orderRecord?.paypal_order_id)
    throw new SandboxVerificationError("Webhook order association missing");
  if (event.resource.amount?.currency_code!=="USD" ||
      event.resource.amount?.value!==expectedAmount(orderRecord.gift_cents) ||
      !validId(event.resource.id))
    throw new SandboxVerificationError("Webhook capture mismatch");
  return {orderId:orderRecord.paypal_order_id,captureId:event.resource.id};
}

async function getSecret(binding){if(typeof binding==="string")return binding;return typeof binding?.get==="function"?await binding.get():"";}

// PayPal AI Hackathon sandbox-only gateway. Never touches real donations or withdrawals.

const OUT="https://api-m.sandbox.paypal.com";
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",...extra}
});
const fail=(message,status=400)=>json({ok:false,error:message},status);
const validId=s=>typeof s==="string" && /^[A-Za-z0-9-]{8,128}$/.test(s);
const money=n=>(n/100).toFixed(2);
const sandboxHost=request=>{
  const u=new URL(request.url);
  return u.protocol==="https:" && /^(?:[a-z0-9-]+\.)?interplanetaryfund-migration\.pages\.dev$/.test(u.hostname);
};
const browserPost=request=>sandboxHost(request) &&
  request.method==="POST" && request.headers.get("origin")===new URL(request.url).origin;

async function bodyJson(request,max=32768){
  const type=request.headers.get("content-type")||"";
  if(!/^application\/json(?:\s*;|\s*$)/i.test(type)) throw Error("Invalid JSON content type");
  const length=request.headers.get("content-length");
  if(length!==null && (!/^\d+$/.test(length)||Number(length)>max)) throw Error("Invalid request length");
  const reader=request.body?.getReader();
  if(!reader)throw Error("Empty request");
  const chunks=[];let size=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error("Invalid input stream");
      size+=value.byteLength;
      if(size>max)throw Error("Request too large");
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  } finally {try{await reader.cancel()}catch{};try{reader.releaseLock()}catch{}}
}
async function rest(env,table,method,query="",payload){
 if(!["ifund_campaigns","ifund_paypal_sandbox_orders","ifund_paypal_sandbox_events"].includes(table))throw Error("Unsafe sandbox table");
 const body=JSON.stringify({table,method,query,payload});
 const time=String(Math.floor(Date.now()/1000));
 const jwk=await getSecret(env.IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK);
 if(!jwk)throw Error("Sandbox signing unavailable");
 const key=await crypto.subtle.importKey("jwk",JSON.parse(jwk),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 const signed=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(time+"\n"+body));
 const sig=btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 const response=await fetch(env.SUPABASE_URL+"/functions/v1/ifund-sandbox-receipts",{method:"POST",
 headers:{"content-type":"application/json","x-ifund-timestamp":time,"x-ifund-signature":sig},body});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data?.ok||!Array.isArray(data.rows))throw Error("Sandbox database write/read not confirmed");
 return data.rows;
}
async function oauth(env){
  const response=await fetch(OUT+"/v1/oauth2/token",{
    method:"POST",
    headers:{"authorization":"Basic "+btoa(env.PAYPAL_CLIENT_ID+":"+env.PAYPAL_CLIENT_SECRET),
      "content-type":"application/x-www-form-urlencoded"},
    body:"grant_type=client_credentials"
  });
  if(!response.ok)throw Error("Sandbox OAuth failed");
  const data=await response.json();
  if(!data.access_token||data.token_type!=="Bearer")throw Error("Invalid sandbox OAuth response");
  return data.access_token;
}
async function paypal(access,method,path,payload,requestId){
  if(!path.startsWith("/")||path.includes("//"))throw Error("Invalid provider path");
  const response=await fetch(OUT+path,{
    method,headers:{"authorization":"Bearer "+access,"content-type":"application/json",
      ...(requestId?{"PayPal-Request-Id":requestId}:{})},
    ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result)throw Error("Provider request not confirmed");
  return result;
}
async function registeredWebhook(env,request,access){
  const result=await paypal(access,"GET",
    "/v1/notifications/webhooks/"+encodeURIComponent(env.PAYPAL_WEBHOOK_ID));
  return isRegisteredSandboxWebhook(result,env.PAYPAL_WEBHOOK_ID,new URL(request.url).origin);
}
async function status(env,request){
  const notReady={mode:"sandbox",enabled:false,webhook_ready:false,
    database_ready:false,live_payments_enabled:false};
  if(!sandboxHost(request)||!sandboxConfigured(env))return json(notReady);
  let verified=false;
  try{
    const access=await oauth(env);
    verified=await registeredWebhook(env,request,access);
  }catch{return json(notReady)}
  if(!verified)return json(notReady);
  try{
    // Confirm the service-only sandbox receipt table can actually be read.
    // A configured key or registered webhook alone is not proof of readiness.
    await rest(env,"ifund_paypal_sandbox_orders","GET","?select=paypal_order_id&limit=1");
    return json({...notReady,enabled:true,webhook_ready:true,database_ready:true});
  }catch{return json({...notReady,webhook_ready:true})}
}
async function orders(env,request){
  if(!browserPost(request))return fail("Sandbox checkout requires a same-origin preview browser",403);
  const input=await bodyJson(request);
  const campaignId=input?.campaign_id;
  if(typeof campaignId!=="string"||!/^[a-f0-9-]{36}$/i.test(campaignId))return fail("Invalid campaign");
  const cents=input?.amount_cents;
  if(!Number.isSafeInteger(cents)||cents<100||cents>10000)return fail("Demo amount must be $1 to $100");
  const campaign=await rest(env,"ifund_campaigns","GET",
    "?select=id,status&id=eq."+encodeURIComponent(campaignId)+"&limit=1");
  if(campaign.length!==1||campaign[0].status!=="active")return fail("Campaign not accepting demo payments",409);
  const access=await oauth(env);
  if(!await registeredWebhook(env,request,access))
    return fail("Sandbox webhook registration not verified",503);
  const origin=new URL(request.url).origin;
  const order=await paypal(access,"POST","/v2/checkout/orders",{
    intent:"CAPTURE",purchase_units:[{reference_id:"ifund-hackathon",
      custom_id:campaignId,description:"IFund SANDBOX demo (no real funds)",
      amount:{currency_code:"USD",value:money(cents)}}],
    application_context:{brand_name:"Interplanetary Fund Demo",user_action:"PAY_NOW",
      return_url:origin+"/hackathon?paypal=approved",
      cancel_url:origin+"/hackathon?paypal=cancelled"}
  },"ifund-demo-create-"+crypto.randomUUID());
  if(!validId(order?.id)||order.status!=="CREATED")throw Error("Order creation not confirmed");
  const approval=(order.links||[]).find(l=>{
    if(l.rel!=="approve"||typeof l.href!=="string")return false;
    try {const u=new URL(l.href);
      return u.protocol==="https:" && ["sandbox.paypal.com","www.sandbox.paypal.com"].includes(u.hostname);
    }catch{return false}
  });
  if(!approval)throw Error("PayPal approval URL missing");
  const binding=await issueCheckoutBinding(order.id);
  const stored=await rest(env,"ifund_paypal_sandbox_orders","POST","",{
    paypal_order_id:order.id,campaign_id:campaignId,gift_cents:cents,
    currency:"USD",status:"created",checkout_token_hash:binding.checkoutTokenHash});
  if(stored.length!==1||stored[0].paypal_order_id!==order.id)
    throw Error("Sandbox order was not persisted");
  return json({ok:true,mode:"sandbox",order_id:order.id,approval_url:approval.href,
    note:"No real money. Does not affect donation totals or payouts."},200,{"set-cookie":binding.setCookie});
}
async function orderRecord(env,id){
  const r=await rest(env,"ifund_paypal_sandbox_orders","GET",
    "?select=paypal_order_id,campaign_id,gift_cents,status,paypal_capture_id,checkout_token_hash"+
    "&paypal_order_id=eq."+encodeURIComponent(id)+"&limit=1");
  return r.length===1?r[0]:null;
}
async function saveCapture(env,record,captureId){
  if(record.status==="captured" && record.paypal_capture_id===captureId)return true;
  if(record.status!=="created")throw Error("Unexpected receipt state");
  const update=await rest(env,"ifund_paypal_sandbox_orders","PATCH",
    atomicCaptureUpdateFilter(record),{
      status:"captured",paypal_capture_id:captureId,captured_at:new Date().toISOString()
    });
  if(update.length===1 && update[0].status==="captured" &&
      update[0].paypal_capture_id===captureId)return true;
  const current=await orderRecord(env,record.paypal_order_id);
  if(current?.status==="captured" && current.paypal_capture_id===captureId)return true;
  throw Error("Atomic receipt transition not confirmed");
}
async function capture(env,request){
  if(!browserPost(request))return fail("Sandbox checkout requires a same-origin preview browser",403);
  const input=await bodyJson(request);
  if(!validId(input?.order_id))return fail("Invalid order",400);
  const record=await orderRecord(env,input.order_id);
  if(!record)return fail("Sandbox order not found",404);
  await requireCheckoutSession(request,record);
  const access=await oauth(env);
  const path="/v2/checkout/orders/"+encodeURIComponent(input.order_id);
  let order=await paypal(access,"GET",path);
  if(order.status==="APPROVED"){
    try {
      await paypal(access,"POST",path+"/capture",{},
        "ifund-demo-capture-"+input.order_id);
    }catch{
      // A concurrent or retried capture can fail. Reconcile ONLY against PayPal.
    }
    order=await paypal(access,"GET",path);
  }
  const proof=confirmCapturedOrder(order,record);
  await saveCapture(env,record,proof.captureId);
  return json({ok:true,mode:"sandbox",order_id:proof.orderId,
    capture_id:proof.captureId,amount_cents:proof.amountCents,
    status:"captured",note:"Sandbox receipt only. No real campaign funds or withdrawals."});
}
async function readWebhookBody(request) {
  const max=65536;
  const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(type!=="application/json")throw Error("Unsupported webhook media type");
  const length=request.headers.get("content-length");
  if(length!==null && (!/^[0-9]+$/.test(length)||Number(length)>max))
    throw Error("Oversized webhook body");
  const reader=request.body?.getReader();
  if(!reader)throw Error("Missing webhook body");
  let size=0;const chunks=[];
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error("Invalid webhook stream");
      size+=value.byteLength;
      if(size>max)throw Error("Oversized webhook body");
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let pos=0;
    for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
    return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  }finally{try{await reader.cancel()}catch{};try{reader.releaseLock()}catch{}}
}
async function webhook(env,request){
  let raw;
  try{raw=await readWebhookBody(request)}catch{return fail("Webhook body rejected",413)}
  let event;try{event=JSON.parse(raw)}catch{return fail("Invalid webhook JSON")}
  const h=request.headers;
  const required=["paypal-transmission-id","paypal-transmission-time",
    "paypal-cert-url","paypal-auth-algo","paypal-transmission-sig"];
  if(required.some(k=>!h.get(k)))return fail("Missing webhook signature headers",400);
  let certificate;
  try{certificate=new URL(h.get("paypal-cert-url"))}catch{return fail("Invalid certificate URL")}
  if(certificate.protocol!=="https:"||
     !["api-m.sandbox.paypal.com","api.sandbox.paypal.com"].includes(certificate.hostname))
    return fail("Invalid certificate host",400);
  const access=await oauth(env);
  const args={transmission_id:h.get("paypal-transmission-id"),
    transmission_time:h.get("paypal-transmission-time"),
    cert_url:certificate.href,auth_algo:h.get("paypal-auth-algo"),
    transmission_sig:h.get("paypal-transmission-sig"),
    webhook_id:env.PAYPAL_WEBHOOK_ID};
  // Include unmodified webhook JSON as delivered, not a rewritten event.
  const signatureBody=JSON.stringify(args).slice(0,-1)+',"webhook_event":'+raw+'}';
  const check=await fetch(OUT+"/v1/notifications/verify-webhook-signature",{
    method:"POST",headers:{"authorization":"Bearer "+access,
      "content-type":"application/json"},body:signatureBody});
  if(!check.ok)return fail("Webhook verification unavailable",503);
  const verified=await check.json();
  if(verified.verification_status!=="SUCCESS")return fail("Webhook signature rejected",401);
  if(!validId(event?.id)||event.event_type!=="PAYMENT.CAPTURE.COMPLETED")
    return fail("Webhook event type not accepted",422);
  const orderId=event.resource?.supplementary_data?.related_ids?.order_id;
  if(!validId(orderId))return fail("Webhook order reference absent",422);
  const record=await orderRecord(env,orderId);
  if(!record)return fail("Webhook order not associated",422);
  const linked=associatedCaptureWebhook(event,record);
  const official=await paypal(access,"GET","/v2/checkout/orders/"+encodeURIComponent(orderId));
  const proof=confirmCapturedOrder(official,record);
  if(proof.captureId!==linked.captureId)throw Error("Webhook does not match provider");
  await saveCapture(env,record,proof.captureId);
  const existing=await rest(env,"ifund_paypal_sandbox_events","GET",
    "?select=paypal_event_id&paypal_event_id=eq."+encodeURIComponent(event.id)+"&limit=1");
  if(!existing.length){
    try{
      await rest(env,"ifund_paypal_sandbox_events","POST","",{
        paypal_event_id:event.id,event_type:event.event_type,
        paypal_resource_id:linked.captureId,verified_at:new Date().toISOString()});
    }catch(e){
      const retry=await rest(env,"ifund_paypal_sandbox_events","GET",
        "?select=paypal_event_id&paypal_event_id=eq."+encodeURIComponent(event.id)+"&limit=1");
      if(retry.length!==1)throw e;
    }
  }
  return json({ok:true,mode:"sandbox",verified:true});
}
async function onRequest({request,env,params}){
  const route=Array.isArray(params.path)?params.path.join("/"):String(params.path||"");
  if(route==="status"&&request.method==="GET")
    return status(env,request);
  if(!["orders","capture","webhook"].includes(route))return fail("Route not found",404);
  if(request.method!=="POST")return fail("Method not allowed",405);
  if(!sandboxConfigured(env))return fail("PayPal sandbox is not configured",503);
  if(!sandboxHost(request))return fail("Invalid preview host",403);
  try{
    if(route==="orders")return await orders(env,request);
    if(route==="capture")return await capture(env,request);
    return await webhook(env,request);
  }catch{
    return fail("Sandbox operation could not be verified",502);
  }
}

export default {async fetch(request,env){
 // Direct workers.dev requests cannot impersonate the Pages request host.
 if(!new URL(request.url).hostname.endsWith(".interplanetaryfund-migration.pages.dev"))
   return new Response(JSON.stringify({ok:false,error:"Preview-only payment service"}),{status:403,headers:{"content-type":"application/json"}});
 const endpoint=new URL(request.url);
 const hit=endpoint.pathname.match(/^\/api\/paypal\/sandbox\/(status|orders|capture|webhook)$/);
 if(!hit)return new Response("Not found",{status:404});
 const safeEnv={
  ...env,IFUND_PAYPAL_SANDBOX_ENABLED:"enabled",
  PAYPAL_CLIENT_ID:await getSecret(env.PAYPAL_CLIENT_ID),
  PAYPAL_CLIENT_SECRET:await getSecret(env.PAYPAL_CLIENT_SECRET),
  // Authenticated signed Edge Function, not a raw Supabase service key in Pages.
  SUPABASE_SECRET_KEY:"authenticated-via-edge-signature"
 };
 return onRequest({request,env:safeEnv,params:{path:[hit[1]]}});
}};