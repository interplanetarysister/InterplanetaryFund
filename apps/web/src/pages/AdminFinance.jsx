import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
const money = n => {
  const x = Number(n);
  return Number.isSafeInteger(x) && x >= 0
    ? new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(x/100) : "Unavailable";
};
export default function AdminFinance() {
  const [state,setState] = useState({status:"loading",rows:[],unattributed:[],error:""});
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const client=authClient();
        const before=await client.auth.getUser();
        if(before.error||!before.data?.user?.id)throw Error("Sign in required.");
        // Server-side RPC checks verified administrator authority independently.
        const [report, merchant] = await Promise.all([
          client.rpc("ifund_admin_finance_summary"),
          client.rpc("ifund_admin_unattributed_paypal_receipts"),
        ]);
        if(report.error||!Array.isArray(report.data)||merchant.error||!Array.isArray(merchant.data))
          throw Error("Administrator financial reporting is unavailable or you do not have verified access.");
        const after=await client.auth.getUser();
        if(after.error||after.data?.user?.id!==before.data.user.id)throw Error("Your session changed. Reload to continue.");
        if(active)setState({status:"ready",rows:report.data,unattributed:merchant.data,error:""});
      }catch(e){if(active)setState({status:"error",rows:[],unattributed:[],error:e.message||"Unavailable"});}
    })();
    return ()=>{active=false};
  },[]);
  const total=state.rows.reduce((s,row)=>s+(Number(row.raised_cents)||0),0);
  const count=state.rows.reduce((s,row)=>s+(Number(row.captured_payments)||0),0);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header><h1 className="text-3xl font-bold">Platform finance oversight</h1>
      <p className="mt-2 text-sm text-muted-foreground">Read-only verified donation totals. No payout controls, donor private details, sandbox payments or unconfirmed captures.</p></header>
    {state.status==="loading"&&<p role="status">Verifying administrator authorization and accounting records…</p>}
    {state.status==="error"&&<section role="alert" className="rounded-xl border border-red-500/50 p-5">{state.error}</section>}
    {state.status==="ready"&&<>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Captured campaign gifts</p><p className="mt-2 text-2xl font-semibold">{money(total)}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Verified payment records</p><p className="mt-2 text-2xl font-semibold">{count}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Campaigns in reporting</p><p className="mt-2 text-2xl font-semibold">{state.rows.length}</p></div>
      </div>
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3" aria-label="Unattributed PayPal receipts">
        <h2 className="text-lg font-semibold">Unattributed PayPal merchant receipts</h2>
        <p className="text-sm text-muted-foreground">These payments were confirmed by PayPal but are not verified campaign donations. They are excluded from campaign totals and withdrawals until the original site and intended allocation are proven.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Unattributed receipts</p><p className="text-xl font-semibold tabular-nums">{state.unattributed.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Gross merchant receipts</p><p className="text-xl font-semibold tabular-nums">{money(state.unattributed.reduce((sum,r)=>sum+Number(r.gross_cents||0),0))}</p></div>
          <div><p className="text-xs text-muted-foreground">Net after processor fees</p><p className="text-xl font-semibold tabular-nums">{money(state.unattributed.reduce((sum,r)=>sum+Number(r.net_cents||0),0))}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border">
            <th className="py-3 pr-4">PayPal transaction</th><th className="py-3 pr-4">Received</th><th className="py-3 pr-4">Gross</th><th className="py-3 pr-4">Processor fee</th><th className="py-3 pr-4">Net</th><th className="py-3">Origin</th>
          </tr></thead><tbody>{state.unattributed.map(r=><tr key={r.paypal_transaction_id} className="border-b border-border">
            <td className="py-3 pr-4 font-mono text-xs">{r.paypal_transaction_id}</td>
            <td className="py-3 pr-4">{new Date(r.occurred_at).toLocaleString()}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.gross_cents)}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.processing_fee_cents)}</td>
            <td className="py-3 pr-4 tabular-nums">{money(r.net_cents)}</td>
            <td className="py-3">{r.source_site === "unattributed" ? "Unverified" : r.source_site}</td>
          </tr>)}</tbody></table>
          {state.unattributed.length===0&&<p className="py-4 text-sm text-muted-foreground">No unmatched provider-confirmed merchant receipts found.</p>}
        </div>
      </section>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="min-w-full text-left text-sm"><thead className="border-b border-border"><tr>
          <th className="p-4">Campaign</th><th className="p-4">Verified gifts</th><th className="p-4">Captures</th><th className="p-4">Refund records</th>
        </tr></thead><tbody>{state.rows.map(row=><tr key={row.campaign_id} className="border-b border-border">
          <td className="p-4">{row.campaign_title}</td><td className="p-4 tabular-nums">{money(row.raised_cents)}</td>
          <td className="p-4 tabular-nums">{row.captured_payments}</td><td className="p-4 tabular-nums">{row.refund_count}</td>
        </tr>)}</tbody></table>
        {state.rows.length===0&&<p className="p-5 text-sm text-muted-foreground">No verified campaign finance records are available. No sample totals were inserted.</p>}
      </div>
    </>}
  </main>;
}
