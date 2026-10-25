import React, { useState, useMemo } from "react";
import { platformName } from "@/components/connections/platformCatalog";
import { roleForPlatform, accentForRole, agentForRole } from "@/lib/externalAccounts";
import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";

const POST_STATUS = { published: "Published", approved: "Approved", pending_approval: "Pending Approval", scheduled: "Scheduled", draft: "Draft", failed: "Failed" };
const POST_STATUS_COLOR = {
  published: "bg-emerald-100 text-emerald-700", approved: "bg-blue-100 text-blue-700",
  pending_approval: "bg-amber-100 text-amber-700", scheduled: "bg-violet-100 text-violet-700",
  draft: "bg-stone-100 text-stone-600", failed: "bg-red-100 text-red-700",
};

export default function PostLookupPanel({ posts, campaigns, agents, connections }) {
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const connById = useMemo(() => Object.fromEntries(connections.map((c) => [c.id, c])), [connections]);
  const platforms = useMemo(() => [...new Set(posts.map((p) => p.platform))].sort(), [posts]);

  const filtered = useMemo(() => posts.filter((p) => {
    if (platform !== "all" && p.platform !== platform) return false;
    if (status !== "all" && p.status !== status) return false;
    if (from && new Date(p.created_date) < new Date(from)) return false;
    if (to && new Date(p.created_date) > new Date(to + "T23:59:59")) return false;
    if (q) {
      const hay = `${p.campaign_title || campaigns[p.campaign_id]?.title || ""} ${p.content || ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [posts, platform, status, from, to, q, campaigns]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by campaign or content…" className="pl-9" />
        </div>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]">
          <option value="all">All platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{platformName(p)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]">
          <option value="all">All statuses</option>
          {Object.entries(POST_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-transparent px-3 h-9 text-sm min-h-[44px]" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2.5">Campaign</th>
              <th className="px-3 py-2.5">Platform</th>
              <th className="px-3 py-2.5">Account</th>
              <th className="px-3 py-2.5">Agent</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Published</th>
              <th className="px-3 py-2.5">External Post</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const conn = connById[p.connection_id];
              const r = roleForPlatform(p.platform, conn?.kind || "social");
              const agent = agentForRole(agents, r);
              const accent = accentForRole(r);
              return (
                <tr key={p.id} className="border-b border-stone-100">
                  <td className="px-3 py-3 text-stone-700 max-w-[180px] truncate">{p.campaign_title || campaigns[p.campaign_id]?.title || "—"}</td>
                  <td className="px-3 py-3 text-stone-600 whitespace-nowrap">{platformName(p.platform)}</td>
                  <td className="px-3 py-3 text-stone-600 max-w-[140px] truncate">{conn?.display_name || "—"}</td>
                  <td className="px-3 py-3">
                    {agent ? <span className={`inline-flex items-center gap-1.5 text-xs ${accent.text}`}><span className={`w-2 h-2 rounded-full ${accent.dot}`} />{agent.name}</span> : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${POST_STATUS_COLOR[p.status] || "bg-stone-100 text-stone-600"}`}>{POST_STATUS[p.status] || p.status}</span>
                    {p.error && <p className="text-xs text-red-500 mt-0.5 max-w-[160px] truncate">{p.error}</p>}
                  </td>
                  <td className="px-3 py-3 text-stone-500 text-xs whitespace-nowrap">{p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-3">
                    {p.external_post_url ? (
                      <a href={p.external_post_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-sm"><ExternalLink className="w-3.5 h-3.5" />Open</a>
                    ) : <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-stone-400">No posts match your filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}