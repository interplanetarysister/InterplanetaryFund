import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AUDIT_PAGE_SIZE, auditCursor, validateAuditRows } from "@/lib/adminAuditFeed.mjs";

/**
 * Selected operational audit records only. Access is checked by the database
 * on every RPC; frontend gates are additional UX, never the authority.
 */
export default function AdminAudit() {
  const { user, status } = useAuthSession();
  const [events, setEvents] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);

  const refresh = useCallback(async (older = false) => {
    if (busy.current) return;
    busy.current = true;
    const currentGeneration = generation.current;
    setPhase(older ? "loading-more" : "loading");
    setError("");
    try {
      const client = authClient();
      const before = await client.auth.getUser();
      if (before.error || !before.data?.user?.id || before.data.user.id !== user?.id)
        throw new Error("Your account session could not be verified.");
      const cursor = older ? auditCursor(events) : { p_before_at: null, p_before_id: null };
      const { data, error: readError } = await client.rpc("ifund_super_admin_audit_feed", {
        p_limit: AUDIT_PAGE_SIZE,
        ...cursor,
      });
      if (readError) throw new Error("The protected audit feed is not available.");
      const page = validateAuditRows(data);
      const after = await client.auth.getUser();
      if (after.error || after.data?.user?.id !== before.data.user.id)
        throw new Error("Your session changed. Reload the audit feed.");
      if (currentGeneration !== generation.current) return;
      if (older) {
        const existing = new Set(events.map(event => event.event_id));
        if (page.some(event => existing.has(event.event_id)))
          throw new Error("Audit pagination changed. Reload before continuing.");
        setEvents(old => [...old, ...page]);
      } else {
        setEvents(page);
      }
      setHasMore(page.length === AUDIT_PAGE_SIZE);
      setPhase("ready");
    } catch (cause) {
      if (currentGeneration === generation.current) {
        setPhase(older ? "ready" : "error");
        setError(cause?.message || "Audit verification failed.");
      }
    } finally {
      busy.current = false;
    }
  }, [events, user?.id]);

  useEffect(() => {
    generation.current++;
    if (status === "loading") return undefined;
    if (!user?.id) {
      setEvents([]); setHasMore(false); setPhase("error");
      setError("Sign in with a verified administrator account.");
      return undefined;
    }
    void refresh(false);
    return () => { generation.current++; };
    // Refresh intentionally tracks account identity and explicit reload only;
    // changing the loaded page must not trigger a new first-page request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, status, attempt]);

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold">Operational audit</h1>
      <p className="text-sm text-muted-foreground">
        Authorized, read-only timestamps and event types from workflow execution,
        administrative mail actions and platform incidents. This is a selected
        operational history, not a comprehensive record of payments or account activity.
        No private message contents, actor identifiers, or provider credentials are shown.
      </p>
      <Link className="text-sm text-primary underline" to="/ops">Return to operations</Link>
    </header>
    {phase === "loading" && <p role="status">Verifying operational history…</p>}
    {error && <section role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
      <p>{error}</p>
      {phase === "error" && <button type="button" className="min-h-11 rounded-xl border px-4"
        onClick={() => setAttempt(n => n + 1)}>Retry protected read</button>}
    </section>}
    {(phase === "ready" || phase === "loading-more") && <section className="rounded-2xl border border-border bg-card p-5" aria-label="Super-admin operational audit events">
      <h2 className="mb-4 text-xl font-semibold">Recorded events</h2>
      {events.length === 0 ? <p className="text-sm text-muted-foreground">No operational audit events were returned.</p> :
        <ol className="divide-y divide-border">{events.map(entry => <li key={entry.event_id} className="space-y-1 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="font-semibold">{entry.event_name}</strong>
            <time dateTime={entry.occurred_at} className="text-xs text-muted-foreground">{new Date(entry.occurred_at).toLocaleString()}</time>
          </div>
          <p className="text-xs text-muted-foreground">{entry.event_source}</p>
        </li>)}</ol>}
      {hasMore && <button type="button" disabled={phase === "loading-more"} onClick={() => refresh(true)}
        className="mt-5 min-h-11 rounded-xl border border-border px-4 font-semibold disabled:opacity-50">
        {phase === "loading-more" ? "Loading older events…" : "Load older events"}
      </button>}
    </section>}
  </main>;
}
