import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, RefreshCw } from "lucide-react";
import { getCampaignDetail } from "@/api/publicData";
import { useAuthSession } from "@/hooks/useAuthSession";
import { savedCampaignIds, setCampaignSaved } from "@/mobile/savedCampaigns";
import { readBlockedOrganizers, verifiedOrganizersForCampaigns } from "@/mobile/organizerBlock";

// Bookmarks hold canonical IDs only. Never show stale fund totals or cached
// campaign text; fetch from the same provider-verified service on every visit.
export default function MobileStoreSaved() {
  const {user}=useAuthSession();
  const [ids,setIds]=useState(()=>savedCampaignIds());
  const [rows,setRows]=useState([]);
  const [phase,setPhase]=useState("loading"),[error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let live=true;
    setPhase("loading");setError("");
    Promise.allSettled(ids.map(id=>getCampaignDetail(id))).then(async results=>{
      let records=results.map((result,index)=>({
        id:ids[index],data:result.status==="fulfilled"?result.value:null,
        failed:result.status==="rejected",
      }));
      if(user?.id){
        const mapped=await verifiedOrganizersForCampaigns(records.filter(r=>r.data).map(r=>r.id)).catch(()=>new Map());
        const blocked=new Set(readBlockedOrganizers(user.id));
        records=records.filter(r=>!blocked.has(mapped.get(r.id)));
      }
      if(live){setRows(records);setPhase("ready");}
    }).catch(e=>{if(live){setError(e.message||"Saved campaigns could not be checked.");setPhase("error");}});
    return()=>{live=false;};
  },[ids.join(","),refresh,user?.id]);
  function remove(id){
    setCampaignSaved(id,false);
    setIds(savedCampaignIds());
  }
  return <section className="space-y-6">
    <header className="space-y-2"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-200"><Bookmark aria-hidden="true" className="h-5 w-5"/> On your device</p>
      <h1 className="text-3xl font-bold">Saved campaigns</h1>
      <p className="text-sm leading-6 text-slate-300">Save campaign links for quick access on this device. The app stores only their IDs locally, not the stories or financial data. Each listing is checked against live IFund records.</p>
    </header>
    <button type="button" onClick={()=>setRefresh(x=>x+1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm"><RefreshCw aria-hidden="true" className="h-4 w-4"/> Refresh live listings</button>
    {phase==="loading"&&<p role="status">Checking live saved campaigns…</p>}
    {phase==="error"&&<p role="alert" className="rounded-xl border border-amber-300/30 p-4">{error}</p>}
    {phase==="ready"&&<div className="space-y-3">
      {rows.length===0&&<div className="rounded-xl border border-white/20 p-5"><p className="text-sm text-slate-300">No saved campaigns yet. Explore causes and tap Save on a campaign.</p><Link to="/discover" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 font-semibold text-slate-950">Explore campaigns</Link></div>}
      {rows.map(row=><article key={row.id} className="space-y-3 rounded-xl border border-white/20 bg-white/5 p-5">
        {row.data?<><h2 className="font-bold">{row.data.title}</h2><p className="line-clamp-3 text-sm text-slate-300">{row.data.summary}</p><Link to={"/campaign/"+row.id} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-sm font-bold text-slate-950">View live campaign</Link></>:
          <p className="text-sm text-slate-300">{row.failed?"The live service could not verify this campaign.":"This campaign is no longer publicly available."}</p>}
        <button type="button" onClick={()=>remove(row.id)} className="ml-3 min-h-11 rounded-lg border border-white/30 px-3 text-sm">Remove saved link</button>
      </article>)}
    </div>}
  </section>;
}
