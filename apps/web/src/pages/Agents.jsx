import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const AGENT_IDS = [
  "admin_builder_agent", "chief_of_staff", "communications_agent",
  "connection_discovery_agent", "finance_agent", "growth_agent",
  "managed_connection_agent", "outreach_agent", "story_agent",
  "strategy_agent",
];
const label = id => id.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");

export default function Agents() {
  const [status, setStatus] = useState({ phase: "loading", data: null });
  useEffect(() => {
    let active = true;
    const aborter = new AbortController();
    fetch("/api/automations/readiness", { cache: "no-store", signal: aborter.signal })
      .then(async response => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
          throw new Error("Independent automation endpoint unavailable");
        const data = await response.json();
        if (data?.source_agents !== 10 || data?.source_workflows !== 17 ||
            data?.source_connectors !== 11) throw new Error("Unexpected automation contract");
        if (active) setStatus({ phase: "ready", data });
      })
      .catch(() => { if (active) setStatus({ phase: "unavailable", data: null }); });
    return () => { active = false; aborter.abort(); };
  }, []);
  const fullyReady = status.phase === "ready" &&
    status.data?.verified_active_agents === 10 &&
    status.data?.verified_active_workflows === 17 &&
    status.data?.execution_enabled === true;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">IFund AI agents</h1>
      <p className="mt-2 text-muted-foreground">Your original specialist team and Chief of Staff are part of the migration requirements.</p></header>
    <section className="rounded-2xl border border-border bg-card p-5" aria-live="polite">
      <h2 className="text-lg font-semibold">Connection readiness</h2>
      {status.phase === "loading" ? <p role="status">Checking independent agent services…</p> :
        status.phase === "unavailable" ? <p role="alert">Independent agent services could not be verified. No workflows were started.</p> :
        <p role="status">{fullyReady ? "All registered agent and workflow executors report ready." :
          "Agent and workflow execution is not yet independently verified. Listing an agent does not enable it."}</p>}
      {status.data && <p className="mt-2 text-sm text-muted-foreground">{status.data.verified_active_agents} of 10 agents and {status.data.verified_active_workflows} of 17 workflows verified active.</p>}
    </section>
    <section aria-label="Original specialist agents">
      <h2 className="mb-4 text-xl font-semibold">Specialists (10 original definitions)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_IDS.map(id => <div key={id} className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">{label(id)}</h3>
          <p className="mt-2 text-sm text-muted-foreground">Independent tools, permissions and execution pending verification.</p>
        </div>)}
      </div>
    </section>
    <p className="text-sm text-muted-foreground">No AI response, scheduled action, outreach or financial advice is simulated. <Link to="/dashboard" className="underline">Return to dashboard</Link>.</p>
  </main>;
}
