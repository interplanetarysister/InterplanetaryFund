import React,{useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import CampaignEmbeddedText from "@/components/campaigns/CampaignEmbeddedText";
import {Button} from "@/components/ui/button";
import {Loader2,Share2} from "lucide-react";

export default function BlogArticle(){
 const {id}=useParams();const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[copied,setCopied]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);
  base44.functions.invoke("manageBlog",{mode:"article",entry_id:id}).then(r=>{if(!r.data?.ok)throw new Error(r.data?.error||"Article unavailable");if(active)setData(r.data);})
   .catch(e=>{if(active){console.error("Blog article load failed:",e?.name||"BlogLoadError");setError("Unable to load this story.");}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id]);
 if(loading)return <div className="flex justify-center py-20"><Loader2 className="animate-spin"/></div>;
 if(error||!data)return <p role="alert" className="max-w-3xl mx-auto p-8 text-red-700">{error||"Article not available."}</p>;
 const {entry,blog,campaigns}=data;
 return <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
  <Link to="/blogs" className="text-sm text-blue-700 underline">All stories</Link>
  <div className="mt-4 bg-white border border-stone-200 rounded-2xl p-5 sm:p-8">
   <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">{entry.type==="newsletter"?"IFund Reporter · Featured newsletter":"Community blog"}</p>
   <h1 className="text-3xl font-display text-slate-950 font-semibold mt-3">{entry.title}</h1>
   <p className="text-sm text-slate-600 mt-3">{blog.title} · {entry.published_at?new Date(entry.published_at).toLocaleDateString():"Unpublished draft"}</p>
   {entry.summary&&<p className="text-lg text-slate-700 mt-5 font-medium">{entry.summary}</p>}
   <div className="border-t border-stone-200 my-6"/>
   <CampaignEmbeddedText body={entry.body} campaigns={campaigns}/>
   <div className="border-t border-stone-200 mt-8 pt-4 flex flex-wrap items-center gap-3">
    {blog.type==="member"&&<Link to={`/u/${blog.owner_user_id}`} className="text-sm text-blue-700 underline">View author's IFund profile</Link>}
    <Button variant="outline" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(window.location.href);setCopied(true);}catch{setCopied(false);}}}><Share2 className="w-4 h-4 mr-1"/>{copied?"Link copied":"Share this story"}</Button>
   </div>
  </div>
 </article>;
}
