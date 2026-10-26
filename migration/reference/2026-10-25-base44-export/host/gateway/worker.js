import { campaignAssistant } from './campaign-assistant.js';
const enc = new TextEncoder();
const DEFAULT_BASE44_ORIGIN = "https://interplanetaryfund.base44.app";

function json(body, status = 200, origin = "") {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-headers"] = "authorization, content-type";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["vary"] = "Origin";
  }
  // 204/205/304 cannot carry response bodies. Browsers send OPTIONS
  // preflight before authenticated cross-origin admin requests; constructing
  // a 204 Response with JSON throws in the Workers runtime and Node fetch.
  if (status === 204 || status === 205 || status === 304) {
    delete headers["content-type"];
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.IFUND_ALLOWED_ORIGINS || "").split(",").map(v=>v.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}
function base44Origin(env) {
  const raw = String(env.IFUND_BASE44_ORIGIN || DEFAULT_BASE44_ORIGIN).trim().replace(/\/+$/, "");
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("IFUND_BASE44_ORIGIN must use HTTPS.");
  return url.origin;
}
function isMcpProxyPath(pathname) {
  return pathname === "/api/mcp"
    || pathname.startsWith("/api/mcp/")
    || /^\/api\/apps\/[^/]+\/mcp(?:\/|$)/.test(pathname)
    || pathname === "/.well-known/oauth-protected-resource"
    || pathname.startsWith("/.well-known/oauth-protected-resource/")
    || pathname === "/.well-known/oauth-authorization-server"
    || pathname.startsWith("/.well-known/oauth-authorization-server/")
    || pathname === "/.well-known/openid-configuration";
}
async function proxyBase44Mcp(request, env) {
  const incoming = new URL(request.url);
  const upstreamOrigin = base44Origin(env);
  const upstreamUrl = new URL(incoming.pathname + incoming.search, upstreamOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-ifund-proxy", "cloudflare-mcp");

  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.arrayBuffer();

  const upstream = await fetch(new Request(upstreamUrl.toString(), init));
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("x-ifund-mcp-proxy", "base44");
  responseHeaders.set("cache-control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
async function sameSecret(a,b) {
  const aa=enc.encode(String(a||"")), bb=enc.encode(String(b||""));
  if (aa.length!==bb.length) return false;
  const key=await crypto.subtle.importKey("raw",enc.encode("ifund-admin-key-compare"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const [ha,hb]=await Promise.all([crypto.subtle.sign("HMAC",key,aa),crypto.subtle.sign("HMAC",key,bb)]);
  const x=new Uint8Array(ha), y=new Uint8Array(hb); let diff=0; for(let i=0;i<x.length;i++) diff|=x[i]^y[i]; return diff===0;
}
function forwardedAdminAuth(request) {
  const authorization = request.headers.get("authorization");
  if (authorization) return { authorization };
  const cookie = request.headers.get("cookie");
  if (cookie) return { cookie };
  return {};
}
async function verifyPlatformAdmin(request, env) {
  const auth = forwardedAdminAuth(request);
  if (!Object.keys(auth).length || !env.IFUND_ADMIN_VERIFY_URL) return null;
  // Never forward administrator bearer credentials or cookies to HTTP,
  // embedded-credential URLs, or an automatic redirect destination.
  let endpoint;
  try {
    endpoint = new URL(env.IFUND_ADMIN_VERIFY_URL);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return null;
  } catch {
    return null;
  }
  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: { ...auth, accept: "application/json" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || (response.status >= 300 && response.status < 400)) return null;
    const user = await response.json().catch(() => null);
    return user?.role === "admin" && user?.super_admin === true &&
      typeof user.id === "string" && user.id.length > 0 ? user : null;
  } catch {
    return null;
  }
}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function sessionSignature(payload,env){
  if(!env.IFUND_SESSION_SECRET) throw new Error("Session signing secret is not configured.");
  const key=await crypto.subtle.importKey("raw",enc.encode(env.IFUND_SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(payload))));
}
async function newSession(userId,env){
  const payload=b64url(enc.encode(JSON.stringify({uid:userId,exp:Date.now()+15*60*1000,nonce:crypto.randomUUID()})));
  return payload+"."+await sessionSignature(payload,env);
}
async function validSession(token,userId,env){
  const [payload,sig,...extra]=String(token||"").split(".");
  if(!payload||!sig||extra.length) return false;
  if(!(await sameSecret(sig,await sessionSignature(payload,env)))) return false;
  try{
    const raw=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));
    const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));
    return data.uid===userId&&Number(data.exp)>Date.now();
  }catch{return false;}
}
async function audit(env,event,request){
  if(!env.IFUND_AUDIT_URL)return;
  const auth=forwardedAdminAuth(request);
  const headers={"content-type":"application/json",...auth};
  if(!Object.keys(auth).length && env.IFUND_SERVICE_TOKEN) headers.authorization=`Bearer ${env.IFUND_SERVICE_TOKEN}`;
  await fetch(env.IFUND_AUDIT_URL,{method:"POST",headers,body:JSON.stringify(event)}).catch(()=>{});
}
async function callAgentRuntime(env, request, payload) {
  if(!env.IFUND_AGENT_EXECUTE_URL) {
    return { response: json({error:"Development agent runtime is not configured on this host.",degraded:true},503), result:null };
  }
  const auth=forwardedAdminAuth(request);
  if(!Object.keys(auth).length) {
    return { response: json({error:"Administrator authorization required."},401), result:null };
  }
  // Admin credentials must never be sent to a non-HTTPS runtime or
  // automatically forwarded to a redirect target.
  let endpoint;
  try {
    endpoint=new URL(env.IFUND_AGENT_EXECUTE_URL);
    if(endpoint.protocol!=="https:" || endpoint.username || endpoint.password) throw Error("Invalid agent runtime URL");
  }catch{
    return { response:json({error:"Development agent runtime URL is invalid.",degraded:true},503), result:null };
  }
  try {
    const r=await fetch(endpoint.toString(),{
      method:"POST",
      headers:{"content-type":"application/json",...auth},
      body:JSON.stringify(payload),
      redirect:"manual",
    });
    if(r.status>=300 && r.status<400) {
      return { response:json({error:"Development agent runtime redirect rejected.",degraded:true},502), result:null };
    }
    const result=await r.json().catch(()=>({}));
    return { response:r, result };
  }catch{
    return { response:json({error:"Development agent runtime unavailable.",degraded:true},502), result:null };
  }
}

