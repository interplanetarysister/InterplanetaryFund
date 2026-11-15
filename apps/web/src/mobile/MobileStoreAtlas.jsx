import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPinned, RefreshCw } from "lucide-react";
import { listPublicAtlasCampaigns } from "@/api/publicData";

// The mobile first release uses only campaign-approved location labels.
// It never requests the user's GPS position or publishes hidden coordinates.
export default function MobileStoreAtlas() {
  const [rows,setRows]=useState([]),[phase,setPhase]=useState("loading"),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let live=true;
    setPhase("loading");setError("");
    listPublicAtlasCampaigns({limit:500}).then(data=>{
      if(!live)return;
      setRows(data.filter(x=>x.map_opt_in===true && x.location));
      setPhase("ready");
    }).catch(e=>{if(live){setError(e.message||"Locations are unavailable.");setPhase("error");}});
    return ()=>{live=false;};
  },[refresh]);
  const locations=useMemo(()=>rows.filter(x=>x.location.toLowerCase().includes(query.toLowerCase()) ||
    x.title.toLowerCase().includes(query.toLowerCase())),[rows,query]);
  return <div className="space-y-6">
    <header className="space-y-3"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-emerald-300"><MapPinned aria-hidden="true" className="h-5 w-5"/> Public Atlas</p>
      <h1 className="text-3xl font-bold">Explore by location</h1>
      <p className="text-sm leading-6 text-slate-300">Find published campaigns that have opted into displaying a general public location. Exact personal or private addresses are not shown.</p>
      <label htmlFor="mobile-place-search" className="block text-sm font-semibold">Search places or causes</label>
      <input id="mobile-place-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="City, state or campaign" className="min-h-12 w-full rounded-xl border border-emerald-300/30 bg-white/10 px-4 text-sm text-white placeholder:text-slate-400"/>
    </header>
    {phase==="loading"&&<p role="status">Loading opted-in locations…</p>}
    {phase==="error"&&<div className="space-y-3 rounded-xl border border-amber-300/30 p-5" role="alert"><p>{error}</p><button type="button" onClick={()=>setRefresh(x=>x+1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4"><RefreshCw aria-hidden="true" className="h-4 w-4"/> Retry</button></div>}
    {phase==="ready"&&<section aria-label="Public campaign locations" className="space-y-4">
      <p role="status" className="text-sm text-slate-300">{locations.length} campaigns with opt-in location labels</p>
      {!locations.length&&<p className="rounded-xl border border-white/15 p-5 text-sm text-slate-300">No campaigns have published a matching general location. Location sharing is optional.</p>}
      {locations.map(x=><article key={x.id} className="rounded-xl border border-white/20 bg-white/5 p-5">
        <h2 className="text-lg font-bold">{x.title}</h2><p className="mt-1 text-sm text-emerald-300">{x.location}</p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-300">{x.summary}</p>
        <Link className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-emerald-300/40 px-4 text-sm text-emerald-200" to={"/campaign/"+encodeURIComponent(x.id)}>View campaign</Link>
      </article>)}
    </section>}
    <p className="text-xs leading-5 text-slate-400">Map opt-in is controlled by campaign owners. The app does not track your location or infer private campaign addresses.</p>
  </div>;
}
