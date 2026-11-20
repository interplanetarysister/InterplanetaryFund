// Tab-scoped, owner-bound transport for human-approved campaign review.
// Agent responses are advice. Neither this module nor the route performs a DB write.
const KEY="ifund-agent-advice-handoff-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENTS=new Set(["nexus","story","orbit","polaris","forge","echo","pulse","link","discover"]);
const MAX_AGE=30*60*1000;
export class AgentAdviceHandoffError extends Error {}
export function rememberAgentAdvice(storage,{ownerId,answer,agent,campaignId=null},{now=Date.now(),id=crypto.randomUUID()}={}){
  if(!UUID.test(ownerId||"")||!UUID.test(id)||!AGENTS.has(agent)||
    (campaignId!==null&&!UUID.test(campaignId))||
    typeof answer!=="string"||!answer.trim()||answer.length>6000||
    !Number.isFinite(now))throw new AgentAdviceHandoffError("This agent answer cannot be opened in the campaign editor.");
  const record={version:1,id,owner_id:ownerId,campaign_id:campaignId,agent,answer:answer.trim(),created_at:now};
  try{storage.setItem(KEY,JSON.stringify(record));}
  catch{throw new AgentAdviceHandoffError("Browser draft storage is unavailable. Copy the answer before leaving this page.");}
  const target=campaignId
    ? "/campaigns/"+encodeURIComponent(campaignId)+"/edit?agentAdvice="+encodeURIComponent(id)
    : "/create?agentAdvice="+encodeURIComponent(id);
  return {id,target};
}
export function readAgentAdvice(storage,{ownerId,id,campaignId=null,now=Date.now()}){
  if(!UUID.test(ownerId||"")||!UUID.test(id||""))return null;
  let record;
  try{record=JSON.parse(storage.getItem(KEY));}catch{return null;}
  if(!record||record.version!==1||record.id!==id||record.owner_id!==ownerId||
    record.campaign_id!==campaignId||!AGENTS.has(record.agent)||
    typeof record.answer!=="string"||!record.answer.trim()||record.answer.length>6000||
    !Number.isFinite(record.created_at)||now<record.created_at||now-record.created_at>MAX_AGE)return null;
  return {...record};
}
export function forgetAgentAdvice(storage,scope){
  if(!readAgentAdvice(storage,scope))return false;
  try{storage.removeItem(KEY);return true;}catch{return false;}
}
