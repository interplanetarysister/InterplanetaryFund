import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { listMyCampaigns } from "@/api/ownerCampaigns";

export default function MobileMyCampaigns() {
  const {user,status}=useAuthSession();
  const [campaigns,setCampaigns]=useState([]),[state,setState]=useState("loading"),[error,setError]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(status==="loading")return;
    if(!user){setState("signed-out");return;}
    let live=true;setState("loading");setError("");
    listMyCampaigns(authClient()).then(rows=>{if(live){setCampaigns(rows);setState("ready");}})
      .catch(cause=>{if(live){setError(cause?.message||"Private campaign records are unavailable.");setState("error");}});
    return ()=>{live=false;};
  },[user?.id,status,reload]);
  return <div className="space-y-5">
    <header><h1 className="text-3xl font-bold">Your campaigns</h1><p className="mt-2 text-sm leading-6 text-slate-300">Owner-scoped campaign records from your existing verified IFund account. This mobile view does not change drafts or publish campaigns.</p></header>
    {state==="loading"&&<p role="status">Loading owned campaigns…</p>}
    {state==="signed-out"&&<div className="rounded-xl border border-white/20 p-5"><p>Please sign in to see your campaigns.</p><Link to="/login?returnTo=%2Fcampaigns" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-slate-950">Sign in</Link></div>}
    {state==="error"&&<section role="alert" className="space-y-3 rounded-xl border border-amber-300/40 p-5"><p>{error}</p><button type="button" onClick={()=>setReload(n=>n+1)} className="min-h-11 rounded-lg border px-4">Retry</button></section>}
    {state==="ready"&&<div className="space-y-3">{campaigns.length===0&&<p className="rounded-xl border border-white/15 p-5 text-sm text-slate-300">No owned campaigns found. Your account is connected; campaigns appear here when created on IFund.</p>}
      {campaigns.map(c=><article key={c.id} className="space-y-3 rounded-xl border border-emerald-300/20 bg-white/5 p-5">
        <h2 className="text-lg font-bold">{c.title||"Untitled campaign"}</h2><p className="text-sm text-slate-300">Status: {c.status||"Unknown"}</p>
        {c.summary&&<p className="line-clamp-3 text-sm text-slate-300">{c.summary}</p>}
        {c.status==="active"&&<Link to={"/campaign/"+encodeURIComponent(c.id)} className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-sm font-bold text-slate-950">View published campaign</Link>}
        {c.status!=="active"&&<p className="text-xs text-slate-400">This unpublished record is visible only to the signed-in owner. It is not accepting donations in this app.</p>}
      </article>)}
    </div>}
    <Link to="/account" className="inline-flex min-h-11 items-center text-emerald-200 underline">Return to account</Link>
  </div>;
}
