// Scoped, authenticated execution of iFund's built-in advisory skills.
// No browser or LLM-supplied owner identifiers, money, publishing or provider actions.
import {memberApi,reply,fail} from "./memberApi.js";
import {readJsonBody,BodyError} from "../bodyLimit.js";
import {runSpecialistPractice} from "./agentPracticalSkills.mjs";
import {researchPublicPractice} from "./agentResearchTool.mjs";
import {assessAgentAction} from "./agentActionPolicy.mjs";
import {TEAM_CONTEXT_AGENTS} from "./teamContext.js";
export function validatePracticeInput(raw,kind){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid task request");
 const allowed=kind==="practice"?["agent","question"]:["agent","source_id"];
 if(Object.keys(raw).some(k=>!allowed.includes(k))||!TEAM_CONTEXT_AGENTS.includes(raw.agent))
   throw Error("Invalid specialist task");
 if(kind==="practice"&&(typeof raw.question!=="string"||raw.question.trim().length<8||
   raw.question.length>2000))throw Error("Invalid question");
 if(kind==="research"&&(typeof raw.source_id!=="string"||
   !/^[a-z]{3,24}$/.test(raw.source_id)))throw Error("Invalid research reference");
 return raw;
}
export async function routeAgentPracticeTask(request,env,fetcher=fetch){
 const path=new URL(request.url).pathname;
 if(!["/api/agents/team/practice","/api/agents/team/research"].includes(path))
   return reply(404,{error:"Not found."});
 if(request.method!=="POST")return reply(405,{error:"Method not allowed."});
 const kind=path.endsWith("/practice")?"practice":"research";
 if(kind==="research"&&env.IFUND_AGENT_PUBLIC_RESEARCH_ENABLED!=="enabled")
   return reply(503,{error:"Curated public research is not enabled here."});
 try{
  const api=await memberApi(request,env,fetcher);
  if(kind==="research"&&(await api.rpc("ifund_current_user_is_verified_admin"))!==true)
   fail(403,"Research submission is limited to verified training reviewers.");
  const campaignAI=await api.aiPermission("campaign",false);
  const internalAI=await api.futureInternalAIPermission("recommendation",false);
  if(!campaignAI&&!internalAI)fail(403,"Enable private AI assistance in My Account.");
  const body=await readJsonBody(request,3200);
  const input=validatePracticeInput(body,kind);
  const permission=assessAgentAction(kind==="practice"?"practice_skill":"research_synthesis",{
   identityVerified:true,ownerScoped:true
  });
  if(!permission.allowed)fail(403,"Specialist task is not authorized.");
  const result=kind==="practice"
   ?runSpecialistPractice({agent:input.agent,question:input.question,identityVerified:true,ownerScoped:true})
   :await researchPublicPractice({agent:input.agent,sourceId:input.source_id,fetcher,enabled:true});
  return reply(200,{ok:true,task:kind,result,actions_performed:false,
   external_publishing:false,payments_performed:false});
 }catch(error){
  if(error instanceof BodyError)return reply(error.status||400,{error:"Invalid task input."});
  const status=Number.isInteger(error?.status)?error.status:
   /Invalid|Unknown|Unapproved/.test(error?.message||"")?400:503;
  return reply(status,{error:status===503?"The specialist tool is temporarily unavailable.":String(error.message).slice(0,170)});
 }
}
