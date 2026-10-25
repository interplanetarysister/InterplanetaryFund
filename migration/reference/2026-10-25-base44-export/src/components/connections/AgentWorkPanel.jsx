import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ALL_PLATFORMS } from "@/components/connections/platformCatalog";
import { Loader2, RefreshCw, ArrowRight } from "lucide-react";

const ACTIVE = new Set(["requested", "assigned", "in_progress", "waiting_user", "waiting_external", "needs_review"]);
const format = (state) => ({
  requested: "Queued",
  assigned: "Assigned",
  in_progress: "Checking",
  waiting_user: "Needs your help",
  waiting_external: "Waiting for provider",
  needs_review: "Needs review",
  responding: "Working",
  responded: "Response ready",
  tool_failed: "Tool failed",
  delivery_unconfirmed: "Delivery unconfirmed",
  completed: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
  superseded: "Replaced",
}[state] || "Unknown");

export default function AgentWorkPanel({ refreshKey = 0, allAgents = false }) {
  const [work, setWork] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState("");
  const sweepInFlight = useRef(false);
  const load = useCallback(async () => {
    try {
      const [response, chat] = await Promise.all([
        base44.functions.invoke("manageAgentWork", { mode: "list", view: allAgents ? "all" : "managed" }),
        allAgents ? base44.functions.invoke("trackAgentConversation", { mode: "list" }) : Promise.resolve(null),
      ]);
      if (!response?.data?.ok || !Array.isArray(response.data.work)) throw new Error("Invalid work status");
      const chats = allAgents && Array.isArray(chat?.data?.runs) ? chat.data.runs : [];
      const combined = [...response.data.work, ...chats]
        .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).slice(0, 24);
      setWork(combined);
      setError(allAgents && !chat?.data?.ok ? "Agent conversations could not be loaded." : "");
      return combined;
    } catch {
      setError("AI connection work could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [allAgents]);

  // A safe, owner-authorized foreground worker checks a small number of due
  // connections. It never creates accounts, posts, spends, or bypasses provider
  // authorization. Runs only while the owner is viewing this page.
  const sweep = useCallback(async () => {
    if (sweepInFlight.current || document.visibilityState === "hidden") return;
    sweepInFlight.current = true;
    try {
      const rows = await load();
      const due = (rows || []).filter((item) =>
        ["in_progress", "waiting_external"].includes(item.status) &&
        item.agent === "managed_connection_agent" && item.connection_id &&
        (!item.last_attempt_at || Date.now() - Date.parse(item.last_attempt_at) >= 5 * 60 * 1000)
      ).slice(0, 2);
      if (due.length) {
        await Promise.allSettled(due.map((item) =>
          base44.functions.invoke("manageAgentWork", { mode: "advance", delegation_id: item.id })
        ));
        await load();
      }
    } finally { sweepInFlight.current = false; }
  }, [load]);

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState !== "hidden") void load(); };
    refresh();
    void sweep();
    const statusTimer = window.setInterval(refresh, 15000);
    const workTimer = window.setInterval(() => { if (active) void sweep(); }, 180000);
    // Agent replies are persisted server-side and rechecked even if the chat
    // tab was switched or a subscription event was dropped.
    const chatTimer = allAgents ? window.setInterval(async () => {
      if (!active || document.visibilityState === "hidden") return;
      const rows = await load();
      const pending = (rows || []).find((item) => item.status === "responding" && item.kind === "chat");
      if (pending) {
        await base44.functions.invoke("trackAgentConversation", { mode: "sync", run_id: pending.id }).catch(() => {});
        if (active) await load();
      }
    }, 30000) : null;
    return () => {
      active = false; window.clearInterval(statusTimer); window.clearInterval(workTimer);
      if (chatTimer) window.clearInterval(chatTimer);
    };
  }, [load, refreshKey, sweep]);

  const advance = async (item) => {
    if (checking) return;
    setChecking(item.id);
    try {
      const response = await base44.functions.invoke("manageAgentWork", {
        mode: "advance", delegation_id: item.id, manual: true,
      });
      if (!response?.data?.ok) throw new Error("Unable to check");
      await load();
    } catch {
      setError("The provider check could not run. Your saved request is still available.");
    } finally {
      setChecking("");
    }
  };

  if (loading) return <div className="text-sm text-slate-500 py-3" role="status">Loading AI activity…</div>;
  if (!work.length && !error) return null;
  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Managed connection activity">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold text-slate-950">{allAgents ? "AI requests and progress" : "IFund AI work"}</h2>
          <p className="text-xs text-slate-600">Verified results, pending steps, and connections IFund can safely check automatically.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700 mb-3">{error}</p>}
      <div className="space-y-3">
        {work.slice(0, 12).map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-950 break-words">{item.objective?.startsWith("create_account ") ? `Set up ${ALL_PLATFORMS.find((p) => p.id === item.objective.slice("create_account ".length))?.name || item.objective.slice("create_account ".length)} account` : item.objective || "Connection request"}</p>
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{item.objective?.startsWith("create_account ") && ["waiting_external", "waiting_user"].includes(item.status) ? "Account setup needed" : format(item.status)}</span>
            </div>
            {item.result_summary && <p className="text-xs text-slate-700 mt-2 break-words">{item.result_summary}</p>}
            {ACTIVE.has(item.status) && item.external_requirement && <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 break-words">Next: {item.objective?.startsWith("create_account ") ? "Open the IFund connection window. Use provider authorization when available; a new provider account may need official sign-up first." : item.external_requirement}</p>}
            {item.objective?.startsWith("create_account ") && ALL_PLATFORMS.some((p) => p.id === item.objective.slice("create_account ".length)) && (
              <Link className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-400 px-3 py-2 text-sm font-semibold text-cyan-800 dark:text-cyan-200 underline" to={`/connections?connect=${encodeURIComponent(item.objective.slice("create_account ".length))}`}>
                Continue in IFund <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            {item.status === "waiting_external" && item.next_retry_at && <p className="text-xs text-slate-600 mt-1">Next automated check: {new Date(item.next_retry_at).toLocaleString()}</p>}
            {ACTIVE.has(item.status) && item.agent === "managed_connection_agent" && item.connection_id && (
              <Button type="button" size="sm" variant="outline" className="mt-2" disabled={checking === item.id} onClick={() => advance(item)}>
                {checking === item.id && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Check connection now
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
