import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { moderationQueue, moderatePost } from "@/lib/socialCommunity";

export default function SocialModeration() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setReports(await moderationQueue()); }
    catch (cause) { setError(cause.message || "Review queue unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(report, action) {
    setBusy(report.id); setError("");
    try {
      await moderatePost(report.id, action, report.archive);
      await load();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(""); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="space-y-2"><h1 className="font-display text-3xl font-bold">Community moderation</h1>
      <p className="text-muted-foreground">Post reports from members. Open reports temporarily hide the original post until an administrator reviews it.</p>
      <Link className="text-primary underline" to="/inbox">Back to inbox</Link></header>
    <button onClick={load} className="rounded-xl border px-4 py-2" disabled={loading}>Refresh reports</button>
    {loading && <p role="status">Loading moderation queue…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && !reports.length && <p>No reports available.</p>}
    <div className="space-y-4">{reports.map(item => <article className="space-y-3 rounded-2xl border border-border bg-card p-5" key={item.id}>
      <p className="text-xs text-muted-foreground">{item.created_at && new Date(item.created_at).toLocaleString()} · {item.status}</p>
      <h2 className="font-semibold">Reported post</h2><p className="whitespace-pre-wrap break-words">{item.body}</p>
      <h3 className="font-semibold">Report explanation</h3><p className="whitespace-pre-wrap break-words">{item.reason}</p>
      {item.status === "open" && <div className="flex flex-wrap gap-3">
        <button disabled={!!busy} onClick={() => decide(item,"restore")} className="min-h-11 rounded-xl border border-border px-4">Restore post</button>
        <button disabled={!!busy} onClick={() => decide(item,"remove")} className="min-h-11 rounded-xl bg-destructive px-4 text-destructive-foreground">Remove post</button>
      </div>}
    </article>)}</div>
  </main>;
}
