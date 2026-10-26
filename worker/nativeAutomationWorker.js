import { WorkflowEntrypoint } from "cloudflare:workers";
import { WORKFLOWS, AGENTS, CONNECTOR_IDS } from "./automationRegistry.js";
import { dispatchScheduled, runAutomationContract } from "./automationEngine.js";

const json=(value,status=200)=>new Response(JSON.stringify(value),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
});

// All 17 original workflow contracts share one durable Workflow class.
// No source handler is enabled by defining the class or a Worker binding.
export class IfundDurableWorkflow extends WorkflowEntrypoint {
  async run(event,step) {
    return runAutomationContract(event.payload,step,this.env);
  }
}
export default {
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if (request.method==="GET"&&path==="/health")
      return json({service:"ifund-independent-automations",state:"staged",
        active:false,source_workflows:WORKFLOWS.length,source_agents:AGENTS.length,
        source_connector_types:CONNECTOR_IDS.length});
    if (request.method==="GET"&&path==="/v1/workflows/catalog")
      return json({execution:"disabled",workflows:WORKFLOWS.map(x=>({
        name:x.id,trigger_type:x.kind,ported:x.ported===true
      }))});
    // Intentionally no HTTP start/dispatch endpoint. An Internet caller,
    // including a logged-in member, must not activate privileged workflows.
    return json({error:"Not found"},404);
  },
  async scheduled(event,env,ctx) {
    const task=dispatchScheduled(event,env,ctx);
    if (ctx?.waitUntil) ctx.waitUntil(task);
    else await task;
  },
};
