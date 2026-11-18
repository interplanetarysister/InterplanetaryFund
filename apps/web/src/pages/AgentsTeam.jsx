import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseAgentFeatureSelection, agentToolHref } from "@/lib/agentFeatureRoutes.mjs";
import StoryAgent from "./StoryAgent";
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
 * messages to an unavailable legacy service or present a placeholder as an active AI conversation.
 */
export default function AgentsTeam() {
  const [params,setParams]=useSearchParams();
  const selection=parseAgentFeatureSelection(params.toString());
  const selected=selection.identity;
  function setSelected(identity){const next=new URLSearchParams();if(identity)next.set("agent",identity);if(selection.campaignId)next.set("campaign",selection.campaignId);setParams(next,{replace:true});}
  const [showWriting, setShowWriting] = useState(selection.identity === "story");
  const [showService, setShowService] = useState(false);
  const [agentQuestion, setAgentQuestion] = useState("");
  useEffect(()=>{setShowWriting(selected === "story");setShowService(false);},[selected,selection.campaignId]);
  const recommendation = agentQuestion.trim() ? proposedSpecialistHandoff(agentQuestion) : null;
  const workspace = AGENT_WORKSPACES.find(agent => agent.identity === selected);
  return <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 sm:px-7">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.23em] text-cyan-300">IFund Mission Control</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Your AI Team</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose an agent to open an available iFund tool or inspect its operational status. A related page is not proof of independent specialist AI execution.</p>
    </header>
    <section className="rounded-2xl border border-border bg-card p-5" aria-label="Find the right specialist">
      <h2 className="text-lg font-semibold">Who should I talk to?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Describe what you need. Agents on your iFund team may use the conversation context stored for your account. This finder does not itself send any message.</p>
      <label className="mt-3 block text-sm font-medium" htmlFor="agent-specialist-question">Your question</label>
      <input id="agent-specialist-question" value={agentQuestion} onChange={e => setAgentQuestion(e.target.value)} placeholder="For example: How should I explain my spending plan in the story?" className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground" />
      {recommendation && <div className="mt-3 rounded-xl border border-border p-3" aria-live="polite">
        <p className="text-sm">Suggested specialist: <strong>{AGENT_IDENTITIES[recommendation.target]?.name}</strong> — {recommendation.reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">Your team can reuse your account's shared context. This recommendation does not itself start a specialist conversation.</p>
        {recommendation.requiresCoordination && <p className="mt-1 text-xs text-muted-foreground">Relevant specialists: {recommendation.topics.map(id => AGENT_IDENTITIES[id]?.name).join(", ")}.</p>}
        <button type="button" onClick={() => {setSelected(recommendation.target);setShowWriting(false);setShowService(false);}} className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">View {AGENT_IDENTITIES[recommendation.target]?.name}</button>
      </div>}
      <p className="mt-2 text-xs text-muted-foreground">Shared specialty directory: {TRAINING_VERSION}. Services remain limited to their verified tool permissions.</p>
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
      {selected === "nexus" && <div className="mt-4"><NexusBrief /></div>}
      {["polaris", "forge", "echo", "link"].includes(selected) && <div className="mt-4 space-y-4">
        <button type="button" className="min-h-11 rounded-xl border border-border px-4 font-semibold" aria-expanded={showService}
          onClick={() => setShowService(value => !value)}>{showService ? "Close saved specialist workspace" : "Open saved specialist workspace"}</button>
        {showService && <SpecialistServiceWorkspace key={selected+":"+(selection.campaignId||"account")} identity={selected} initialCampaignId={selection.campaignId}/>}
      </div>}
      {workspace && <div className="mt-4">
        {selected === "story" ?
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" onClick={() => setShowWriting(true)}>Open Story writing assistant</button> :
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold" to={agentToolHref(selected,selection.campaignId)}>Open related tool: {workspace.tool}</Link>}
      </div>}
      <button type="button" className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={() => {setSelected(null);setShowService(false);}}>Return to team</button>
    </section>}
    <EditorialAgentQueue />
    <TeamConversationHistory />
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Available AI writing workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">The existing Story Agent can create private campaign writing suggestions. Standalone specialist chat is still undergoing individual verification.</p>
      <button type="button" className="mt-3 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" aria-expanded={showWriting} onClick={() => setShowWriting(v => !v)}>{showWriting ? "Close writing workspace" : "Open writing workspace"}</button>
      {showWriting && <div className="mt-4"><StoryAgent key={selection.campaignId||"account"} initialCampaignId={selection.campaignId}/></div>}
    </section>
  </div>;
}
