import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquare, MessagesSquare } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import AgentOperationsRoom from "@/components/agents/AgentOperationsRoom";
import MemberAgentChat from "@/components/agents/MemberAgentChat";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { agentFromParam } from "@/lib/agentsPage.mjs";

const AGENT_ORDER = ["nexus","story","polaris","orbit","echo","pulse","forge","link","discover"];

/**
 * Agent messaging, not user mail, CRM outreach, email, or social DMs.
 * Signed-in members get a full-size personal chat and AI analysis composer.
 * The separate Agent Operations Room mounts only after an admin RPC check.
 * API authentication and database RLS remain the actual access boundaries.
 */
export default function Messaging() {
  const {user,status} = useAuthSession();
  const [active,setActive] = useState("nexus");
  const adminStatus=useAdminAccess(user);
  // Sprint 6 (2026-11-25): per-agent "continue conversation" links arrive
  // as /messaging?agent=echo&campaign=<uuid>. The agent is validated, the
  // side conversation opens for that agent, and the campaign stays in the
  // URL so context is not lost when navigating back to the Agents page.
  const [params] = useSearchParams();
  const requestedAgent = agentFromParam(params.get("agent"));
  const requestedCampaign = params.get("campaign");
  useEffect(() => {
    if (requestedAgent) setActive(requestedAgent);
  }, [requestedAgent]);
  // Selecting a specialist changes the full-size chat composer. The floating
  // companion is independently available elsewhere, but must not cover this chat.
  function openAgent(agent) { setActive(agent); }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="rounded-xl border border-cyan-500/30 bg-slate-950 p-3 text-cyan-300"><MessagesSquare size={24}/></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">AI Team</p>
          <h1 className="text-3xl font-bold">Messaging</h1>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Talk with your iFund agents while navigating the site. NEXUS can consult other specialists
        when your question spans several topics. Their answers are advisory and never authorize
        publishing, payments, account changes, or external messages.
      </p>
      <p className="text-sm text-muted-foreground">
        Looking for messages delivered to your account? <Link to="/mail" className="inline-flex min-h-11 items-center font-semibold text-cyan-500 underline">Open Mail</Link>.
        For campaign outreach drafts, use <Link to="/communications" className="inline-flex min-h-11 items-center font-semibold text-cyan-500 underline">ECHO Outreach</Link>.
      </p>
    </header>

    <section className="space-y-3" aria-label="Message your agents">
      <h2 className="text-xl font-semibold">Choose an agent</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AGENT_ORDER.map(id => {
          const agent=AGENT_IDENTITIES[id];
          return <button type="button" key={id}
            onClick={()=>openAgent(id)}
            aria-label={"Message "+agent.name+", "+agent.role}
            aria-pressed={active===id}
            className={"flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-colors hover:bg-cyan-500/10 "+
              (active===id?"border-cyan-400/60 bg-cyan-500/10":"border-border bg-card")}>
            <AgentIdentityIcon identity={id} size={48}/>
            <span className="text-sm font-semibold">{agent.name}</span>
            <span className="text-xs text-muted-foreground">{agent.role}</span>
          </button>;
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        Selecting an agent opens its personal conversation below. Your messages stay separate from administrator discussions.
        Agent messages are not email and do not contact outside platforms.
      </p>
    </section>

    {status==="loading" ? <p role="status">Verifying your account…</p> :
      !user ? <section className="rounded-2xl border border-border bg-card p-5" aria-label="Sign in for AI chat">
        <h2 className="text-lg font-semibold">Sign in to chat with your AI team</h2>
        <p className="mt-2 text-sm text-muted-foreground">Free and subscribed members can ask questions and request personal AI analysis.</p>
        <Link to="/login?returnTo=%2Fmessaging" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-cyan-700 px-4 font-semibold text-white">Sign in</Link>
      </section> :
      <MemberAgentChat key={user.id} user={user} agent={active}/>}
    {user && adminStatus==="admin" && <details className="rounded-2xl border border-slate-600/50 bg-card p-4">
      <summary className="min-h-11 cursor-pointer text-base font-semibold">Private administrator operations room</summary>
      <p className="my-3 text-sm text-muted-foreground">Administrative agent discussions are separate from member AI conversations.</p>
      <AgentOperationsRoom key={user.id} user={user}/>
    </details>}
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <MessageSquare className="size-4 text-cyan-400"/>
      <Link to={active ? `/agents?agent=${encodeURIComponent(active)}${requestedCampaign ? `&campaign=${encodeURIComponent(requestedCampaign)}` : ""}` : "/agents"} className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-500 underline">Explore agent tools and specialties</Link>
    </div>
  </main>;
}
