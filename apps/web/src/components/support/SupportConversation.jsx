import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Server authorization is enforced independently for every read and reply RPC. */
export default function SupportConversation({ ticketId, ticketStatus }) {
  const [expanded, setExpanded] = useState(false);
  const [sequence, setSequence] = useState(0);
  const [state, setState] = useState({ phase: "idle", replies: [], error: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    setState({ phase: "loading", replies: [], error: "" });
    authClient().rpc("ifund_support_ticket_replies", { p_ticket_id: ticketId })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !Array.isArray(data))
          setState({ phase: "error", replies: [], error: "This conversation could not be verified." });
        else setState({ phase: "ready", replies: data, error: "" });
      })
      .catch(() => {
        if (alive) setState({ phase: "error", replies: [], error: "Support conversation is unavailable." });
      });
    return () => { alive = false; };
  }, [expanded, ticketId, sequence]);

  async function submit(event) {
    event.preventDefault();
    if (busy || ticketStatus !== "open") return;
    const body = reply.trim();
    if (body.length < 2 || body.length > 4000) {
      setState(s => ({ ...s, error: "Replies must be 2–4000 characters." }));
      return;
    }
    setBusy(true); setNotice("");
    try {
      const { data, error } = await authClient().rpc("ifund_add_support_reply", {
        p_ticket_id: ticketId, p_message: body,
      });
      if (error || !Array.isArray(data) || !data[0]?.reply_id)
        throw new Error(error?.message || "Reply could not be recorded.");
      setReply("");
      setNotice("Reply recorded in your support conversation.");
      setSequence(n => n + 1);
    } catch (cause) {
      setState(s => ({ ...s, error: cause.message || "Reply unavailable." }));
    } finally { setBusy(false); }
  }

  return <div className="mt-3 border-t border-border pt-3">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(s => !s)}
      className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-semibold">
      {expanded ? "Hide conversation" : "View conversation"}
    </button>
    {expanded && <section aria-label="Support conversation" className="mt-3 space-y-3">
      {state.phase === "loading" && <p role="status" className="text-sm">Loading verified conversation…</p>}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {notice && <p role="status" className="text-sm text-cyan-700">{notice}</p>}
      {state.phase === "ready" && (state.replies.length === 0
        ? <p className="text-sm text-muted-foreground">No replies yet.</p>
        : <ol className="space-y-2">{state.replies.map(row => <li key={row.reply_id} className="rounded-lg bg-muted/50 p-3">
            <strong className="text-sm">{row.author_role === "super_admin" ? "iFund support" : "Member"}</strong>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.reply_body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(row.posted_at).toLocaleString()}</p>
          </li>)}</ol>)}
      {ticketStatus === "open" ? <form onSubmit={submit} className="space-y-2">
        <label className="block text-sm font-semibold" htmlFor={"support-reply-" + ticketId}>Add a reply</label>
        <textarea id={"support-reply-" + ticketId} value={reply} maxLength={4000} required
          onChange={event => setReply(event.target.value)}
          className="w-full min-h-28 rounded-lg border border-border bg-background p-3" />
        <p className="text-xs text-muted-foreground">Messages are stored in your private ticket thread. Never include passwords or payment card data.</p>
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Saving reply…" : "Send reply"}
        </button>
      </form> : <p className="text-sm text-muted-foreground">This ticket is closed and cannot receive more replies.</p>}
    </section>}
  </div>;
}
