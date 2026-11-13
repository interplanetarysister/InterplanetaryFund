import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import CampaignGrowthTrends from "@/components/agents/CampaignGrowthTrends";

export default function CampaignEngagement() {
  const [state,setState] = useState({ phase: "loading", rows: [], error: "" });
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ phase: "loading", rows: [], error: "" });
    authClient().rpc("ifund_owner_campaign_engagement")
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !Array.isArray(data)) throw new Error("Owner-scoped campaign engagement could not be verified.");
        setState({ phase: "ready", rows: data, error: "" });
      })
      .catch(e => { if (active) setState({ phase: "error", rows: [], error: e.message || "Campaign engagement is unavailable." }); });
    return () => { active = false; };
  }, [refresh]);
  function count(n) {
    if (typeof n === "boolean" || n === null || n === undefined || n === "") return "Unavailable";
    const value = Number(n);
    return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : "Unavailable";
  }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Supporter engagement</h1>
      <p className="text-sm text-muted-foreground">
        Private campaign-owner reporting. Counts are derived from saved follows and verified captured payment records.
        No supporter identities or marketing contact permissions are disclosed by this report.
      </p>
    </header>
    <CampaignGrowthTrends />
    {state.phase === "loading" && <p role="status">Verifying owned campaigns and supporter activity…</p>}
    {state.phase === "error" && <section role="alert" className="rounded-xl border border-red-500/40 p-5">
      <p>{state.error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}
      className="mt-3 min-h-11 rounded-lg border px-4">Retry</button>
    </section>}
    {state.phase === "ready" && (state.rows.length === 0
      ? <p className="rounded-xl border border-border p-5">No owned campaigns are available for engagement reporting.</p>
      : <div className="grid gap-4 sm:grid-cols-2">{state.rows.map(row =>
        <article key={row.campaign_id} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold"><Link className="underline" to={"/campaign/" + row.campaign_id}>{row.campaign_title || "Campaign"}</Link></h2>
          <p className="text-sm capitalize text-muted-foreground">{row.campaign_status || "Unknown status"}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-xs text-muted-foreground">Active followers</dt><dd className="text-2xl font-semibold">{count(row.active_followers)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Verified captures</dt><dd className="text-2xl font-semibold">{count(row.verified_captures)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Recurring captures</dt><dd className="text-2xl font-semibold">{count(row.verified_recurring_captures)}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">
            A follow is not consent to marketing outreach. Captures are counted only when recorded as provider-verified.
          </p>
        </article>)}</div>)}
  </main>;
}
