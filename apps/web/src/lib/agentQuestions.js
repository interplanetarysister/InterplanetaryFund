// One user-initiated advisory question to the IFund specialist gateway.
// Authenticated state is independently checked before AND after the request.
import { memberIdentity } from "./guestAccess.js";

export const TEAM_QUESTION_LIMIT=2000;
export async function askIFundAgent(client,{question,agent="auto",ownerId,fetcher=fetch,signal}){
  if(typeof question!=="string" || question.trim().length<1 ||
     question.length>TEAM_QUESTION_LIMIT)
    throw Error("Enter a message of 1–2,000 characters.");
  const current=await client.auth.getUser();
  if(current.error || !memberIdentity(current.data?.user) ||
     current.data.user.id!==ownerId)
    throw Error("Your account changed. Please sign in again.");
  const session=await client.auth.getSession();
  if(session.error || session.data?.session?.user?.id!==ownerId ||
     !session.data.session.access_token)
    throw Error("Your session could not be confirmed.");
  const response=await fetcher("/api/agents/team/question",{
    method:"POST",
    headers:{"Content-Type":"application/json",
      Authorization:"Bearer "+session.data.session.access_token},
    body:JSON.stringify({request_id:crypto.randomUUID(),question:question.trim(),agent}),signal,
  });
  const result=await response.json().catch(()=>null);
  const again=await client.auth.getUser();
  if(again.error || again.data?.user?.id!==ownerId)
    throw Error("Your account changed. Discarded the previous response.");
  if(!response.ok)
    throw Error(typeof result?.error==="string" ? result.error.slice(0,350) :
      "The selected agent is unavailable.");
  if(!result || typeof result.answer!=="string" ||
     !result.answer.trim() || result.answer.length>6000 ||
     result.actions_performed!==false ||
     !["nexus","story","orbit","polaris","forge","echo","pulse","link","discover"].includes(result.agent))
    throw Error("The agent response could not be verified.");
  // Never fabricate model/tool activity in the UI. Only accept complete,
  // correctly-shaped consultation receipts from the authorized backend.
  const consultations=Array.isArray(result.consultations) &&
    result.consultations.length<=2 &&
    result.agent==="nexus" &&
    result.consultations.every(call=>
      call && ["story","orbit","polaris","forge","echo","pulse","link","discover"].includes(call.agent) &&
      call.status==="completed" && call.kind==="advisory_analysis" &&
      typeof call.summary==="string" && call.summary.length>0 && call.summary.length<=1600)
    ? result.consultations : [];
  return {agent:result.agent,answer:result.answer.trim(),
    consultations,coordination_needed:result.coordination_needed===true,context_saved:result.context_saved===true};
}
