import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, BookOpen, Users, Heart, MessageCircle } from "lucide-react";

export default function PublicProfile() {
 const { id }=useParams();
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let mounted=true;setLoading(true);
  base44.functions.invoke("managePublicProfile",{mode:"read",user_id:id}).then(r=>{
   if(!r.data?.ok)throw new Error("User profile not available");
   if(mounted)setData(r.data);
  }).catch(()=>{if(mounted)setError("This public profile is unavailable.");})
   .finally(()=>{if(mounted)setLoading(false);});
  return()=>{mounted=false;};
 },[id]);
 if(loading)return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>;
 if(error||!data)return <p role="alert" className="max-w-3xl mx-auto p-8">{error||"Profile unavailable"}</p>;
 const p=data.profile;
 return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-7">
  <header className="bg-white rounded-2xl border border-stone-200 p-6 flex gap-4 items-start">
   <Image src={p.avatar_url||FALLBACK_IMAGE} alt="" className="w-20 h-20 rounded-full object-cover shrink-0"/>
   <div className="min-w-0 flex-1"><h1 className="text-2xl font-display font-semibold text-slate-950 break-words">{p.display_name}</h1>
    {p.username&&<p className="text-sm text-slate-600">@{p.username}</p>}
    {p.bio&&<p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap break-words">{p.bio}</p>}
    <Link className="inline-block mt-3 text-sm font-medium text-blue-700 underline" to={`/blogs?author=${encodeURIComponent(id)}`}>Read this member's blog</Link>
   </div>
  </header>
  {p.priority_campaign_id&&data.focus?.some(c=>c.id===p.priority_campaign_id)&&
   <section><h2 className="text-lg font-semibold text-slate-950 mb-3 flex gap-2 items-center"><Heart className="w-5 h-5"/>Priority campaign</h2>
     <div className="max-w-sm"><CampaignCard campaign={data.focus.find(c=>c.id===p.priority_campaign_id)}/></div>
   </section>}
  {data.focus?.filter(c=>c.id!==p.priority_campaign_id).length>0&&<section>
   <h2 className="font-semibold text-lg text-slate-950 mb-3">Campaigns they champion</h2>
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.focus.filter(c=>c.id!==p.priority_campaign_id).map(c=><CampaignCard key={c.id} campaign={c}/>)}</div>
  </section>}
  {data.own_campaigns?.length>0&&<section><h2 className="font-semibold text-lg text-slate-950 mb-3">Their campaigns</h2>
   <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{data.own_campaigns.map(c=><CampaignCard key={c.id} campaign={c}/>)}</div></section>}
  {p.show_posts!==false&&<section><h2 className="text-lg font-semibold text-slate-950 mb-3 flex gap-2 items-center"><MessageCircle className="w-5 h-5"/>IFund posts</h2>
    {data.posts?.length?<div className="space-y-3">{data.posts.map(post=><div key={post.id} className="bg-white border border-stone-200 rounded-xl p-4">
      <p className="text-slate-800 text-sm whitespace-pre-wrap break-words">{post.content}</p>
      {post.media_url&&<Image src={post.media_url} alt="Shared post" className="max-h-64 mt-3 rounded-lg object-contain"/>}
      {post.campaign_id&&<Link className="text-sm text-blue-700 underline mt-2 inline-block" to={`/campaign/${post.campaign_id}`}>View linked campaign</Link>}
    </div>)}</div>:<p className="text-slate-600 text-sm">No public posts yet.</p>}
  </section>}
  {p.show_communities!==false&&<section><h2 className="text-lg font-semibold text-slate-950 mb-3 flex gap-2 items-center"><Users className="w-5 h-5"/>Communities</h2>
    {data.communities?.length?<div className="grid sm:grid-cols-2 gap-3">{data.communities.map(c=><Link key={c.id} to={`/community/${c.id}`} className="block p-4 bg-white border border-stone-200 rounded-xl hover:border-cyan-400"><p className="font-semibold text-slate-900">{c.name}</p><p className="text-sm text-slate-600 line-clamp-2">{c.description}</p></Link>)}</div>:<p className="text-sm text-slate-600">No visible community memberships.</p>}
  </section>}
  {p.show_communities!==false&&data.community_activity?.length>0&&<section>
   <h2 className="font-semibold text-lg text-slate-950 mb-3">Community conversations</h2>
   <div className="space-y-2">{data.community_activity.slice(0,12).map(item=><Link key={item.id} to={`/community/${item.community_id}`} className="block rounded-xl bg-white border border-stone-200 p-3 text-sm text-blue-800 hover:underline">
    {item.title} <span className="text-xs text-slate-500 ml-2">{item.type==="reply"?"Discussion reply":"Community discussion"}</span>
   </Link>)}</div>
  </section>}
  {data.blogs?.length>0&&<section><h2 className="font-semibold text-lg text-slate-950 mb-3 flex gap-2 items-center"><BookOpen className="w-5 h-5"/>Blog</h2>{data.blogs.map(b=><Link className="block bg-white rounded-xl border border-stone-200 p-4 text-blue-700 hover:underline" key={b.id} to={`/blogs?author=${id}`}>{b.title}</Link>)}</section>}
 </div>;
}
