import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import CampaignCard from "@/components/campaigns/CampaignCard";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function PublicProfile(){
  const {id}=useParams();
  const [view,setView]=useState({phase:"loading",campaigns:[],profile:null});
  useEffect(()=>{
    let mounted=true;
    if(!UUID.test(id||"")){setView({phase:"invalid",campaigns:[],profile:null});return;}
    setView({phase:"loading",campaigns:[],profile:null});
    (async()=>{
      try{
        const client=authClient();
        const {data:{user},error}=await client.auth.getUser();
        if(error||!user || user.id!==id){
          // Source PublicProfile has privacy choices that are not migrated.
          // Never aggregate another member's posts/campaigns by UUID until
          // public-visibility consent and the original profile function port.
          if(mounted)setView({phase:"private",campaigns:[],profile:null});
          return;
        }
        const [profile,campaigns]=await Promise.all([
          client.from("ifund_profiles").select("id,display_name,handle").eq("id",user.id).maybeSingle(),
          client.from("ifund_campaigns")
            .select("id,title,summary,category,goal_amount,cover_image_url,status,created_at")
            .eq("owner_id",user.id).eq("status","active")
            .order("created_at",{ascending:false}).limit(40)
        ]);
        if(profile.error||campaigns.error)throw Error("Profile unavailable");
        if(mounted)setView({phase:"ready",campaigns:campaigns.data||[],profile:profile.data||null});
      }catch{if(mounted)setView({phase:"error",campaigns:[],profile:null});}
    })();
    return()=>{mounted=false;};
  },[id]);
  return <main className="mx-auto max-w-5xl space-y-7 px-4 py-8">
    <header className="rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl font-bold">{view.phase==="ready"?(view.profile?.display_name||"My public profile preview"):"IFund member profile"}</h1>
      {view.phase==="ready"&&view.profile?.handle&&<p className="mt-2 text-muted-foreground">@{view.profile.handle}</p>}
      <p className="mt-3 text-sm text-muted-foreground">Public profile visibility, bio, followed campaigns and community privacy choices are not yet migrated. Only the signed-in owner can preview this page.</p>
    </header>
    {view.phase==="loading"&&<p role="status">Checking profile permissions…</p>}
    {view.phase==="invalid"&&<p role="alert">Invalid member profile reference.</p>}
    {view.phase==="private"&&<p role="status">This member's public profile has not been authorized for the independent platform.</p>}
    {view.phase==="error"&&<p role="alert">Your profile could not be loaded.</p>}
    {view.phase==="ready"&&<section>
      <h2 className="mb-3 text-xl font-semibold">My published campaigns</h2>
      {view.campaigns.length>0?<div className="grid gap-4 sm:grid-cols-2">{view.campaigns.map(c=><CampaignCard key={c.id} campaign={c}/>)}</div>:
        <p className="text-muted-foreground">You have no active publicly listed campaigns in the independent database.</p>}
      <Link to="/profile" className="mt-4 inline-block underline">Manage my profile</Link>
    </section>}
    <Link to="/discover" className="inline-block underline">Browse campaigns</Link>
  </main>;
}
