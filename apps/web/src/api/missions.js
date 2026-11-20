// What If? Engine — private, account-scoped Mission client.
// No client operation authorizes OAuth, provider verification, publishing, financial changes, or agent execution.
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { TERMS_VERSION } from "../lib/legalPolicy.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSION_FIELDS="id,owner_id,title,original_prompt,goal_type,desired_outcome,summary,status,privacy,current_plan_version,revision,created_at,updated_at,completed_at,archived_at";
const TASK_FIELDS="id,mission_id,owner_id,milestone_key,title,description,state,sort_order,due_at,completed_at,revision,created_at,updated_at";
const TYPES=new Set(["emergency","personal","education","business","creative","community","environment","other"]);
const STATES=new Set(["draft","planned","in_progress","completed","archived"]);
const TASK_STATES=new Set(["todo","in_progress","blocked","done","cancelled"]);
const ensureUuid=(v,label)=>{if(!UUID.test(v||""))throw new Error("Invalid "+label);return v;};
const text=(v,max,label,required=false)=>{
 if(typeof v!=="string"||v.length>max||(required&&!v.trim()))throw new Error("Invalid "+label);
 return v.trim();
};
export class MissionConflictError extends Error{
 constructor(message="A newer Mission revision exists. Reload before editing."){super(message);this.name="MissionConflictError";}
}
async function verifiedOwner(client,needTerms=false){
 const {data,error}=await client.auth.getUser(), u=data?.user;
 if(error||!UUID.test(u?.id||"")||u.is_anonymous===true||!u.email_confirmed_at)
  throw new Error("A confirmed email account is required to save Missions.");
 const lifecycle=await verifyAccountLifecycle(client,u);
 if(!lifecycle.ok)throw new Error(lifecycle.message||"Your account is inactive.");
 if(needTerms){
  const t=await client.from("ifund_legal_acceptances").select("owner_id,terms_version,explicit_consent")
   .eq("owner_id",u.id).eq("terms_version",TERMS_VERSION).maybeSingle();
  if(t.error||t.data?.owner_id!==u.id||t.data?.explicit_consent!==true)
   throw new Error("Accept the current member agreement before saving.");
 }
 return u.id;
}
async function sessionStillOwner(client,id){
 const {data,error}=await client.auth.getUser();
 if(error||data?.user?.id!==id)throw new Error("Your account changed. Reload private Missions.");
}
export async function createMission(client,{prompt,title="",goalType="other",desiredOutcome="",summary=""}){
 const ownerId=await verifiedOwner(client,true);
 if(!TYPES.has(goalType))throw new Error("Invalid Mission type.");
 const payload={
  owner_id:ownerId,original_prompt:text(prompt,12000,"prompt",true),
  title:text(title,160,"title"),goal_type:goalType,
  desired_outcome:text(desiredOutcome,4000,"desired outcome"),summary:text(summary,4000,"summary")
 };
 const r=await client.from("ifund_missions").insert(payload).select(MISSION_FIELDS).single();
 if(r.error||r.data?.owner_id!==ownerId)throw new Error("Mission save was not confirmed.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function listMissions(client,{limit=30,before=null}={}){
 const ownerId=await verifiedOwner(client);
 let q=client.from("ifund_missions").select(MISSION_FIELDS).eq("owner_id",ownerId)
  .order("updated_at",{ascending:false}).order("id",{ascending:false})
  .limit(Math.min(Math.max(1,Number(limit)||30),100));
 if(before)q=q.lt("updated_at",String(before));
 const r=await q;
 if(r.error||!Array.isArray(r.data)||r.data.some(v=>v.owner_id!==ownerId))
  throw new Error("Unable to verify your Mission list.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function loadMission(client,id){
 ensureUuid(id,"Mission ID");
 const ownerId=await verifiedOwner(client);
 const r=await client.from("ifund_missions").select(MISSION_FIELDS)
  .eq("id",id).eq("owner_id",ownerId).maybeSingle();
 if(r.error||!r.data||r.data.owner_id!==ownerId)throw new Error("Mission not found or access denied.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function updateMission(client,id,expectedRevision,changes={}){
 ensureUuid(id,"Mission ID");
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error("Missing revision.");
 const ownerId=await verifiedOwner(client,true),patch={revision:expectedRevision+1};
 if(Object.hasOwn(changes,"title"))patch.title=text(changes.title,160,"title");
 if(Object.hasOwn(changes,"summary"))patch.summary=text(changes.summary,4000,"summary");
 if(Object.hasOwn(changes,"desired_outcome"))patch.desired_outcome=text(changes.desired_outcome,4000,"outcome");
 if(Object.hasOwn(changes,"goal_type")){
  if(!TYPES.has(changes.goal_type))throw new Error("Invalid goal type.");
  patch.goal_type=changes.goal_type;
 }
 if(Object.hasOwn(changes,"status")){
  if(!STATES.has(changes.status))throw new Error("Invalid status.");
  patch.status=changes.status;
 }
 if(Object.keys(patch).length===1)throw new Error("No editable fields supplied.");
 const r=await client.from("ifund_missions").update(patch)
  .eq("id",id).eq("owner_id",ownerId).eq("revision",expectedRevision)
  .select(MISSION_FIELDS).maybeSingle();
 if(r.error)throw new Error("Unable to save Mission changes.");
 if(!r.data)throw new MissionConflictError();
 if(r.data.owner_id!==ownerId||r.data.revision!==expectedRevision+1)throw new Error("Invalid save receipt.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function listMissionPlans(client,id){
 ensureUuid(id,"Mission ID");const ownerId=await verifiedOwner(client);
 const r=await client.from("ifund_mission_plan_versions")
  .select("id,mission_id,owner_id,version,input_revision,structured_plan,source_kind,model_id,evidence_note,created_at")
  .eq("mission_id",id).eq("owner_id",ownerId).order("version",{ascending:false}).limit(40);
 if(r.error||!Array.isArray(r.data)||r.data.some(v=>v.owner_id!==ownerId))throw new Error("Unable to read plan history.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function listMissionTasks(client,id){
 ensureUuid(id,"Mission ID");const ownerId=await verifiedOwner(client);
 const r=await client.from("ifund_mission_tasks").select(TASK_FIELDS)
  .eq("mission_id",id).eq("owner_id",ownerId).order("sort_order").limit(300);
 if(r.error||!Array.isArray(r.data)||r.data.some(v=>v.owner_id!==ownerId))throw new Error("Unable to read tasks.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function addMissionTask(client,id,{title,description="",milestoneKey=null,sortOrder=0,dueAt=null}){
 ensureUuid(id,"Mission ID");const ownerId=await verifiedOwner(client,true);
 const payload={
  mission_id:id,owner_id:ownerId,title:text(title,240,"task title",true),
  description:text(description,4000,"description"),
  milestone_key:milestoneKey===null?null:text(milestoneKey,120,"milestone"),
  sort_order:Number.isSafeInteger(sortOrder)?sortOrder:0,due_at:dueAt
 };
 const r=await client.from("ifund_mission_tasks").insert(payload).select(TASK_FIELDS).single();
 if(r.error||r.data?.owner_id!==ownerId||r.data?.mission_id!==id)throw new Error("Task save unconfirmed.");
 await sessionStillOwner(client,ownerId);return r.data;
}
export async function setMissionTaskState(client,missionId,taskId,expectedRevision,state){
 ensureUuid(missionId,"Mission ID");ensureUuid(taskId,"Task ID");
 if(!TASK_STATES.has(state)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)
  throw new Error("Invalid task transition.");
 const ownerId=await verifiedOwner(client,true);
 const r=await client.from("ifund_mission_tasks").update({state,revision:expectedRevision+1})
  .eq("mission_id",missionId).eq("id",taskId).eq("owner_id",ownerId)
  .eq("revision",expectedRevision).select(TASK_FIELDS).maybeSingle();
 if(r.error)throw new Error("Task update failed.");
 if(!r.data)throw new MissionConflictError("Task changed in another session.");
 if(r.data.owner_id!==ownerId||r.data.revision!==expectedRevision+1)throw new Error("Invalid task receipt.");
 await sessionStillOwner(client,ownerId);return r.data;
}
// Explicitly read-only: provider status cannot be written or forged by the member client.
export async function getMissionIntegrationStatus(client,missionId){
 ensureUuid(missionId,"Mission ID");const ownerId=await verifiedOwner(client);
 const [c,a,o]=await Promise.all([
  client.from("ifund_mission_connection_intents")
   .select("id,provider,requested_capability,state,authorized_at,revoked_at,created_at")
   .eq("mission_id",missionId).eq("owner_id",ownerId),
  client.from("ifund_mission_agent_actions")
   .select("id,agent_id,action_kind,status,description,approved_at,created_at")
   .eq("mission_id",missionId).eq("owner_id",ownerId),
  client.from("ifund_mission_opportunity_matches")
   .select("id,title,provider_name,source_status,match_status,checked_at,expires_at")
   .eq("mission_id",missionId).eq("owner_id",ownerId)
 ]);
 if(c.error||a.error||o.error)throw new Error("Provider and agent status unavailable.");
 await sessionStillOwner(client,ownerId);
 return {connections:c.data||[],agents:a.data||[],opportunities:o.data||[]};
}

// A plan is saved only AFTER the owner reviews it; this RPC atomically versions it
// and creates initial tasks. It never authenticates a provider or publishes anything.
export async function saveReviewedMissionPlan(client,missionId,expectedRevision,structuredPlan,{requestId}={}){
 ensureUuid(missionId,"Mission ID");
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)throw new Error("Missing plan revision.");
 const id=ensureUuid(requestId||crypto.randomUUID(),"plan request ID");
 if(!structuredPlan||typeof structuredPlan!=="object"||Array.isArray(structuredPlan)||
    typeof structuredPlan.summary!=="string"||!structuredPlan.summary.trim()||
    !Array.isArray(structuredPlan.steps)||structuredPlan.steps.length>20)
    throw new Error("Review a summary and up to 20 steps before saving.");
 const owner=await verifiedOwner(client,true);
 const r=await client.rpc("ifund_mission_save_reviewed_plan",{
   p_mission_id:missionId,p_request_id:id,p_expected_revision:expectedRevision,p_plan:structuredPlan
 });
 if(r.error||r.data?.id!==id||r.data?.mission_id!==missionId||
    !Number.isInteger(r.data?.version)||!Number.isInteger(r.data?.revision))
   throw new Error(r.error?.code==="40001"?"Mission changed. Reload before saving this plan.":
     "Plan save could not be verified; retry with the same request ID.");
 await sessionStillOwner(client,owner);
 return r.data;
}
export async function linkCampaignToMission(client,missionId,campaignId){
 ensureUuid(missionId,"Mission ID");ensureUuid(campaignId,"campaign ID");
 const owner=await verifiedOwner(client,true);
 const r=await client.rpc("ifund_mission_link_owned_campaign",{
   p_mission_id:missionId,p_campaign_id:campaignId
 });
 if(r.error||r.data?.mission_id!==missionId||r.data?.campaign_id!==campaignId)
   throw new Error("Your campaign saved but could not be linked to this Mission. Reopen the Mission to retry.");
 await sessionStillOwner(client,owner);
 return r.data;
}
export async function listMissionCampaignLinks(client,missionId){
 ensureUuid(missionId,"Mission ID");
 const owner=await verifiedOwner(client);
 const r=await client.from("ifund_mission_campaign_links")
   .select("id,mission_id,owner_id,campaign_id,linked_at")
   .eq("mission_id",missionId).eq("owner_id",owner)
   .order("linked_at",{ascending:false}).limit(30);
 if(r.error||!Array.isArray(r.data)||r.data.some(x=>x.owner_id!==owner))
   throw new Error("Campaign associations could not be verified.");
 await sessionStillOwner(client,owner);return r.data;
}
// Guest: the response is intentionally provisional and does not persist a prompt.
export async function exploreMission(prompt,{fetcher=fetch}={}){
 const response=await fetcher("/api/missions/explore",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({prompt}),signal:AbortSignal.timeout(16000)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(data?.error||"Planning preview unavailable; saving privately is still possible.");
 if(data?.provisional!==true||data.provider_actions_executed!==0||
    data.provider_funding_confirmed!==false)throw new Error("Planning preview could not be verified.");
 return data;
}
// Signed-in AI inference generates an UNPERSISTED draft requiring explicit Save.
export async function suggestMissionPlan(client,missionId,revision,{requestId=crypto.randomUUID(),fetcher=fetch}={}){
 ensureUuid(missionId,"Mission ID");ensureUuid(requestId,"planning request ID");
 const owner=await verifiedOwner(client);
 const {data:auth,error}=await client.auth.getSession();
 if(error||auth?.session?.user?.id!==owner||!auth?.session?.access_token)
   throw new Error("Sign in before requesting AI planning.");
 const response=await fetcher("/api/missions/plan",{
   method:"POST",
   headers:{"content-type":"application/json",authorization:"Bearer "+auth.session.access_token},
   body:JSON.stringify({mission_id:missionId,revision,request_id:requestId}),
   signal:AbortSignal.timeout(90000)
 });
 const data=await response.json().catch(()=>null);
 await sessionStillOwner(client,owner);
 if(!response.ok)throw Object.assign(
   new Error(data?.error||"Mission planning is unavailable; manual tasks still work."),
   {code:data?.code||"unavailable"}
 );
 if(data?.saved!==false||data.ai_inference!==true||
    data.requires_owner_review!==true||data.mission_id!==missionId||
    data.input_revision!==revision||
    !data.plan||!Array.isArray(data.plan.steps))
   throw new Error("AI planning returned an unverified response. Nothing was saved.");
 return data.plan;
}
