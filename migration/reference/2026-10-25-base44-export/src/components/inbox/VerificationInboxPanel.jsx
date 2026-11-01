import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MailCheck, Copy, Eye, EyeOff } from "lucide-react";

export default function VerificationInboxPanel({ platform }) {
  const [aliases, setAliases] = useState([]);
  const [messages, setMessages] = useState([]);
  const [revealed, setRevealed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "list" });
    if (data?.ok !== true) throw new Error(data?.error || "Verification mail unavailable.");
    setAliases(data.mailboxes || []);
    setMessages(data.messages || []);
  };
  useEffect(() => {
    let live = true;
    base44.functions.invoke("manageVerificationMailbox", { mode: "list" })
      .then(({data}) => { if (live && data?.ok) {
        setAliases(data.mailboxes || []); setMessages(data.messages || []);
      } else if(live) setError("Verification mail is not available yet."); })
      .catch(() => {if(live)setError("Verification mail is not available yet.");});
    return () => {live = false;};
  }, []);
  const create = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "create", platform: platform || "general" });
      if (!data?.ok) throw new Error(data?.error || "Could not reserve address.");
      await refresh();
      setNotice("Private verification address prepared. Wait until email delivery is activated before using it.");
    } catch {setError("Could not prepare address. Try again.");}
    finally {setBusy(false);}
  };
  const open = async (id) => {
    if (revealed?.id === id) {setRevealed(null); return;}
    setBusy(true); setError(""); setRevealed(null);
    try {
      const { data } = await base44.functions.invoke("manageVerificationMailbox", { mode: "open", mail_id: id });
      if (!data?.ok) throw new Error(data?.error || "Message unavailable.");
      setRevealed(data.mail);
    } catch {setError("Message unavailable. Try again.");}
    finally {setBusy(false);}
  };
  const current = platform ? aliases.filter(a => a.platform === platform) : aliases;
  const live = current.some(a => a.status === "active");
  const visible = platform ? messages.filter(m => current.some(a => a.id === m.alias_id)) : messages;
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Private verification mail">
    <h2 className="font-semibold text-lg flex items-center gap-2"><MailCheck className="w-5 h-5" /> Private verification mail</h2>
    <p className="text-sm text-muted-foreground">For external account sign-up emails and one-time security codes. Only you can open these messages. They are separate from the AI-accessible inbox.</p>
    {current.length === 0 ? <Button type="button" variant="outline" onClick={create} disabled={busy}>{busy ? "Preparing…" : "Prepare a verification email address"}</Button> : current.map(a =>
      <div className="rounded-lg border border-border p-3 space-y-2" key={a.address}>
        <p className="text-sm font-semibold">{a.platform}</p>
        <p className="text-sm break-all">{a.status === "active" ? a.address : "Private alias reserved (receiving disabled)"}</p>
        <p className="text-sm text-muted-foreground">{a.status === "active" ? "Ready to receive email" : "Email routing is being prepared; do not use this for sign-up until it is activated."}</p>
        {a.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(a.address).then(() => setNotice("Address copied")).catch(() => setError("Could not copy address."))}><Copy className="w-4 h-4 mr-1" /> Copy address</Button>}
      </div>
    )}
    {live && <Button type="button" variant="outline" disabled={busy} onClick={() => refresh().catch(() => setError("Unable to refresh mail."))}>Check new mail</Button>}
    {visible.map(m => <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-semibold">{m.sender}</p>
      <p className="text-sm text-muted-foreground">{new Date(m.received_at).toLocaleString()} · Expires after 24 hours</p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => open(m.id)}>{revealed?.id === m.id ? <EyeOff className="w-4 h-4 mr-1"/> : <Eye className="w-4 h-4 mr-1"/>}{revealed?.id === m.id ? "Hide verification email" : "Reveal verification email"}</Button>
      {revealed?.id === m.id && <div className="rounded-lg bg-muted p-3">
        <p className="text-sm font-bold break-words">{revealed.subject}</p>
        <pre className="whitespace-pre-wrap break-words text-sm font-sans mt-2">{revealed.text}</pre>
        <p className="text-sm text-muted-foreground mt-2">Confirm any email links are on the official provider website. Never share verification codes in AI chat.</p>
      </div>}
    </div>)}
    {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    {notice && <p className="text-sm text-emerald-700" role="status">{notice}</p>}
  </section>;
}
