import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { Compass, HeartHandshake, ReceiptText, FlaskConical, ShieldCheck, RefreshCw, Info, Sparkles, Clock3 } from "lucide-react";

// Only donor-owned captured records are selectable under the existing Supabase RLS
// policy. Sandbox orders remain isolated until a donor-scoped backend endpoint
// verifies capture and exposes them; never read the sandbox table directly.
export default function MyGiving() {
  const [mode, setMode] = useState("sandbox");
  const [records, setRecords] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setPhase("loading"); setError("");
    try {
      const client = authClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth?.user?.id) throw new Error("Please sign in to view your private giving records.");
      const { data, error: readError } = await client.from("ifund_donations")
        .select("id,campaign_id,gift_cents,optional_support_cents,currency,status,created_at,captured_at,payment_channel,paypal_capture_id")
        .eq("donor_id", auth.user.id).eq("status", "captured").order("captured_at", { ascending: false }).limit(200);
      if (readError) throw new Error("Verified giving records cannot be retrieved safely right now.");
      setRecords(Array.isArray(data) ? data : []);
      setPhase("ready");
    } catch (cause) {
      setError(cause?.message || "Unable to retrieve giving records.");
      setPhase("error");
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const completed = useMemo(() => {
    const seen = new Set();
    return records.filter(row => {
      if (row.status !== "captured" || !row.paypal_capture_id || !row.campaign_id || !row.currency) return false;
      const key = "live:" + row.paypal_capture_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [records]);
  const usd = completed.filter(row => row.currency === "USD");
  const lifetime = usd.reduce((sum, row) => sum + Math.max(0, Number(row.gift_cents || 0)), 0) / 100;
  const campaigns = new Set(usd.map(row => row.campaign_id)).size;
  const show = mode === "live" && phase === "ready";
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-display text-3xl font-bold text-foreground">My Giving</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your private campaign donation history.</p></div>
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${mode==="sandbox"?"border-amber-500/30 bg-amber-500/10":"border-border bg-card"}`}>
        {mode==="sandbox"?<FlaskConical aria-hidden="true" className="h-4 w-4"/>:<ShieldCheck aria-hidden="true" className="h-4 w-4"/>}
        {mode==="sandbox"?"SANDBOX · TEST FUNDS":"LIVE · REAL PAYMENTS"}
      </span>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Giving environment">
      {[["sandbox","Sandbox demo"],["live","Live giving"]].map(([key,label])=><button key={key} type="button" aria-pressed={mode===key} onClick={()=>setMode(key)}
        className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-cyan-400 ${mode===key?"border-cyan-400 bg-cyan-500/15":"border-border bg-card"}`}>{label}</button>)}
    </div>
    {mode==="sandbox"&&<p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
      <Info className="h-5 w-5 shrink-0" aria-hidden="true"/>Sandbox transaction history is not connected to a verified donor-scoped endpoint on this Cloudflare build yet. Test funds never count toward live totals.</p>}
    {phase==="error"&&<section role="alert" className="rounded-xl border border-destructive/50 bg-card p-5"><p>{error}</p><button onClick={load} className="mt-3 rounded-xl border border-border px-4 py-2 font-semibold">Retry securely</button></section>}
    {phase==="loading"&&<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4"/>Loading your verified record access…</p>}
    {phase==="ready"&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><HeartHandshake className="h-5 w-5 text-cyan-400" aria-hidden="true"/>Lifetime Giving</div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{show?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(lifetime):"—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{show?"Verified capture records · USD":"Not available in this environment"}</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Compass className="h-5 w-5 text-violet-400" aria-hidden="true"/>Campaigns Supported</div>
        <p className="mt-2 text-3xl font-bold tabular-nums">{show?campaigns:"—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Unique campaigns with captured USD gifts</p>
      </section>
    </div>}
    <section aria-labelledby="history-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="history-title" className="flex items-center gap-2 text-xl font-semibold"><ReceiptText className="h-5 w-5 text-cyan-400" aria-hidden="true"/>Donation history</h2>
        <button type="button" disabled={phase==="loading"} onClick={load} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden="true"/>Refresh history</button>
      </div>
      {phase==="ready"&&(!show||completed.length===0)&&<div className="flex flex-col items-center gap-3 py-8 text-center">
        <HeartHandshake className="h-12 w-12 text-cyan-400" aria-hidden="true"/>
        <strong>{mode==="sandbox"?"Sandbox history awaiting integration":"No confirmed donations yet"}</strong>
        <p className="max-w-md text-sm text-muted-foreground">Browse real campaigns. Pending, cancelled, or unverified payments never contribute to giving totals.</p>
        <Link to="/discover" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground"><Compass className="h-4 w-4" aria-hidden="true"/>Find campaigns</Link>
      </div>}
      {show&&completed.length>0&&<ul className="divide-y divide-border">
        {completed.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><Link to={`/campaign/${encodeURIComponent(row.campaign_id)}`} className="font-semibold underline">View supported campaign</Link>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(row.captured_at||row.created_at).toLocaleDateString()} · Captured · {row.payment_channel||"PayPal"}</p></div>
          <div className="text-right"><p className="font-bold">{new Intl.NumberFormat("en-US",{style:"currency",currency:row.currency}).format(Number(row.gift_cents||0)/100)}</p>
            <p className="text-xs text-muted-foreground">Confirmed · {row.currency}</p></div>
        </li>)}</ul>}
    </section>
    <p className="flex items-start gap-2 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 shrink-0 text-violet-400" aria-hidden="true"/>Recurring payments and optional platform support are hidden until separately verified. Refund and reversal reconciliation is required before this page can be considered a complete financial statement.</p>
  </main>;
}