// Preview-only independent identity verification. This never authorizes access
// to migrated campaigns, financial records, agent actions, or Base44 accounts.
// It verifies a Supabase session against Supabase Auth, not a decoded JWT claim.
async function verifyIndependentSession(request, env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (env.IFUND_INDEPENDENT_AUTH_PREVIEW !== "enabled") {
    return json({ error: "Independent authentication preview disabled", cutover_ready: false }, 503);
  }
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [^\s]{20,4096}$/.test(authorization)) {
    return json({ error: "Bearer token required" }, 401);
  }
  const projectRef = String(env.IFUND_SUPABASE_PROJECT_REF || "").trim();
  const publishableKey = String(env.IFUND_SUPABASE_PUBLISHABLE_KEY || "").trim();
  // The URL is constructed from a validated project reference. Never send
  // bearer credentials to an arbitrary configurable verification URL.
  // Pin this preview to IFund's designated destination project. A mistaken
  // environment value must not authenticate identities from another tenant.
  if (projectRef !== "tzehxfikoslihnclhxuz" || !/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(publishableKey)) {
    return json({ error: "Independent authentication is not configured" }, 503);
  }
  try {
    const endpoint = `https://${projectRef}.supabase.co/auth/v1/user`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { authorization, apikey: publishableKey, accept: "application/json" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return json({ authenticated: false }, 401);
    }
    if (!response.ok) return json({ error: "Identity provider unavailable" }, 503);
    const user = await response.json().catch(() => null);
    if (!user || typeof user.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
      return json({ error: "Invalid identity response" }, 502);
    }
    return json({
      authenticated: true,
      provider: "supabase",
      migration_authorization: "not_verified",
      campaign_access_granted: false,
      cutover_ready: false,
    });
  } catch {
    return json({ error: "Identity provider unavailable" }, 503);
  }
}

