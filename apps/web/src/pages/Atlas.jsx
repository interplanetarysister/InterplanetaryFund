import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Globe2, MapPin, Search, ShieldCheck } from "lucide-react";
import { listActiveCampaigns } from "@/api/publicData";
import CampaignGlobe from "@/components/atlas/CampaignGlobe";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
import FinanceDataGrid from "@/components/finance/FinanceDataGrid";
import "./Atlas.css";

export default function Atlas() {
  const [campaigns, setCampaigns] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setError("");
    listActiveCampaigns({ limit: 500 })
      .then(rows => {
        if (!alive) return;
        setCampaigns(rows);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;
        setError("Public campaign data could not be verified. No unverified campaign markers are shown.");
        setStatus("error");
      });
    return () => { alive = false; };
  }, [reload]);

  const mapped = useMemo(() => campaigns.filter(c =>
    c.map_opt_in === true &&
    typeof c.location === "string" && c.location.trim().length > 1 &&
    c.latitude !== null && c.longitude !== null &&
    Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) &&
    Math.abs(Number(c.latitude)) <= 90 && Math.abs(Number(c.longitude)) <= 180
  ), [campaigns]);

  const matches = useMemo(() => mapped.filter(c =>
    !query || [c.title,c.category,c.location].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [mapped,query]);

  const analytics = useMemo(() => {
    const byCause = new Map();
    let verifiedRaised = 0;
    let verifiedDonors = 0;
    for (const campaign of campaigns) {
      const cause = String(campaign.category || "other").replace(/_/g, " ");
      byCause.set(cause, (byCause.get(cause) || 0) + 1);
      const raised = Number(campaign.raised_amount);
      const donors = Number(campaign.donor_count);
      if (Number.isFinite(raised) && raised >= 0) verifiedRaised += raised;
      if (Number.isSafeInteger(donors) && donors >= 0) verifiedDonors += donors;
    }
    const causeRows = [...byCause].map(([name, value]) => ({ name, value, label: value + " active campaigns" }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    return {
      causeRows,
      verifiedRaised,
      verifiedDonors,
      money,
      rows: campaigns.map(c => ({
        id: c.id,
        title: c.title,
        category: String(c.category || "other").replace(/_/g, " "),
        location: c.map_opt_in ? c.location : "Location not shared",
        raised: Number(c.raised_amount),
        goal: Number(c.goal_amount),
        donorCount: Number(c.donor_count),
      })),
    };
  }, [campaigns]);

  const atlasColumns = useMemo(() => [
    { field: "title", headerName: "Live campaign", minWidth: 235 },
    { field: "category", headerName: "Cause", minWidth: 150 },
    { field: "location", headerName: "Organizer-approved location", minWidth: 185 },
    { field: "raised", headerName: "Verified raised", minWidth: 150,
      valueFormatter: ({value}) => Number.isFinite(value) && value >= 0 ? analytics.money.format(value) : "Not verified" },
    { field: "goal", headerName: "Published goal", minWidth: 155,
      valueFormatter: ({value}) => Number.isFinite(value) && value >= 0 ? analytics.money.format(value) : "Not reported" },
    { field: "donorCount", headerName: "Verified supporters", minWidth: 160,
      valueFormatter: ({value}) => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : "Not verified" },
  ], [analytics.money]);

  return (
    <main className="ifund-atlas-shell mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
          <Globe2 className="h-5 w-5" aria-hidden="true"/> IFund interactive Earth Atlas
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Find a possibility around the world</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">The same free, interactive globe renderer used in our hackathon demo, connected here to real active IFund campaigns. Map markers are shown only when organizers consent to sharing an approximate public city or region.</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold"><ArrowLeft className="h-4 w-4"/> Discover campaigns</Link>
          <Link to="/create" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500/40 px-4 font-semibold"><MapPin className="h-4 w-4"/> Create and place a campaign</Link>
        </div>
      </header>
      <section className="rounded-xl border border-cyan-500/25 bg-cyan-950/5 p-4 text-sm text-muted-foreground">
        <p className="flex items-start gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-cyan-500" /> Campaigns without organizer-approved broad coordinates are not plotted; we do not fabricate or infer private locations. Exact home coordinates are never accepted for Atlas storage.</p>
      </section>
      {status === "loading" && <p role="status">Loading provider-verified live campaigns and public locations…</p>}
      {status === "error" && <div role="alert" className="rounded-xl border border-red-500/40 p-5">{error}<button type="button" onClick={() => setReload(x=>x+1)} className="ml-3 underline">Try again</button></div>}
      {status === "ready" && <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">{mapped.length}</strong> campaigns have approved Atlas markers
            <span aria-hidden="true"> · </span> {campaigns.length} active campaigns in discovery
          </div>
          <label className="relative block w-full max-w-sm text-sm">
            <span className="sr-only">Filter Atlas campaigns by title, category or place</span>
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, causes or cities…"
              className="min-h-11 w-full rounded-xl border border-input bg-background py-2 pl-10 pr-3" />
          </label>
        </div>
        <CampaignGlobe campaigns={matches} />
        <section className="grid gap-5 lg:grid-cols-2" aria-label="Live Atlas campaign analytics">
          <div className="ifund-chart-card">
            <p className="ifund-chart-eyebrow">AG Charts Community · Live published campaigns</p>
            <h2>Campaigns by cause</h2>
            <DonutChart
              data={analytics.causeRows}
              title="Live active campaign categories, not personal demographics"
              valueText={campaigns.length + " active campaigns by cause"}
            />
            <p className="mt-3 text-sm text-muted-foreground">These are actual campaign categories in the live IFund database. They are not estimates of supporters' ages, identities, or locations.</p>
          </div>
          <div className="ifund-chart-card">
            <p className="ifund-chart-eyebrow">Live verified activity · No sandbox figures</p>
            <h2>Atlas funding and location coverage</h2>
            <DonutChart
              data={[
                { name:"Approved public map markers", value:mapped.length, label:mapped.length + " opted-in campaigns" },
                { name:"Locations not shared", value:campaigns.length - mapped.length, label:(campaigns.length - mapped.length) + " private/unmapped campaigns" },
              ]}
              title="Organizer-approved public location coverage"
              valueText={mapped.length + " mapped of " + campaigns.length + " published campaigns"}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="block text-muted-foreground">Verified campaign funds</span><strong className="tabular-nums">{analytics.money.format(analytics.verifiedRaised)}</strong></div>
              <div><span className="block text-muted-foreground">Confirmed donor counts</span><strong className="tabular-nums">{analytics.verifiedDonors.toLocaleString()}</strong></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Verified public funding totals only. Donor counts are summed per campaign (not a deduplicated count of people). No sandbox payments or implied personal demographics.</p>
          </div>
        </section>
        <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label="Live campaign data explorer">
          <h2 className="text-xl font-semibold">AG Grid · Explore live campaigns</h2>
          <p className="text-sm text-muted-foreground">Sort, filter and page through the same verified live campaign records that feed the Atlas. Missing public locations remain private.</p>
          <FinanceDataGrid rows={analytics.rows} columns={atlasColumns} label="AG Grid live campaign Atlas explorer" search={query} />
        </section>

        {!mapped.length && <div className="rounded-xl border border-cyan-500/30 p-5">
          <h2 className="font-semibold">Atlas is ready for organizer-approved locations</h2>
          <p className="mt-2 text-sm text-muted-foreground">Existing campaigns predate the public map field, so none were geolocated without their owners' permission. To appear, an organizer can edit their campaign and opt in to a broad city/region location.</p>
          <Link to="/campaigns" className="mt-3 inline-flex items-center gap-2 font-semibold underline">Manage my campaigns <Compass className="h-4 w-4"/></Link>
        </div>}
        {mapped.length > 0 && <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold">Campaigns on the Atlas</h2>
          <p className="text-sm text-muted-foreground">This list is keyboard-accessible and includes campaigns on the globe's opposite side.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {matches.map(c => <li key={c.id} className="rounded-lg border border-border p-3">
              <Link to={"/campaign/"+encodeURIComponent(c.id)} className="font-semibold underline">{c.title}</Link>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5"/> {c.location} · approximate</p>
            </li>)}
          </ul>
          {!matches.length && <p role="status">No mapped campaigns match those filters.</p>}
        </section>}
      </>}
    </main>
  );
}
