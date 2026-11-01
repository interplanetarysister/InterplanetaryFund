// Standalone Cloudflare Worker for IFund administrator OAuth 2.0.
// Requires D1 binding OAUTH_DB and IFUND_ADMIN_VERIFY_URL. Disabled unless OAUTH_ENABLED=true.
const encoder=new TextEncoder();
const resp=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","pragma":"no-cache"}});
const rnd=(n=32)=>{const b=crypto.getRandomValues(new Uint8Array(n));return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")};
const sha=async(s)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const pkce=async(s)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const err=(code,status=400)=>resp({error:code},status);
const scopes=new Set(["campaigns:read"]);
const callback="https://www.integromat.com/oauth/cb/oauth2";
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const noStore={"cache-control":"no-store","content-security-policy":"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
async function admin(req,env){
 if(env.IFUND_OAUTH_ADMIN_BRIDGE_SECRET && req.headers.get("x-ifund-oauth-admin-bridge")===env.IFUND_OAUTH_ADMIN_BRIDGE_SECRET)return true;
 const auth=req.headers.get("authorization"),cookie=req.headers.get("cookie");
 if(!env.IFUND_ADMIN_VERIFY_URL || (!auth&&!cookie))return false;
 const uri=new URL(env.IFUND_ADMIN_VERIFY_URL);
 if(uri.protocol!=="https:")return false;
 const r=await fetch(uri.toString(),{headers:{...(auth?{authorization:auth}:{}),...(cookie?{cookie}:{})},redirect:"manual"});
 if(!r.ok)return false;const p=await r.json().catch(()=>null);
 return p?.role==="admin" && p?.super_admin===true;
}
async function readForm(req){if(Number(req.headers.get("content-length")||0)>8192)throw Error("large");return await req.formData()}
function normalizeScope(scope){return scopes.has(scope)?scope:null}
async function handle(req,env){
 const u=new URL(req.url),p=u.pathname,now=Math.floor(Date.now()/1000);
 if(env.OAUTH_ENABLED!=="true"||!env.OAUTH_DB)return err("service_unavailable",503);
 if(p==="/.well-known/oauth-authorization-server"){
  return resp({issuer:u.origin,authorization_endpoint:u.origin+"/oauth/authorize",token_endpoint:u.origin+"/oauth/token",revocation_endpoint:u.origin+"/oauth/revoke",response_types_supported:["code"],grant_types_supported:["authorization_code","refresh_token"],token_endpoint_auth_methods_supported:["client_secret_post","client_secret_basic"],code_challenge_methods_supported:["S256"],scopes_supported:["campaigns:read"]});
 }
 if(p==="/oauth/admin/clients"&&req.method==="POST"){
  if(!await admin(req,env))return err("unauthorized",401);
  const b=await req.json().catch(()=>null);
  if(!b||typeof b.name!=="string"||b.name.trim().length<2||b.name.length>80||b.redirect_uri!==callback)return err("invalid_request");
  const id="ifund_oauth_"+rnd(16),secret=rnd(32);
  await env.OAUTH_DB.prepare("INSERT INTO oauth_clients(id,name,secret_hash,redirect_uri,created_at) VALUES(?,?,?,?,?)").bind(id,b.name.trim(),await sha(secret),callback,now).run();
  return resp({client_id:id,client_secret:secret,redirect_uri:callback,warning:"Save the secret now; it will not be displayed again."},201);
 }
 if(p==="/oauth/admin/clients"&&req.method==="GET"){
  if(!await admin(req,env))return err("unauthorized",401);
  const q=await env.OAUTH_DB.prepare("SELECT id,name,redirect_uri,enabled,created_at FROM oauth_clients ORDER BY created_at DESC LIMIT 100").all();
  return resp({clients:q.results});
 }
 if(p==="/oauth/admin/clients/revoke"&&req.method==="POST"){
  if(!await admin(req,env))return err("unauthorized",401);
  const b=await req.json().catch(()=>null);if(!b||typeof b.client_id!=="string")return err("invalid_request");
  await env.OAUTH_DB.prepare("UPDATE oauth_clients SET enabled=0 WHERE id=?").bind(b.client_id).run();
  await env.OAUTH_DB.prepare("UPDATE oauth_tokens SET revoked=1 WHERE client_id=?").bind(b.client_id).run();
  await env.OAUTH_DB.prepare("UPDATE oauth_refresh SET revoked=1 WHERE client_id=?").bind(b.client_id).run();
  return resp({ok:true});
 }
 if(p==="/oauth/authorize"&&req.method==="GET"){
  const q=u.searchParams,id=q.get("client_id"),redirect=q.get("redirect_uri"),state=q.get("state"),scope=q.get("scope")||"campaigns:read",challenge=q.get("code_challenge");
  const client=await env.OAUTH_DB.prepare("SELECT id,name,redirect_uri,enabled FROM oauth_clients WHERE id=?").bind(id).first();
  if(!client||!client.enabled||redirect!==client.redirect_uri)return err("invalid_client",400);
  if(q.get("response_type")!=="code"||!state||state.length<16||state.length>512||!normalizeScope(scope)||((challenge||q.get("code_challenge_method"))&&(q.get("code_challenge_method")!=="S256"||!/^[a-zA-Z0-9_-]{43}$/.test(challenge||""))))return err("invalid_request");
  if(!env.IFUND_OAUTH_PORTAL_URL)return err("service_unavailable",503);
  const portal=new URL(env.IFUND_OAUTH_PORTAL_URL);
  if(portal.protocol!=="https:")return err("service_unavailable",503);
  portal.searchParams.set("oauth_authorize",u.search.slice(1));
  return Response.redirect(portal.toString(),302);
 }
 if(p==="/oauth/admin/authorize"&&req.method==="POST"){
  if(!await admin(req,env))return err("unauthorized",401);
  const b=await req.json().catch(()=>null);
  const id=b?.client_id,client=await env.OAUTH_DB.prepare("SELECT id,name,redirect_uri,enabled FROM oauth_clients WHERE id=?").bind(id).first();
  if(!client||!client.enabled||b.redirect_uri!==client.redirect_uri||b.response_type!=="code"||((b.code_challenge||b.code_challenge_method)&&(b.code_challenge_method!=="S256"||!/^[A-Za-z0-9_-]{43}$/.test(b.code_challenge||""))))return err("invalid_request");
  if(typeof b.state!=="string"||b.state.length<16||b.state.length>512||!normalizeScope(b.scope||"campaigns:read"))return err("invalid_request");
  const redirect=new URL(client.redirect_uri);
  redirect.searchParams.set("state",b.state);
  if(b.decision!=="approve")redirect.searchParams.set("error","access_denied");
  else {
   const code=rnd(32);
   await env.OAUTH_DB.prepare("INSERT INTO oauth_codes(code_hash,client_id,redirect_uri,scope,challenge,expires) VALUES(?,?,?,?,?,?)").bind(await sha(code),id,client.redirect_uri,b.scope||"campaigns:read",b.code_challenge||"",now+180).run();
   redirect.searchParams.set("code",code);
  }
  return resp({redirect_url:redirect.toString(),client_name:client.name});
 }
 if(p==="/oauth/token"&&req.method==="POST"){
  const f=await readForm(req);
  let id=f.get("client_id"),secret=f.get("client_secret");
  const basic=req.headers.get("authorization")||"";
  if(basic.startsWith("Basic ")){try{const raw=atob(basic.slice(6)),idx=raw.indexOf(":");id=decodeURIComponent(raw.slice(0,idx));secret=decodeURIComponent(raw.slice(idx+1))}catch{return err("invalid_client",401)}}
  if(typeof id!=="string"||typeof secret!=="string"||!secret)return err("invalid_client",401);
  const client=await env.OAUTH_DB.prepare("SELECT * FROM oauth_clients WHERE id=?").bind(id).first();
  if(!client||!client.enabled||await sha(secret)!==client.secret_hash)return err("invalid_client",401);
  if(f.get("grant_type")==="refresh_token"){
   const old=f.get("refresh_token");if(typeof old!=="string")return err("invalid_grant");
   const oldHash=await sha(old);
   const used=await env.OAUTH_DB.prepare("UPDATE oauth_refresh SET revoked=1 WHERE refresh_hash=? AND client_id=? AND expires>? AND revoked=0").bind(oldHash,id,now).run();
   if(used.meta.changes!==1){await env.OAUTH_DB.prepare("UPDATE oauth_refresh SET revoked=1 WHERE client_id=?").bind(id).run();return err("invalid_grant");}
   const previous=await env.OAUTH_DB.prepare("SELECT scope FROM oauth_refresh WHERE refresh_hash=?").bind(oldHash).first();
   const nextAccess="ifund_oat_"+rnd(32),nextRefresh="ifund_ort_"+rnd(32);
   await env.OAUTH_DB.prepare("INSERT INTO oauth_tokens(token_hash,client_id,scope,expires) VALUES(?,?,?,?)").bind(await sha(nextAccess),id,previous.scope,now+900).run();
   await env.OAUTH_DB.prepare("INSERT INTO oauth_refresh(refresh_hash,client_id,scope,expires) VALUES(?,?,?,?)").bind(await sha(nextRefresh),id,previous.scope,now+2592000).run();
   return resp({access_token:nextAccess,refresh_token:nextRefresh,token_type:"Bearer",expires_in:900,scope:previous.scope});
  }
  if(f.get("grant_type")!=="authorization_code")return err("unsupported_grant_type");
  const code=f.get("code"),verifier=f.get("code_verifier");
  if(typeof code!=="string")return err("invalid_grant");
  const codeHash=await sha(code);
  const row=await env.OAUTH_DB.prepare("SELECT * FROM oauth_codes WHERE code_hash=? AND client_id=? AND redirect_uri=? AND expires>?").bind(codeHash,id,f.get("redirect_uri"),now).first();
  if(!row||(row.challenge&&(typeof verifier!=="string"||!/^[a-zA-Z0-9._~-]{43,128}$/.test(verifier)||await pkce(verifier)!==row.challenge)))return err("invalid_grant");
  const used=await env.OAUTH_DB.prepare("DELETE FROM oauth_codes WHERE code_hash=? AND expires>?").bind(codeHash,now).run();
  if(used.meta.changes!==1)return err("invalid_grant");
  const token="ifund_oat_"+rnd(32);
  await env.OAUTH_DB.prepare("INSERT INTO oauth_tokens(token_hash,client_id,scope,expires) VALUES(?,?,?,?)").bind(await sha(token),id,row.scope,now+900).run();
  const refresh="ifund_ort_"+rnd(32);
  await env.OAUTH_DB.prepare("INSERT INTO oauth_refresh(refresh_hash,client_id,scope,expires) VALUES(?,?,?,?)").bind(await sha(refresh),id,row.scope,now+2592000).run();
  return resp({access_token:token,refresh_token:refresh,token_type:"Bearer",expires_in:900,scope:row.scope});
 }
 if(p==="/oauth/revoke"&&req.method==="POST"){
  const f=await readForm(req),id=f.get("client_id"),secret=f.get("client_secret");
  const c=await env.OAUTH_DB.prepare("SELECT secret_hash,enabled FROM oauth_clients WHERE id=?").bind(id).first();
  if(!c||!c.enabled||await sha(String(secret||""))!==c.secret_hash)return err("invalid_client",401);
  if(typeof f.get("token")==="string"){
   await env.OAUTH_DB.prepare("UPDATE oauth_tokens SET revoked=1 WHERE token_hash=? AND client_id=?").bind(await sha(f.get("token")),id).run();
   await env.OAUTH_DB.prepare("UPDATE oauth_refresh SET revoked=1 WHERE refresh_hash=? AND client_id=?").bind(await sha(f.get("token")),id).run();
  }
  return resp({});
 }
 if(p==="/api/v1/oauth/campaigns"&&req.method==="GET"){
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\\s+/i,"");
  if(!token.startsWith("ifund_oat_"))return err("unauthorized",401);
  const t=await env.OAUTH_DB.prepare("SELECT t.scope FROM oauth_tokens t JOIN oauth_clients c ON t.client_id=c.id WHERE t.token_hash=? AND t.revoked=0 AND t.expires>? AND c.enabled=1").bind(await sha(token),now).first();
  if(!t||t.scope!=="campaigns:read")return err("forbidden",403);
  if(!env.IFUND_AGENT_CAMPAIGNS_URL||!env.IFUND_OAUTH_AGENT_KEY)return err("service_unavailable",503);
  const upstream=new URL(env.IFUND_AGENT_CAMPAIGNS_URL);
  if(upstream.protocol!=="https:")return err("service_unavailable",503);
  const response=await fetch(upstream.toString(),{headers:{"authorization":"Bearer "+env.IFUND_OAUTH_AGENT_KEY,"accept":"application/json"},redirect:"manual"});
  return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
 }
 if(p==="/oauth/inspect"&&req.method==="POST"){
  // Only trusted internal services with a separate protected shared secret may introspect tokens.
  if(!env.OAUTH_INTROSPECTION_SECRET||req.headers.get("x-ifund-internal-secret")!==env.OAUTH_INTROSPECTION_SECRET)return err("unauthorized",401);
  const b=await req.json().catch(()=>null),token=b?.token;
  if(typeof token!=="string"||!token.startsWith("ifund_oat_"))return resp({active:false});
  const t=await env.OAUTH_DB.prepare("SELECT t.client_id,t.scope,t.expires FROM oauth_tokens t JOIN oauth_clients c ON t.client_id=c.id WHERE t.token_hash=? AND t.revoked=0 AND t.expires>? AND c.enabled=1").bind(await sha(token),now).first();
  return resp(t?{active:true,client_id:t.client_id,scope:t.scope,exp:t.expires}:{active:false});
 }
 return err("not_found",404);
}
export default {async fetch(req,env){try{return await handle(req,env)}catch(e){console.error("oauth error",e?.name||"unknown");return err("server_error",503)}}};
