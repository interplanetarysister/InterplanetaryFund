import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { CAMPAIGN_UUID } from "@/lib/ownerCampaigns";
import { categoryLabels } from "@/components/campaigns/CampaignCard";

export default function OwnerCampaignPreview(){
  const {id}=useParams();
  const [state,setState]=useState({phase:"loading",campaign:null});
  useEffect(()=>{
    let mounted=true;
    if(!CAMPAIGN_UUID.test(id||"")){setState({phase:"invalid",campaign:null});return;}
    setState({phase:"loading",campaign:null});
    (async()=>{
      try{
        const client=authClient();
        const {data:{user},error:authError}=await client.auth.getUser();
        if(authError||!user)throw Error("Unauthorized");
        const {data,error}=await client.from("ifund_campaigns")
          .select("id,title,summary,story,category,goal_amount,status,created_at,updated_at")
          .eq("id",id).eq("owner_id",user.id).maybeSingle();
        if(error)throw Error("Unable to load campaign");
        if(mounted)setState({phase:data?"ready":"not_found",campaign:data||null});
      }catch{if(mounted)setState({phase:"error",campaign:null});}
    })();
    return()=>{mounted=false;};
  },[id]);
  const c=state.campaign;
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <Link to="/mine" className="underline">All my campaigns</Link>
    {state.phase==="loading"&&<p role="status">Checking campaign ownership…</p>}
    {state.phase==="invalid"&&<p role="alert">Invalid campaign ID.</p>}
    {state.phase==="not_found"&&<p role="status">This campaign is not available to your account.</p>}
    {state.phase==="error"&&<p role="alert">Unable to verify campaign details.</p>}
    {state.phase==="ready"&&<article className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{categoryLabels[c.category]||"Other"} · {c.status}</p>
      <h1 className="font-display text-3xl font-bold">{c.title||"Untitled campaign"}</h1>
      {c.summary&&<p className="text-lg">{c.summary}</p>}
      {c.story&&<p className="whitespace-pre-wrap">{c.story}</p>}
      {c.goal_amount>0&&<p className="text-sm text-muted-foreground">Fundraising goal: ${Number(c.goal_amount).toLocaleString()}. Verified donations and balance are unavailable.</p>}
      {c.status==="draft"&&<Link to={"/create?draft="+encodeURIComponent(c.id)} className="inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Continue editing draft</Link>}
      {c.status!=="active"&&<p className="text-sm text-muted-foreground">This is an owner-only preview. The public campaign page deliberately excludes unpublished or paused records.</p>}
      {c.status==="active"&&<Link to={"/campaign/"+encodeURIComponent(c.id)} className="underline">View public page</Link>}
    </article>}
  </main>;
}
