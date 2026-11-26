// One free trigger for current production health and future Stitch jobs.
// UTC offsets deliberately stagger periodic jobs. Only trusted private
// service bindings may execute work; a cron tick grants no owner authority.
export const JOBS=Object.freeze([
 {id:"approved-distribution",minutes:5,offset:0,flag:"IFUND_STITCH_DISTRIBUTION_ENABLED",binding:"IFUND_STITCH_DISTRIBUTION",batch:10},
 {id:"media-recovery",minutes:5,offset:0,flag:"IFUND_STITCH_MEDIA_ENABLED",binding:"IFUND_STITCH_MEDIA",batch:5},
 {id:"integration-outbox",minutes:5,offset:0,flag:"IFUND_STITCH_OUTBOX_ENABLED",binding:"IFUND_STITCH_OUTBOX",batch:20},
 {id:"email-and-membership-reconciliation",minutes:15,offset:5,flag:"IFUND_STITCH_ENTITLEMENTS_ENABLED",binding:"IFUND_STITCH_ENTITLEMENTS",batch:20},
 {id:"mission-deadlines",minutes:60,offset:10,flag:"IFUND_STITCH_DEADLINES_ENABLED",binding:"IFUND_STITCH_DEADLINES",batch:25},
 {id:"provider-sync",minutes:60,offset:15,flag:"IFUND_STITCH_PROVIDER_SYNC_ENABLED",binding:"IFUND_STITCH_PROVIDER_SYNC",batch:10},
 {id:"media-and-document-audit",minutes:60,offset:20,flag:"IFUND_STITCH_STORAGE_AUDIT_ENABLED",binding:"IFUND_STITCH_STORAGE_AUDIT",batch:10},
 {id:"verified-opportunity-refresh",minutes:360,offset:30,flag:"IFUND_STITCH_OPPORTUNITIES_ENABLED",binding:"IFUND_STITCH_OPPORTUNITIES",batch:10},
 {id:"growth-reporting",minutes:1440,offset:905,flag:"IFUND_STITCH_REPORTS_ENABLED",binding:"IFUND_STITCH_REPORTS",batch:20},
 {id:"delivery-notifications",minutes:15,offset:10,flag:"IFUND_STITCH_NOTIFICATIONS_ENABLED",binding:"IFUND_STITCH_NOTIFICATIONS",batch:20}
]);
// Cloudflare invokes cron ticks slightly after their nominal boundary.
// Normalize within the first minute of the intended slot, never using
// wall-clock time (which could shift a delayed retry into a different slot).
export function normalizeSlot(value){
 if(!Number.isSafeInteger(value)||value<1000000000)return null;
 const ms=value<10000000000?value*1000:value;
 if(ms<1000000000000||ms>=4102444800000)return null;
 const slot=Math.floor(ms/300000)*300000;
 return ms-slot<60000?slot:null;
}
export function due(job,scheduledTime){
 const slot=normalizeSlot(scheduledTime);
 return slot!==null&&(Math.floor(slot/60000)-job.offset)%job.minutes===0;
}
async function health(env){
 const checks=[];
 for(const [id,binding,path,verify] of [
  ["workflow","IFUND_WORKFLOW_HEALTH","/health",d=>d?.agent_ops_binding_ready===true&&d?.execution==="enabled"],
  ["notifications","IFUND_NOTIFICATION_HEALTH","/api/notifications/health",d=>d?.configured===true&&d?.authentication_required===true]
 ]){
  try{
   const r=await env[binding].fetch("https://ifund.internal"+path,{method:"GET"});
   const d=await r.json();
   checks.push({job:id,state:r.ok&&verify(d)?"ready":"degraded",status:r.status});
  }catch{checks.push({job:id,state:"unavailable"});}
 }
 return checks;
}
export async function runTick(event,env,emit=record=>console.log(JSON.stringify(record))){
 const scheduledTime=normalizeSlot(event?.scheduledTime);
 if(env.IFUND_STITCH_SCHEDULER_ENABLED!=="enabled"||scheduledTime===null)return [];
 const results=[];
 // Health probes do not execute any business workflow, consume AI, or publish content.
 if(env.IFUND_STITCH_HEALTH_ENABLED==="enabled"&&due({minutes:30,offset:0},scheduledTime)){
  results.push(...await health(env));
 }
 for(const job of JOBS){
  if(!due(job,scheduledTime)||env[job.flag]!=="enabled")continue;
  const bound=env[job.binding];
  if(!bound||typeof bound.tick!=="function"){results.push({job:job.id,state:"blocked_missing_binding"});continue;}
  try{
   // The consumer must enforce current consent, durable deduplication by
   // slotKey, lease, readiness, quotas, and current owner-approved action.
   const slotKey=job.id+":"+String(scheduledTime);
   const result=await bound.tick({job:job.id,scheduledAt:new Date(scheduledTime).toISOString(),slotKey,batchLimit:job.batch});
   if(!result||!["completed","idle","blocked","retry"].includes(result.state))throw Error("invalid receipt");
   results.push({job:job.id,state:result.state});
  }catch{results.push({job:job.id,state:"failed"});}
 }
 emit({service:"ifund-stitch-scheduler",scheduledTime,job:"dispatch",state:"completed",jobs:results.length});
 for(const result of results)emit({service:"ifund-stitch-scheduler",scheduledTime,...result});
 return results;
}
export default {
 fetch(){return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});},
 scheduled(event,env,ctx){ctx.waitUntil(runTick(event,env));}
};
