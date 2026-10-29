import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import CampaignCard from "@/components/campaigns/CampaignCard";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function PublicProfile() {
  const {id}=useParams();
  const [view,setView]=useState({phase:"loading",campaigns:[],posts:[]});
  useEffect(()=>{
    let active=true;
    if(!UUID.test(id||"")){setView({phase:"invalid",campaigns:[],posts:[]});return;}
    setView({phase:"loading",campaigns:[],posts:[]});
    (async()=>{
      try{
        const client=authClient();
        const [campaigns,posts]=await Promise.all([
          client.from("ifund_campaigns")
            .select("id,title,summary,category,goal_amount,cover_image_url,status,created_at")
            .eq("owner_id",id).eq("status","active")
            .order("created_at",{ascending:false}).limit(40),
          client.from("ifund_posts")
            .select("id,body,created_at").eq("author_id",id)
            .order("created_at",{ascending:false}).limit(40),
        ]);
        if(campaigns.error||posts.error)throw Error("Public data unavailable");
        if(active)setView({phase:"ready",campaigns:campaigns.data||[],posts:posts.data||[]});
      }catch{if(active)setView({phase:"error",campaigns:[],posts:[]});}
    })();
    return()=>{active=false;};
  },[id]);
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
    <header className="rounded-2xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl font-semibold">IFund member</h1>
      <p className="mt-2 text-muted-foreground">Campaigns and public posts this account has shared.</p>
      <p className="mt-2 text-sm text-muted-foreground">Public bio, name, followers, and private activity are not imported or exposed without verified privacy settings.</p>
    </header>
    {view.phase==="loading"&&<p role="status">Loading public activity…</p>}
    {view.phase==="invalid"&&<p role="alert">Invalid profile link.</p>}
    {view.phase==="error"&&<p role="alert">Public activity cannot be loaded right now.</p>}
    {view.phase==="ready"&&<>
      <section><h2 className="text-xl font-semibold mb-4">Public campaigns</h2>
        {view.campaigns.length?<div className="grid gap-4 sm:grid-cols-2">{view.campaigns.map(c=><CampaignCard key={c.id} campaign={c} />)}</div>:
          <p className="text-muted-foreground">No active campaigns are publicly visible for this account.</p>}
      </section>
      <section><h2 className="text-xl font-semibold mb-4">Public posts</h2>
        {view.posts.length?<div className="space-y-3">{view.posts.map(p=><article key={p.id} className="rounded-xl border border-border bg-card p-5"><p className="whitespace-pre-wrap break-words">{p.body}</p><p className="mt-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p></article>)}</div>:
          <p className="text-muted-foreground">No posts are publicly visible for this account.</p>}
      </section>
    </>}
    <Link to="/discover" className="inline-block underline">Discover campaigns</Link>
  </main>;
}
