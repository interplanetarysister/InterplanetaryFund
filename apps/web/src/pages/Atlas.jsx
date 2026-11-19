import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Globe2, MapPin, Search, ShieldCheck } from "lucide-react";
import { listPublicAtlasCampaigns } from "@/api/publicData";
import { listOwnerAtlasCampaigns } from "@/api/ownerCampaigns";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import CampaignGlobe from "@/components/atlas/CampaignGlobe";
import USCampaignMap from "@/components/atlas/USCampaignMap";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
const FinanceDataGrid = lazy(() => import("@/components/finance/FinanceDataGrid"));
import { mapAtlasCampaign, atlasLocationRows, atlasLocationSummary, isApprovedAtlasLocation } from "@/lib/atlasLocations.mjs";
import "./Atlas.css";

export default function Atlas() {
  const { user, status: sessionStatus } = useAuthSession();
  const [selectedScope, setSelectedScope] = useState(null);
  // Authenticated members land on their campaigns; visitors see the public Atlas.
  const scope = selectedScope || (sessionStatus === "signed-in" && user?.is_anonymous !== true ? "mine" : "public");
  const [publicCampaigns, setPublicCampaigns] = useState([]);
  const [ownerCampaigns, setOwnerCampaigns] = useState({ ownerId: null, rows: [] });
  const [query, setQuery] = useState("");
  const [mapView, setMapView] = useState("usa");
  const mapScopeKey = scope+":"+(scope==="mine" ? user?.id || "signed-out" : "public");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    if (sessionStatus === "loading") { setStatus("loading"); return () => { alive = false; }; }
    setStatus("loading");
    setError("");
    (async () => {
      try {
        if (scope === "mine") {
          if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) {
            if (alive) { setOwnerCampaigns({ownerId:null,rows:[]}); setStatus("signed-out"); }
            return;
          }
          const client = authClient();
          // The session can switch in another tab while a private campaign
          // request is pending. Verify the same email-confirmed owner both
          // before and after the query, not merely when React rendered.
          const before = await client.auth.getUser();
          if (before.error || before.data?.user?.id !== user.id ||
              before.data.user.is_anonymous === true || !before.data.user.email_confirmed_at)
            throw new Error("Owner verification failed");
          const rows = await listOwnerAtlasCampaigns(client);
          const after = await client.auth.getUser();
          if (after.error || after.data?.user?.id !== user.id ||
              after.data.user.is_anonymous === true || !after.data.user.email_confirmed_at)
            throw new Error("Owner changed during location read");
          if (alive) { setOwnerCampaigns({ownerId:user.id,rows:rows.map(mapAtlasCampaign)}); setStatus("ready"); }
        } else {
          // This is a public geography-only query: no payment RPC is needed.
          const rows = await listPublicAtlasCampaigns({ limit: 500 });
          if (alive) { setPublicCampaigns(rows); setStatus("ready"); }
        }
      } catch {
        if (alive) {
          setStatus("error");
          setError(scope === "mine"
            ? "Your account campaigns could not be verified. No private campaign data is shown."
            : "Public campaign data could not be verified. No unverified campaign markers are shown.");
        }
      }
    })();
    return () => { alive = false; };
  }, [scope, sessionStatus, user?.id, user?.is_anonymous, user?.email_confirmed_at, reload]);

  // Account scope is only ever populated by the server-verified owner read.
  // Unpublished campaigns can appear in the PRIVATE grid, not public globe pins.
  const campaigns = scope === "mine" ? (user?.id && ownerCampaigns.ownerId === user.id ? ownerCampaigns.rows : []) : publicCampaigns;
  const published = useMemo(() => campaigns.filter(c => c.status === "active"), [campaigns]);
  const mapped = useMemo(() => published.filter(isApprovedAtlasLocation), [published]);
  const matchingCampaigns = useMemo(() => campaigns.filter(c =>
    !query.trim() || [c.title, c.category, c.location].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [campaigns, query]);
  const markers = useMemo(() => matchingCampaigns.filter(c =>
    c.status === "active" && isApprovedAtlasLocation(c)
  ), [matchingCampaigns]);

  const locationRows = useMemo(() => atlasLocationRows(markers), [markers]);
  const coverage = useMemo(() => atlasLocationSummary(campaigns), [campaigns]);
  const coverageData = useMemo(() => [
    {name:"Published with approved location",value:coverage.mapped,label:coverage.mapped+" campaigns"},
    {name:"Published without location",value:coverage.unmapped,label:coverage.unmapped+" campaigns"},
  ], [coverage.mapped, coverage.unmapped]);
  const columns = useMemo(() => [
    { field:"title", headerName:"Campaign", minWidth:240,
      cellRenderer:({data,value})=>data?.id
        ? <Link className="font-semibold text-cyan-200 underline underline-offset-2" to={data.status==="Published"
          ? "/campaign/"+encodeURIComponent(data.id)
          : "/campaigns/"+encodeURIComponent(data.id)+"/edit"}>{value}</Link>
        : (value || ""),
    },
    { field:"location", headerName:"Approved city / region", minWidth:200 },
    { field:"category", headerName:"Cause", minWidth:140 },
    { field:"status", headerName:"Status", minWidth:130 },
    { field:"visibility", headerName:"Atlas visibility", minWidth:170 },
  ], []);

  const gridRows = useMemo(() => matchingCampaigns.map(c => ({
    id:c.id,
    title:c.title,
    location:isApprovedAtlasLocation(c) ? c.location : "Not shared",
    category:String(c.category || "other").replace(/_/g, " "),
    status:c.status === "active" ? "Published" : c.status === "draft" ? "Draft" : c.status === "paused" ? "Paused" : "Unavailable",
    visibility:c.status !== "active" ? "Not public" : isApprovedAtlasLocation(c) ? "Approved location" : "Not on map",
  })), [matchingCampaigns]);

  return <main className="ifund-atlas-shell mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><Globe2 className="h-5 w-5" aria-hidden="true"/> IFund living Earth Atlas</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Your campaigns across America and beyond</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">Explore campaign locations rather than financial totals. Plot published campaigns only where their organizers approved an approximate public city or region.</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold"><ArrowLeft className="h-4 w-4"/> Discover campaigns</Link>
        <Link to="/campaigns" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/40 px-4 font-semibold"><MapPin className="h-4 w-4"/> Manage campaign locations</Link>
      </div>
    </header>
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-950/5 p-4 text-sm text-muted-foreground">
      <p className="flex items-start gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500"/> Public pins use only organizer-approved approximate locations. Private drafts and paused campaigns remain invisible on the public globe. No precise home addresses, inferred locations or invented cities.</p>
    </section>
    <div role="group" aria-label="Campaign Atlas scope" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={scope==="public"} onClick={()=>{setSelectedScope("public");setQuery("");}} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${scope==="public"?"border-emerald-400 bg-emerald-500/10":"border-border"}`}>All public campaigns</button>
      <button type="button" aria-pressed={scope==="mine"} onClick={()=>{setSelectedScope("mine");setQuery("");}} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${scope==="mine"?"border-emerald-400 bg-emerald-500/10":"border-border"}`}>My campaigns</button>
    </div>
    {status==="loading" && <p role="status">Loading verified campaign locations…</p>}
    {status==="signed-out" && <p role="status" className="rounded-xl border p-5">Sign in with your verified campaign-owner account to view your own campaigns. <Link to="/login" className="underline font-semibold">Sign in</Link></p>}
    {status==="error" && <div role="alert" className="rounded-xl border border-red-500/40 p-5">{error}<button type="button" onClick={()=>setReload(v=>v+1)} className="ml-3 underline">Try again</button></div>}
    {status==="ready" && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground"><strong className="text-foreground">{mapped.length}</strong> published, location-approved campaigns · {campaigns.length} {scope==="mine"?"campaigns in your account":"public campaigns"}</p>
        <label className="relative block w-full max-w-sm text-sm">
          <span className="sr-only">Filter campaigns by title, cause or location</span>
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, causes or cities…" className="min-h-11 w-full rounded-xl border border-input bg-background py-2 pl-10 pr-3"/>
        </label>
      </div>
      <div role="group" aria-label="Select Atlas map view" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={mapView==="usa"} onClick={()=>setMapView("usa")}
          className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${mapView==="usa"?"border-emerald-400 bg-emerald-500/10":"border-border"}`}>United States map</button>
        <button type="button" aria-pressed={mapView==="earth"} onClick={()=>setMapView("earth")}
          className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${mapView==="earth"?"border-emerald-400 bg-emerald-500/10":"border-border"}`}>Earth globe</button>
      </div>
      {mapView==="usa" ? <USCampaignMap key={mapScopeKey} campaigns={markers}/> : <CampaignGlobe key={mapScopeKey} campaigns={markers}/>}
      <section className="grid gap-5 lg:grid-cols-2" aria-label="Campaign location charts">
        <div className="ifund-chart-card">
          <p className="ifund-chart-eyebrow">AG Charts Community · Approved locations</p>
          <h2>Where campaigns are located</h2>
          <DonutChart data={locationRows} title="Published campaign count by approved location" valueText={markers.length+" opted-in campaign locations"}/>
          <p className="mt-3 text-sm text-muted-foreground">Categories are the actual organizer-provided city or region labels. No financial or population estimates.</p>
        </div>
        <div className="ifund-chart-card">
          <p className="ifund-chart-eyebrow">Map availability · Public location consent</p>
          <h2>Location coverage</h2>
          <DonutChart data={coverageData} title="Public campaign location coverage" valueText={coverage.mapped+" mapped of "+coverage.published+" published campaigns"}/>
          {scope==="mine" && <p className="mt-3 text-sm text-muted-foreground">{coverage.nonPublic} drafts or paused campaigns are not plotted publicly.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Location sharing is optional. Open a campaign in your editor to add or change an approved broad location.</p>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label="Campaign location explorer">
        <h2 className="text-xl font-semibold">AG Grid · Campaign locations</h2>
        <p className="text-sm text-muted-foreground">Sort and filter campaigns by place, cause, and status. {scope==="mine"?"Private drafts are visible only to the verified owner; they are never displayed as public markers.":"The public grid contains only published campaigns."}</p>
        {gridRows.length ? <Suspense fallback={<p role="status" className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Loading interactive location table…</p>}><FinanceDataGrid rows={gridRows} columns={columns} label="Campaign location explorer" search={query}/></Suspense>
        : <div role="status" className="space-y-3 rounded-xl border border-border p-5 text-sm">
            <p className="font-semibold">{query.trim() ? "No campaigns match your search." : "No campaign locations to display yet."}</p>
            <p className="text-muted-foreground">{query.trim() ? "Try a different city, cause or campaign title." : scope==="mine" ? "Your campaigns will appear here once you have saved one. Sharing an approximate public map location is optional." : "Campaigns will appear when organizers publish them and approve their public visibility."}</p>
            <div className="flex flex-wrap gap-3">{query.trim() && <button type="button" onClick={()=>setQuery("")} className="min-h-11 rounded-lg border border-border px-4 font-semibold">Clear search</button>}<Link to={scope==="mine"?"/create":"/discover"} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold">{scope==="mine"?"Create a campaign":"Explore campaigns"}</Link></div>
          </div>}
      </section>
      {scope==="mine" && campaigns.some(c=>c.status==="active"&&!isApprovedAtlasLocation(c)) && (
        <section className="space-y-3 rounded-xl border border-emerald-500/25 bg-card p-5" aria-label="Campaigns missing map locations">
          <h2 className="text-xl font-semibold">Place your campaigns on the Atlas</h2>
          <p className="text-sm text-muted-foreground">These published campaigns have no approved public map location. Open each campaign to choose a broad city or region, then explicitly opt in. No location is assigned automatically.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {campaigns.filter(c=>c.status==="active"&&!isApprovedAtlasLocation(c)).map(c=>(
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span className="min-w-0 font-medium">{c.title}</span>
                <Link to={"/campaigns/"+encodeURIComponent(c.id)+"/edit#campaign-atlas-location"} className="inline-flex min-h-11 items-center rounded-lg border border-emerald-500/35 px-3 text-sm font-semibold">Set map location</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {markers.length===0 && <div className="rounded-xl border border-emerald-500/30 p-5">
        <h2 className="font-semibold">No published locations in this view</h2>
        <p className="mt-2 text-sm text-muted-foreground">Campaigns without approved approximate coordinates are not placed on the globe. We cannot determine a campaign location from the account profile or title.</p>
        <Link to="/campaigns" className="mt-3 inline-flex items-center gap-2 font-semibold underline">Manage my campaigns <Compass className="h-4 w-4"/></Link>
      </div>}
      {markers.length>0 && <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Campaign locations</h2>
        <ul className="grid gap-2 sm:grid-cols-2">{markers.map(c=><li key={c.id} className="rounded-lg border border-border p-3">
          <Link to={"/campaign/"+encodeURIComponent(c.id)} className="font-semibold underline">{c.title}</Link>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5"/> {c.location} · approximate</p>
        </li>)}</ul>
      </section>}
    </>}
  </main>;
}
