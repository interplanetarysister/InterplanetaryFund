import React,{useCallback,useEffect,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {Newspaper,BookOpen,Loader2} from "lucide-react";
import {listPublishedStories} from "@/lib/editorial";
import {Image} from "@/components/ui/image";

// Visual composition/text carried from the original Base44 Blogs page.
export default function Blogs(){
 const [params]=useSearchParams(),author=params.get("author")||"";
 const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{setItems(await listPublishedStories({author,limit:100}));}
  catch{setError("Unable to load stories.");}
  finally{setLoading(false);}
 },[author]);
 useEffect(()=>{let live=true;setLoading(true);setError("");
  listPublishedStories({author,limit:100})
   .then(data=>{if(live)setItems(data);})
   .catch(()=>{if(live)setError("Unable to load stories.");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[author]);
 const featured=items.filter(e=>e.type==="newsletter");
 const members=items.filter(e=>e.type!=="newsletter");
 return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><h1 className="text-3xl font-display font-semibold text-slate-950">IFund Stories & Blogs</h1>
    <p className="mt-2 text-slate-600">Our insider reporter’s diary, community stories, ideas and member journalism.</p></div>
   <div className="flex flex-wrap items-center gap-3">
    <Link to="/social?tab=publications" className="text-blue-800 underline font-medium text-sm">All IFund publications</Link>
    <Link to="/my-blog" className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Write a blog</Link>
   </div>
  </header>
  {loading&&<p role="status" className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4"/>Loading stories…</p>}
  {error&&<p role="alert" className="text-red-700">{error} <button type="button" onClick={load} className="underline">Retry</button></p>}
  {author&&<Link to="/blogs" className="text-blue-700 underline text-sm">See all stories</Link>}
  {!loading&&!error&&<>
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
  </>}
 </div>;
}

function ArticleTeaser({entry:e}){
 return <Link to={"/blogs/"+encodeURIComponent(e.id)} className="block rounded-2xl border border-stone-200 bg-white p-5 hover:border-cyan-400 transition-colors">
  {e.blog?.cover_image_url&&<Image src={e.blog.cover_image_url} alt="" className="mb-3 h-36 w-full rounded-xl object-cover"/>}
  <p className="text-xs uppercase font-semibold text-cyan-800">{e.type==="newsletter"?"Featured newsletter":"Member blog"}</p>
  <h3 className="mt-2 text-lg font-semibold text-slate-950">{e.title}</h3>
  <p className="text-sm text-slate-600 mt-2 line-clamp-3">{e.summary||"Read the story"}</p>
  <p className="text-xs text-slate-500 mt-4">{e.blog?.author_display_name||"IFund"}
   {e.published_at&&" · "+new Date(e.published_at).toLocaleDateString()}</p>
 </Link>;
}
