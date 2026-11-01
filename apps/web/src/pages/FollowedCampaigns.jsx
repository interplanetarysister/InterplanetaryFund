import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listMyFollows, setCampaignFollow, changeFollow, DEFAULT_FOLLOW_PREFS } from "@/lib/followedCampaigns";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Image } from "@/components/ui/image";
import { Heart, Pin, Archive, Search } from "lucide-react";

const SORTS=[
  ["newest","Newest followed"],["recently_updated","Recently updated"],
  ["recently_viewed","Recently viewed"]
];
const PREF_LABELS={
  updates:"Campaign updates",media:"New images and videos",milestones:"Milestones",
  goal_reached:"Goal reached",nearing_completion:"Nearing completion",
  comments:"Comments",volunteer:"Volunteer opportunities",events:"Events",
  emergencies:"Urgent updates",completed:"Campaign completed"
};

export default function FollowedCampaigns(){
  const mounted=useRef(true);
  const version=useRef(0);
  const [entries,setEntries]=useState([]);
  const [phase,setPhase]=useState("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [sort,setSort]=useState("newest");
  const [category,setCategory]=useState("all");
  const [search,setSearch]=useState("");
  const [showArchived,setShowArchived]=useState(false);
  const [editing,setEditing]=useState(null);
  const load=useCallback(async()=>{
    const request=++version.current;
    setPhase("loading");setError("");
    try{
      const rows=await listMyFollows(authClient());
      if(mounted.current&&request===version.current){
        setEntries(rows);setPhase("ready");
      }
    }catch(cause){
      if(mounted.current&&request===version.current){
        setError(cause?.message||"Could not load followed campaigns.");
        setPhase("error");
      }
    }
  },[]);
  useEffect(()=>{
    mounted.current=true;load();
    return()=>{mounted.current=false;version.current+=1;};
  },[load]);
  const categories=useMemo(()=>[...new Set(entries.map(e=>e.campaign?.category).filter(Boolean))].sort(),[entries]);
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    const data=entries.filter(({follow,campaign})=>
      Boolean(follow.archived)===showArchived &&
      (category==="all"||campaign?.category===category) &&
      (!q||(campaign?.title||"").toLowerCase().includes(q)));
    const timestamp=(value)=>{const t=Date.parse(value||"");return Number.isFinite(t)?t:0;};
    data.sort((a,b)=>{
      if(a.follow.pinned!==b.follow.pinned)return a.follow.pinned?-1:1;
      if(sort==="recently_updated")
        return timestamp(b.campaign?.updated_at)-timestamp(a.campaign?.updated_at);
      if(sort==="recently_viewed")
        return timestamp(b.follow.last_viewed)-timestamp(a.follow.last_viewed);
      return timestamp(b.follow.created_at)-timestamp(a.follow.created_at);
    });
    return data;
  },[entries,search,category,showArchived,sort]);
  async function updateOne(follow,change){
    if(busy)return;
    setBusy(follow.id);setError("");
    try{
      const saved=await changeFollow(authClient(),follow.id,change);
      setEntries(prev=>prev.map(entry=>entry.follow.id===follow.id?{...entry,follow:saved}:entry));
    }catch(cause){setError(cause?.message||"Could not update this follow.");}
    finally{setBusy("");}
  }
  async function unfollow(follow){
    if(busy)return;
    setBusy(follow.id);setError("");
    try{
      const confirmed=await setCampaignFollow(authClient(),follow.campaign_id,false);
      if(confirmed!==false)throw Error("Unfollow was not confirmed.");
      setEntries(prev=>prev.filter(entry=>entry.follow.id!==follow.id));
      setEditing(null);
    }catch(cause){setError(cause?.message||"Could not unfollow this campaign.");}
    finally{setBusy("");}
  }
  function prefsFor(follow){
    return {...DEFAULT_FOLLOW_PREFS,...follow.notification_prefs};
  }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header>
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
        <Heart aria-hidden="true" className="h-7 w-7 text-primary"/>Followed campaigns
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Find the causes you've followed, set notification preferences, pin favorites, or archive them.</p>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-4 text-destructive">{error}</p>}
    {phase==="loading"&&<p role="status">Loading your followed campaigns…</p>}
    {phase==="error"&&<section className="rounded-2xl border border-border bg-card p-5">
      <p>Independent follow storage is not yet available, or the signed-in account could not be verified. Your original follows are not replaced by example records.</p>
      <button type="button" onClick={load} className="mt-3 underline font-semibold">Retry</button>
    </section>}
    {phase==="ready"&&<>
      <section className="flex flex-wrap items-end gap-3" aria-label="Follow filters">
        <label className="text-sm">Sort by
          <select value={sort} onChange={event=>setSort(event.target.value)}
            className="mt-1 block rounded-lg border border-input bg-background p-2">
            {SORTS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm">Category
          <select value={category} onChange={event=>setCategory(event.target.value)}
            className="mt-1 block rounded-lg border border-input bg-background p-2">
            <option value="all">All categories</option>
            {categories.map(value=><option value={value} key={value}>{categoryLabels[value]||value}</option>)}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-input px-3 py-2">
          <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground"/>
          <span className="sr-only">Search follows</span>
          <input value={search} onChange={event=>setSearch(event.target.value)}
            placeholder="Search followed causes" className="w-full bg-transparent outline-none"/>
        </label>
        <button type="button" aria-pressed={showArchived} onClick={()=>setShowArchived(v=>!v)}
          className="rounded-lg border border-border px-4 py-2">{showArchived?"Show active":"Show archived"}</button>
      </section>
      {filtered.length===0?<section className="rounded-2xl border border-border bg-card p-6">
        <p>{entries.length===0?"No followed campaigns yet.":"No followed campaigns match these filters."}</p>
        <Link to="/discover" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Discover campaigns</Link>
      </section>:<ul className="space-y-4">
        {filtered.map(({follow,campaign})=><li key={follow.id}>
          <article className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              {campaign?.cover_image_url&&<Link to={"/campaign/"+encodeURIComponent(campaign.id)} className="shrink-0">
                <Image src={campaign.cover_image_url} alt={campaign.title} className="h-24 w-24 rounded-xl object-cover"/>
              </Link>}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{campaign?.title||"Unavailable campaign"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{campaign?
                  (categoryLabels[campaign.category]||campaign.category):
                  "No public campaign details are accessible. Private history is not exposed."}</p>
              </div>
              <div className="flex gap-2 text-xs font-semibold">{follow.pinned&&<span> Pinned </span>}{follow.archived&&<span> Archived </span>}</div>
            </header>
            {campaign?.summary&&<p className="text-sm">{campaign.summary}</p>}
            {campaign&&<Link to={"/campaign/"+encodeURIComponent(campaign.id)}
              onClick={()=>{changeFollow(authClient(),follow.id,{last_viewed:new Date().toISOString()}).catch(()=>{});}}
              className="inline-block text-sm font-semibold underline">View campaign</Link>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={()=>updateOne(follow,{pinned:!follow.pinned})}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
                <Pin aria-hidden="true" className="h-4 w-4"/>{follow.pinned?"Unpin":"Pin"}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={()=>updateOne(follow,{archived:!follow.archived})}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">
                <Archive aria-hidden="true" className="h-4 w-4"/>{follow.archived?"Restore":"Archive"}
              </button>
              <button type="button" onClick={()=>setEditing(editing===follow.id?null:follow.id)}
                className="rounded-lg border border-border px-3 py-2 text-sm">Notification preferences</button>
              <button type="button" disabled={Boolean(busy)} onClick={()=>unfollow(follow)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-destructive disabled:opacity-50">Unfollow</button>
            </div>
            {editing===follow.id&&<fieldset className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <legend className="font-semibold">Notifications for this campaign</legend>
              {Object.entries(PREF_LABELS).map(([key,label])=><label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={prefsFor(follow)[key]===true}
                  disabled={Boolean(busy)}
                  onChange={event=>updateOne(follow,{notification_prefs:{...prefsFor(follow),[key]:event.target.checked}})}/>
                {label}
              </label>)}
            </fieldset>}
          </article>
        </li>)}
      </ul>}
      <p className="text-xs text-muted-foreground">Goal-based and end-date sorting require verified fundraising totals and deadlines, which are not available from the current public campaign schema. The original follow relationships require verified owner mapping before historical import.</p>
    </>}
  </main>;
}
