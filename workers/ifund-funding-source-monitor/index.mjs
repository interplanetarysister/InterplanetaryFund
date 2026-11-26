// Private, read-only source observations. Actual eligibility/deadline review
// remains a separate evidence workflow. No arbitrary outbound destinations.
import { WorkerEntrypoint } from "cloudflare:workers";
const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
const ALLOWED=Object.freeze({
 "awesome-foundation":"https://www.awesomefoundation.org/en/about_us",
 "mit-solve":"https://solve.mit.edu/challenges",
 "usa-benefits":"https://www.usa.gov/benefit-finder"
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES=2*1024*1024;
const nativeFetch=(...args)=>fetch(...args);
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
async function boundedBody(response,limit){
 const raw=response.headers.get("content-length");
 if(raw!==null&&(!/^\d+$/.test(raw)||Number(raw)>limit))throw Error("body_limit");
 if(!response.body)throw Error("empty_body");
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error("body_limit");chunks.push(value);}}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return bytes;
}
export async function observeSource(id,url,fetcher=nativeFetch){
 if(!Object.hasOwn(ALLOWED,id)||ALLOWED[id]!==url)throw Error("source_not_approved");
 let status=null;
 try{
  const r=await fetcher(url,{method:"GET",redirect:"manual",headers:{accept:"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(10000)});
  status=r.status;
  if(status!==200||!/^(text\/html|application\/xhtml\+xml)(?:\s*;|\s*$)/i.test(r.headers.get("content-type")||"")){
   await r.body?.cancel().catch(()=>{});return {status:"failed",httpStatus:status,sha256:null};
  }
  const body=await boundedBody(r,MAX_BYTES);
  if(!body.byteLength)throw Error("empty_body");
  return {status:"review_required",httpStatus:200,sha256:hex(await crypto.subtle.digest("SHA-256",body))};
 }catch{return {status:"failed",httpStatus:status,sha256:null};}
}
async function rpc(env,name,body,fetcher){
 if(env.SUPABASE_URL!==ORIGIN||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY||"")||!(/^[a-f0-9]{64}$/).test(env.IFUND_SOURCE_PROBE_KEY||""))throw Error("probe_configuration");
 const r=await fetcher(ORIGIN+"/rest/v1/rpc/"+name,{method:"POST",redirect:"error",signal:AbortSignal.timeout(12000),headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,"content-type":"application/json","x-ifund-source-probe-key":env.IFUND_SOURCE_PROBE_KEY},body:JSON.stringify(body)});
 if(!r.ok){await r.body?.cancel().catch(()=>{});throw Error("probe_rpc_unavailable");}
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(await boundedBody(r,16384)));
}
export async function sourceTick(env,request,fetcher=nativeFetch){
 if(env.IFUND_SOURCE_PROBE_ENABLED!=="enabled"||request?.job!=="verified-opportunity-refresh"||
 !Number.isInteger(request.batchLimit)||request.batchLimit<1||request.batchLimit>10)return {state:"blocked"};
 const slot=Date.parse(request.scheduledAt);
 if(!Number.isFinite(slot)||new Date(slot).toISOString()!==request.scheduledAt||
 request.slotKey!=="verified-opportunity-refresh:"+slot||slot%300000!==0)return {state:"blocked"};
 let claims;
 try{claims=await rpc(env,"ifund_claim_funding_source_probes",{p_limit:Math.min(3,request.batchLimit)},fetcher);}
 catch{return {state:"retry"};}
 if(!Array.isArray(claims)||claims.length>Math.min(3,request.batchLimit)||
 claims.some(c=>!Object.hasOwn(ALLOWED,c?.source_id)||ALLOWED[c.source_id]!==c.official_url||!UUID.test(c.lease_id||""))||
 new Set(claims.map(c=>c.source_id)).size!==claims.length)return {state:"blocked"};
 let recorded=0,unavailable=0;
 for(const c of claims){
  const result=await observeSource(c.source_id,c.official_url,fetcher);
  try{
   const ok=await rpc(env,"ifund_complete_funding_source_probe",{p_source_id:c.source_id,p_lease_id:c.lease_id,p_status:result.status,p_http_status:result.httpStatus,p_sha256:result.sha256},fetcher);
   if(ok===true){recorded++;if(result.status==="failed")unavailable++;}
  }catch{/* Expiring lease allows later safe retry. */}
 }
 return {state:claims.length===0?"idle":recorded===claims.length?"completed":"retry",recorded,unavailable};
}
export class FundingSourceMonitor extends WorkerEntrypoint {
 async tick(request){return sourceTick(this.env,request);}
}
export default {fetch(){return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});}};
