import React, { useEffect, useRef, useState } from "react";
import "./../styles/agent-team.css";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { rememberAgentAdvice } from "@/lib/agentAdviceHandoff.mjs";
import { parseAgentFeatureSelection, agentToolHref } from "@/lib/agentFeatureRoutes.mjs";
import StoryAgent from "./StoryAgent";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { askIFundAgent } from "@/lib/agentQuestions";
import { canAskAgentWithSavedPermission } from "@/lib/agentAdvisoryPermission.mjs";
import NexusBrief from "@/components/agents/NexusBrief";
import EditorialAgentQueue from "@/components/agents/EditorialAgentQueue";
import TeamConversationHistory from "@/components/agents/TeamConversationHistory";
import SpecialistServiceWorkspace from "@/components/agents/SpecialistServiceWorkspace";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import AgentConsultationTrail from "@/components/agents/AgentConsultationTrail";
import { AGENT_WORKSPACES } from "@/lib/agentWorkspaces.mjs";
import { TRAINING_ROLES, TRAINING_VERSION, proposedSpecialistHandoff } from "@/lib/agentTrainingDirectory.mjs";

const TEAM = AGENT_WORKSPACES.filter(agent => !agent.consolidatedInto).map(agent => agent.identity);
/**
 * The independent application has an authorized Story service, but does not
 * yet have a verified seven-specialist conversational endpoint. Never send
 * messages to Base44 or present a placeholder as an active AI conversation.
 */
