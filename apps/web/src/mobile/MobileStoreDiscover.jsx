import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, RefreshCw, MapPinned } from "lucide-react";
import { listActiveCampaigns } from "@/api/publicData";
import { useAuthSession } from "@/hooks/useAuthSession";
import { readBlockedOrganizers, verifiedOrganizersForCampaigns } from "@/mobile/organizerBlock";

const money = value => Number.isFinite(value) && value >= 0 ?
  new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value) : null;
const safeMedia = url => typeof url === "string" && /^https:\/\/[^\s]+$/i.test(url) ? url : null;

export default function MobileStoreDiscover() {
  const [campaigns,setCampaigns]=useState([]);
  const {user}=useAuthSession();
  const [organizerIds,setOrganizerIds]=useState(new Map());
  const [phase,setPhase]=useState("loading");
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [reload,setReload]=useState(0);
  const [hidden,setHidden]=useState(() => {
    try { return JSON.parse(localStorage.getItem("ifund-mobile-hidden-campaigns")||"[]"); }
    catch { return []; }
  });
  useEffect(()=>{
    let live=true;
    setPhase("loading");setError("");
    listActiveCampaigns({limit:100}).then(rows=>{
      if(!live)return;
      setCampaigns(Array.isArray(rows)?rows:[]);
      setPhase("ready");
    }).catch(cause=>{
      if(!live)return;
      setError(cause?.message||"Unable to reach published campaigns.");
      setPhase("error");
    });
    return ()=>{live=false;};
  },[reload]);
  useEffect(()=>{
    let active=true;
    if(!user?.id || user.is_anonymous || campaigns.length===0){
      setOrganizerIds(new Map());return()=>{active=false;};
    }
    verifiedOrganizersForCampaigns(campaigns.map(c=>c.id)).then(ids=>{
      if(active)setOrganizerIds(ids);
    }).catch(()=>{if(active)setOrganizerIds(new Map());});
    return()=>{active=false;};
  },[user?.id,user?.is_anonymous,campaigns]);
  const blocked=new Set(user?.id?readBlockedOrganizers(user.id):[]);
  const visible=useMemo(()=>campaigns.filter(c=>!hidden.includes(c.id) &&
    !blocked.has(organizerIds.get(c.id)) &&
    [c.title,c.summary,c.category,c.location].join(" ").toLowerCase().includes(search.trim().toLowerCase())),[campaigns,hidden,search,organizerIds,user?.id]);
  function resetHidden(){setHidden([]);try{localStorage.removeItem("ifund-mobile-hidden-campaigns");}catch{}}
  return <div className="space-y-6">
    <header className="space-y-3">
      <h1 className="text-3xl font-bold">Explore live campaigns</h1>
      <p className="text-sm leading-6 text-slate-300">Published campaigns are loaded from the same IFund service as interplanetaryfund.com. Financial totals display only when provider verification is available.</p>
      <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 text-emerald-300"/>
        <label className="sr-only" htmlFor="native-campaign-search">Search live campaigns</label>
        <input id="native-campaign-search" type="search" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search causes, categories, or locations" className="min-h-12 w-full rounded-xl border border-emerald-300/30 bg-white/10 pl-10 pr-3 text-sm text-white placeholder:text-slate-300"/>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={()=>setReload(n=>n+1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-3 text-sm"><RefreshCw aria-hidden="true" className="h-4 w-4"/> Refresh</button>
        <Link to="/atlas" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-3 text-sm"><MapPinned aria-hidden="true" className="h-4 w-4"/> Locations</Link>
        {hidden.length>0 && <button type="button" onClick={resetHidden} className="min-h-11 rounded-lg border border-white/30 px-3 text-sm">Restore hidden campaigns</button>}
      </div>
    </header>
    {phase==="loading"&&<p role="status">Loading verified published campaigns…</p>}
    {phase==="error"&&<section className="space-y-3 rounded-xl border border-amber-300/40 bg-amber-500/10 p-5" role="alert">
      <h2 className="font-bold">Campaigns are temporarily unavailable</h2><p className="text-sm">{error}</p>
      <button type="button" className="min-h-11 rounded-lg border px-4" onClick={()=>setReload(n=>n+1)}>Try again</button>
    </section>}
    {phase==="ready"&&<section aria-label="Published campaigns" className="space-y-4">
      <p className="text-sm text-slate-300" aria-live="polite">{visible.length} campaigns matching your filters</p>
      {!visible.length&&<p className="rounded-xl border border-white/15 p-5 text-sm text-slate-300">
        No published campaigns match this search. Try different words or clear hidden campaigns.
      </p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map(c=><article key={c.id} className="overflow-hidden rounded-2xl border border-emerald-300/20 bg-white/5">
          {safeMedia(c.cover_image_url)&&<img src={safeMedia(c.cover_image_url)} alt="" loading="lazy" className="h-40 w-full object-cover" referrerPolicy="no-referrer"/>}
          <div className="space-y-3 p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-300">{c.category||"Fundraising"}</p>
            <h2 className="line-clamp-2 text-lg font-bold">{c.title}</h2>
            <p className="line-clamp-3 text-sm leading-6 text-slate-300">{c.summary||"Read this campaign's details."}</p>
            {c.raised_amount!==null&&<p className="text-sm text-emerald-200">Verified donations: {money(c.raised_amount)??"Unavailable"}</p>}
            <Link to={"/campaign/"+encodeURIComponent(c.id)} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 py-2 text-sm font-bold text-[#09221b]">Read campaign</Link>
          </div>
        </article>)}
      </div>
    </section>}
    <p className="text-xs leading-5 text-slate-400">Information is supplied by campaign organizers. IFund does not guarantee claims, fundraising results, or tax deductibility. Payments are not offered in this mobile app.</p>
  </div>;
}
