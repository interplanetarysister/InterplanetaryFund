import test from "node:test";
import assert from "node:assert/strict";
import worker,{JOBS,due,runTick,normalizeSlot} from "./index.mjs";
const time=Date.parse("2026-11-26T14:00:00Z");
const event={scheduledTime:time};
const base={IFUND_STITCH_SCHEDULER_ENABLED:"enabled"};
const run=(e=base,t=event)=>runTick(t,e,()=>{});
test("invalid ticks and disabled global flag fail closed",async()=>{
 assert.deepEqual(await run({}),[]);
 assert.deepEqual(await run(base,{scheduledTime:time+60000}),[]);
});
test("future jobs are all off unless explicitly enabled",async()=>{
 assert.deepEqual(await run(),[]);
 assert.equal(worker.fetch().status,404);
});
test("missing private binding is blocked",async()=>{
 assert.deepEqual(await run({...base,IFUND_STITCH_DISTRIBUTION_ENABLED:"enabled"}),[{job:"approved-distribution",state:"blocked_missing_binding"}]);
});
test("private dispatch carries stable idempotency key, bounded batch and exact timestamp",async()=>{
 const calls=[];const e={...base,IFUND_STITCH_DISTRIBUTION_ENABLED:"enabled",IFUND_STITCH_DISTRIBUTION:{tick:async v=>{calls.push(v);return {state:"idle"};}}};
 await run(e);await run(e,{scheduledTime:time+9000});
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].batchLimit,10);
 assert.equal(calls[0].slotKey,"approved-distribution:"+time);
});
test("failed consumer does not prevent other due jobs",async()=>{
 const r=await run({...base,IFUND_STITCH_DISTRIBUTION_ENABLED:"enabled",IFUND_STITCH_DISTRIBUTION:{tick:async()=>{throw Error("test")}},IFUND_STITCH_MEDIA_ENABLED:"enabled",IFUND_STITCH_MEDIA:{tick:async()=>({state:"idle"})}});
 assert.deepEqual(r,[{job:"approved-distribution",state:"failed"},{job:"media-recovery",state:"idle"}]);
});
test("only due jobs run",()=>{
 const d=JOBS.find(j=>j.id==="mission-deadlines");
 assert.equal(due(d,time),false);assert.equal(due(d,time+600000),true);
});
test("health check is read-only and reports degraded services",async()=>{
 const e={...base,IFUND_STITCH_HEALTH_ENABLED:"enabled",IFUND_WORKFLOW_HEALTH:{fetch:async(url,o)=>{assert.equal(o.method,"GET");return Response.json({execution:"enabled",agent_ops_binding_ready:true});}},IFUND_NOTIFICATION_HEALTH:{fetch:async()=>Response.json({configured:false,authentication_required:true})}};
 assert.deepEqual(await run(e),[{job:"workflow",state:"ready",status:200},{job:"notifications",state:"degraded",status:200}]);
 assert.deepEqual(await run(e,{scheduledTime:time+300000}),[]);
});

test("observed delayed production timestamps resolve to nominal five-minute slot",()=>{
 assert.equal(normalizeSlot(time+9000),time);
 assert.equal(normalizeSlot((time+9000)/1000),time);
 assert.equal(normalizeSlot(time+59999),time);
 assert.equal(normalizeSlot(time+60000),null);
 assert.equal(normalizeSlot(NaN),null);
});
test("valid idle cron emits receipt even when no job is due",async()=>{
 const receipts=[];await runTick({scheduledTime:time+309000},base,v=>receipts.push(v));
 assert.deepEqual(receipts,[{service:"ifund-stitch-scheduler",scheduledTime:time+300000,job:"dispatch",state:"completed",jobs:0}]);
});
