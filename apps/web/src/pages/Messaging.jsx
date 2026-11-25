import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MessageSquare, MessagesSquare } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import AgentOperationsRoom from "@/components/agents/AgentOperationsRoom";
import { agentFromParam } from "@/lib/agentsPage.mjs";

const AGENT_ORDER = ["nexus","story","polaris","orbit","echo","pulse","forge","link","discover"];

/**
 * Agent messaging, not user mail, CRM outreach, email, or social DMs.
 * Agent replies use the existing authenticated advisory service and side panel.
 * Agent Operations Room remains admin-only with independent database RLS.
 */
export default function Messaging() {
  const {user,status} = useAuthSession();
  const [active,setActive] = useState(null);
  // Sprint 6 (2026-11-25): per-agent "continue conversation" links arrive
  // as /messaging?agent=echo&campaign=<uuid>. The agent is validated, the
  // side conversation opens for that agent, and the campaign stays in the
  // URL so context is not lost when navigating back to the Agents page.
  const [params] = useSearchParams();
  const requestedAgent = agentFromParam(params.get("agent"));
  const requestedCampaign = params.get("campaign");
  useEffect(() => {
    if (!requestedAgent) return;
    setActive(requestedAgent);
    window.dispatchEvent(new CustomEvent("ifund-open-agent", { detail: { agent: requestedAgent } }));
  }, [requestedAgent]);
  useEffect(() => {
    const onOpen = event => setActive(event.detail?.agent || "nexus");
    window.addEventListener("ifund-open-agent",onOpen);
    return () => window.removeEventListener("ifund-open-agent",onOpen);
  },[]);
  function openAgent(agent) {
    setActive(agent);
    window.dispatchEvent(new CustomEvent("ifund-open-agent",{detail:{agent}}));
  }
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
        Selecting an agent opens a side conversation; you can keep it open while browsing.
        Agent messages are not email and do not contact outside platforms.
      </p>
    </section>

    {status==="loading" ? <p role="status">Verifying your account…</p> :
      user && <section className="space-y-3" aria-label="Private administrator agent messaging">
        <AgentOperationsRoom key={user.id} user={user}/>
      </section>}
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      <MessageSquare className="size-4 text-cyan-400"/>
      <Link to={active ? `/agents?agent=${encodeURIComponent(active)}${requestedCampaign ? `&campaign=${encodeURIComponent(requestedCampaign)}` : ""}` : "/agents"} className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-500 underline">Explore agent tools and specialties</Link>
    </div>
  </main>;
}
