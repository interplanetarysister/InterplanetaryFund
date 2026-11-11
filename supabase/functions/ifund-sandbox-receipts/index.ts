// Isolated sandbox receipt storage. Signed Worker-only API; NEVER touches live financial tables.
const PUBLIC_JWK={"kty":"EC","crv":"P-256","x":"higwnBNoUX4hoTHyvctc85RbeUH1vuvd0xwikU-4s9M","y":"YMrYjF3lZDSfkTRhTNt7jtgrqTrY1-r3zdBECcAe13w","ext":true,"key_ops":["verify"]};
const URL_BASE=Deno.env.get("SUPABASE_URL")||"";
const enc=new TextEncoder();
const fail=(error,status=400)=>Response.json({ok:false,error},{status,headers:{"cache-control":"no-store"}});
function key(){const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
try{const v=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default;return typeof v==="string"?v:(v?.key||v?.secret||"");}catch{return "";}}
function bytes64(s){const raw=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function auth(req){
const raw=await req.text();if(raw.length>16384)throw Error("Too large");
const time=req.headers.get("x-ifund-timestamp")||"",sig=req.headers.get("x-ifund-signature")||"";
const t=Number(time);if(!Number.isInteger(t)||Math.abs(Math.floor(Date.now()/1000)-t)>120||!sig)throw Error("Invalid timestamp");
const publicKey=await crypto.subtle.importKey("jwk",PUBLIC_JWK,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
if(!await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,bytes64(sig),enc.encode(time+"\n"+raw)))throw Error("Invalid signature");
return JSON.parse(raw);}
const TABLES=["ifund_campaigns","ifund_paypal_sandbox_orders","ifund_paypal_sandbox_events"];
const valid=(table,method,query,payload)=>{
if(!TABLES.includes(table)||!["GET","POST","PATCH"].includes(method))return false;
if(table==="ifund_campaigns"&&method!=="GET")return false;
if(table==="ifund_paypal_sandbox_events"&&method==="PATCH")return false;
if(method==="GET"){
if(!query.startsWith("?")||query.length>700||/[^A-Za-z0-9_?=.,%&-]/.test(query))return false;
const params=new URLSearchParams(query);if(!params.has("select")||!params.has("limit")||params.get("limit")!=="1")return false;
const fields=Object.keys(Object.fromEntries(params));const allow=table==="ifund_campaigns"?["select","id","limit"]:table==="ifund_paypal_sandbox_orders"?["select","paypal_order_id","limit"]:["select","paypal_event_id","limit"];
if(fields.some(x=>!allow.includes(x)))return false;
return true;
}
if(method==="POST"&&query!=="")return false;
if(method==="PATCH" && (table!=="ifund_paypal_sandbox_orders"||!query.startsWith("?paypal_order_id=eq.")||!query.includes("&status=eq.created&paypal_capture_id=is.null")))return false;
if(!payload||Array.isArray(payload)||typeof payload!=="object")return false;
const orderCols=["paypal_order_id","campaign_id","gift_cents","currency","status","checkout_token_hash","paypal_capture_id","captured_at"];
const eventCols=["paypal_event_id","event_type","paypal_resource_id","verified_at"];
const allow=table==="ifund_paypal_sandbox_orders"?orderCols:eventCols;
if(Object.keys(payload).some(x=>!allow.includes(x)))return false;
if(method==="PATCH"&&Object.keys(payload).some(x=>!["status","paypal_capture_id","captured_at"].includes(x)))return false;
return true;
};
Deno.serve(async req=>{
if(req.method!=="POST")return fail("Method not allowed",405);
let input;try{input=await auth(req)}catch{return fail("Unauthorized sandbox service",401);}
const {table,method,query="",payload}=input||{};
if(!valid(table,method,query,payload))return fail("Operation not allowed",403);
const k=key();if(!k||!URL_BASE)return fail("Sandbox database credentials unavailable",503);
try{
const h={"apikey":k,"content-type":"application/json","prefer":"return=representation"};
if(k.startsWith("eyJ"))h.authorization="Bearer "+k;
const res=await fetch(URL_BASE+"/rest/v1/"+table+query,{method,headers:h,body:payload===undefined?undefined:JSON.stringify(payload),cache:"no-store"});
if(!res.ok)return fail("Sandbox persistence unavailable",res.status===409?409:503);
if(res.status===204)return Response.json({ok:true,rows:[]});
const rows=await res.json();if(!Array.isArray(rows))return fail("Invalid database response",502);
return Response.json({ok:true,rows},{headers:{"cache-control":"no-store"}});
}catch{return fail("Sandbox storage unavailable",503);}
});
