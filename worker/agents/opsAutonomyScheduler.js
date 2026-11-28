// Private service-binding entrypoint; no HTTP trigger for private agent jobs.
import {WorkerEntrypoint} from "cloudflare:workers";
import handler,{processAgentOpsTick} from "./opsAutonomy.js";
export class AgentOpsScheduler extends WorkerEntrypoint {
  ping(){return "ifund-agent-ops-scheduler-v1";}
  async tick(){
    const result=await processAgentOpsTick(this.env);
    return {state:result?.state||"unavailable"};
  }
}
export default handler;
