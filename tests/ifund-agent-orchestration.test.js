import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planAgentConsultations,validateConsultation,nexusSynthesisMessages,MAX_NEXUS_SPECIALISTS} from "../worker/agents/teamOrchestration.js";
import {routeTeamQuestion,validateTeamQuestion} from "../worker/agents/teamQuestion.js";
const UID="11111111-1111-4111-8111-111111111111";
const KEY="22222222-2222-4222-8222-222222222222";
const request=(question,agent="auto")=>new Request("https://ifund.test/api/agents/team/question",{
  method:"POST",headers:{authorization:"Bearer good.token","content-type":"application/json"},
  body:JSON.stringify({request_id:KEY,question,agent})
});
function harness({failure=false}={}){
 const rpc=[],inferences=[];
 const fetcher=async(url)=>{
  if(url.endsWith("/auth/v1/user"))return Response.json({id:UID,email_confirmed_at:"2026-11-01T00:00:00Z",is_anonymous:false});
  if(url.endsWith("/rpc/ifund_current_account_is_active"))return Response.json(true);
  if(url.includes("/ifund_ai_permission_preferences?")){
   return Response.json([{owner_id:UID,allow_ai_campaign_drafts:true,allow_ai_outreach_drafts:true,allow_future_internal_ai_assistance:true}]);
  }
  if(url.endsWith("/rpc/ifund_reserve_agent_question")){rpc.push("reserve");return Response.json({allowed:true,state:"reserved",remaining:10});}
  if(url.endsWith("/rpc/ifund_complete_agent_question")){rpc.push("complete");return Response.json(true);}
  if(url.endsWith("/rpc/ifund_release_agent_question")){rpc.push("release");return Response.json(true);}
  throw Error("Unexpected "+url);
 };
 const env={IFUND_TEAM_QUESTIONS_ENABLED:"enabled",
   SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"public-test",
   AI:{run:async(model,params)=>{
     inferences.push(params.messages);
     if(failure&&inferences.length===2)throw Error("Simulated specialist failure");
     return {response:"Verified costs and beneficiary story should be clearly separated from assumptions."};
   }}};
 return {fetcher,env,rpc,inferences};
}
test("NEXUS schedules specialist calls only for real mixed-topic requests",()=>{
 const multi=validateTeamQuestion({request_id:KEY,question:"Review my campaign story and budget spending",agent:"auto"});
 assert.equal(multi.selected,"nexus");
 assert.deepEqual(planAgentConsultations(multi),["orbit","story"]);
 assert.deepEqual(planAgentConsultations({...multi,selected:"orbit"}),[]);
 assert.deepEqual(planAgentConsultations({...multi,selected:"nexus",recommendation:{topics:["story"],requiresCoordination:false}}),["story"]);
 assert.ok(MAX_NEXUS_SPECIALISTS<=2);
 assert.deepEqual(planAgentConsultations(validateTeamQuestion({request_id:KEY,question:"Review my campaign story",agent:"auto"})),[]);
});
test("NEXUS executes specialists then synthesis; response holds genuine icon receipts",async()=>{
 const h=harness();
 const response=await routeTeamQuestion(request("Please improve the campaign story and budget"),h.env,h.fetcher);
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.agent,"nexus");
 assert.equal(body.actions_performed,false);
 assert.deepEqual(h.rpc,["reserve","complete"]);
 assert.equal(h.inferences.length,3);
 assert.deepEqual(body.consultations.map(call=>call.agent),["orbit","story"]);
 assert.ok(body.consultations.every(call=>call.status==="completed"&&call.kind==="advisory_analysis"));
 assert.match(h.inferences[1].at(-1).content,/previous_specialist_findings/);
 assert.match(h.inferences[1].at(-1).content,/orbit/);
 assert.match(h.inferences[2][0].content,/NEXUS/);
 assert.match(h.inferences[2][1].content,/completed_read_only_specialist_analyses/);
 assert.doesNotMatch(h.inferences[0][0].content,/Integrate the independent specialist findings/);
});
test("single-specialist request has one inference and no made-up consultation",async()=>{
 const h=harness();
 const response=await routeTeamQuestion(request("Please help me rewrite my campaign story"),h.env,h.fetcher);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.agent,"story");
 assert.deepEqual(body.consultations,[]);
 assert.equal(h.inferences.length,1);
});
test("failed consultation cannot be displayed as completed; quota released",async()=>{
 const h=harness({failure:true});
 const response=await routeTeamQuestion(request("Review my story and budget"),h.env,h.fetcher);
 assert.equal(response.status,503);
 assert.deepEqual(h.rpc,["reserve","release"]);
 assert.equal(h.inferences.length,2);
});
test("untrusted specialist text is bounded before NEXUS synthesis",()=>{
 const item=validateConsultation({response:"Evidence-based recommendations."},"story");
 assert.equal(item.status,"completed");
 assert.throws(()=>validateConsultation({response:"X".repeat(3001)},"story"),/valid advisory/);
 assert.throws(()=>validateConsultation({response:"hello"},"unknown"),/Unknown/);
 assert.match(nexusSynthesisMessages({question:"x",consultations:[item]})[1].content,/story/);
 assert.throws(()=>nexusSynthesisMessages({question:"x",consultations:[]}),/Verified specialist/);
});
test("agent interfaces render genuine service receipts with their governed icons",()=>{
 const trail=readFileSync(new URL("../apps/web/src/components/agents/AgentConsultationTrail.jsx",import.meta.url),"utf8");
 const panel=readFileSync(new URL("../apps/web/src/components/agents/AgentSidePanel.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../apps/web/src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
 assert.match(trail,/AgentIdentityIcon identity=\{call.agent\}/);
 assert.match(trail,/call.status!=="completed"/);
 assert.match(panel,/AgentConsultationTrail consultations=\{message.consultations\}/);
 assert.match(page,/AgentConsultationTrail consultations=\{agentReply.consultations\}/);
 assert.match(page,/Proposed specialist calls:/);
});

test("REACH front desk consults only its own backend specialists", async () => {
  const { planAgentConsultations, frontDeskSynthesisMessages } = await import("../worker/agents/teamOrchestration.js");
  const { recommendAgent, frontAgentForSpecialist, isFrontDeskAgent } = await import("../apps/web/src/lib/agentTrainingDirectory.mjs");
  assert.equal(isFrontDeskAgent("reach"), true);
  assert.equal(frontAgentForSpecialist("echo"), "reach");
  assert.equal(frontAgentForSpecialist("pulse"), "reach");
  assert.equal(frontAgentForSpecialist("link"), "reach");
  assert.equal(frontAgentForSpecialist("forge"), "reach");
  assert.equal(frontAgentForSpecialist("story"), "story");
  // A connections question routed to LINK is planned for REACH as a LINK consult.
  const rec = recommendAgent("my oauth connection repair for a linked account");
  const planned = planAgentConsultations({ question: "q", selected: "reach", recommendation: rec });
  assert.deepEqual(planned, ["link"]);
  // Topics outside REACH's scope are never planned for it.
  const storyRec = recommendAgent("help rewrite my campaign story headline");
  assert.deepEqual(planAgentConsultations({ question: "q", selected: "reach", recommendation: storyRec }), []);
  // Synthesis presents one REACH voice and rejects non-backend consultations.
  const messages = frontDeskSynthesisMessages({ front: "reach", question: "How do I fix my connection?",
    consultations: [{ agent: "link", status: "completed", summary: "The OAuth grant expired." }] });
  assert.match(messages[0].content, /You are REACH/);
  assert.match(messages[1].content, /connections/);
  assert.throws(() => frontDeskSynthesisMessages({ front: "reach", question: "q",
    consultations: [{ agent: "story", status: "completed", summary: "x" }] }), /front-desk/i);
});

test("NEXUS dispatch prepares explicit single-domain action requests only", async () => {
  const { detectDispatchIntent, buildDispatch, dispatchEventKey } = await import("../worker/agents/chiefOfStaffDispatch.js");
  const { replyEventKey } = await import("../worker/agents/teamContext.js");
  // Explicit action + one specialist domain -> dispatch.
  assert.deepEqual(detectDispatchIntent("Draft my campaign story for the food drive"), { specialist: "story" });
  assert.deepEqual(detectDispatchIntent("Prepare a thank-you email for my supporters"), { specialist: "echo" });
  assert.deepEqual(detectDispatchIntent("Fix my oauth connection repair"), { specialist: "link" });
  // Pure questions are advisory, never dispatched.
  assert.equal(detectDispatchIntent("How do I write a campaign story?"), null);
  assert.equal(detectDispatchIntent("What is a good strategy for my goal?"), null);
  // No action verb, or mixed domains, stays advisory.
  assert.equal(detectDispatchIntent("Tell me about referral attribution"), null);
  assert.equal(detectDispatchIntent("Draft my story and prepare a budget breakdown"), null);
  const dispatch = buildDispatch({ question: "Draft my campaign story for the food drive", requestId: UID });
  assert.equal(dispatch.status, "prepared");
  assert.equal(dispatch.specialist, "story");
  assert.equal(dispatch.actions_performed, false);
  assert.equal(dispatch.requires_member_launch, true);
  assert.match(dispatch.workspace_path, /^\//);
  // Dispatch idempotency key is a valid UUID distinct from message/reply keys.
  const key = dispatchEventKey(UID);
  assert.match(key, /^[0-9a-f-]{36}$/i);
  assert.notEqual(key, UID);
  assert.notEqual(key, replyEventKey(UID));
  assert.equal(dispatchEventKey(UID), key);
});

test("Refine Knowledge About Your Goal prepares a full, unlimited research plan", async () => {
  const { detectRefineKnowledgeIntent, buildGoalKnowledgePlan, detectGoalCategory,
    refineEventKey, anonymizeForCategoryPlaybook, GOAL_KNOWLEDGE_AREAS } =
    await import("../worker/agents/goalKnowledge.js");
  const { dispatchEventKey } = await import("../worker/agents/chiefOfStaffDispatch.js");
  const { replyEventKey } = await import("../worker/agents/teamContext.js");
  // Explicit refine/deep-research asks, and research about a goal, trigger it.
  assert.equal(detectRefineKnowledgeIntent("Please deep research my goal before we publish"), true);
  assert.equal(detectRefineKnowledgeIntent("Refine knowledge about your goal for my fundraiser"), true);
  assert.equal(detectRefineKnowledgeIntent("Can you research my campaign plan?"), true);
  // Ordinary questions do not.
  assert.equal(detectRefineKnowledgeIntent("How do I write a campaign story?"), false);
  assert.equal(detectRefineKnowledgeIntent("What is a good budget for a bake sale?"), false);
  // Category detection is broad, and an unknown goal still gets a full plan.
  assert.equal(detectGoalCategory("Help with surgery bills for my dad"), "medical");
  assert.equal(detectGoalCategory("Raise money for the animal rescue"), "animals");
  const plan = buildGoalKnowledgePlan({ question: "Deep research my goal: surgery bills", origin: "chat" });
  assert.equal(plan.kind, "goal_knowledge_refinement");
  assert.equal(plan.label, "Refine Knowledge About Your Goal");
  assert.equal(plan.status, "prepared");
  assert.equal(plan.category, "medical");
  // No knowledge area is withheld: the plan covers every area, the full
  // practice source set, and is shared with the whole team.
  assert.deepEqual(plan.knowledge_areas, [...GOAL_KNOWLEDGE_AREAS]);
  assert.deepEqual(plan.practice_source_ids, ["ethics", "transparency", "planning", "outreach"]);
  assert.equal(plan.shared_with_team, true);
  assert.ok(plan.research_questions.length >= 8);
  assert.ok(plan.research_questions.some(q => /fastest/i.test(q)));
  assert.ok(plan.research_questions.some(q => /easiest/i.test(q)));
  // Honesty + privacy contract.
  assert.equal(plan.research_completed, false);
  assert.equal(plan.actions_performed, false);
  assert.equal(plan.private_user_data_sent_externally, false);
  assert.equal(plan.save_to_private_space, true);
  assert.equal(plan.brief_expires_after_days, 90);
  assert.equal(plan.cross_campaign_learning.anonymized_only, true);
  assert.equal(plan.cross_campaign_learning.requires_super_admin_approval, true);
  assert.equal(plan.cross_campaign_learning.training_promoted, false);
  const general = buildGoalKnowledgePlan({ question: "Research my plan for something new" });
  assert.equal(general.category, "general");
  assert.deepEqual(general.knowledge_areas, [...GOAL_KNOWLEDGE_AREAS]);
  // Refine idempotency key is distinct from message, reply and dispatch keys.
  const key = refineEventKey(UID);
  assert.match(key, /^[0-9a-f-]{36}$/i);
  assert.notEqual(key, UID);
  assert.notEqual(key, replyEventKey(UID));
  assert.notEqual(key, dispatchEventKey(UID));
  assert.equal(refineEventKey(UID), key);
  // Cross-campaign learning strips personal data and stays unpromoted.
  const candidate = anonymizeForCategoryPlaybook({ category: "medical",
    findings: "Email jane@example.com or see https://example.com/x, goal was $5,000, call 555-123-4567. Short updates with proof worked." });
  assert.equal(candidate.personal_data_removed, true);
  assert.equal(candidate.training_promoted, false);
  assert.equal(candidate.requires_super_admin_approval, true);
  assert.doesNotMatch(candidate.findings, /jane@example\.com|example\.com|\$5,000|555-123-4567/);
  assert.match(candidate.findings, /Short updates with proof worked/);
});

test("Refine Knowledge tier gate: subscribers and verified admins only, fail closed", async () => {
  const { classifyMemberAccess, extractGoalKnowledgeFromHistory, goalKnowledgeApplicationSummary,
    buildGoalKnowledgePlan } = await import("../worker/agents/goalKnowledge.js");
  // Verified admin / super-admin (enterprise, admin_granted) is eligible.
  assert.deepEqual(classifyMemberAccess({ tier: "enterprise", level: 4, status: "active", active: true, admin_granted: true }),
    { kind: "admin", eligible: true, tier: "enterprise", level: 4, verified: true });
  // Paying subscribers at any paid level are eligible.
  assert.equal(classifyMemberAccess({ tier: "basic", level: 1, status: "active", active: true, admin_granted: false }).kind, "subscriber");
  assert.equal(classifyMemberAccess({ tier: "professional", level: 3, status: "active", active: true, admin_granted: false }).eligible, true);
  // Free tier is not eligible.
  assert.deepEqual(classifyMemberAccess({ tier: "free", level: 0, status: "inactive", active: false, admin_granted: false }),
    { kind: "free", eligible: false, tier: "free", level: 0, verified: true });
  // Lapsed/inactive paid rows and unverifiable answers fail closed.
  assert.equal(classifyMemberAccess({ tier: "basic", level: 1, status: "cancelled", active: false, admin_granted: false }).eligible, false);
  assert.equal(classifyMemberAccess(null).eligible, false);
  assert.equal(classifyMemberAccess(undefined).eligible, false);
  assert.equal(classifyMemberAccess({ admin_granted: "yes", active: "true", level: "4" }).eligible, false);
  assert.equal(classifyMemberAccess({ tier: "enterprise", level: 4, active: true, admin_granted: false }).kind, "subscriber");
});

test("Agents can find and apply previously refined goal knowledge from team history", async () => {
  const { extractGoalKnowledgeFromHistory, goalKnowledgeApplicationSummary, buildGoalKnowledgePlan } =
    await import("../worker/agents/goalKnowledge.js");
  const plan = buildGoalKnowledgePlan({ question: "Deep research my goal: surgery bills" });
  const events = [
    { speaker: "user", agent_id: "nexus", content: "hello", recorded_at: "2026-11-26T00:00:00Z" },
    { speaker: "agent", agent_id: "nexus", content: JSON.stringify({ goal_knowledge_refinement: plan }), recorded_at: "2026-11-26T00:01:00Z" },
    { speaker: "agent", agent_id: "nexus", content: JSON.stringify({ goal_knowledge_refinement: { ...plan, status: "subscriber_required" } }), recorded_at: "2026-11-26T00:02:00Z" },
  ];
  // The latest PREPARED plan is the learned knowledge; a locked notice is not.
  const found = extractGoalKnowledgeFromHistory(events);
  assert.equal(found.category, "medical");
  assert.equal(found.status, "prepared");
  const summary = goalKnowledgeApplicationSummary(found);
  assert.equal(summary.category, "medical");
  assert.ok(summary.knowledge_areas.includes("fastest_path"));
  assert.ok(summary.research_questions.some(q => /fastest/i.test(q)));
  // No plan on file -> nothing to apply.
  assert.equal(extractGoalKnowledgeFromHistory([{ content: "no plan here" }]), null);
  assert.equal(extractGoalKnowledgeFromHistory(null), null);
  assert.equal(goalKnowledgeApplicationSummary(null), null);
});

function contextHarness(){
  const base=harness();
  const recorded=[];
  const fetcher=async(url,opts)=>{
    if(url.endsWith("/rpc/ifund_team_recent")) return Response.json([]);
    if(url.endsWith("/rpc/ifund_team_record_user")||url.endsWith("/rpc/ifund_team_record_agent")){
      recorded.push(JSON.parse(opts.body));
      return Response.json(UID);
    }
    return base.fetcher(url,opts);
  };
  const env={...base.env,IFUND_TEAM_CONTEXT_ENABLED:"enabled",
    IFUND_WORKFORCE_EXECUTOR_KEY:"a".repeat(64)};
  return {fetcher,env,recorded,rpc:base.rpc,inferences:base.inferences};
}

test("REACH question with team context enabled records under a backend identity", async () => {
  const { TEAM_CONTEXT_AGENTS } = await import("../worker/agents/teamContext.js");
  const h=contextHarness();
  const response=await routeTeamQuestion(request("How do I fix my oauth connection?","reach"),h.env,h.fetcher);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.agent,"reach");
  assert.ok(h.recorded.length>=2);
  // Every recorded event must use an identity the team-context store
  // accepts (the nine backend specialists); "reach" itself would throw.
  assert.ok(h.recorded.every(e=>TEAM_CONTEXT_AGENTS.includes(e.p_agent_id)));
  assert.ok(h.recorded.every(e=>e.p_agent_id==="link"));
});

test("locked refinement is returned but never recorded as team knowledge", async () => {
  const h=contextHarness();
  const response=await routeTeamQuestion(request("Please deep research my goal for my medical campaign","nexus"),h.env,h.fetcher);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.goal_knowledge?.status,"subscriber_required");
  assert.equal(body.goal_knowledge?.research_questions?.length,0);
  assert.ok(!h.recorded.some(e=>String(e.p_content).includes("goal_knowledge_refinement")));
});
