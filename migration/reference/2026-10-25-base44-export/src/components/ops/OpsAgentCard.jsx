import React from "react";
import { Bot } from "lucide-react";

export default function OpsAgentCard({ agent }) {
  const active = (agent.status || "").toLowerCase() === "active";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-100 text-sm truncate">{agent.name}</p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${active ? "bg-emerald-400/15 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>
              {agent.status || "unknown"}
            </span>
          </div>
          <p className="text-xs text-slate-400 capitalize">{(agent.role || "").replace(/_/g, " ")}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, agent.trust_score || 0)}%` }} />
            </div>
            <span className="text-xs font-semibold text-cyan-300">{agent.trust_score ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}