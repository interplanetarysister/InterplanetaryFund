import { readFileSync } from "node:fs";
import { WORKFLOWS, AGENTS, CONNECTOR_IDS } from "../worker/automationRegistry.js";
const fn=JSON.parse(readFileSync(new URL("../worker/legacyFunctionCatalog.json",import.meta.url),"utf8"));
const conf=JSON.parse(readFileSync(new URL("../wrangler.automations.jsonc",import.meta.url),"utf8"));
const failures=[];
if(WORKFLOWS.length!==17) failures.push("source workflow inventory incomplete");
if(AGENTS.length!==10) failures.push("agent inventory incomplete");
if(CONNECTOR_IDS.length!==11) failures.push("source connector inventory incomplete");
if(fn.functions.length!==184) failures.push("backend source function inventory incomplete");
for(const wf of WORKFLOWS) {
  if(wf.ported!==true) failures.push("workflow requires verified independent handler: "+wf.id);
}
for(const item of fn.functions) {
  if(!["ported","explicitly_retired_with_owner_approval"].includes(item.port_state))
    failures.push("unverified function: "+item.name);
}
if(conf.vars?.IFUND_AUTOMATIONS_ENABLED!=="enabled")
  failures.push("automation deployment is intentionally disabled");
if(!conf.triggers?.crons?.length)
  failures.push("no approved Cloudflare cron schedule");
if(!conf.workflows?.some(x=>x.binding==="IFUND_WORKFLOW"))
  failures.push("durable workflow binding not configured");
console.log("IFund worker cutover: "+(fn.functions.length-fn.functions.filter(x=>x.port_state==="unverified").length)+"/184 reviewed functions; "+
  WORKFLOWS.filter(x=>x.ported).length+"/17 independently ported workflows; "+
  AGENTS.length+" source agent contracts; "+failures.length+" release blockers.");
if(process.argv.includes("--summary")) {
  for(const m of failures.slice(0,12)) console.log("BLOCKED: "+m);
} else if(failures.length) {
  console.error(failures.slice(0,32).join("\n"));
  process.exitCode=1;
}
