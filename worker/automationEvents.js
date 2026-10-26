import { WORKFLOWS } from "./automationRegistry.js";
import { automationCanRun } from "./automationEngine.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();
function json(status,value) {
  return new Response(JSON.stringify(value), {
    status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}
function hexToBytes(value) {
  if (!/^[0-9a-f]{64}$/i.test(value||"")) return null;
  return Uint8Array.from(value.match(/../g), item=>parseInt(item,16));
}
async function validSignature(env,ts,text,signature) {
  const bytes=hexToBytes(signature);
  if (!bytes || typeof env.IFUND_EVENT_SIGNING_SECRET!=="string" ||
      env.IFUND_EVENT_SIGNING_SECRET.length<32) return false;
  const key=await crypto.subtle.importKey("raw",encoder.encode(env.IFUND_EVENT_SIGNING_SECRET),
    {name:"HMAC",hash:"SHA-256"},false,["verify"]);
  return crypto.subtle.verify("HMAC",key,bytes,encoder.encode(ts+"."+text));
}
function eventContracts(input) {
  if (!input || Array.isArray(input) || typeof input!=="object") return [];
  if (Object.keys(input).some(name=>!["eventId","entity","eventType","recordId","status","changedFields"].includes(name)))
    return [];
  if (!UUID.test(input.eventId||"")||!UUID.test(input.recordId||"")||
      typeof input.entity!=="string"||!["create","update"].includes(input.eventType)) return [];
  if (input.status!==undefined && typeof input.status!=="string") return [];
  if (input.changedFields!==undefined &&
      (!Array.isArray(input.changedFields) || input.changedFields.length>40 ||
        input.changedFields.some(x=>typeof x!=="string" || x.length>64))) return [];
  return WORKFLOWS.filter(x=>x.kind==="entity" &&
    x.entityName===input.entity && x.events.includes(input.eventType))
    .filter(x=>{
      if (x.id==="Feature Discovery on Completion")
        return input.status==="completed" && input.changedFields?.includes("status");
      if (x.id==="Grant Application Review") return input.status==="submitted";
      return true;
    });
}
async function idForEvent(input,id) {
  const hash=await crypto.subtle.digest("SHA-256",
    encoder.encode(input.eventId.toLowerCase()+"|"+id));
  const suffix=Array.from(new Uint8Array(hash).slice(0,16),n=>n.toString(16).padStart(2,"0")).join("");
  return "ifund-event-"+suffix;
}
/**
 * Trusted SOURCE OUTBOX only: the signing secret belongs on the independent
 * server; never in the browser or in an event payload. The route is inactive
 * until the complete backend consent, identity, audit and release gates pass.
 */
export async function routeEntityEventRequest(request,env) {
  if (env?.IFUND_AUTOMATIONS_ENABLED!=="enabled" ||
      env?.IFUND_ENTITY_EVENTS_ENABLED!=="enabled" ||
      env?.IFUND_AUTOMATION_RELEASE_APPROVED!=="true")
    return json(404,{error:"Not found"});
  if (request.method!=="POST") return json(405,{error:"Method not allowed"});
  if (!env.IFUND_WORKFLOW) return json(503,{error:"Durable engine unavailable"});
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type")||""))
    return json(415,{error:"JSON required"});
  if (Number(request.headers.get("content-length"))>8192) return json(413,{error:"Too large"});
  const ts=request.headers.get("x-ifund-timestamp")||"";
  const sig=request.headers.get("x-ifund-signature")||"";
  if (!/^\d{10}$/.test(ts) || Math.abs(Date.now()-Number(ts)*1000)>300000)
    return json(401,{error:"Invalid request authentication"});
  let text="";
  try {text=await request.text();} catch {return json(400,{error:"Invalid body"});}
  if (encoder.encode(text).length>8192) return json(413,{error:"Too large"});
  if (!await validSignature(env,ts,text,sig))
    return json(401,{error:"Invalid request authentication"});
  let input;try {input=JSON.parse(text);}catch {return json(400,{error:"Invalid JSON"});}
  const contracts=eventContracts(input);
  if (!contracts.length) return json(422,{error:"Unrecognized event"});
  const allowed=contracts.filter(x=>automationCanRun(x.id,env));
  if (!allowed.length) return json(409,{error:"Independent handlers not released",queued:0});
  const result=[];
  for (const wf of allowed) {
    const id=await idForEvent(input,wf.id);
    try {
      await env.IFUND_WORKFLOW.create({id,params:{
        workflowId:wf.id,trigger:"entity",eventId:input.eventId,
        entity:input.entity,eventType:input.eventType,recordId:input.recordId
      }});
      result.push({name:wf.id,queued:true});
    }catch(error){
      if(Number(error?.code)===10405) result.push({name:wf.id,queued:false,duplicate:true});
      else return json(503,{error:"Queue unavailable"});
    }
  }
  return json(202,{queued:result.filter(x=>x.queued).length,duplicates:result.filter(x=>x.duplicate).length});
}