export default function AgentsTeam() {
  const navigate=useNavigate();
  const [params,setParams]=useSearchParams();
  const selection=parseAgentFeatureSelection(params.toString());
  const selected=selection.identity;
  function setSelected(identity){const next=new URLSearchParams();if(identity)next.set("agent",identity);if(selection.campaignId)next.set("campaign",selection.campaignId);setParams(next,{replace:true});}
  const [showWriting, setShowWriting] = useState(selection.identity === "story");
  const [showService, setShowService] = useState(false);
  const [agentQuestion, setAgentQuestion] = useState("");
  const {user, status: authStatus}=useAuthSession();
  useEffect(()=>{setShowWriting(selected === "story");setShowService(false);},[selected,selection.campaignId]);
  const [agentMode,setAgentMode]=useState("auto");
  const [agentReply,setAgentReply]=useState(null);
  const [questionError,setQuestionError]=useState("");
  const [questionBusy,setQuestionBusy]=useState(false);
  const [gateway,setGateway]=useState({status:"loading",configured:false});
  const [membership,setMembership]=useState({status:"loading",active:false,ownerId:null});
  const [aiPermission,setAiPermission]=useState({status:"loading",allowed:false,ownerId:null});
  const membershipActive=Boolean(user?.id && membership.ownerId===user.id && membership.status==="ready" && membership.active);
  const aiPermissionGranted=Boolean(user?.id && aiPermission.ownerId===user.id && aiPermission.status==="ready" && aiPermission.allowed);
  const requestRef=useRef({generation:0,controller:null});
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/agents/team/status",{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const data=await response.json().catch(()=>null);
        if(!controller.signal.aborted) setGateway({
          status:response.ok&&data?.configured===true?"ready":"unavailable",
          configured:response.ok&&data?.configured===true,
        });
      }).catch(()=>{if(!controller.signal.aborted)setGateway({status:"unavailable",configured:false});});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    let active=true;
    setMembership({status:"loading",active:false,ownerId:user?.id||null});
    if(!user?.id){setMembership({status:"signed-out",active:false,ownerId:null});return()=>{active=false};}
    const owner=user.id;
    try {
      const client=authClient();
      client.rpc("ifund_story_subscription").then(async({data,error})=>{
        const {data:identity}=await client.auth.getUser();
        if(!active||identity?.user?.id!==owner)return;
        setMembership({status:error?"unavailable":"ready",ownerId:owner,
          active:!error&&data?.active===true&&Number.isInteger(data?.level)&&data.level>=1});
      }).catch(()=>{if(active)setMembership({status:"unavailable",active:false,ownerId:owner});});
    } catch {
      if(active)setMembership({status:"unavailable",active:false,ownerId:owner});
    }
    return()=>{active=false;};
  },[user?.id]);
  useEffect(()=>{
    let active=true;
    const owner=user?.id||null;
    setAiPermission({status:owner?"loading":"signed-out",allowed:false,ownerId:owner});
    if(!owner)return()=>{active=false;};
    try {
    const client=authClient();
    client.from("ifund_ai_permission_preferences")
      .select("owner_id,allow_ai_campaign_drafts,allow_future_internal_ai_assistance")
      .eq("owner_id",owner).maybeSingle()
      .then(async ({data,error})=>{
        if(error)throw error;
        const identity=await client.auth.getUser();
        if(!active)return;
        const verifiedUser=identity?.data?.user;
        const matching=verifiedUser?.id===owner &&
          Boolean(verifiedUser.email_confirmed_at) && verifiedUser.is_anonymous!==true;
        const allowed=canAskAgentWithSavedPermission({
          user:verifiedUser,ownerId:owner,preferences:data,
        });
        setAiPermission({status:matching?"ready":"unavailable",allowed,ownerId:owner});
      }).catch(()=>{if(active)setAiPermission({status:"unavailable",allowed:false,ownerId:owner});});
    } catch {
      if(active)setAiPermission({status:"unavailable",allowed:false,ownerId:owner});
    }
    return()=>{active=false;};
  },[user?.id]);
  useEffect(()=>{
    requestRef.current.generation++;
    requestRef.current.controller?.abort();
    setAgentReply(null);setQuestionError("");setQuestionBusy(false);
    return ()=>{
      requestRef.current.generation++;
      requestRef.current.controller?.abort();
    };
  },[user?.id]);
  async function submitAgentQuestion(event) {
    event.preventDefault();
    if(questionBusy || agentQuestion.trim().length<8) return;
    if(!gateway.configured){setQuestionError("Direct AI questions are not yet enabled here. Use the available specialist tools.");return;}
    if(!membershipActive){setQuestionError("An active verified AI membership is needed for direct agent answers.");return;}
    if(!aiPermissionGranted){setQuestionError("Enable campaign drafting or private AI assistance under My Profile → Manage iFund Permissions → AI assistance before asking a specialist.");return;}
    const owner=user?.id;
    if(!owner){setQuestionError("Sign in with a verified email account to ask a specialist.");return;}
    requestRef.current.controller?.abort();
    const controller=new AbortController();
    const generation=++requestRef.current.generation;
    requestRef.current.controller=controller;
    const submittedQuestion=agentQuestion.trim();
    const submittedAgent=agentMode;
    setQuestionBusy(true);setQuestionError("");setAgentReply(null);
    try{
      const result=await askIFundAgent(authClient(),{
        question:submittedQuestion,agent:submittedAgent,ownerId:owner,signal:controller.signal,
      });
      if(generation!==requestRef.current.generation || controller.signal.aborted) return;
      setSelected(result.agent);setAgentReply({question:submittedQuestion,...result});
      setShowWriting(false);setShowService(false);
    }catch(cause){
      if(generation!==requestRef.current.generation || controller.signal.aborted) return;
      setQuestionError(cause?.message || "The agent could not respond.");
    }finally{
      if(generation===requestRef.current.generation) setQuestionBusy(false);
    }
  }
  async function reviewAnswerInCampaign(){
    if(!agentReply||!user?.id)return;
    setQuestionError("");
    try{
      const client=authClient();
      const identity=await client.auth.getUser();
      const verified=identity.data?.user;
      if(identity.error||verified?.id!==user.id||!verified.email_confirmed_at||verified.is_anonymous===true)
        throw Error("Sign in to the same verified account to use this answer.");
      const target=selection.campaignId||null;
      // A campaign-specific link is checked again by the owner editor before any changes.
      const handoff=rememberAgentAdvice(sessionStorage,{
        ownerId:user.id,agent:agentReply.agent,answer:agentReply.answer,campaignId:target,
      });
      navigate(handoff.target);
    }catch(cause){setQuestionError(cause?.message||"The campaign editor could not open.");}
  }
  const recommendation = agentQuestion.trim() ? proposedSpecialistHandoff(agentQuestion) : null;
  const workspace = AGENT_WORKSPACES.find(agent => agent.identity === selected);
  return <div className="ifund-agents-page space-y-6">
    <header className="ifund-agents-hero">
      <p className="ifund-agents-kicker">Interplanetary Fund · Mission Control</p>
      <h1 className="ifund-agents-headline">Your mission. <span>Your AI Team.</span></h1>
      <p className="ifund-agents-lede">One place for campaign ideas, strategy, writing, finances, outreach and connections. Select a specialist to open a conversation that stays visible as you explore the site.</p>
      <a href="#ask-mission-control" className="ifund-agents-hero-link">Ask Mission Control <span aria-hidden="true">↗</span></a>
      <div className="ifund-agents-hero-foot" aria-label="Agent Team capabilities">
        <span className="ifund-agents-chip">Specialist matching included</span>
        <span className="ifund-agents-chip">Account-scoped assistance</span>
        <span className="ifund-agents-chip">You approve external actions</span>
      </div>
    </header>
    <section aria-label="Agent specialties" className="space-y-4">
      <div className="ifund-agents-section-heading"><h2>Meet your specialists</h2><p>Choose an agent to chat in a side panel while you browse</p></div>
      <div aria-label="IFund agents" className="ifund-agents-grid">
      {TEAM.map(id => { const agent = AGENT_IDENTITIES[id]; return <button key={id} type="button" aria-label={agent.name + ", " + agent.role} aria-pressed={selected === id}
        onClick={() => { setSelected(id); setShowWriting(false); setShowService(false); window.dispatchEvent(new CustomEvent("ifund-open-agent", { detail: { agent: id } })); }}
        className="ifund-agents-card" style={{"--agent-accent": agent.color}}>
        <AgentIdentityIcon identity={id} size={70}/>
        <span className="ifund-agents-name">{agent.name}</span>
        <span className="ifund-agents-role">{agent.role}</span><span className="ifund-agents-arrow" aria-hidden="true">↗</span>
      </button>; })}
      </div>
    </section>
    <section id="ask-mission-control" className="ifund-agents-console" aria-label="Ask the IFund agent team">
      <div className="ifund-agents-section-heading"><h2>Ask Mission Control</h2><p>One question. The right specialist.</p></div>
      <p className="ifund-agents-muted max-w-2xl text-sm leading-relaxed">Describe what you need. NEXUS will direct your question to a relevant specialist, or you can select a specialist yourself. Every answer is advisory; external actions always require separate authorization.</p>
      <form className="mt-4 space-y-3" onSubmit={submitAgentQuestion}>
        <label className="block text-sm font-medium" htmlFor="agent-specialist-question">What would you like help with?</label>
        <textarea id="agent-specialist-question" rows={3} minLength={8} maxLength={2000}
          required value={agentQuestion} onChange={e => setAgentQuestion(e.target.value)}
          placeholder="For example: How should I explain my spending plan in the story?"
          className="w-full min-h-[120px] resize-y p-4 text-sm leading-relaxed" />
        <label className="block text-sm font-medium" htmlFor="ifund-agent-choice">Who should answer?</label>
        <select id="ifund-agent-choice" value={agentMode} onChange={e=>setAgentMode(e.target.value)}
          className="min-h-12 w-full px-4 text-sm">
          <option value="auto">Automatically choose the right agent</option>
          {TEAM.map(id=><option key={id} value={id}>{AGENT_IDENTITIES[id].name} — {AGENT_IDENTITIES[id].role}</option>)}
        </select>
        {recommendation && <div className="rounded-xl border border-border p-3" aria-live="polite">
          <p className="text-sm">Recommended: <strong>{AGENT_IDENTITIES[recommendation.target]?.name}</strong> — {recommendation.reason}</p>
          {recommendation.requiresCoordination && <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Proposed NEXUS specialist routing">
            <AgentIdentityIcon identity="nexus" size={30}/>
            <span className="text-xs text-muted-foreground">Proposed specialist calls:</span>
            {recommendation.topics.slice(0,2).map(id=><span className="inline-flex items-center gap-1" key={id}>
              <AgentIdentityIcon identity={id} size={27}/>
              <span className="text-xs">{AGENT_IDENTITIES[id]?.name}</span>
            </span>)}
          </div>}
          <p className="mt-1 text-xs text-muted-foreground">The recommendation is informational until you submit your question.</p>
          <button type="button" onClick={()=>{setSelected(recommendation.target);setShowWriting(false);setShowService(false);}} className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Open recommended agent tools</button>
        </div>}
        {authStatus!=="loading" && !user && <p className="text-sm"><Link className="text-primary underline" to="/login?returnTo=%2Fagents">Sign in</Link> to ask an agent.</p>}
        {gateway.status==="loading"&&<p role="status" className="text-sm text-muted-foreground">Checking agent service availability…</p>}
        {gateway.status==="unavailable"&&<p role="status" className="text-sm text-muted-foreground">Direct AI answers are not enabled on this deployment. You can still choose specialist tools below.</p>}
        {gateway.configured&&membership.status==="loading"&&<p role="status" className="text-sm text-muted-foreground">Checking your AI membership…</p>}
        {gateway.configured&&membership.status==="ready"&&!membershipActive&&<p role="status" className="text-sm">Free specialist matching is available. <Link to="/subscriptions" className="text-primary underline">See verified AI plans</Link> for direct answers.</p>}
        {gateway.configured&&membership.status==="unavailable"&&<p role="status" className="text-sm text-muted-foreground">Your AI membership could not be verified. No paid question was sent.</p>}
        {gateway.configured&&membershipActive&&aiPermission.status==="loading"&&<p role="status" className="text-sm text-muted-foreground">Checking your saved AI permissions…</p>}
        {gateway.configured&&membershipActive&&aiPermission.status==="unavailable"&&<p role="status" className="text-sm text-muted-foreground">Your AI permission could not be verified. No question was sent.</p>}
        {gateway.configured&&membershipActive&&aiPermission.status==="ready"&&!aiPermissionGranted&&<p role="status" className="text-sm">Direct AI questions are disabled in your saved permissions. <Link to="/permissions?section=ai" className="text-primary underline">Enable private AI assistance</Link> and save to use the agent team.</p>}
        {questionError && <p role="alert" className="text-sm text-red-600">{questionError}</p>}
        <button type="submit" disabled={questionBusy || !user || agentQuestion.trim().length<8 || !gateway.configured || !membershipActive || !aiPermissionGranted}
          className="ifund-agents-submit">
          {questionBusy ? "Asking your agent…" : "Ask iFund"}
        </button>
      </form>
      {agentReply && <article className="ifund-agents-reply mt-6 space-y-3" aria-live="polite">
        <div className="flex items-center gap-3">
          <AgentIdentityIcon identity={agentReply.agent} size={48}/>
          <div><h3 className="font-semibold">{AGENT_IDENTITIES[agentReply.agent]?.name} answered</h3>
            <p className="text-xs text-muted-foreground">{AGENT_IDENTITIES[agentReply.agent]?.role} · Advisory response</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Your question: {agentReply.question}</p>
        <AgentConsultationTrail consultations={agentReply.consultations}/>
        <p className="ifund-agents-reply-body text-sm">{agentReply.answer}</p>
        <button type="button" onClick={reviewAnswerInCampaign} className="ifund-agents-action">Review this answer in a campaign editor</button>
        <p className="text-xs text-muted-foreground">This answer does not send messages, change campaigns, move money or publish content.</p>
      </article>}
      <p className="mt-3 text-xs text-muted-foreground">Free accounts can use specialist matching and available campaign tools. Direct AI answers require an active provider-backed AI membership, available service capacity, and either saved campaign-drafting or future private AI assistance permission. Changing a preference takes effect for new questions and never authorizes outside posting.</p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm"><Link to="/subscriptions" className="text-primary underline">View AI membership</Link><Link to="/permissions?section=ai" className="text-primary underline">Manage AI permission</Link><Link to="/connections" className="text-primary underline">Connect your accounts</Link></div>
      <p className="mt-2 text-xs text-muted-foreground">Specialty directory: {TRAINING_VERSION}.</p>
    </section>
    {selection.invalidCampaign&&<p role="alert">The campaign link is invalid. Choose a saved campaign in the workspace.</p>}
    {selected && <section aria-live="polite" className="ifund-agents-detail space-y-3">
      <div className="flex items-center gap-3">
        <AgentIdentityIcon identity={selected} size={54}/>
        <div><h2 className="text-xl font-semibold">{AGENT_IDENTITIES[selected].name}</h2><p className="text-sm text-muted-foreground">{AGENT_IDENTITIES[selected].role}</p></div>
      </div>
      <p className="mt-3 text-sm font-medium">Specialty: {TRAINING_ROLES[selected]?.skill}</p>
      <p className="mt-1 text-sm text-muted-foreground">Can help with: {TRAINING_ROLES[selected]?.handles.join(", ")}. Consults: {TRAINING_ROLES[selected]?.consult.map(id => AGENT_IDENTITIES[id]?.name).join(", ")}.</p>
      <p role="status" className="ifund-agents-muted mt-4 text-sm">{workspace?.evidence} Selecting this role does not send a message or authorize financial or external actions.</p>
      {!user && <p className="mt-3 text-sm"><Link className="text-primary underline" to="/login?returnTo=%2Fagents">Sign in</Link> to open private agent workspaces. Agent identities and specialties are public.</p>}
      {user && selected === "nexus" && <div className="mt-4"><NexusBrief /></div>}
      {user && ["polaris", "forge", "echo", "link"].includes(selected) && <div className="mt-4 space-y-4">
        <button type="button" className="min-h-11 rounded-xl border border-border px-4 font-semibold" aria-expanded={showService}
          onClick={() => setShowService(value => !value)}>{showService ? "Close saved specialist workspace" : "Open saved specialist workspace"}</button>
        {showService && <SpecialistServiceWorkspace key={selected+":"+(selection.campaignId||"account")} identity={selected} initialCampaignId={selection.campaignId}/>}
      </div>}
      {user && workspace && <div className="mt-4">
        {selected === "story" ?
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" onClick={() => setShowWriting(true)}>Open Story writing assistant</button> :
          <Link className="ifund-agents-action" to={agentToolHref(selected,selection.campaignId)}>Open related tool: {workspace.tool}</Link>}
      </div>}
      <button type="button" className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={() => {setSelected(null);setShowService(false);}}>Return to team</button>
    </section>}
    {user && <EditorialAgentQueue />}
    {user && <TeamConversationHistory />}
    <section className="ifund-agents-writing">
      <h2 className="text-lg font-semibold">Campaign writing studio</h2>
      <p className="mt-2 text-sm text-muted-foreground">The Story Agent can prepare private campaign writing suggestions. Direct specialist answers require an active verified membership and AI permission.</p>
      <button type="button" disabled={!user} className="mt-3 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50" aria-expanded={showWriting} onClick={() => setShowWriting(v => !v)}>{showWriting ? "Close writing workspace" : "Open writing workspace"}</button>
      {!user && <p className="mt-2 text-sm"><Link className="text-primary underline" to="/login?returnTo=%2Fagents">Sign in</Link> to use private writing tools.</p>}
      {user && showWriting && <div className="mt-4"><StoryAgent key={selection.campaignId||"account"} initialCampaignId={selection.campaignId}/></div>}
    </section>
  </div>;
}
