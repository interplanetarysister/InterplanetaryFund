import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseAgentFeatureSelection, agentToolHref } from "@/lib/agentFeatureRoutes.mjs";
import StoryAgent from "./StoryAgent";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { askIFundAgent } from "@/lib/agentQuestions";
import NexusBrief from "@/components/agents/NexusBrief";
import EditorialAgentQueue from "@/components/agents/EditorialAgentQueue";
import TeamConversationHistory from "@/components/agents/TeamConversationHistory";
import SpecialistServiceWorkspace from "@/components/agents/SpecialistServiceWorkspace";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import { AGENT_WORKSPACES } from "@/lib/agentWorkspaces.mjs";
import { TRAINING_ROLES, TRAINING_VERSION, proposedSpecialistHandoff } from "@/lib/agentTrainingDirectory.mjs";

const TEAM = AGENT_WORKSPACES.filter(agent => !agent.consolidatedInto).map(agent => agent.identity);
/**
 * The independent application has an authorized Story service, but does not
 * yet have a verified seven-specialist conversational endpoint. Never send
 * messages to Base44 or present a placeholder as an active AI conversation.
 */
export default function AgentsTeam() {
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
    const client=authClient();
    client.from("ifund_ai_permission_preferences")
      .select("owner_id,allow_ai_campaign_drafts,allow_future_internal_ai_assistance")
      .eq("owner_id",owner).maybeSingle()
      .then(async ({data,error})=>{
        if(error)throw error;
        const identity=await client.auth.getUser();
        if(!active)return;
        const matching=identity?.data?.user?.id===owner &&
          identity.data.user.email_confirmed_at && identity.data.user.is_anonymous!==true;
        const allowed=Boolean(matching && data?.owner_id===owner &&
          (data.allow_ai_campaign_drafts===true || data.allow_future_internal_ai_assistance===true));
        setAiPermission({status:matching?"ready":"unavailable",allowed,ownerId:owner});
      }).catch(()=>{if(active)setAiPermission({status:"unavailable",allowed:false,ownerId:owner});});
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
  const recommendation = agentQuestion.trim() ? proposedSpecialistHandoff(agentQuestion) : null;
  const workspace = AGENT_WORKSPACES.find(agent => agent.identity === selected);
  return <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 sm:px-7">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.23em] text-cyan-300">IFund Mission Control</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Your AI Team</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose an agent to open an available iFund tool or inspect its operational status. A related page is not proof of independent specialist AI execution.</p>
    </header>
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Ask the IFund agent team">
      <h2 className="text-lg font-semibold">Ask your iFund agent team</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ask a question and iFund will choose a relevant specialist. You can also select an agent yourself. The response is advice, not a financial, publishing, or account action.</p>
      <form className="mt-4 space-y-3" onSubmit={submitAgentQuestion}>
        <label className="block text-sm font-medium" htmlFor="agent-specialist-question">What would you like help with?</label>
        <textarea id="agent-specialist-question" rows={3} minLength={8} maxLength={2000}
          required value={agentQuestion} onChange={e => setAgentQuestion(e.target.value)}
          placeholder="For example: How should I explain my spending plan in the story?"
          className="w-full rounded-xl border border-border bg-background p-3 text-foreground" />
        <label className="block text-sm font-medium" htmlFor="ifund-agent-choice">Who should answer?</label>
        <select id="ifund-agent-choice" value={agentMode} onChange={e=>setAgentMode(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-background px-3">
          <option value="auto">Automatically choose the right agent</option>
          {TEAM.map(id=><option key={id} value={id}>{AGENT_IDENTITIES[id].name} — {AGENT_IDENTITIES[id].role}</option>)}
        </select>
        {recommendation && <div className="rounded-xl border border-border p-3" aria-live="polite">
          <p className="text-sm">Recommended: <strong>{AGENT_IDENTITIES[recommendation.target]?.name}</strong> — {recommendation.reason}</p>
          {recommendation.requiresCoordination && <p className="mt-1 text-xs text-muted-foreground">NEXUS can coordinate: {recommendation.topics.map(id => AGENT_IDENTITIES[id]?.name).join(", ")}.</p>}
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
          className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">
          {questionBusy ? "Asking your agent…" : "Ask iFund"}
        </button>
      </form>
      {agentReply && <article className="mt-5 space-y-3 rounded-2xl border border-primary/30 bg-background p-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <AgentIdentityIcon identity={agentReply.agent} size={48}/>
          <div><h3 className="font-semibold">{AGENT_IDENTITIES[agentReply.agent]?.name} answered</h3>
            <p className="text-xs text-muted-foreground">{AGENT_IDENTITIES[agentReply.agent]?.role} · Advisory response</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Your question: {agentReply.question}</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{agentReply.answer}</p>
        <p className="text-xs text-muted-foreground">This answer does not send messages, change campaigns, move money or publish content.</p>
      </article>}
      <p className="mt-3 text-xs text-muted-foreground">Free accounts can use specialist matching and available campaign tools. Direct AI answers require an active provider-backed AI membership, available service capacity, and either saved campaign-drafting or future private AI assistance permission. Changing a preference takes effect for new questions and never authorizes outside posting.</p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm"><Link to="/subscriptions" className="text-primary underline">View AI membership</Link><Link to="/permissions?section=ai" className="text-primary underline">Manage AI permission</Link><Link to="/connections" className="text-primary underline">Connect your accounts</Link></div>
      <p className="mt-2 text-xs text-muted-foreground">Specialty directory: {TRAINING_VERSION}.</p>
    </section>
    <div aria-label="IFund agents" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {TEAM.map(id => { const agent = AGENT_IDENTITIES[id]; return <button key={id} type="button" aria-label={agent.name + ", " + agent.role} aria-pressed={selected === id}
        onClick={() => { setSelected(id); setShowWriting(false); setShowService(false); }}
        className={"flex min-h-40 flex-col items-center justify-center rounded-2xl border bg-[#0B0F14] p-4 text-center transition hover:border-cyan-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " + (selected === id ? "border-cyan-400/80" : "border-white/15")}>
        <AgentIdentityIcon identity={id} size={70}/>
        <span className="mt-3 font-semibold tracking-[0.16em] text-white">{agent.name}</span>
        <span className="mt-1 text-xs text-slate-400">{agent.role}</span>
      </button>; })}
    </div>
    {selection.invalidCampaign&&<p role="alert">The campaign link is invalid. Choose a saved campaign in the workspace.</p>}
    {selected && <section aria-live="polite" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <AgentIdentityIcon identity={selected} size={54}/>
        <div><h2 className="text-xl font-semibold">{AGENT_IDENTITIES[selected].name}</h2><p className="text-sm text-muted-foreground">{AGENT_IDENTITIES[selected].role}</p></div>
      </div>
      <p className="mt-3 text-sm font-medium">Specialty: {TRAINING_ROLES[selected]?.skill}</p>
      <p className="mt-1 text-sm text-muted-foreground">Can help with: {TRAINING_ROLES[selected]?.handles.join(", ")}. Consults: {TRAINING_ROLES[selected]?.consult.map(id => AGENT_IDENTITIES[id]?.name).join(", ")}.</p>
      <p role="status" className="mt-4 text-sm text-muted-foreground">{workspace?.evidence} Selecting this role does not send a message or authorize financial or external actions.</p>
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
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold" to={agentToolHref(selected,selection.campaignId)}>Open related tool: {workspace.tool}</Link>}
      </div>}
      <button type="button" className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={() => {setSelected(null);setShowService(false);}}>Return to team</button>
    </section>}
    {user && <EditorialAgentQueue />}
    {user && <TeamConversationHistory />}
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Available AI writing workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">The Story Agent can prepare private campaign writing suggestions. Direct specialist answers require an active verified membership and AI permission.</p>
      <button type="button" disabled={!user} className="mt-3 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50" aria-expanded={showWriting} onClick={() => setShowWriting(v => !v)}>{showWriting ? "Close writing workspace" : "Open writing workspace"}</button>
      {!user && <p className="mt-2 text-sm"><Link className="text-primary underline" to="/login?returnTo=%2Fagents">Sign in</Link> to use private writing tools.</p>}
      {user && showWriting && <div className="mt-4"><StoryAgent key={selection.campaignId||"account"} initialCampaignId={selection.campaignId}/></div>}
    </section>
  </div>;
}
