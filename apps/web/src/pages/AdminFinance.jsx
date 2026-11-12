import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";
import FinanceDataGrid, { formatUsdCents } from "@/components/finance/FinanceDataGrid";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
const money = n => {
  const x = Number(n);
  return Number.isSafeInteger(x) && x >= 0
    ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(x/100) : "Unavailable";
};
const campaignColumns = [
  { field: "campaign_title", headerName: "Campaign", minWidth: 240 },
  { field: "raised_cents", headerName: "Verified gifts", minWidth: 150, valueFormatter: ({ value }) => formatUsdCents(value) },
  { field: "captured_payments", headerName: "Verified captures", minWidth: 160 },
  { field: "refund_count", headerName: "Refund records", minWidth: 160 },
];
export default function AdminFinance({ embedded = false }) {
  const { user } = useAuthSession();
  const superAdminStatus = useSuperAdminAccess(user);
  const [state,setState] = useState({status:"loading",rows:[],receipts:[],income:null,error:""});
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const client=authClient();
        const before=await client.auth.getUser();
        if(before.error||!before.data?.user?.id)throw Error("Sign in required.");
        // Server-side RPC checks verified administrator authority independently.
        const [report, merchant, income] = await Promise.all([
          client.rpc("ifund_admin_finance_summary"),
          client.rpc("ifund_admin_paypal_merchant_receipts"),
          client.rpc("ifund_super_admin_platform_income_summary"),
        ]);
        if(report.error||!Array.isArray(report.data)||merchant.error||!Array.isArray(merchant.data))
          throw Error("Administrator financial reporting is unavailable or you do not have verified access.");
        const incomeRow = !income.error && Array.isArray(income.data) ? income.data[0] || null : null;
        const after=await client.auth.getUser();
        if(after.error||after.data?.user?.id!==before.data.user.id)throw Error("Your session changed. Reload to continue.");
        if(active)setState({status:"ready",rows:report.data,receipts:merchant.data,income:incomeRow,error:""});
      }catch(e){if(active)setState({status:"error",rows:[],receipts:[],income:null,error:e.message||"Unavailable"});}
    })();
    return ()=>{active=false};
  },[]);
  const total=state.rows.reduce((s,row)=>s+(Number(row.raised_cents)||0),0);
  const count=state.rows.reduce((s,row)=>s+(Number(row.captured_payments)||0),0);
  const shown=state.receipts.filter(r=>r.allocation_status==="platform_support"||r.allocation_status==="unattributed");
  const platform=shown.filter(r=>r.allocation_status==="platform_support");
  const unmatched=shown.filter(r=>r.allocation_status==="unattributed");
  const Wrapper = embedded ? "div" : "main";
  return <Wrapper className={embedded ? "space-y-6 border-t border-border pt-7" : "mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8"}>
    <header><h2 className="text-2xl font-bold">Platform finance oversight</h2>
      <p className="mt-2 text-sm text-muted-foreground">Read-only verified donation totals. No payout controls, donor private details, sandbox payments or unconfirmed captures.</p></header>
    {state.status==="loading"&&<p role="status">Verifying administrator authorization and accounting records…</p>}
    {state.status==="error"&&<section role="alert" className="rounded-xl border border-red-500/50 p-5">{state.error}</section>}
    {state.status==="ready"&&<>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Captured campaign gifts</p><p className="mt-2 text-2xl font-semibold">{money(total)}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Verified payment records</p><p className="mt-2 text-2xl font-semibold">{count}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Campaigns in reporting</p><p className="mt-2 text-2xl font-semibold">{state.rows.length}</p></div>
      </div>
      {superAdminStatus === "super-admin" && state.income && <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-4" aria-label="IFund platform income">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Super admin · IFund platform income</p>
          <h2 className="mt-1 text-xl font-semibold">Realized platform income</h2>
          <p className="mt-1 text-sm text-muted-foreground">Provider-backed platform revenue only. Campaign principal is excluded.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Total realized income</p><p className="mt-2 text-2xl font-semibold tabular-nums">{money(state.income.total_realized_platform_income_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Platform support · gross</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.platform_support_gross_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">PayPal processing fees</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.platform_support_processing_fee_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Platform support · net</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.platform_support_net_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Subscription receipts · gross</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.subscription_gross_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Subscription refunds/reversals</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.subscription_refund_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Subscription ledger · net</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.subscription_net_cents)}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Realized 7% withdrawal fees</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(state.income.realized_withdrawal_fee_cents)}</p></div>
        </div>
      </section>}
      <section className="ifund-chart-card" aria-label="Verified platform finance composition">
        <p className="ifund-chart-eyebrow">AG Charts Community · independently attributed finance</p>
        <h3>Verified campaign gifts by campaign</h3>
        <DonutChart data={state.rows.filter(r=>Number.isSafeInteger(Number(r.raised_cents)) && Number(r.raised_cents)>0).map(r=>({
          name:r.campaign_title || "Campaign", value:Number(r.raised_cents), label:money(r.raised_cents),
        }))} title="Administrator verified campaign gift distribution" valueText={money(total)+" verified campaign gifts"}/>
        <p className="text-xs text-muted-foreground">Only completed provider-verified captures are included; merchant platform support and unmatched receipts are not combined with campaign gifts.</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3" aria-label="Platform support and unmatched PayPal receipts">
        <p className="text-xs text-muted-foreground">{unmatched.length} unmatched merchant receipt{unmatched.length === 1 ? "" : "s"} awaiting allocation review.</p>
        <h2 className="text-lg font-semibold">PayPal platform donations and merchant receipts</h2>
        <p className="text-sm text-muted-foreground">PayPal-confirmed gifts to IFund itself are platform support, not campaign gifts. Unmatched merchant payments remain separate. Neither group is included in campaign fundraising or owner withdrawals; the originating website is only displayed when verified.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Verified platform donations</p><p className="text-xl font-semibold tabular-nums">{platform.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Gross platform support</p><p className="text-xl font-semibold tabular-nums">{money(platform.reduce((sum,r)=>sum+Number(r.gross_cents||0),0))}</p></div>
          <div><p className="text-xs text-muted-foreground">Net platform support after PayPal fees</p><p className="text-xl font-semibold tabular-nums">{money(platform.reduce((sum,r)=>sum+Number(r.net_cents||0),0))}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border">
            <th className="py-3 pr-4">PayPal transaction</th><th className="py-3 pr-4">Allocation</th><th className="py-3 pr-4">Received</th><th className="py-3 pr-4">Gross</th><th className="py-3 pr-4">Processor fee</th><th className="py-3 pr-4">Net</th><th className="py-3">Origin</th>
          </tr></thead><tbody>{shown.map(r=><tr key={r.paypal_transaction_id} className="border-b border-border">
            <td className="py-3 pr-4 font-mono text-xs">{r.paypal_transaction_id}</td><td className="py-3 pr-4">{r.allocation_status === "platform_support" ? "IFund platform donation" : "Unmatched merchant receipt"}</td>
            <td className="py-3 pr-4">{new Date(r.occurred_at).toLocaleString()}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.gross_cents)}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.processing_fee_cents)}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.net_cents)}</td>
            <td className="py-3">{r.source_site === "unattributed" ? "Unverified" : r.source_site}</td>
          </tr>)}</tbody></table>
          {shown.length===0&&<p className="py-4 text-sm text-muted-foreground">No provider-confirmed platform or unmatched merchant receipts found.</p>}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Verified campaign finance dashboard">
        <h2 className="text-lg font-semibold">AG Grid · Verified campaign finance</h2>
        <p className="text-sm text-muted-foreground">Live records from the existing authorization-checked Supabase finance RPC. Sort, filter, or resize columns. No sandbox or example data is included in this admin report.</p>
        <FinanceDataGrid rows={state.rows} columns={campaignColumns} label="Verified authorized campaign accounting" />
        {state.rows.length === 0 && <p className="text-sm text-muted-foreground">No verified campaign finance records are available. No sample totals were inserted.</p>}
      </section>
    </>}
  </Wrapper>;
}
