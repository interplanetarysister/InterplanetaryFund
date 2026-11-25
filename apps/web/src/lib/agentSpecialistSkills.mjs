// Client-side bridge to the existing authenticated, owner-scoped specialist skill endpoint.
// This returns a local advisory checklist only; it is not external tool authority.
import { memberIdentity } from "./guestAccess.js";
const AGENTS = new Set(["nexus","story","orbit","polaris","forge","echo","pulse","link","discover"]);
export async function runIFundSpecialistSkill(client,{question,agent,ownerId,fetcher=fetch,signal}={}) {
  if(!AGENTS.has(agent)||typeof question!=="string"||question.trim().length<8||question.length>2000)
    throw Error("Choose an available agent and a question of 8–2,000 characters.");
  const identity=await client.auth.getUser();
  if(identity.error||!memberIdentity(identity.data?.user)||identity.data.user.id!==ownerId)
    throw Error("Your account changed. Please sign in again.");
  const session=await client.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==ownerId||!session.data.session.access_token)
    throw Error("Your session could not be confirmed.");
  const response=await fetcher("/api/agents/team/practice",{
    method:"POST",signal,
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.data.session.access_token},
    body:JSON.stringify({agent,question:question.trim()}),
  });
  const data=await response.json().catch(()=>null);
  const after=await client.auth.getUser();
  if(after.error||after.data?.user?.id!==ownerId)
    throw Error("Your account changed. Discarded the previous skill result.");
  if(!response.ok)
    throw Error(typeof data?.error==="string"?data.error.slice(0,250):"The selected specialist skill is unavailable.");
  const item=data?.result;
  if(data?.ok!==true||data.task!=="practice"||data.actions_performed!==false||
    data.external_publishing!==false||data.payments_performed!==false||
    item?.agent!==agent||item.status!=="executed_local_advisory"||
    item.actions_performed!==false||item.external_actions!==false||
    typeof item.skill!=="string"||item.skill.length>120||
    !Array.isArray(item.checklist)||item.checklist.length<1||item.checklist.length>8||
    item.checklist.some(x=>typeof x!=="string"||x.length<1||x.length>300))
    throw Error("The specialist skill result could not be verified.");
  return {agent,skill:item.skill,checklist:item.checklist,advisory:true};
}
