// Internal sandbox credential broker: no real funds and no public credential endpoint.
const allowed=/^(?:[a-z0-9-]+\.)?interplanetaryfund-migration\.pages\.dev$/;
const output=(d,s=200)=>Response.json(d,{status:s,headers:{"cache-control":"no-store"}});
const secret=async x=>typeof x?.get==="function"?await x.get():typeof x==="string"?x:"";
export default {async fetch(request,env){
 const u=new URL(request.url);
 if(!allowed.test(u.hostname)||u.protocol!=="https:"||
    request.method!=="POST"||request.headers.get("x-ifund-sandbox-internal")!=="1")
    return output({ok:false,error:"Sandbox internal service only"},403);
 if(u.pathname==="/internal/oauth"){
  const id=await secret(env.PAYPAL_CLIENT_ID),password=await secret(env.PAYPAL_CLIENT_SECRET);
  if(!id||!password)return output({ok:false,error:"Sandbox client binding unavailable"},503);
  try {
    const p=await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token",{method:"POST",
      headers:{"authorization":"Basic "+btoa(id+":"+password),"content-type":"application/x-www-form-urlencoded"},
      body:"grant_type=client_credentials"});
    if(!p.ok)return output({ok:false,error:"Sandbox OAuth rejected"},503);
    const data=await p.json();
    if(!data.access_token||data.token_type!=="Bearer")return output({ok:false,error:"Invalid sandbox token"},503);
    return output({ok:true,access_token:data.access_token});
  }catch{return output({ok:false,error:"Sandbox OAuth unavailable"},503);}
 }
 if(u.pathname==="/internal/migrate-webhook"){
  // A single, restricted change: move the existing sandbox demo webhook from an
  // immutable build URL to the stable branch alias. No arbitrary URL accepted.
  const id="51B35522F66392518";
  const old="https://f69605aa.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/webhook";
  const target="https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/api/paypal/sandbox/webhook";
  const client=await secret(env.PAYPAL_CLIENT_ID),password=await secret(env.PAYPAL_CLIENT_SECRET);
  if(!client||!password)return output({ok:false,error:"Sandbox credentials unavailable"},503);
  try{
   const auth=await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token",{
     method:"POST",headers:{"authorization":"Basic "+btoa(client+":"+password),
       "content-type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
   if(!auth.ok)return output({ok:false,error:"PayPal OAuth rejected"},503);
   const token=(await auth.json()).access_token;
   if(!token)return output({ok:false,error:"PayPal OAuth token unavailable"},503);
   const url="https://api-m.sandbox.paypal.com/v1/notifications/webhooks/"+id;
   const read=async()=>{const r=await fetch(url,{headers:{"authorization":"Bearer "+token}});
     if(!r.ok)throw Error("Unable to identify webhook");return r.json();};
   const prior=await read();
   if(prior?.id!==id)return output({ok:false,error:"Webhook ID mismatch"},409);
   if(prior.url!==target && prior.url!==old)return output({ok:false,error:"Unexpected existing callback; no changes made"},409);
   if(prior.url===old){
    const update=await fetch(url,{method:"PATCH",headers:{
      "authorization":"Bearer "+token,"content-type":"application/json"},
      body:JSON.stringify([{op:"replace",path:"/url",value:target}])});
    if(!update.ok)return output({ok:false,error:"PayPal refused callback update"},503);
   }
   const current=await read();
   if(current?.id!==id||current?.url!==target)return output({ok:false,error:"Updated callback not confirmed"},503);
   return output({ok:true,updated:true,callback_url:target});
  }catch{return output({ok:false,error:"Sandbox callback update unavailable"},503);}
 }
 if(u.pathname==="/internal/storage"){
  let raw;
  try{raw=await request.text();if(raw.length>8192)throw Error("oversized");}catch{return output({ok:false,error:"Invalid request"},413);}
  const signing=await secret(env.IFUND_PAYMENTS_EDGE_SIGNING_PRIVATE_JWK);
  if(!signing)return output({ok:false,error:"Missing sandbox signing key"},503);
  try{
   const key=await crypto.subtle.importKey("jwk",JSON.parse(signing),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
   const time=String(Math.floor(Date.now()/1000));
   const bytes=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(time+"\n"+raw));
   const sig=btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
   const res=await fetch("https://ssibsfmtodgximseeqsv.supabase.co/functions/v1/ifund-sandbox-receipts",{
     method:"POST",headers:{"content-type":"application/json","x-ifund-timestamp":time,"x-ifund-signature":sig},body:raw});
   return new Response(await res.text(),{status:res.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return output({ok:false,error:"Sandbox signed storage unavailable"},503);}
 }
 return output({ok:false,error:"Unknown internal operation"},404);
}};