import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const cents = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n / 100)
    : "Unavailable";
};
function SummaryCard({ label, value }) {
  return <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
  </div>;
}
export default function FinanceDashboard() {
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
  const totalRaised = state.owned.reduce((sum, x) => sum + (Number(x.raised_cents)||0), 0);
  const totalGiven = state.donated.reduce((sum, x) => sum + (Number(x.amount_cents)||0), 0);
  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-8">
    <header>
      <h1 className="text-3xl font-bold">Your finances</h1>
      <p className="mt-2 text-sm text-muted-foreground">Only PayPal-confirmed, captured donations are included. Sandbox and pending payments are excluded. Withdrawals are not enabled.</p>
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
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Campaign fundraising</h2>
        {state.owned.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">You have no owned campaigns with financial records to display.</p> :
          <div className="mt-3 space-y-3">{state.owned.map(c => <div key={c.campaign_id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3">
            <div><Link className="font-medium underline" to={"/campaign/"+c.campaign_id}>{c.campaign_title}</Link>
              <p className="text-xs text-muted-foreground">{c.campaign_status} · {c.captured_payments} verified payments</p></div>
            <strong className="tabular-nums">{cents(c.raised_cents)}</strong>
          </div>)}</div>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Your donation receipts</h2>
        {state.donated.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No verified captured donations recorded for your account.</p> :
          <div className="mt-3 space-y-3">{state.donated.map(r => <div key={r.donation_id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3">
            <div><Link to={"/campaign/"+r.campaign_id} className="underline">{r.campaign_title}</Link>
              <p className="text-xs text-muted-foreground">Captured · {new Date(r.captured_at).toLocaleDateString()}</p></div>
            <strong className="tabular-nums">{cents(r.amount_cents)}</strong>
          </div>)}</div>}
      </section>
    </>}
  </main>;
}
