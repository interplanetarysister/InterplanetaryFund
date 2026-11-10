// PayPal AI Hackathon sandbox-only gateway. Never touches real donations or withdrawals.
import {
  sandboxConfigured, issueCheckoutBinding, requireCheckoutSession,
  confirmCapturedOrder, atomicCaptureUpdateFilter, associatedCaptureWebhook
} from "../../../../../../worker/paypalSandboxSecurity.js";

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
  return u.protocol==="https:" && /^(?:[a-z0-9-]+\\.)?interplanetaryfund-migration\\.pages\\.dev$/.test(u.hostname);
};
const browserPost=request=>sandboxHost(request) &&
  request.method==="POST" && request.headers.get("origin")===new URL(request.url).origin;

async function bodyJson(request,max=32768){
  const type=request.headers.get("content-type")||"";
  if(!/^application\\/json(?:\\s*;|\\s*$)/i.test(type)) throw Error("Invalid JSON content type");
  const length=request.headers.get("content-length");
  if(length!==null && (!/^\\d+$/.test(length)||Number(length)>max)) throw Error("Invalid request length");
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
  if(!["ifund_campaigns","ifund_paypal_sandbox_orders","ifund_paypal_sandbox_events"].includes(table))
    throw Error("Unsafe table");
  const endpoint=new URL(env.SUPABASE_URL);
  if(endpoint.protocol!=="https:")throw Error("Unsafe database endpoint");
  const response=await fetch(endpoint.origin+"/rest/v1/"+table+query,{
    method,
    headers:{"apikey":env.SUPABASE_SECRET_KEY,
      "content-type":"application/json","prefer":"return=representation"},
    ...(payload===undefined?{}:{body:JSON.stringify(payload)})
  });
  if(!response.ok)throw Error("Sandbox database write/read not confirmed");
  if(response.status===204)return [];
  const result=await response.json();
  if(!Array.isArray(result))throw Error("Invalid database response");
  return result;
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
async function webhook(env,request){
  const raw=await request.text();
  if(raw.length>65536)return fail("Webhook too large",413);
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
export async function onRequest({request,env,params}){
  const route=Array.isArray(params.path)?params.path.join("/"):String(params.path||"");
  if(route==="status"&&request.method==="GET")
    return json({mode:"sandbox",enabled:sandboxConfigured(env),
      webhook_ready:sandboxConfigured(env),live_payments_enabled:false});
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
