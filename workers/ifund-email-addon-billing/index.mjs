// PayPal Subscriptions v1 adapter for the separate $1 Basic campaign-email add-on.
// Zero live charges until the plan registry, webhook, checkout flag and member
// payment approval are provider-verified. External execution is intentionally
// narrower than the general iFund Payments Worker.
const PAYPAL="https://api-m.paypal.com";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAN=/^P-[A-Z0-9]{20,32}$/;
const SUB=/^I-[A-Z0-9]{10,30}$/;
const json=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const error=(message,status=503)=>json({ok:false,error:message},status);
async function secret(binding){
 if(typeof binding==="string")return binding;
 return typeof binding?.get==="function"?await binding.get():"";
}
function config(env){
 return typeof env.IFUND_SUPABASE_URL==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.IFUND_SUPABASE_URL)&&
 typeof env.SUPABASE_PUBLISHABLE_KEY==="string"&&env.SUPABASE_PUBLISHABLE_KEY.length>=10;
}
async function member(request,env,fetcher=fetch){
 if(!config(env))throw Object.assign(Error("member_service_unavailable"),{status:503});
 const token=(request.headers.get("authorization")||"").match(/^Bearer ([A-Za-z0-9._-]{40,8192})$/)?.[1];
 if(!token)throw Object.assign(Error("verified_member_required"),{status:401});
 const auth=await fetcher(env.IFUND_SUPABASE_URL+"/auth/v1/user",{headers:{
  "apikey":env.SUPABASE_PUBLISHABLE_KEY,authorization:"Bearer "+token},cache:"no-store"});
 if(!auth.ok)throw Object.assign(Error("verified_member_required"),{status:401});
 const user=await auth.json();
 if(!UUID.test(user?.id||"")||!user.email_confirmed_at||user.is_anonymous===true)
  throw Object.assign(Error("verified_member_required"),{status:401});
 return {token,user};
}
async function rpc(env,token,name,data={},fetcher=fetch){
 const res=await fetcher(env.IFUND_SUPABASE_URL+"/rest/v1/rpc/"+name,{
  method:"POST",headers:{"apikey":env.SUPABASE_PUBLISHABLE_KEY,
    authorization:"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify(data),cache:"no-store"});
 if(!res.ok)throw Object.assign(Error("member_billing_unavailable"),{status:res.status===401||res.status===403?403:503});
 return await res.json();
}
function exactPlan(value){
 const cycles=value?.billing_cycles;
 if(!PLAN.test(value?.id||"")||value.status!=="ACTIVE"||
    typeof value.product_id!=="string"||!Array.isArray(cycles)||cycles.length!==1)return false;
 const cycle=cycles[0],price=cycle?.pricing_scheme?.fixed_price;
 const setup=value.payment_preferences?.setup_fee;
 return cycle?.tenure_type==="REGULAR"&&
    cycle?.frequency?.interval_unit==="MONTH"&&
    cycle?.frequency?.interval_count===1&&
    cycle.total_cycles===0&&
    price?.currency_code==="USD"&&price?.value==="1.00"&&
    (!setup||(setup.currency_code==="USD"&&setup.value==="0.00"));
}
export {exactPlan};
async function accessToken(env,fetcher=fetch){
 const [id,key]=await Promise.all([secret(env.PAYPAL_CLIENT_ID),secret(env.PAYPAL_CLIENT_SECRET)]);
 if(!id||!key)throw Error("paypal_credentials_not_configured");
 const res=await fetcher(PAYPAL+"/v1/oauth2/token",{
  method:"POST",headers:{"authorization":"Basic "+btoa(id+":"+key),
    "content-type":"application/x-www-form-urlencoded"},
  body:"grant_type=client_credentials",cache:"no-store"});
 if(!res.ok)throw Error("paypal_auth_unavailable");
 const data=await res.json();
 if(!data.access_token)throw Error("paypal_auth_unavailable");
 return data.access_token;
}
async function paypal(env,path,method="GET",body,requestId,fetcher=fetch){
 const token=await accessToken(env,fetcher);
 const headers={"authorization":"Bearer "+token,"content-type":"application/json"};
 if(requestId)headers["PayPal-Request-Id"]=requestId;
 const res=await fetcher(PAYPAL+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
 if(!res.ok)throw Error("paypal_provider_unavailable");
 return await res.json();
}
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)))
 .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function signedLedger(env,op,data,fetcher=fetch){
 const jwk=await secret(env.IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK);
 if(!jwk||!config(env))throw Error("trusted_ledger_unavailable");
 const key=await crypto.subtle.importKey("jwk",JSON.parse(jwk),
  {name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 const body=JSON.stringify({op,data});
 const stamp=String(Math.floor(Date.now()/1000));
 const sig=b64(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},
    key,new TextEncoder().encode(stamp+"\n"+body)));
 const res=await fetcher(env.IFUND_SUPABASE_URL+"/functions/v1/ifund-email-addon-ledger",{
  method:"POST",headers:{"content-type":"application/json",
    "x-ifund-timestamp":stamp,"x-ifund-signature":sig},
  body,cache:"no-store"});
 const reply=await res.json().catch(()=>null);
 if(!res.ok||reply?.ok!==true)throw Error("provider_binding_rejected");
 return reply.result;
}
async function status(request,env){
 const user=await member(request,env);
 const readiness=await rpc(env,user.token,"ifund_campaign_email_checkout_readiness");
 if(!readiness||typeof readiness.checkout_ready!=="boolean"||
    readiness.monthly_amount_cents!==100||readiness.currency!=="USD")
   throw Error("provider_plan_unavailable");
 const enabled=env.IFUND_EMAIL_ADDON_CHECKOUT_ENABLED==="enabled"&&
   PLAN.test(env.IFUND_EMAIL_ADDON_PLAN_ID||"")&&
   env.IFUND_PAYPAL_MODE==="live";
 return json({ok:true,monthly_amount_cents:100,currency:"USD",interval:"monthly",
  checkout_ready:enabled&&readiness.checkout_ready===true,
  provider:"paypal",activation_requires_completed_sale:true});
}
async function start(request,env){
 const {token}=await member(request,env);
 if(env.IFUND_EMAIL_ADDON_CHECKOUT_ENABLED!=="enabled"||
   env.IFUND_PAYPAL_MODE!=="live"||!PLAN.test(env.IFUND_EMAIL_ADDON_PLAN_ID||""))
  return error("recurring_email_checkout_not_available");
 const readiness=await rpc(env,token,"ifund_campaign_email_checkout_readiness");
 if(readiness?.checkout_ready!==true||readiness?.monthly_amount_cents!==100)
  return error("recurring_email_checkout_not_available");
 const raw=await request.text();
 if(raw.length>500)return error("invalid_checkout_request",400);
 let body;try{body=JSON.parse(raw)}catch{return error("invalid_checkout_request",400)}
 if(!body||Object.keys(body).length!==1||!UUID.test(body.request_id||""))
  return error("invalid_checkout_request",400);
 const plan=await paypal(env,"/v1/billing/plans/"+env.IFUND_EMAIL_ADDON_PLAN_ID);
 if(!exactPlan(plan)||plan.id!==env.IFUND_EMAIL_ADDON_PLAN_ID)
  return error("paypal_email_plan_not_verified");
 const intent=await rpc(env,token,"ifund_begin_campaign_email_checkout",{
  p_request_id:body.request_id});
 if(intent?.intent_id!==body.request_id||
   intent?.plan_id!==env.IFUND_EMAIL_ADDON_PLAN_ID||
   intent?.amount_cents!==100||
   intent?.status!=="requested"||
   typeof intent?.custom_id!=="string")
   return error("checkout_intent_not_verified");
 let subscriptionId=null;
 try{
   const subscription=await paypal(env,"/v1/billing/subscriptions","POST",{
    plan_id:intent.plan_id,custom_id:intent.custom_id,
    application_context:{brand_name:"Interplanetary Fund",user_action:"SUBSCRIBE_NOW",
      return_url:"https://interplanetaryfund.com/subscriptions?email_addon_checkout=return",
      cancel_url:"https://interplanetaryfund.com/subscriptions?email_addon_checkout=cancel"}
   },body.request_id);
   const approval=subscription?.links?.find(x=>x?.rel==="approve")?.href;
   subscriptionId=subscription?.id;
   if(!SUB.test(subscriptionId||"")||typeof approval!=="string")
     throw Error("paypal_approval_unavailable");
   const url=new URL(approval);
   if(url.protocol!=="https:"||
     !["www.paypal.com","paypal.com"].includes(url.hostname))
     throw Error("paypal_approval_unavailable");
   const bound=await signedLedger(env,"intent_bind",{
     p_intent_id:intent.intent_id,p_subscription_id:subscriptionId,
     p_plan_id:intent.plan_id,p_custom_id:intent.custom_id});
   if(bound!==true)throw Error("provider_binding_unverified");
   return json({ok:true,approval_url:approval,subscription_id:subscriptionId,
      addon_active:false,monthly_amount_cents:100});
 }catch{
   if(SUB.test(subscriptionId||"")){
     try{await paypal(env,"/v1/billing/subscriptions/"+subscriptionId+"/cancel",
       "POST",{reason:"Failed merchant subscription record verification"});}
     catch{/* Payment audit must reconcile orphaned provider intent manually. */}
   }
   return error("checkout_not_confirmed");
 }
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==="/api/payments/email-addon/status"&&request.method==="GET"){
    try{return await status(request,env)}
    catch(e){return error(e?.message||"billing_unavailable",e?.status||503)}
  }
  if(path==="/api/payments/email-addon/start"&&request.method==="POST"){
    try{return await start(request,env)}
    catch(e){return error(e?.message||"billing_unavailable",e?.status||503)}
  }
  return error("not_found",404);
 }
};
