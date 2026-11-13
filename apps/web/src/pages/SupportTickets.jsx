import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";
import SupportConversation from "@/components/support/SupportConversation";

export default function SupportTickets() {
  const { user } = useAuthSession();
  const access = useSuperAdminAccess(user);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState([]);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState("");

  const refresh = useCallback(async () => {
    const { data, error: issue } = await authClient().rpc("ifund_my_support_tickets");
    if (issue || !Array.isArray(data)) throw new Error("Support history could not be verified.");
    setTickets(data);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh().catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const refreshQueue = useCallback(async () => {
    const { data, error: issue } = await authClient().rpc("ifund_super_admin_support_queue");
    if (issue || !Array.isArray(data)) throw new Error("Administrator support queue is unavailable.");
    setQueue(data);
  }, []);
  useEffect(() => {
    if (access !== "super-admin") { setQueue([]); return; }
    let active = true;
    setQueueLoading(true);
    refreshQueue().catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setQueueLoading(false); });
    return () => { active = false; };
  }, [access, refreshQueue]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const cleanSubject = subject.trim(), cleanMessage = message.trim();
      if (cleanSubject.length < 4 || cleanSubject.length > 160 || cleanMessage.length < 10 || cleanMessage.length > 4000)
        throw new Error("Enter a subject of 4–160 characters and a message of 10–4000 characters.");
      const { data, error: issue } = await authClient().rpc("ifund_create_support_ticket", {
        p_subject: cleanSubject, p_message: cleanMessage,
      });
      if (issue || !Array.isArray(data) || !data[0]?.ticket_id)
        throw new Error(issue?.message || "Support request could not be recorded.");
      setSubject(""); setMessage("");
      setNotice("Your support request was recorded. Reference: " + data[0].ticket_id);
      await refresh();
      if (access === "super-admin") await refreshQueue();
    } catch (err) { setError(err.message || "Support request failed."); }
    finally { setBusy(false); }
  }

  async function close(ticketId) {
    if (access !== "super-admin" || closing) return;
    setClosing(ticketId); setError(""); setNotice("");
    try {
      const { data, error: issue } = await authClient().rpc("ifund_super_admin_close_support_ticket", {
        p_ticket_id: ticketId,
      });
      if (issue || data !== true) throw new Error("Ticket was not closed. Its status may have changed.");
      setNotice("Ticket closed.");
      await Promise.all([refresh(), refreshQueue()]);
    } catch (err) { setError(err.message || "Support update failed."); }
    finally { setClosing(""); }
  }

  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8">
    <header>
      <h1 className="text-3xl font-bold">Support requests</h1>
      <p className="mt-2 text-sm text-muted-foreground">Submit and track account support cases. Never include passwords, payment card details, or authentication codes.</p>
      <p className="mt-1 text-sm text-muted-foreground">For assistance by email, visit <Link className="underline" to="/contact">Contact</Link>.</p>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-500/40 p-4">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-cyan-500/40 p-4">{notice}</p>}
    <form className="space-y-4 rounded-xl border border-border bg-card p-5" onSubmit={submit}>
      <h2 className="text-xl font-semibold">New support request</h2>
      <label className="block text-sm font-medium" htmlFor="ticket-subject">Subject</label>
      <input id="ticket-subject" className="w-full min-h-11 rounded-lg border border-border bg-background px-3"
        value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} required />
      <label className="block text-sm font-medium" htmlFor="ticket-message">Message</label>
      <textarea id="ticket-message" className="w-full min-h-36 rounded-lg border border-border bg-background p-3"
        value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} required />
      <p className="text-xs text-muted-foreground">Maximum three submissions per hour. Submitting stores your case in iFund; email delivery is not implied.</p>
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit support request"}
      </button>
    </form>
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Your cases</h2>
      {loading ? <p role="status" className="mt-2">Loading your support history…</p> :
        tickets.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No recorded support tickets.</p> :
        <ul className="mt-4 space-y-3">{tickets.map(t => <li key={t.ticket_id} className="rounded-lg border border-border p-4">
          <div className="flex justify-between gap-2"><strong>{t.subject}</strong><span className="text-sm capitalize">{t.ticket_status}</span></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{t.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">Opened {new Date(t.submitted_at).toLocaleString()} · {t.ticket_id}</p>
          <SupportConversation ticketId={t.ticket_id} ticketStatus={t.ticket_status} />
        </li>)}</ul>}
    </section>
    {access === "super-admin" && <section className="rounded-xl border border-border bg-card p-5" aria-label="Super admin support queue">
      <h2 className="text-xl font-semibold">Administrator support queue</h2>
      {queueLoading ? <p role="status">Loading administrator queue…</p> :
        queue.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No support cases in the queue.</p> :
        <ul className="mt-3 space-y-3">{queue.map(t => <li key={t.ticket_id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap justify-between gap-2"><strong>{t.subject}</strong><span className="text-sm capitalize">{t.ticket_status}</span></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{t.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">Owner: {t.owner_id} · Opened {new Date(t.submitted_at).toLocaleString()}</p>
          <SupportConversation ticketId={t.ticket_id} ticketStatus={t.ticket_status} />
          {t.ticket_status === "open" && <button type="button" disabled={Boolean(closing)} onClick={() => close(t.ticket_id)}
            className="mt-3 min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50">{closing === t.ticket_id ? "Closing…" : "Mark closed"}</button>}
        </li>)}</ul>}
    </section>}
  </main>;
}
