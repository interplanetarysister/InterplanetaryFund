import React,{useEffect,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {Newspaper,BookOpen,Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";

export default function Blogs(){
 const [params]=useSearchParams(),author=params.get("author")||"";
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;setLoading(true);setError("");
  base44.functions.invoke("manageBlog",{mode:"feed"}).then(r=>{
   if(!r.data?.ok)throw new Error(r.data?.error||"Blog index unavailable");
   if(active)setItems(r.data.entries||[]);
  }).catch(e=>{if(active){console.error("Blog index load failed:",e?.name||"BlogLoadError");setError("Unable to load stories");}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const visible=items.filter(e=>!author||e.owner_user_id===author);
 const featured=visible.filter(e=>e.type==="newsletter"),members=visible.filter(e=>e.type!=="newsletter");
 return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h1 className="text-3xl font-display font-semibold text-slate-950">IFund Stories & Blogs</h1>
    <p className="mt-2 text-slate-600">Our insider reporter’s diary, community stories, ideas and member journalism.</p></div>
   <div className="flex flex-wrap items-center gap-3"><Link to="/social?tab=publications" className="text-blue-800 underline font-medium text-sm">All IFund publications</Link><Link to="/my-blog"><Button>Write a blog</Button></Link></div>
  </header>
  {loading&&<p role="status" className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4"/>Loading stories…</p>}
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {author&&<Link to="/blogs" className="text-blue-700 underline text-sm">See all stories</Link>}
  <section><h2 className="text-xl font-semibold text-slate-950 flex items-center gap-2"><Newspaper/>Interplanetary Fund Reporter</h2>
   <p className="text-sm text-slate-600 mb-3">The official diary, featured newsletters, and what the IFund team is building.</p>
   <div className="grid sm:grid-cols-2 gap-4">{featured.length?featured.map(e=><ArticleTeaser key={e.id} entry={e}/>):
    <p className="text-slate-600 bg-white border rounded-xl p-5">The reporter’s first featured issue has not been published yet.</p>}</div>
  </section>
  <section><h2 className="text-xl font-semibold text-slate-950 flex items-center gap-2"><BookOpen/>Community Blogs</h2>
   <p className="text-sm text-slate-600 mb-3">Fundraising, local events, passions, and community perspectives.</p>
   <div className="grid sm:grid-cols-2 gap-4">{members.length?members.map(e=><ArticleTeaser key={e.id} entry={e}/>):
    <p className="text-slate-600 bg-white border rounded-xl p-5">No published member stories yet. Anyone can read; subscribed creators can write.</p>}</div>
  </section>
 </div>;
}
function ArticleTeaser({entry:e}){
 return <Link to={`/blogs/${e.id}`} className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-cyan-400 transition-colors">
  <p className="text-xs uppercase font-semibold text-cyan-800">{e.type==="newsletter"?"Featured newsletter":"Member blog"}</p>
  <h3 className="mt-2 text-lg font-semibold text-slate-950">{e.title}</h3>
  <p className="text-sm text-slate-600 mt-2 line-clamp-3">{e.summary||"Read the story"}</p>
  <p className="text-xs text-slate-500 mt-4">{e.author_name} {e.published_at&&" · "+new Date(e.published_at).toLocaleDateString()}</p>
 </Link>;
}
