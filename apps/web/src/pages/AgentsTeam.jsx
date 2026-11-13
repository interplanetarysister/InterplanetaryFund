import React, { useState } from "react";
import { Link } from "react-router-dom";
import StoryAgent from "./StoryAgent";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import { AGENT_WORKSPACES } from "@/lib/agentWorkspaces.mjs";

const TEAM = AGENT_WORKSPACES.map(agent => agent.identity);
/**
 * The independent application has an authorized Story service, but does not
 * yet have a verified seven-specialist conversational endpoint. Never send
 * messages to Base44 or present a placeholder as an active AI conversation.
 */
export default function AgentsTeam() {
  const [selected, setSelected] = useState(null);
  const [showWriting, setShowWriting] = useState(false);
  const workspace = AGENT_WORKSPACES.find(agent => agent.identity === selected);
  return <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 sm:px-7">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.23em] text-cyan-300">IFund Mission Control</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Your AI Team</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose an agent to open an available iFund tool or inspect its operational status. A related page is not proof of independent specialist AI execution.</p>
    </header>
    <div aria-label="IFund agents" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {TEAM.map(id => { const agent = AGENT_IDENTITIES[id]; return <button key={id} type="button" aria-label={agent.name + ", " + agent.role} aria-pressed={selected === id}
        onClick={() => { setSelected(id); setShowWriting(false); }}
        className={"flex min-h-40 flex-col items-center justify-center rounded-2xl border bg-[#0B0F14] p-4 text-center transition hover:border-cyan-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " + (selected === id ? "border-cyan-400/80" : "border-white/15")}>
        <AgentIdentityIcon identity={id} size={70}/>
        <span className="mt-3 font-semibold tracking-[0.16em] text-white">{agent.name}</span>
        <span className="mt-1 text-xs text-slate-400">{agent.role}</span>
      </button>; })}
    </div>
    {selected && <section aria-live="polite" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <AgentIdentityIcon identity={selected} size={54}/>
        <div><h2 className="text-xl font-semibold">{AGENT_IDENTITIES[selected].name}</h2><p className="text-sm text-muted-foreground">{AGENT_IDENTITIES[selected].role}</p></div>
      </div>
      <p role="status" className="mt-4 text-sm text-muted-foreground">{workspace?.evidence} Selecting this role does not send a message or authorize financial or external actions.</p>
      {workspace && <div className="mt-4">
        {selected === "story" ?
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" onClick={() => setShowWriting(true)}>Open Story writing assistant</button> :
          <Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold" to={workspace.path}>Open related tool: {workspace.tool}</Link>}
      </div>}
      <button type="button" className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={() => setSelected(null)}>Return to team</button>
    </section>}
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Available AI writing workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">The existing Story Agent can create private campaign writing suggestions. Standalone specialist chat is still undergoing individual verification.</p>
      <button type="button" className="mt-3 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground" aria-expanded={showWriting} onClick={() => setShowWriting(v => !v)}>{showWriting ? "Close writing workspace" : "Open writing workspace"}</button>
      {showWriting && <div className="mt-4"><StoryAgent/></div>}
    </section>
  </div>;
}
