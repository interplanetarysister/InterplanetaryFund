import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Megaphone, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { platformName } from "@/components/connections/platformCatalog";

const postStatusColors = {
  published: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-violet-100 text-violet-700",
  failed: "bg-red-100 text-red-700",
  pending_approval: "bg-amber-100 text-amber-700",
};

// Automation history — everything AI has done on the owner's behalf: agent
// activity plus every distributed post and its outcome, fully transparent.
export default function AutomationPanel() {
  const [posts, setPosts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [chatRuns, setChatRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("Sign-in required");
      const [p, a, chats] = await Promise.allSettled([
        base44.entities.DistributedPost.filter({ created_by_id: me.id }, "-updated_date", 25),
        base44.entities.AgentActivity.filter({ owner_user_id: me.id }, "-created_date", 25),
        base44.functions.invoke("trackAgentConversation", { mode: "list" }),
      ]);
      if (p.status === "fulfilled") setPosts(Array.isArray(p.value) ? p.value : []);
      if (a.status === "fulfilled") setActivity(Array.isArray(a.value) ? a.value : []);
      if (chats.status === "fulfilled" && chats.value?.data?.ok) {
        setChatRuns(chats.value.data.runs || []);
      }
      const incomplete = [p, a, chats].some((item) => item.status === "rejected") ||
        (chats.status === "fulfilled" && !chats.value?.data?.ok);
      setError(incomplete ? "Some activity could not be refreshed; the remaining records are still shown." : "");
    } catch {
      setError("Could not load automation activity. Check your sign-in and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !posts.length && !activity.length && !chatRuns.length) {
    return <div role="status" className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? <p className="text-sm text-amber-800" role="alert">{error}</p> : <p className="text-sm text-stone-500">Verified outcomes and work still in progress.</p>}
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>Refresh activity</Button>
      </div>
      <div>
        <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3"><Megaphone className="w-4 h-4 text-primary" /> Distribution activity</h3>
        {posts.length === 0 ? (
          <p className="text-sm text-stone-400">No distributed posts yet — generate platform content from any campaign page.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-stone-200/70 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-stone-800"><span className="font-semibold">{platformName(p.platform)}</span> · {p.campaign_title}</p>
                  <p className="text-xs text-stone-500 truncate mt-0.5">{p.content}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{formatDistanceToNow(new Date(p.updated_date), { addSuffix: true })}{p.error ? ` · ${p.error}` : ""}</p>
                </div>
                <Badge className={`${postStatusColors[p.status] || "bg-stone-100 text-stone-600"} border-0 capitalize shrink-0`}>{p.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3"><Bot className="w-4 h-4 text-primary" /> Agent activity log</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-400">No autonomous agent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-stone-200/70 p-3">
                <p className="text-sm text-stone-800">{a.action}</p>
                <p className="text-xs text-stone-500 mt-0.5">{a.reason}</p>
                <p className="text-xs text-stone-400 mt-0.5 capitalize">{a.campaign_title} · {a.status} · {formatDistanceToNow(new Date(a.created_date), { addSuffix: true })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3"><Bot className="w-4 h-4 text-primary" /> Agent chat requests</h3>
        {!chatRuns.length ? (
          <p className="text-sm text-stone-500">No recorded agent conversations yet.</p>
        ) : (
          <div className="space-y-2">
            {chatRuns.slice(0, 10).map((run) => (
              <div key={run.id} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium text-stone-900">{run.objective}</p>
                  <Badge variant="secondary" className="capitalize">{String(run.status || "unknown").replaceAll("_", " ")}</Badge>
                </div>
                <p className="text-xs text-stone-600 mt-1">{run.result_summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}