import React, { useState } from "react";
import { platformName } from "@/components/connections/platformCatalog";
import {
  healthStatus, HEALTH_BADGE, completenessPct, completenessLevel,
  daysSinceSync, roleForPlatform, accentForRole, agentForRole,
} from "@/lib/externalAccounts";
import { Search, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const COMPLETENESS_COLOR = { incomplete: "bg-red-500", partial: "bg-amber-500", complete: "bg-emerald-500" };

export default function ExternalAccountsTable({ connections, campaigns, agents, onRowClick }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [health, setHealth] = useState("all");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState(new Set());

  const filtered = connections.filter((c) => {
    if (kind !== "all" && c.kind !== kind) return false;
    if (health !== "all" && healthStatus(c) !== health) return false;
    if (role !== "all" && roleForPlatform(c.platform, c.kind) !== role) return false;
    if (q) {
      const hay = `${platformName(c.platform)} ${c.display_name || ""} ${campaigns[c.campaign_id]?.title || ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const filteredIds = filtered.map((c) => c.id);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filteredIds.forEach((id) => next.delete(id));
    else filteredIds.forEach((id) => next.add(id));
    setSelected(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search platform, account, or campaign…" className="pl-9" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]">
          <option value="all">All kinds</option>
          <option value="crowdfunding">Crowdfunding</option>
          <option value="social">Social</option>
        </select>
        <select value={health} onChange={(e) => setHealth(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]">
          <option value="all">All statuses</option>
          <option value="connected">Connected</option>
          <option value="stale">Stale</option>
          <option value="requires_action">Requires Action</option>
          <option value="incomplete">Incomplete</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]">
          <option value="all">All agents</option>
          <option value="growth">Growth</option>
          <option value="outreach">Outreach</option>
        </select>
      </div>

      {/* Persistent bulk-action bar — stays visible while any rows are selected. */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 rounded-xl bg-stone-900 text-white px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-300">Provider status cannot be changed manually.</span>
            <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 rounded-lg px-3 text-sm text-stone-200 hover:text-white min-h-[44px]">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2.5 w-10">
                <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="w-4 h-4 align-middle" />
              </th>
              <th className="px-3 py-2.5">Platform</th>
              <th className="px-3 py-2.5">Display Name</th>
              <th className="px-3 py-2.5">Kind</th>
              <th className="px-3 py-2.5">Campaign</th>
              <th className="px-3 py-2.5">Agent</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Completeness</th>
              <th className="px-3 py-2.5">Last Synced</th>
              <th className="px-3 py-2.5">External</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const hs = healthStatus(c);
              const pct = completenessPct(c);
              const lvl = completenessLevel(c);
              const camp = campaigns[c.campaign_id];
              const r = roleForPlatform(c.platform, c.kind);
              const agent = agentForRole(agents, r);
              const accent = accentForRole(r);
              const d = daysSinceSync(c);
              const checked = selected.has(c.id);
              return (
                <tr key={c.id} onClick={() => onRowClick(c)} className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer ${checked ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(c.id)} className="w-4 h-4 align-middle" />
                  </td>
                  <td className="px-3 py-3 font-medium text-stone-900 whitespace-nowrap">{platformName(c.platform)}</td>
                  <td className="px-3 py-3 text-stone-600 max-w-[160px] truncate">{c.display_name || "—"}</td>
                  <td className="px-3 py-3"><span className="capitalize text-stone-500 text-sm">{c.kind}</span></td>
                  <td className="px-3 py-3 text-stone-600 text-sm max-w-[160px] truncate">{camp?.title || "—"}</td>
                  <td className="px-3 py-3">
                    {agent ? (
                      <span className={`inline-flex items-center gap-1.5 text-sm ${accent.text}`}>
                        <span className={`w-2 h-2 rounded-full ${accent.dot}`} />{agent.name}
                      </span>
                    ) : <span className="text-stone-400 text-sm">—</span>}
                  </td>
                  <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_BADGE[hs].className}`}>{HEALTH_BADGE[hs].label}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                        <div className={`h-full ${COMPLETENESS_COLOR[lvl]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-stone-500">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-stone-500 text-sm whitespace-nowrap">{d === null ? "never" : `${d}d ago`}</td>
                  <td className="px-3 py-3">
                    {c.external_url ? (
                      <a href={c.external_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1 text-sm">
                        <ExternalLink className="w-3.5 h-3.5" />Open
                      </a>
                    ) : <span className="text-stone-400 text-sm">—</span>}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-stone-400">No accounts match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}