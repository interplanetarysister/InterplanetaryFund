import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import AdminFinance from "@/pages/AdminFinance";
import { authClient } from "@/api/auth";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
import FinanceDataGrid, { formatUsdCents } from "@/components/finance/FinanceDataGrid";
import { sumVerifiedCents } from "@/lib/verifiedMoney.mjs";

const cents = value => value === null || value === undefined || value === "" ? "Unavailable" : formatUsdCents(value);
function SummaryCard({ label, value }) {
  return <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
  </div>;
}
export default function FinanceDashboard() {
  const { user } = useAuthSession();
  const adminStatus = useAdminAccess(user);
  const [state, setState] = useState({ status: "loading", owned: [], donated: [], error: "" });
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const client = authClient();
        const session = await client.auth.getUser();
        if (session.error || !session.data?.user?.id) throw Error("Sign in to review your finances.");
        const [owner, receipts] = await Promise.all([
          client.rpc("ifund_owner_finance_summary"),
          client.rpc("ifund_my_donation_receipts"),
        ]);
        if (owner.error || receipts.error || !Array.isArray(owner.data) || !Array.isArray(receipts.data)) {
          throw Error("Verified financial records could not be loaded. Please retry.");
        }
        const fresh = await client.auth.getUser();
        if (fresh.error || fresh.data?.user?.id !== session.data.user.id) throw Error("Your session changed. Reload your finances.");
        if (active) setState({status:"ready", owned:owner.data, donated:receipts.data, error:""});
      } catch(e) {
        if(active) setState({status:"error",owned:[],donated:[],error:e.message||"Finance service unavailable."});
      }
    }
    refresh();
    return () => { active = false; };
  }, []);
  const totalRaised = sumVerifiedCents(state.owned, "raised_cents");
  const totalGiven = sumVerifiedCents(state.donated.filter(x=>x.receipt_status==="captured"), "amount_cents");
  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8">
    <header>
      <h1 className="text-3xl font-bold">Financial center</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your verified campaign receipts, owner fundraising and financial records in one place. Sandbox and pending payments are excluded. Withdrawal availability depends on verified account eligibility, cleared funds, and provider confirmation.</p>
      <nav aria-label="Financial center sections" className="mt-4 flex flex-wrap gap-2 text-sm">
        <a href="#campaign-finances" className="rounded-xl border border-border px-4 py-3 font-semibold">Campaign finances</a>
        <a href="#giving-receipts" className="rounded-xl border border-border px-4 py-3 font-semibold">My giving</a>
        <Link to="/withdrawals" className="rounded-xl border border-border px-4 py-3 font-semibold">Withdrawal verification</Link>
        <Link to="/engagement" className="rounded-xl border border-border px-4 py-3 font-semibold">Supporter engagement</Link>
        {adminStatus === "admin" && <a href="#platform-finance" className="rounded-xl border border-border px-4 py-3 font-semibold">Platform oversight</a>}
      </nav>
    </header>
    {state.status==="loading" && <p role="status">Verifying your donation records…</p>}
    {state.status==="error" && <section role="alert" className="rounded-xl border border-red-500/40 p-5">
      <p>{state.error}</p><button type="button" onClick={()=>window.location.reload()} className="mt-3 min-h-11 rounded-xl border px-4">Retry</button>
    </section>}
    {state.status==="ready" && <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Verified campaign gifts received" value={cents(totalRaised)}/>
        <SummaryCard label="Your verified donations to campaigns" value={cents(totalGiven)}/>
      </div>
      <section id="campaign-finances" className="ifund-chart-card" aria-label="Owner verified campaign funding distribution">
        <p className="ifund-chart-eyebrow">AG Charts Community · verified captured donations only</p>
        <h2>Fundraising by your campaigns</h2>
        {state.owned.length===0 ? <p className="text-sm text-muted-foreground">No owned campaign funds to chart.</p> : <>
          <DonutChart data={state.owned
            .filter(row=>Number.isSafeInteger(Number(row.raised_cents)) && Number(row.raised_cents)>0)
            .map(row=>({name:row.campaign_title||"Campaign",value:Number(row.raised_cents),label:cents(row.raised_cents)}))}
            title="Verified campaign donations by owned campaign" valueText={cents(totalRaised)+" verified received"} />
          <p className="text-sm text-muted-foreground">Verified received amounts are in cents from the owner finance RPC; sandbox test payments, unverified pledges and platform support are excluded.</p>
          <FinanceDataGrid rows={state.owned} label="Owner campaigns sorted by verified captures"
            columns={[{field:"campaign_title",headerName:"Campaign",minWidth:230},
              {field:"campaign_status",headerName:"Status",minWidth:130},
              {field:"raised_cents",headerName:"Verified captured",minWidth:175,valueFormatter:({value})=>formatUsdCents(value)},
              {field:"captured_payments",headerName:"Captures",minWidth:135}]} />
        </>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Campaign fundraising</h2>
        {state.owned.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">You have no owned campaigns with financial records to display.</p> :
          <div className="mt-3 space-y-3">{state.owned.map(c => <div key={c.campaign_id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3">
            <div><Link className="font-medium underline" to={"/campaign/"+c.campaign_id}>{c.campaign_title}</Link>
              <p className="text-xs text-muted-foreground">{c.campaign_status} · {c.captured_payments} verified payments</p></div>
            <strong className="tabular-nums">{cents(c.raised_cents)}</strong>
          </div>)}</div>}
      </section>
      <section id="giving-receipts" className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Your donation receipts</h2>
        <p className="mt-1 text-xs text-muted-foreground">Provider-verified refunds remain visible for your records, but are excluded from active giving and campaign totals.</p>
        {state.donated.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No verified captured donations recorded for your account.</p> :
          <div className="mt-3 space-y-3">{state.donated.map(r => <div key={r.donation_id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3">
            <div><Link to={"/campaign/"+r.campaign_id} className="underline">{r.campaign_title}</Link>
              <p className="text-xs text-muted-foreground">{r.receipt_status==="refunded"?"Refunded / reversed":"Captured"} · {new Date(r.captured_at).toLocaleDateString()}</p></div>
            <strong className={"tabular-nums "+(r.receipt_status==="refunded"?"text-muted-foreground line-through":"")}>{cents(r.amount_cents)}</strong>
          </div>)}</div>}
      </section>
    </>}
    {adminStatus === "admin" && <section id="platform-finance" aria-label="Verified administrator finance oversight"><AdminFinance embedded /></section>}
  </main>;
}
