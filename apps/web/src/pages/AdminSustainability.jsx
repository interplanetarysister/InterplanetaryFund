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
      <h1 className="text-3xl font-bold">Planetary Impact</h1>
      <p className="text-sm text-muted-foreground">
        Read-only overview of published environmental campaigns. Public campaign fundraising totals are not evidence of provider-verified payments or measured environmental outcomes. No estimated carbon savings or volunteer impact is presented as fact.
      </p>
    </header>
    <section aria-labelledby="infrastructure-heading" className="space-y-4 rounded-2xl border border-emerald-500/30 bg-card p-5 sm:p-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Our infrastructure choices</p>
        <h2 id="infrastructure-heading" className="text-2xl font-semibold">Building a better Internet with Cloudflare</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Interplanetary Fund uses Cloudflare Pages and Workers for web hosting and edge services. We selected infrastructure from a provider that publishes its environmental footprint and renewable-energy commitments. These are Cloudflare's company-wide disclosures, not independently measured carbon savings attributable to Interplanetary Fund.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4"><dt className="text-sm font-semibold">100% renewable-energy matching</dt><dd className="mt-2 text-xs leading-relaxed text-muted-foreground">Cloudflare reports matching electricity used by its operations with renewable-energy purchases. This does not imply carbon-free electricity every hour.</dd></div>
        <div className="rounded-xl border border-border p-4"><dt className="text-sm font-semibold">31,000 metric tons CO₂e</dt><dd className="mt-2 text-xs leading-relaxed text-muted-foreground">Cloudflare's 2025 Impact Report records investments in verified projects totaling approximately 31,000 metric tons CO₂e for historical network emissions before its first renewable-energy purchase in 2018.</dd></div>
        <div className="rounded-xl border border-border p-4"><dt className="text-sm font-semibold">Public emissions reporting</dt><dd className="mt-2 text-xs leading-relaxed text-muted-foreground">Cloudflare publishes company-wide emissions inventories and has committed to science-aligned reduction targets.</dd></div>
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">Transparency note: Renewable-energy certificates and offsets are accounting instruments; they do not eliminate all physical emissions. iFund's own complete operational footprint, including third-party services and end-user devices, has not been independently quantified. No verified iFund-specific carbon savings are claimed.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a className="min-h-11 inline-flex items-center text-primary underline underline-offset-4" href="https://www.cloudflare.com/impact/" target="_blank" rel="noopener noreferrer">Cloudflare environmental commitments</a>
        <a className="min-h-11 inline-flex items-center text-primary underline underline-offset-4" href="https://www.cloudflare.com/press/press-releases/2025/cloudflare-publishes-fifth-annual-impact-report/" target="_blank" rel="noopener noreferrer">2025 Impact Report announcement</a>
      </div>
    </section>
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
          ["Publicly reported fundraising", stats.verifiedRaisedCents === null ? "Unavailable" : currency.format(stats.verifiedRaisedCents / 100)],
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
      <p className="text-xs text-muted-foreground">Showing up to 500 most recently published campaigns in the canonical public API. The public campaign API does not independently establish provider verification, refunds, payment environment or attribution. Treat displayed fundraising as reported campaign data, not confirmed gifts. Environmental outcomes require separately validated measurements.</p>
    </>}
  </main>;
}
