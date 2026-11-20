// Server-to-server, provider-evidence-only transport. This endpoint cannot
// bill a customer, send email, or activate a mailbox. The PayPal Worker
// supplies verified provider evidence signed by the existing iFund ledger key.
const PUBLIC_JWK={"kty":"EC","crv":"P-256","x":"higwnBNoUX4hoTHyvctc85RbeUH1vuvd0xwikU-4s9M","y":"YMrYjF3lZDSfkTRhTNt7jtgrqTrY1-r3zdBECcAe13w","ext":true,"key_ops":["verify"]};
const URL_BASE=Deno.env.get("SUPABASE_URL")||"";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function serviceKey(){
 const existing=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(existing)return existing;
 try{
  const parsed=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;
  return typeof parsed==="string"?parsed:(parsed?.key||parsed?.secret||"");
 }catch{return "";}
}
function base64urlBytes(value:string){
 if(!/^[A-Za-z0-9_-]{70,100}$/.test(value))throw Error("Invalid signature");
 return Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4)),ch=>ch.charCodeAt(0));
}
async function providerRequest(req:Request){
 const timestamp=req.headers.get("x-ifund-timestamp")||"";
 const signature=req.headers.get("x-ifund-signature")||"";
 if(!/^\d{10}$/.test(timestamp)||Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>120)
  throw Error("Invalid provider timestamp");
 const body=await req.text();
 if(body.length>24000||!body)throw Error("Invalid body size");
 const key=await crypto.subtle.importKey("jwk",PUBLIC_JWK,
  {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
 const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},
  key,base64urlBytes(signature),new TextEncoder().encode(timestamp+"\n"+body));
 if(!valid)throw Error("Invalid provider signature");
 const parsed=JSON.parse(body);
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||
   !["plan_register","intent_bind","event_stage","plan_identity","event_reconcile"].includes(parsed.op)||
   !parsed.data||typeof parsed.data!=="object"||Array.isArray(parsed.data))
   throw Error("Unsupported operation");
 return parsed as {op:string,data:Record<string,unknown>};
}
async function rpc(name:string,body:Record<string,unknown>){
 const key=serviceKey();if(!key||!URL_BASE)throw Error("Service credentials unavailable");
 const headers:Record<string,string>={
  "apikey":key,"content-type":"application/json",
  "prefer":"return=representation"
 };
 if(key.startsWith("eyJ"))headers.authorization="Bearer "+key;
 const response=await fetch(URL_BASE+"/rest/v1/rpc/"+name,{
  method:"POST",headers,body:JSON.stringify(body),cache:"no-store"
 });
 if(!response.ok)throw Error("Provider evidence rejected");
 return await response.json();
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return Response.json({ok:false,error:"method_not_allowed"},{status:405});
 try{
  const {op,data}=await providerRequest(req);
  let result:unknown;
  if(op==="plan_register"){
   if(typeof data.p_plan_id!=="string"||typeof data.p_product_id!=="string"||
      typeof data.p_merchant_id!=="string"||typeof data.p_verified_at!=="string"||
      typeof data.p_webhook_verified_at!=="string")throw Error("Invalid plan registration");
   result=await rpc("ifund_register_campaign_email_verified_plan",data);
  }else if(op==="intent_bind"){
   if(!UUID.test(String(data.p_intent_id||""))||
     typeof data.p_subscription_id!=="string"||
     typeof data.p_plan_id!=="string"||
     typeof data.p_custom_id!=="string")throw Error("Invalid PayPal checkout identity");
   result=await rpc("ifund_bind_campaign_email_provider_checkout",data);
  }else if(op==="event_stage"){
   if(!data.p_event||typeof data.p_event!=="object")throw Error("Invalid PayPal evidence");
   result=await rpc("ifund_stage_campaign_email_provider_event",data);
  }else if(op==="plan_identity"){
   if(typeof data.p_plan_id!=="string"||!/^P-[A-Z0-9]{20,32}$/.test(data.p_plan_id))
     throw Error("Invalid registered PayPal plan");
   result=await rpc("ifund_campaign_email_provider_plan_identity",data);
  }else if(op==="event_reconcile"){
   if(typeof data.p_event_id!=="string"||
     !/^WH-[A-Z0-9-]{8,90}$/.test(data.p_event_id)||
     !(data.p_provider_paid_through===null||
        typeof data.p_provider_paid_through==="string"))
     throw Error("Invalid provider reconciliation");
   result=await rpc("ifund_reconcile_campaign_email_provider_event",data);
  }
  return Response.json({ok:true,result},{headers:{"cache-control":"no-store"}});
 }catch{
  // No provider details, secrets, email or account data are echoed.
  return Response.json({ok:false,error:"provider_evidence_unverified"},
   {status:401,headers:{"cache-control":"no-store"}});
 }
});
