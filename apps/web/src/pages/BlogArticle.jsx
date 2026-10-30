import React,{useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {Loader2,Share2} from "lucide-react";
import {getPublishedStory} from "@/lib/editorial";
import {extractCampaignIds} from "@/lib/campaignEmbed";
import {getCampaignDetail} from "@/api/publicData";
import CampaignEmbeddedText from "@/components/campaigns/CampaignEmbeddedText";

export default function BlogArticle(){
 const {id}=useParams();
 const [data,setData]=useState(null);
 const [campaigns,setCampaigns]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");setData(null);setCampaigns([]);
  (async()=>{
   try{
    const entry=await getPublishedStory(id);
    if(!entry)throw Error("Article unavailable");
    const ids=extractCampaignIds(entry.body).filter(x=>
      /^[a-f0-9-]{36}$/i.test(x));
    const linked=await Promise.all(ids.map(x=>getCampaignDetail(x).catch(()=>null)));
    if(active){setData(entry);setCampaigns(linked.filter(Boolean));}
   }catch{if(active)setError("Unable to load this story.");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[id]);
 if(loading)return <div role="status" className="flex justify-center gap-2 py-20">
  <Loader2 aria-hidden="true" className="animate-spin"/>Loading story…</div>;
 if(error||!data)return <p role="alert" className="max-w-3xl mx-auto p-8 text-red-700">
  {error||"Article not available."} <Link to="/blogs" className="underline">All stories</Link></p>;
 const entry=data, blog=data.blog;
 return <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
  <Link to="/blogs" className="text-sm text-blue-700 underline">All stories</Link>
  <div className="mt-4 bg-white border border-stone-200 rounded-2xl p-5 sm:p-8">
   <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">
    {entry.type==="newsletter"?"IFund Reporter · Featured newsletter":"Community blog"}
   </p>
   <h1 className="text-3xl font-display text-slate-950 font-semibold mt-3">{entry.title}</h1>
   <p className="text-sm text-slate-600 mt-3">{blog?.title||"IFund"}
    {entry.published_at?" · "+new Date(entry.published_at).toLocaleDateString():""}</p>
   {entry.summary&&<p className="text-lg text-slate-700 mt-5 font-medium">{entry.summary}</p>}
   <div className="border-t border-stone-200 my-6"/>
   <CampaignEmbeddedText body={entry.body} campaigns={campaigns}/>
   <div className="border-t border-stone-200 mt-8 pt-4 flex flex-wrap items-center gap-3">
    {blog?.type==="member"&&
      <Link to={"/u/"+encodeURIComponent(blog.owner_id)}
        className="text-sm text-blue-700 underline">View author's IFund profile</Link>}
    <button type="button" className="inline-flex items-center rounded-xl border px-4 py-2 text-sm"
      onClick={async()=>{
       try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}
       catch{setCopied(false);}
      }}><Share2 aria-hidden="true" className="w-4 h-4 mr-2"/>
      {copied?"Link copied":"Share this story"}</button>
   </div>
  </div>
 </article>;
}
