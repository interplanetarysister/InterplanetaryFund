import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listActiveCampaigns } from "@/api/publicData";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const moneyCents = value => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const raw = value * 100;
  const cents = Math.round(raw);
  return Number.isSafeInteger(cents) && Math.abs(raw - cents) < 0.000001 ? cents : null;
};

/**
 * Environmental campaign reporting derived only from public, verified-active
 * campaigns. Fundraising is not an environmental outcome measure.
 * Does not make claims about carbon avoided, trees planted or grant impacts.
 */
export default function AdminSustainability() {
  const [state, setState] = useState({ phase: "loading", campaigns: [], error: "" });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ phase: "loading", campaigns: [], error: "" });
    listActiveCampaigns({ limit: 500 })
      .then(rows => {
        if (!active) return;
        if (!Array.isArray(rows)) throw Error("Public campaign data could not be verified.");
        setState({ phase: "ready", campaigns: rows.filter(row =>
          row.status === "active" && row.category === "environment"), error: "" });
      })
      .catch(cause => {
        if (active) setState({ phase: "error", campaigns: [],
          error: cause?.message || "Environmental campaign data could not be verified." });
      });
    return () => { active = false; };
  }, [reload]);

  const stats = useMemo(() => {
    const total = state.campaigns.length;
    const publiclyMapped = state.campaigns.filter(c => c.map_opt_in === true).length;
    const values = state.campaigns.map(c => moneyCents(c.raised_amount));
    const fundingComplete = values.every(value => value !== null);
    const totalCents = fundingComplete ? values.reduce((sum,value)=>sum+value,0) : null;
    const verifiedRaisedCents = totalCents !== null && Number.isSafeInteger(totalCents) ? totalCents : null;
    return { total, publiclyMapped, verifiedRaisedCents };
  }, [state.campaigns]);

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Planet impact and sustainability</h1>
      <p className="text-sm text-muted-foreground">
        Read-only overview of published environmental campaigns. The verified campaign payment ledger reports
        donations, not measured environmental outcomes. No estimated carbon savings or volunteer impact is presented as fact.
      </p>
    </header>
    {state.phase === "loading" && <p role="status">Checking published environmental campaigns…</p>}
    {state.phase === "error" && <section className="space-y-3 rounded-xl border border-destructive/40 p-5" role="alert">
      <p>{state.error}</p>
      <button type="button" onClick={() => setReload(n => n + 1)} className="min-h-11 rounded-xl border px-4">Retry verified read</button>
    </section>}
    {state.phase === "ready" && <>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["Published environmental campaigns", stats.total.toLocaleString()],
          ["Campaigns opting into the public Atlas", stats.publiclyMapped.toLocaleString()],
          ["Provider-verified fundraising", stats.verifiedRaisedCents === null ? "Unavailable" : currency.format(stats.verifiedRaisedCents / 100)],
        ].map(([label,value]) => <div key={label} className="rounded-2xl border border-border bg-card p-5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
        </div>)}
      </dl>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Environmental campaign directory</h2>
        {!state.campaigns.length
          ? <p className="text-sm text-muted-foreground">There are no independently published environmental campaigns to report.</p>
          : <ul className="divide-y divide-border">{state.campaigns.map(c =>
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link className="font-semibold text-primary underline" to={"/campaign/"+encodeURIComponent(c.id)}>{c.title}</Link>
                <p className="text-xs text-muted-foreground">{c.map_opt_in === true ? c.location || "Public location shared" : "Campaign location private"}</p>
              </div>
              <span className="text-sm font-medium">{moneyCents(c.raised_amount) !== null ? currency.format(moneyCents(c.raised_amount) / 100) : "Funding unavailable"}</span>
            </li>)}</ul>}
      </section>
      <p className="text-xs text-muted-foreground">Showing up to 500 most recently published campaigns in the canonical public API. Financial figures exclude pending, refunded, unverified and sandbox transactions. Environmental outcomes require separately validated measurement data.</p>
    </>}
  </main>;
}
