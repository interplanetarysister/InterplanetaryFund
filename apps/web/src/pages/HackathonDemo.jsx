import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";

// A genuine PayPal Orders v2 SANDBOX demo. This page never uses hosted live buttons.
export default function HackathonDemo() {
  const [query] = useSearchParams();
  const [ready, setReady] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignId, setCampaignId] = useState("");
  const [campaignError, setCampaignError] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [cents, setCents] = useState(500);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState(null);
  const token = query.get("token");
  const approved = query.get("paypal")==="approved";
  const missingApprovalToken = approved && !token;
  const sandboxReady = ready?.mode === "sandbox" && ready?.enabled === true && ready?.webhook_ready === true && ready?.live_payments_enabled === false;
  useEffect(() => {
    let alive=true;
    fetch("/api/paypal/sandbox/status",{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw Error(`Sandbox status unavailable (${r.status})`);return r.json()})
      .then(x=>{if(alive)setReady(x)})
      .catch(e=>{if(alive){setReady({enabled:false});setStatusError(e.message)}});
    // Auth client initialization can fail synchronously when preview config is absent.
    // Never strand judges on an indefinite campaign-loading state.
    try {
      Promise.resolve(authClient().from("ifund_campaigns").select("id,title").eq("status","active").order("title",{ascending:true}).limit(100))
        .then(({data,error})=>{if(!alive)return;if(error){setCampaignError("Unable to load published campaigns. Please try again later.");setCampaignLoading(false);return}setCampaigns(data||[]);setCampaignId(data?.[0]?.id||"");setCampaignLoading(false)})
        .catch(()=>{if(alive){setCampaignError("Campaign discovery is temporarily unavailable. Please try again later.");setCampaignLoading(false)}});
    } catch {
      if(alive){setCampaignError("Campaign discovery is unavailable because the preview data connection could not initialize.");setCampaignLoading(false)}
    }
    return ()=>{alive=false};
  },[]);
  async function post(path,data) {
    const r=await fetch("/api/paypal/sandbox/"+path,{method:"POST",
      headers:{"content-type":"application/json"},body:JSON.stringify(data)});
    const reply=await r.json().catch(()=>({}));
    if(!r.ok||reply.ok!==true)throw Error(reply.error||"PayPal sandbox transaction not confirmed");
    return reply;
  }
  async function start() {
    if(!campaignId||working||!sandboxReady||approved)return;
    setWorking(true);setMessage("");setReceipt(null);
    try {
      const result=await post("orders",{campaign_id:campaignId,amount_cents:cents});
      const u=new URL(result.approval_url);
      if(u.protocol!=="https:"||u.hostname!=="www.sandbox.paypal.com"&&u.hostname!=="sandbox.paypal.com")
        throw Error("Unexpected PayPal approval URL");
      window.location.assign(u.href);
    }catch(e){setMessage(e.message);setWorking(false)}
  }
  async function complete() {
    if(!approved||!token||working||!sandboxReady)return;
    setWorking(true);setMessage("");
    try {
      const result=await post("capture",{order_id:token});
      if(result.mode!=="sandbox"||result.status!=="captured"||!result.capture_id||!result.order_id)
        throw Error("PayPal capture receipt was incomplete; payment is not confirmed");
      setReceipt(result);
      // Remove the one-time approval token from browser history after confirmed capture.
      const clean=new URL(window.location.href);
      clean.searchParams.delete("token");
      clean.searchParams.delete("PayerID");
      clean.searchParams.delete("paypal");
      window.history.replaceState(window.history.state,"",clean.pathname+clean.search+clean.hash);
    }
    catch(e){setMessage(e.message)}
    finally{setWorking(false)}
  }
  return <main className="mx-auto max-w-3xl space-y-7 px-4 py-10 pb-24">
    <header>
      <nav aria-label="Demo navigation" className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">IFund home</Link>
        <Link to="/discover" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">Browse campaigns</Link>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-400">PayPal AI Hackathon · 2026</p>
      <h1 className="mt-3 text-3xl font-bold text-foreground">IFund PayPal + AI demo</h1>
      <p className="mt-3 text-muted-foreground">See how AI helps people prepare a fundraiser, then approve a sample donation through PayPal's free sandbox. No real money is collected here.</p>
    </header>
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">1. AI campaign preparation</h2>
      <p className="mt-2 text-sm text-muted-foreground">Open the existing AI writing workspace to draft and review campaign wording before publication. Availability depends on verified account access.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link to="/agents" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Open AI writing workspace (sign-in required)</Link>
        <Link to="/create" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Try campaign drafting as a guest</Link>
      </div>
    </section>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="PayPal sandbox checkout">
      <div><h2 className="text-lg font-semibold">2. PayPal sandbox checkout</h2>
        <p className="mt-1 text-sm text-muted-foreground">This uses PayPal REST Orders v2 rather than the live platform-support payment button. Every receipt is isolated from real fundraising totals. Sandbox checkout is disabled unless the server explicitly confirms sandbox-only readiness.</p></div>
      {statusError&&<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">{statusError}</p>}
      {missingApprovalToken&&<p role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm">PayPal returned without an order token. No payment has been captured. Start a new sandbox checkout; do not treat this approval as a donation.</p>}
      {ready===null ? <p role="status">Checking sandbox readiness…</p>:
        (!sandboxReady) ? <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">Sandbox checkout is unavailable until PayPal sandbox credentials, webhook verification, and the server-side feature gate are configured. No sample payment can be captured yet.</p> : null}
      {campaignLoading&&<p role="status" className="text-sm text-muted-foreground">Loading active campaigns…</p>}
      {campaignError&&<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">{campaignError}</p>}
      {!campaignLoading&&!campaignError&&campaigns.length===0&&<p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">No active campaign is available for a real sandbox checkout. <Link to="/discover" className="underline">Browse campaigns</Link> or ask the demo organizer to publish an authentic test campaign.</p>}
      <label className="block text-sm font-medium">Demo campaign
        <select aria-label="Demo campaign" disabled={campaignLoading} value={campaignId} onChange={e=>setCampaignId(e.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border bg-background p-3">
          {campaigns.length===0&&<option value="">No published demo campaigns available</option>}
          {campaigns.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Sandbox donation amount
        <select aria-label="Sandbox donation amount" value={cents} onChange={e=>setCents(Number(e.target.value))}
          className="mt-2 min-h-12 w-full rounded-xl border bg-background p-3">
          <option value={100}>$1.00</option><option value={500}>$5.00</option><option value={1000}>$10.00</option>
        </select>
      </label>
      <button type="button" onClick={start} disabled={!sandboxReady||campaignLoading||!campaignId||working||approved}
        className="min-h-12 w-full rounded-xl bg-[#FFC439] px-4 font-semibold text-[#003087] disabled:opacity-50">
        {working?"Connecting to PayPal…":"Approve sandbox payment with PayPal"}
      </button>
      {query.get("paypal")==="cancelled"&&<p role="status">The sample payment was cancelled. No donation was recorded.</p>}
      {approved&&token&&<div className="rounded-xl border p-4">
        <p className="text-sm">PayPal returned from approval. This is not a completed donation. Capture must now be verified on the server.</p>
        {!sandboxReady&&<p role="alert" className="mt-2 text-sm">Capture is currently unavailable because sandbox readiness has not been verified. No donation is recorded; do not retry payment or assume approval completed it.</p>}
        <button disabled={working||!!receipt||!sandboxReady} onClick={complete} className="mt-3 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Verify and capture sample payment</button>
      </div>}
      {receipt&&<div role="status" className="rounded-xl border border-cyan-500/40 p-4">
        <p className="font-semibold">Verified PayPal sandbox receipt</p>
        <p className="mt-1 text-sm">Order: {receipt.order_id} · Capture: {receipt.capture_id}</p>
        <p className="mt-2 text-xs">No real donation or withdrawable balance was created.</p>
      </div>}
      {message&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{message}</p>}
      {(statusError||campaignError||missingApprovalToken||message)&&<button type="button" onClick={()=>window.location.reload()} className="min-h-11 w-full rounded-xl border border-border px-4 text-sm font-semibold">Retry demo checks</button>}
    </section>
    <p className="text-xs text-muted-foreground">Demo receipts require successful server-side verification and database persistence. Sandbox transactions never count toward public campaign totals. The live PayPal platform-support button is a separate integration.</p>
  </main>;
}
