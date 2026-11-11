import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";
import FinanceDataGrid, { formatUsdCents } from "@/components/finance/FinanceDataGrid";
import { financeDemoRows, demoFinanceStats } from "@/lib/hackathonFinanceDemo.mjs";
import DemoJourney from "@/components/hackathon/DemoJourney";

const financeColumns = [
  { field: "id", headerName: "Example record", minWidth: 150 },
  { field: "campaign", headerName: "Fictional campaign", minWidth: 230 },
  { field: "paymentMethod", headerName: "Example channel", minWidth: 190 },
  { field: "status", headerName: "Simulated status", minWidth: 170 },
  { field: "amountCents", headerName: "Example value", minWidth: 140, valueFormatter: ({ value }) => formatUsdCents(value) },
  { field: "period", headerName: "Period", minWidth: 125 },
];
const demoStats = demoFinanceStats();

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
  const [financeSearch, setFinanceSearch] = useState("");
  const token = query.get("token");
  const approved = query.get("paypal")==="approved";
  const missingApprovalToken = approved && !token;
  const sandboxReady = ready?.mode === "sandbox" && ready?.enabled === true && ready?.webhook_ready === true && ready?.live_payments_enabled === false;
  // Judges can reach the configured sandbox without enabling test payments on the live site.
  // This is a public location, never a credential or a secret.
  const sandboxDemoUrl = "https://feature-paypal-sandbox-secur.interplanetaryfund-migration.pages.dev/hackathon";
  // Every Cloudflare Pages preview is sandbox-only, even if payment is unavailable there.
  const sandboxHost = window.location.hostname.endsWith(".interplanetaryfund-migration.pages.dev");
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
  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-10 pb-24">
    <header>
      <nav aria-label="Demo navigation" className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">IFund home</Link>
        <Link to="/discover" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">Browse campaigns</Link>
        <Link to="/hackathon/tracker" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-400/40 px-4 font-semibold text-cyan-300">Organizer demo tracker</Link>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-400">PayPal AI Hackathon · 2026</p>
      <h1 className="mt-3 text-3xl font-bold text-foreground">The complete iFund guided demo</h1>
      <p className="mt-3 text-muted-foreground">One guided experience connects campaign discovery, AI story planning, social promotion, PayPal sandbox checkout, financial reporting and the AI agent ecosystem. No real money is collected on preview.</p>
    </header>
    <DemoJourney onFinanceFilter={setFinanceSearch} />
    <section className="rounded-2xl border border-cyan-400/40 bg-card p-5" aria-label="Choose PayPal payment environment">
      <h2 className="text-lg font-semibold">Choose a payment environment</h2>
      <p className="mt-2 text-sm text-muted-foreground">These are separate PayPal experiences. Sandbox payments use test buyer credentials and never create real donations. Live campaign checkout uses real money and is available only when the production payment health check enables it.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {window.location.origin === new URL(sandboxDemoUrl).origin
          ? <p className="rounded-xl border border-cyan-400/50 bg-cyan-400/10 p-3 text-center text-sm font-semibold text-cyan-200">You're on the designated PayPal sandbox preview.</p>
          : <a href={sandboxDemoUrl} className="flex min-h-12 items-center justify-center rounded-xl border border-cyan-400/60 px-4 text-center text-sm font-semibold text-cyan-300">Open configured PayPal sandbox preview — no real money</a>}
        {!sandboxHost && <a href="https://interplanetaryfund.com/discover" className="flex min-h-12 items-center justify-center rounded-xl border border-amber-400/60 px-4 text-center text-sm font-semibold text-amber-200">Browse live campaigns — real payments if enabled</a>}
        {!sandboxHost && <a href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl border border-amber-400/60 px-4 text-center text-sm font-semibold sm:col-span-2">Optional LIVE platform support — real charge, not a campaign donation</a>}
        {sandboxHost && <p className="rounded-xl border border-cyan-400/40 bg-cyan-400/5 p-3 text-sm text-cyan-100 sm:col-span-2">Sandbox judge environment: only test payments are offered here. Live campaign and platform-support payment links are intentionally hidden to prevent accidental real charges.</p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Judges: use a Personal PayPal Sandbox test buyer for sandbox checkout, not a merchant account or personal live PayPal credentials. Do not enter real card information in sandbox. Only the live checkout can create a real charge; confirm the amount and merchant before approving. No login credentials are supplied on this page.</p>
      {!sandboxHost && <p role="status" className="mt-3 rounded-lg border border-amber-500/40 p-3 text-sm">This is the production website. Use the linked isolated preview for sandbox checkout. Demo examples never create real donations.</p>}
    </section>
    <section id="ai-live-tools" className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Live AI writing workspace</h2>
      <p className="mt-2 text-sm text-muted-foreground">Open the existing AI writing workspace to draft and review campaign wording before publication. Availability depends on verified account access.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link to="/agents" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Open AI writing workspace (sign-in required)</Link>
        <Link to="/create" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">Try campaign drafting as a guest</Link>
      </div>
    </section>
    <section id="sandbox-checkout" className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="PayPal sandbox checkout">
      <div><h2 className="text-lg font-semibold">Step 4 · PayPal sandbox checkout</h2>
        <p className="mt-1 text-sm text-muted-foreground">This uses PayPal REST Orders v2. The sandbox order must reference an actually published campaign from the Supabase list below, not the fictional showcase scenario in steps 1–3. Every confirmed sandbox receipt is isolated from real fundraising totals; checkout stays disabled unless the server confirms readiness.</p></div>
      <aside className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm" aria-label="PayPal sandbox buyer login guidance">
        <h3 className="font-semibold">Before signing into PayPal Sandbox</h3>
        <p className="mt-1 text-muted-foreground">
          Use a <strong>Personal sandbox buyer</strong> account different from the
          <strong> Business sandbox merchant</strong> that receives IFund test payments.
          PayPal blocks payments to your own merchant account.
        </p>
        <p className="mt-2 text-muted-foreground">
          If PayPal says your account is associated with the merchant, sign out of
          PayPal Sandbox and choose another Personal test account. You can create a
          separate buyer in{" "}
          <a href="https://developer.paypal.com/sandbox-testing/accounts" target="_blank"
             rel="noopener noreferrer" className="font-semibold underline">
            PayPal Developer Sandbox Accounts
          </a>. Do not use a real PayPal account or real funds.
        </p>
        <p className="mt-2 text-muted-foreground">
          Start a new checkout here, and keep the same browser session through PayPal
          approval and the return to IFund. Confirm the PayPal login address begins
          with <code>https://www.sandbox.paypal.com/</code>.
        </p>
      </aside>
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
    <section id="finance-demo" aria-label="AG Grid Community example financial dashboard" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-slate-950 p-5 text-slate-100 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Sponsor technology · AG Grid Community</p>
        <h2 className="mt-2 text-xl font-bold">Step 5 · Interactive financial dashboard</h2>
        <p className="mt-2 text-sm text-slate-300">Sort columns, filter examples, page through records, or export the example CSV. This grid runs inside iFund at no extra backend cost.</p>
      </div>
      <p role="note" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3 text-sm font-semibold text-amber-100">
        FICTIONAL EXAMPLE DATA ONLY — these are not PayPal transactions, sandbox captures, donor receipts, real fundraising totals, or withdrawable balances. The actual sandbox receipt appears only in the verified checkout section above.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-sm text-slate-400">Fictional records</p><p className="mt-1 text-2xl font-bold">{demoStats.examples}</p></div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-sm text-slate-400">Sample completed entries</p><p className="mt-1 text-2xl font-bold">{demoStats.completed}</p></div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-sm text-slate-400">Illustrative completed value</p><p className="mt-1 text-2xl font-bold">{formatUsdCents(demoStats.exampleCapturedCents)}</p></div>
      </div>
      <label className="block text-sm font-medium text-slate-200">
        Filter the example finance table
        <input type="search" value={financeSearch} onChange={e=>setFinanceSearch(e.target.value)}
          placeholder="Search fictional campaign, status, or channel"
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-slate-100" />
      </label>
      <FinanceDataGrid rows={financeDemoRows} columns={financeColumns} label="Fictional campaign finance data in AG Grid"
        search={financeSearch} allowExport csvName="ifund-fictional-example-finance.csv" />
      <p className="text-xs text-slate-400">Developer API testing: a Postman collection is included in the public GitHub repository. Postman readiness checks do not create orders or verify captures.</p>
      <a className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-300 underline"
        href="/docs/postman/ifund-paypal-sandbox-readonly.postman_collection.json"
        target="_blank" rel="noopener noreferrer">View Postman PayPal sandbox test collection</a>
    </section>
    <section id="mission-control" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-[#09132c] p-5 text-slate-100 sm:p-6" aria-label="Connected iFund tools and AI agents">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Step 6 · Mission Control & developer evidence</p>
      <h2 className="text-xl font-bold">One platform, connected services</h2>
      <p className="text-sm text-slate-300">Explore the actual iFund features through the links below. Protected features require sign-in; provider status varies. These links open separately so this guided page stays your entry point.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["/agents","AI Story Agent & specialist identities","Story writing requires an eligible account; specialist chat is not fully connected"],
          ["/create","AI-assisted campaign creator","Five title choices, two summaries, editable story sections"],
          ["/discover","Campaign discovery","Browse actually published campaigns"],
          ["/social","IFund Social","Explore community posts and engagement"],
          ["/connections","Account connections","View available providers and consent settings"],
          ["/giving","Personal finance dashboard","Verified owner/donor accounting, sign-in required"],
        ].map(([to,name,description])=><Link key={to} to={to} target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 transition hover:border-cyan-400">
          <strong className="text-sm text-cyan-200">{name}</strong>
          <p className="mt-2 text-xs text-slate-300">{description}</p>
        </Link>)}
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <h3 className="font-semibold">Hackathon sponsor tools</h3>
        <p className="mt-2 text-sm text-slate-300">AG Grid Community powers the interactive example financial table above and a protected real-data admin finance dashboard. A free Postman v2.1 collection verifies read-only PayPal sandbox API contracts; it cannot prove a payment was captured.</p>
        <a href="/docs/postman/ifund-paypal-sandbox-readonly.postman_collection.json" target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/50 px-4 text-sm font-semibold text-cyan-200">Open Postman sandbox collection</a>
      </div>
      <a href="#journey" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/40 px-4 text-sm font-semibold text-cyan-200">Return to step 1</a>
    </section>
    <p className="text-xs text-muted-foreground">Demo receipts require successful server-side verification and database persistence. Sandbox transactions never count toward public campaign totals. The live PayPal platform-support button is a separate integration.</p>
  </main>;
}
