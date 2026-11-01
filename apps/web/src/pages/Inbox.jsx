import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Loader2, MailOpen, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadUniversalInbox, markInboxItemDone, markInboxNotificationRead } from "@/lib/inbox";

function localDestination(value) {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return null;
  return value;
}

function externalDestination(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("open");
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await loadUniversalInbox(authClient()));
    } catch (err) {
      setError(err?.message || "We couldn't load your inbox. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const platforms = useMemo(() => [...new Set(items.map(item => item.platform))].sort(), [items]);
  const visible = useMemo(() => items.filter(item =>
    (tab === "all" || item.status === tab) &&
    (platform === "all" || item.platform === platform) &&
    (!search || [item.author, item.content, item.campaign_title, item.platform]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()))
  ), [items, tab, platform, search]);

  async function markDone(item) {
    if (busy) return;
    setBusy(item.key);
    setError("");
    try {
      if (item.source === "inbox") await markInboxItemDone(authClient(), item.id);
      else await markInboxNotificationRead(authClient(), item.id);
      setItems(current => current.map(row => row.key === item.key ? { ...row, status: "done" } : row));
    } catch (err) {
      setError(err?.message || "This item could not be updated.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
            <MailOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-semibold">Universal Inbox</h1>
            <p className="text-sm text-muted-foreground">Your connected-platform messages and IFund notifications.</p>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap gap-2" aria-label="Inbox filters">
        {["open", "done", "all"].map(value => (
          <button key={value} type="button" onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium capitalize ${tab === value ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            {value}
          </button>
        ))}
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Search inbox…" aria-label="Search inbox"
            className="min-h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm" />
        </label>
        <select value={platform} onChange={event => setPlatform(event.target.value)}
          aria-label="Filter by platform"
          className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm">
          <option value="all">All platforms</option>
          {platforms.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="button" onClick={load} disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </section>

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading inbox…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-14 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">{items.length ? "Nothing in this view" : "Your inbox is clear"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length ? "Try another filter or search term." : "New connected-platform messages and IFund notifications will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(item => {
            const local = localDestination(item.link);
            const external = !local ? externalDestination(item.link) : null;
            return (
              <article key={item.key} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800">{item.platform}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{item.type}</span>
                      {item.priority && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Priority</span>}
                    </div>
                    <h2 className="mt-2 break-words font-semibold">{item.author || item.campaign_title || "IFund notification"}</h2>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.content}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{item.date ? new Date(item.date).toLocaleString() : "Date unavailable"}</p>
                    {local && <Link to={local} className="mt-2 inline-block text-sm font-medium text-cyan-800 underline">View in IFund</Link>}
                    {external && <a href={external} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-cyan-800 underline">Open source platform</a>}
                    {!local && !external && item.link && <p className="mt-2 text-xs text-muted-foreground">External link unavailable</p>}
                  </div>
                  {item.status === "open" ? (
                    <button type="button" onClick={() => markDone(item)} disabled={Boolean(busy)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50">
                      {busy === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Done
                    </button>
                  ) : <span className="shrink-0 text-xs text-muted-foreground">Done</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This view currently includes owner-scoped inbox messages and notifications. Campaign donation details and admin approval actions remain disabled until their separate privacy and authorization paths are verified.
      </p>
    </div>
  );
}