// Read-only destination campaign preview. The RPC is security-definer but
// explicitly joins a verified destination UID to its source owner, and returns
// no finance ledger fields. The Worker independently verifies each returned
// owner UID and never falls back to Base44 when the destination is unavailable.
async function readIndependentCampaigns(request, env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (env.IFUND_INDEPENDENT_AUTH_PREVIEW !== "enabled")
    return json({ error: "Independent campaign preview disabled", cutover_ready: false }, 503);
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [^\s]{20,4096}$/.test(authorization))
    return json({ error: "Bearer token required" }, 401);
  const projectRef = String(env.IFUND_SUPABASE_PROJECT_REF || "").trim();
  const publishableKey = String(env.IFUND_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (projectRef !== "tzehxfikoslihnclhxuz" || !/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(publishableKey))
    return json({ error: "Independent campaign backend is not configured" }, 503);
  const host = `https://${projectRef}.supabase.co`;
  const headers = { authorization, apikey: publishableKey, accept: "application/json" };
  try {
    const verified = await fetch(host + "/auth/v1/user", {
      method: "GET", headers, redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (verified.status === 401 || verified.status === 403)
      return json({ error: "Independent authentication required" }, 401);
    if (!verified.ok) return json({ error: "Identity provider unavailable" }, 503);
    const user = await verified.json().catch(() => null);
    if (!user || typeof user.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id))
      return json({ error: "Invalid identity response" }, 502);

    const result = await fetch(host + "/rest/v1/rpc/ifund_migration_my_campaigns", {
      method: "POST", headers: { ...headers, "content-type": "application/json" },
      body: "{}", redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (result.status === 401 || result.status === 403)
      return json({ error: "Independent campaign access denied" }, 403);
    if (!result.ok) return json({ error: "Independent campaign backend unavailable" }, 503);
    const raw = await result.text();
    if (raw.length > 200000) return json({ error: "Invalid campaign response" }, 502);
    let rows;
    try { rows = JSON.parse(raw); } catch { return json({ error: "Invalid campaign response" }, 502); }
    if (!Array.isArray(rows) || rows.length > 50)
      return json({ error: "Invalid campaign response" }, 502);
    const fields = ["source_id", "title", "summary", "story", "status", "category",
      "goal_amount", "cover_image_url", "end_date", "location", "source_updated_at"];
    const campaigns = [];
    for (const row of rows) {
      if (!row || row.owner_auth_uid !== user.id ||
          typeof row.source_id !== "string" || typeof row.title !== "string")
        return json({ error: "Campaign ownership verification failed" }, 502);
      const safe = {};
      for (const field of fields) safe[field] = row[field] ?? null;
      campaigns.push(safe);
    }
    return json({ campaigns, source: "independent_shadow", read_only: true,
      financial_authoritative: false, cutover_ready: false });
  } catch {
    return json({ error: "Independent campaign backend unavailable" }, 503);
  }
}

export default { async fetch(request, env) {
  const url=new URL(request.url);
  // Migration hold: block Cloudflare gateway agent execution while preserving
  // status/health and unrelated campaign/payment routes.
  if(env.IFUND_AGENT_ACTIONS_PAUSED === 'true' &&
    (url.pathname === '/v1/admin/agents/message' ||
     url.pathname === '/api/v1/agent/content' && request.method !== 'GET')) {
    return json({error:'Agent actions temporarily paused for Cloudflare migration',code:'agent_actions_paused',retryable:true},503);
  }

  // Independent cutover must not be declared ready while MCP and core
  // account/campaign authority still depend on Base44. This is intentionally
  // separate from process liveness (/api/health), which remains healthy.
  if(/^\/api\/health\/readiness\/*$/.test(url.pathname)){
    if(request.method!=="GET" && request.method!=="HEAD") return json({error:"Method not allowed"},405);
    return json({
      ready:false,
      status:"migration_in_progress",
      independent_backend:false,
      blockers:["base44_mcp_proxy","base44_auth_authority","base44_campaign_authority"]
    },503);
  }

  if(url.pathname==="/api/health" || url.pathname==="/api/health/"){
    if(request.method!=="GET" && request.method!=="HEAD") return json({error:"Method not allowed"},405);
    return json({
      ok:true,
      service:"interplanetary-fund",
      runtime:"cloudflare-worker",
      mcp_proxy:"base44",
      status:"healthy"
    });
  }

  if(url.pathname === '/api/v1/campaign-assistant') return campaignAssistant(request, env);

  if(url.pathname==="/api/v1/migration/auth/session"){
    const origin=request.headers.get("origin")||"";
    // Reuse the same deploy-time origin allowlist as the other protected
    // endpoints; a separate hardcoded list could silently drift.
    if(origin && !allowedOrigin(request,env)) return json({error:"Origin not allowed"},403);
    const headers={"cache-control":"no-store","vary":"Origin"};
    if(origin) headers["access-control-allow-origin"]=origin;
    if(request.method==="OPTIONS"){
      headers["access-control-allow-methods"]="GET, OPTIONS";
      headers["access-control-allow-headers"]="Authorization, Content-Type";
      return new Response(null,{status:204,headers});
    }
    const result=await verifyIndependentSession(request,env);
    const out=new Headers(result.headers);
    for(const [key,value] of Object.entries(headers)) out.set(key,value);
    return new Response(result.body,{status:result.status,headers:out});
  }

  if(url.pathname==="/api/v1/migration/campaigns"){
    const origin=request.headers.get("origin")||"";
    if(origin && !allowedOrigin(request,env)) return json({error:"Origin not allowed"},403);
    const headers={"cache-control":"no-store","vary":"Origin"};
    if(origin) headers["access-control-allow-origin"]=origin;
    if(request.method==="OPTIONS"){
      headers["access-control-allow-methods"]="GET, OPTIONS";
      headers["access-control-allow-headers"]="Authorization, Content-Type";
      return new Response(null,{status:204,headers});
    }
    const result=await readIndependentCampaigns(request,env);
    const out=new Headers(result.headers);
    for(const [key,value] of Object.entries(headers)) out.set(key,value);
    return new Response(result.body,{status:result.status,headers:out});
  }

  if(isMcpProxyPath(url.pathname)){
    try{return await proxyBase44Mcp(request,env);}
    catch{return json({error:"Interplanetary Fund MCP backend is unavailable.",degraded:true},502);}
  }

  // Creator-authorized campaign content writes from external AI agents.
  if(url.pathname==="/api/v1/agent/content"){
    if(request.method!=="POST") return json({error:"Method not allowed"},405);
    const authorization=request.headers.get("authorization")||"";
    if(!/^Bearer ifund_ag_[a-f0-9]{64}$/i.test(authorization)) return json({error:"Bearer API key required"},401);
    if(!env.IFUND_AGENT_CONTENT_WRITE_URL) return json({error:"Agent write API is not configured",degraded:true},503);
    try{
      const upstream=new URL(env.IFUND_AGENT_CONTENT_WRITE_URL);
      if(upstream.protocol!=="https:") throw Error("HTTPS required");
      const body=await request.text();
      if(body.length>12000) return json({error:"Request too large"},413);
      const response=await fetch(upstream.toString(),{
        method:"POST",headers:{authorization,accept:"application/json","content-type":"application/json"},
        body,redirect:"manual"
      });
      return new Response(response.body,{status:response.status,headers:{"content-type":"application/json","cache-control":"no-store"}});
    }catch{return json({error:"Agent content API unavailable",degraded:true},502);}
  }

  // Dedicated external-agent REST access, kept separate from admin tools.
  // The Base44 backend verifies the revocable key hash and limits fields.
  if(url.pathname==="/api/v1/agent/campaigns"){
    if(request.method!=="GET") return json({error:"Method not allowed"},405);
    const authorization=request.headers.get("authorization")||"";
    if(!/^Bearer ifund_ag_[a-f0-9]{64}$/i.test(authorization))
      return json({error:"Bearer API key required"},401);
    if(!env.IFUND_AGENT_CAMPAIGNS_URL)
      return json({error:"Agent campaign API is not configured",degraded:true},503);
    try{
      const upstream=new URL(env.IFUND_AGENT_CAMPAIGNS_URL);
      if(upstream.protocol!=="https:") throw Error("HTTPS required");
      const response=await fetch(upstream.toString(),{
        method:"GET",headers:{authorization,accept:"application/json"},redirect:"manual"
      });
      const h=new Headers({"content-type":"application/json","cache-control":"no-store"});
      return new Response(response.body,{status:response.status,headers:h});
    }catch{
      return json({error:"Agent campaign API unavailable",degraded:true},502);
    }
  }

  const origin=allowedOrigin(request,env);
  if(request.method==="OPTIONS") return origin?json({},204,origin):json({error:"Origin denied"},403);
  if(!origin) return json({error:"Origin denied"},403);
  const user=await verifyPlatformAdmin(request,env);
  if(!user) return json({error:"Administrator authorization required."},403,origin);

  if(url.pathname==="/v1/admin/agents/session"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    // Missing secrets must fail closed: comparing two empty strings would
    // otherwise allow an empty admin key on an unconfigured deployment.
    if(!env.IFUND_ADMIN_AGENT_KEY || !env.IFUND_SESSION_SECRET){
      return json({error:"Admin gateway secrets are not configured."},503,origin);
    }
    if(!body.adminKey || !(await sameSecret(body.adminKey,env.IFUND_ADMIN_AGENT_KEY))){
      await audit(env,{type:"admin_agent_auth_failed",userId:user.id,at:new Date().toISOString()},request);
      return json({error:"Admin development key rejected."},403,origin);
    }
    const sessionId=await newSession(user.id,env);
    await audit(env,{type:"admin_agent_session",userId:user.id,agent:String(body.agent||"chief_of_staff"),at:new Date().toISOString()},request);
    return json({sessionId,expiresIn:900},200,origin);
  }

  if(url.pathname==="/v1/admin/agents/message"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await validSession(body.sessionId,user.id,env))) return json({error:"Admin development session expired."},401,origin);
    const allowed=new Set(["chief_of_staff","connection_discovery_agent","managed_connection_agent","outreach_agent"]);
    if(!allowed.has(body.agent)) return json({error:"Agent is not approved for this gateway."},400,origin);

    const runtime=await callAgentRuntime(env,request,{
      agent:body.agent,
      content:String(body.content||""),
      adminUserId:user.id,
    });
    if(runtime.response instanceof Response && runtime.result===null) {
      const fallback=await runtime.response.json().catch(()=>({}));
      return json(fallback,runtime.response.status,origin);
    }

    const result=runtime.result||{};
    await audit(env,{type:"admin_agent_message",userId:user.id,agent:body.agent,status:runtime.response.ok?"accepted":"failed",requestId:result.requestId,at:new Date().toISOString()},request);
    return json(runtime.response.ok?{
      response:result.response||"Request accepted.",
      requestId:result.requestId,
      activityId:result.activityId,
      conversationId:result.conversationId,
      execution_status:result.execution_status,
      degraded:result.degraded===true,
      tool_call:result.tool_call,
    }:{error:result.error||"Agent request failed."},runtime.response.status,origin);
  }

  if(url.pathname==="/v1/admin/agents/status"&&request.method==="POST"){
    const body=await request.json().catch(()=>({}));
    if(!(await validSession(body.sessionId,user.id,env))) return json({error:"Admin development session expired."},401,origin);
    const activityId=String(body.activityId||"").trim();
    if(!activityId) return json({error:"Activity ID is required."},400,origin);

    const runtime=await callAgentRuntime(env,request,{mode:"status",activityId,adminUserId:user.id});
    if(runtime.response instanceof Response && runtime.result===null) {
      const fallback=await runtime.response.json().catch(()=>({}));
      return json(fallback,runtime.response.status,origin);
    }

    const result=runtime.result||{};
    return json(runtime.response.ok?{
      response:result.response||"Agent execution is in progress.",
      requestId:result.requestId,
      activityId:result.activityId||activityId,
      conversationId:result.conversationId,
      execution_status:result.execution_status,
      degraded:result.degraded===true,
      tool_call:result.tool_call,
      tool_errors:result.tool_errors===true,
    }:{error:result.error||"Agent status check failed."},runtime.response.status,origin);
  }

  return json({error:"Not found"},404,origin);
}};

