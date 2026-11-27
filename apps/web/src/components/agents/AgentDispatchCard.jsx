import React from "react";
import { Link } from "react-router-dom";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";

/**
 * Chief-of-staff dispatch card: NEXUS prepared a specialist request from the
 * member's own words. One tap opens that specialist's workspace to launch
 * it. A dispatch is a prepared request, never a claim the work is done.
 */
export default function AgentDispatchCard({ dispatch }) {
  if (!dispatch || dispatch.kind !== "chief_of_staff_dispatch" || !dispatch.workspace_path)
    return null;
  const identity = AGENT_IDENTITIES[dispatch.specialist];
  const name = identity?.name || String(dispatch.specialist || "").toUpperCase();
  return (
    <div className="mt-2 rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-3">
      <div className="flex items-center gap-2">
        <AgentIdentityIcon identity={dispatch.specialist} size={28} />
        <p className="text-sm font-semibold">Prepared for {name} — {dispatch.tool}</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        NEXUS saved your request{dispatch.context_saved ? " to your team context" : ""}. Launch it in {name}&rsquo;s workspace when you&rsquo;re ready — nothing has been sent or published.
      </p>
      <Link
        className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 font-semibold text-slate-950"
        to={dispatch.workspace_path}
      >
        Launch with {name}
      </Link>
    </div>
  );
}
