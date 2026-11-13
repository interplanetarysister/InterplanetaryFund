import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";
import FinanceDataGrid, { formatUsdCents } from "@/components/finance/FinanceDataGrid";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
import { sumVerifiedCents, sumVerifiedCounts } from "@/lib/verifiedMoney.mjs";
import { merchantReceiptExceptions } from "@/lib/merchantReconciliation.mjs";
const money = n => n === null || n === undefined || n === "" ? "Unavailable" : formatUsdCents(n);
const operationalCount = n => (typeof n !== "number" && typeof n !== "string") || (typeof n === "string" && !/^(0|[1-9]\d*)$/.test(n.trim())) || !Number.isSafeInteger(Number(n)) || Number(n) < 0 ? "Unavailable" : String(Number(n));
const campaignColumns = [
  { field: "campaign_title", headerName: "Campaign", minWidth: 240 },
  { field: "raised_cents", headerName: "Verified gifts", minWidth: 150, valueFormatter: ({ value }) => formatUsdCents(value) },
  { field: "captured_payments", headerName: "Verified captures", minWidth: 160 },
  { field: "refund_count", headerName: "Refund records", minWidth: 160 },
];
export default function AdminFinance({ embedded = false }) {
  const { user } = useAuthSession();
  const superAdminStatus = useSuperAdminAccess(user);
  const [state,setState] = useState({status:"loading",rows:[],receipts:[],income:null,payoutQueue:null,operational:null,error:""});
  const [payoutBusy,setPayoutBusy] = useState("");
  const [payoutMessage,setPayoutMessage] = useState("");
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const client=authClient();
        const before=await client.auth.getUser();
        if(before.error||!before.data?.user?.id)throw Error("Sign in required.");
        // Server-side RPC checks verified administrator authority independently.
        const [report, merchant, income, payoutQueue, operational] = await Promise.all([
          client.rpc("ifund_admin_finance_summary"),
          client.rpc("ifund_admin_paypal_merchant_receipts"),
          client.rpc("ifund_super_admin_platform_income_summary"),
          client.rpc("ifund_super_admin_payout_queue"),
          client.rpc("ifund_super_admin_operational_snapshot"),
        ]);
        if(report.error||!Array.isArray(report.data)||merchant.error||!Array.isArray(merchant.data))
          throw Error("Administrator financial reporting is unavailable or you do not have verified access.");
        const incomeRow = !income.error && Array.isArray(income.data) ? income.data[0] || null : null;
        const after=await client.auth.getUser();
        if(after.error||after.data?.user?.id!==before.data.user.id)throw Error("Your session changed. Reload to continue.");
        // A failed payout-query must never be misrepresented as an empty queue.
        const queueRows = !payoutQueue.error && Array.isArray(payoutQueue.data) ? payoutQueue.data : null;
        const operationalRow = !operational.error && Array.isArray(operational.data) ? operational.data[0] || null : null;
        if(active)setState({status:"ready",rows:report.data,receipts:merchant.data,income:incomeRow,payoutQueue:queueRows,operational:operationalRow,error:""});
      }catch(e){if(active)setState({status:"error",rows:[],receipts:[],income:null,payoutQueue:null,operational:null,error:e.message||"Unavailable"});}
    })();
    return ()=>{active=false};
  },[]);
  async function executePayout(withdrawalId) {
    if(payoutBusy)return;
    setPayoutBusy(withdrawalId);setPayoutMessage("");
    try{
      const client=authClient();
      const session=await client.auth.getSession();
      const token=session.data?.session?.access_token;
      if(session.error||!token)throw Error("Verified super-admin session required.");
      const response=await fetch("/api/payments/payouts/execute",{
        method:"POST",
        headers:{"content-type":"application/json","authorization":"Bearer "+token},
        body:JSON.stringify({withdrawal_id:withdrawalId})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true)
        throw Error(data.error==="payout_status_unknown_reconcile_before_retry"
          ?"PayPal outcome is uncertain. The reservation remains locked for reconciliation; do not create another payout."
          :data.error||"PayPal payout execution was not confirmed.");
      const [queue,income]=await Promise.all([
        client.rpc("ifund_super_admin_payout_queue"),
        client.rpc("ifund_super_admin_platform_income_summary")
      ]);
      setState(v=>({...v,
        payoutQueue:!queue.error&&Array.isArray(queue.data)?queue.data:null,
        income:!income.error&&Array.isArray(income.data)?income.data[0]||v.income:v.income
      }));
      setPayoutMessage(data.status==="SUCCESS"
        ?"PayPal confirmed the payout item as SUCCESS and the withdrawal ledger is settled."
        :"Payout submitted to PayPal. Funds remain reserved until PayPal confirms item-level SUCCESS.");
    }catch(cause){setPayoutMessage(cause.message||"Payout execution is unavailable.");}
    finally{setPayoutBusy("");}
  }

  const total=sumVerifiedCents(state.rows, "raised_cents");
  const count=sumVerifiedCounts(state.rows, "captured_payments");
  const shown=state.receipts.filter(r=>r.allocation_status==="platform_support"||r.allocation_status==="unattributed");
  const platform=shown.filter(r=>r.allocation_status==="platform_support");
  const unmatched=shown.filter(r=>r.allocation_status==="unattributed");
  const reconciliation=merchantReceiptExceptions(state.receipts);
  const Wrapper = embedded ? "div" : "main";
  return <Wrapper className={embedded ? "space-y-6 border-t border-border pt-7" : "mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8"}>
    <header><h2 className="text-2xl font-bold">Platform finance oversight</h2>
      <p className="mt-2 text-sm text-muted-foreground">Verified live finance only. Payout controls are restricted to verified super-admin sessions and provider-ready owner withdrawals; sandbox and unconfirmed payments are excluded.</p></header>
    {state.status==="loading"&&<p role="status">Verifying administrator authorization and accounting records…</p>}
    {state.status==="error"&&<section role="alert" className="rounded-xl border border-red-500/50 p-5">{state.error}</section>}
    {state.status==="ready"&&<>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Captured campaign gifts</p><p className="mt-2 text-2xl font-semibold">{money(total)}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Verified payment records</p><p className="mt-2 text-2xl font-semibold">{count===null?"Unavailable":count}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Campaigns in reporting</p><p className="mt-2 text-2xl font-semibold">{state.rows.length}</p></div>
      </div>
      {superAdminStatus === "super-admin" && !state.income &&
        <p role="alert" className="rounded-xl border border-amber-500/50 p-4 text-sm">
          Provider-backed platform income could not be verified. This is not a confirmed zero balance.
        </p>}
      {superAdminStatus === "super-admin" && reconciliation && reconciliation.length>0 &&
        <section aria-label="ORBIT reconciliation exceptions" className="rounded-xl border border-amber-500/40 bg-card p-5 space-y-3">
          <h2 className="text-lg font-semibold">ORBIT · Reconciliation exceptions ({reconciliation.length})</h2>
          <p className="text-sm text-muted-foreground">Read-only alerts. Missing origin or amount mismatches require provider evidence; this report does not allocate merchant receipts.</p>
          <ul className="space-y-2">{reconciliation.map((r,i)=><li key={r.id+":"+i} className="rounded-lg border border-border p-3 text-sm">
            <strong className="font-mono">{r.id}</strong>
            <ul className="mt-1 list-disc pl-5">{r.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>
          </li>)}</ul>
        </section>}
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
      {superAdminStatus === "super-admin" && <section className="rounded-2xl border border-border bg-card p-5 space-y-4" aria-label="IFund operational monitoring">
        <h2 className="text-xl font-semibold">Operational monitoring</h2>
        <p className="text-sm text-muted-foreground">Read-only database snapshot; Cloudflare Workers uptime and external service health must be checked separately. No payment or administrative operation is triggered by this view.</p>
        {state.operational ? <>
          <p className="text-xs text-muted-foreground">Database snapshot: {new Date(state.operational.checked_at).toLocaleString()}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Queued database jobs", "queued_workflow_jobs"],
              ["Failed database jobs", "failed_workflow_jobs"],
              ["Overdue database jobs", "overdue_workflow_jobs"],
              ["Job events · last 24h", "recent_workflow_events"],
              ["Unresolved incident records", "unresolved_platform_incidents"],
              ["Unattributed merchant receipts", "unattributed_merchant_receipts"],
              ["Active subscription plans", "active_subscription_plans"],
              ["Provider-verified plans", "provider_verified_subscription_plans"],
            ].map(([label,key]) => <div key={key} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{operationalCount(state.operational[key])}</p>
            </div>)}
          </div>
          <p className="text-xs text-muted-foreground">Zero database jobs or incidents does not verify that external scheduled Workers ran successfully.</p>
        </> : <p role="status" className="text-sm text-amber-700">Operational telemetry is unavailable or permission verification failed. No healthy status is inferred.</p>}
      </section>}
      {superAdminStatus === "super-admin" && <section className="rounded-2xl border border-border bg-card p-5 space-y-4" aria-label="Owner payout execution queue">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Super admin · PayPal Payouts</p>
          <h2 className="mt-1 text-xl font-semibold">Owner withdrawal queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">Execution is allowed only after owner/AAL2 reservation, provider-cleared refund-adjusted funds, exact 7% fee accounting, and a verified owner payout recipient. A PayPal submission is not marked paid until item-level SUCCESS.</p>
        </div>
        {state.payoutQueue===null ? <p role="alert" className="text-sm text-amber-700">Withdrawal queue could not be verified. Payout actions are unavailable until refreshed.</p> : state.payoutQueue.length===0 ? <p className="text-sm text-muted-foreground">No owner withdrawals are currently awaiting payout or reconciliation.</p> :
          <div className="space-y-3">{state.payoutQueue.map(row=><div key={row.withdrawal_id} className="rounded-xl border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.campaign_title}</p>
                <p className="text-sm text-muted-foreground">Gross {money(row.gross_cents)} · 7% fee {money(row.fee_cents)} · owner net {money(row.net_cents)}</p>
                <p className="text-xs text-muted-foreground">Status: {String(row.request_status||"").replace(/_/g," ")}{row.provider_transaction_status ? " · PayPal "+row.provider_transaction_status : ""}</p>
              </div>
              <button type="button"
                disabled={Boolean(payoutBusy)||row.destination_ready!==true}
                onClick={()=>executePayout(row.withdrawal_id)}
                className="min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-40">
                {payoutBusy===row.withdrawal_id ? "Checking PayPal…" :
                  row.request_status==="under_review" ? "Execute verified PayPal payout" : "Reconcile PayPal payout"}
              </button>
            </div>
            {row.destination_ready!==true&&<p className="mt-2 text-xs text-amber-700">Blocked: the owner does not have a verified payout destination.</p>}
          </div>)}</div>}
        {payoutMessage&&<p role="status" className="text-sm font-medium">{payoutMessage}</p>}
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
          <div><p className="text-xs text-muted-foreground">Gross platform support</p><p className="text-xl font-semibold tabular-nums">{money(sumVerifiedCents(platform, "gross_cents"))}</p></div>
          <div><p className="text-xs text-muted-foreground">Net platform support after PayPal fees</p><p className="text-xl font-semibold tabular-nums">{money(sumVerifiedCents(platform, "net_cents"))}</p></div>
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
