import React,{useCallback,useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {extractCampaignIds} from "@/lib/campaignEmbed";
import CampaignCard from "@/components/campaigns/CampaignCard";
import {Loader2,BookOpen} from "lucide-react";

const empty={title:"",summary:"",body:"",id:""};
export default function MyBlog(){
 const [state,setState]=useState(null),[article,setArticle]=useState(empty),[blogTitle,setBlogTitle]=useState(""),[blogDesc,setBlogDesc]=useState("");
 const [campaigns,setCampaigns]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const [r,cs]=await Promise.all([
   base44.functions.invoke("manageBlog",{mode:"mine"}),
   base44.entities.Campaign.filter({status:"active"}, "-created_date",100).catch(()=>[]),
  ]);
  if(!r.data?.ok)throw new Error(r.data?.error||"Blog studio unavailable");
  setState(r.data);setCampaigns(cs||[]);if(r.data.blog){setBlogTitle(r.data.blog.title);setBlogDesc(r.data.blog.description||"");}
 },[]);
 useEffect(()=>{load().catch(e=>{console.error("Blog state load failed:",e?.name||"BlogLoadError");setError("Unable to load your blog right now.");});},[load]);
 const call=async(body,success)=>{setBusy(true);setError("");setNotice("");
  try{const r=await base44.functions.invoke("manageBlog",body);if(!r.data?.ok)throw new Error(r.data?.error||"Could not save.");
   setNotice(success);await load();return r.data;
  }catch(e){console.error("Blog save failed:",e?.name||"BlogSaveError");setError("Unable to save.");return null;}finally{setBusy(false);}
 };
 if(!state)return <div role="status" className="mx-auto max-w-3xl p-8">{error||<Loader2 className="animate-spin"/>}</div>;
 const b=state.blog;
 const save=async(publish)=>{if(!b)return;const r=await call({mode:publish?"publish_entry":"save_entry",blog_id:b.id,entry_id:article.id||undefined,
  title:article.title,summary:article.summary,body:article.body},publish?"Story published for everyone to read.":"Draft saved.");
  if(r?.entry)setArticle({...r.entry});};
 const addEmbed=(id)=>setArticle(p=>({...p,body:p.body+`\n\n[campaign:${id}]\n`}));
 const pasteIds=extractCampaignIds(article.body);
 return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
  <header><h1 className="text-3xl font-display font-semibold text-slate-950 flex items-center gap-2"><BookOpen/>My Blog Studio</h1>
   <p className="text-slate-600 mt-2">One blog per subscribed member. Publish about fundraising, community groups, local events, and the causes you care about.</p>
   <Link to="/blogs" className="text-blue-700 underline text-sm">Browse public blogs and IFund Reporter</Link>
  </header>
  {!b? <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
   {state.can_create?<>
    <h2 className="text-lg text-slate-950 font-semibold">Create your one public blog</h2>
    <Input aria-label="Blog name" maxLength={90} placeholder="Your blog name" value={blogTitle} onChange={e=>setBlogTitle(e.target.value)}/>
    <Textarea aria-label="Blog description" maxLength={500} placeholder="Describe your topic" value={blogDesc} onChange={e=>setBlogDesc(e.target.value)}/>
    <Button disabled={busy||blogTitle.trim().length<3} onClick={()=>call({mode:"create_blog",title:blogTitle,description:blogDesc},"Your blog has been created.")}>Create my blog</Button>
   </>:<><p className="text-slate-700">Creating and publishing your personal blog is included with paid membership. Anyone can read it.</p>
    <Link to="/subscriptions" className="text-blue-700 font-medium underline">View memberships</Link></>}
  </section>:<>
   <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
    <h2 className="font-semibold text-lg text-slate-950">About your blog</h2>
    <Input value={blogTitle} onChange={e=>setBlogTitle(e.target.value)} maxLength={90} aria-label="Blog title"/>
    <Textarea value={blogDesc} onChange={e=>setBlogDesc(e.target.value)} maxLength={500} aria-label="Blog description"/>
    <Button variant="outline" disabled={busy} onClick={()=>call({mode:"edit_blog",blog_id:b.id,title:blogTitle,description:blogDesc},"Blog details updated.")}>Save blog details</Button>
   </section>
   <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
    <h2 className="font-semibold text-lg text-slate-950">{article.id?"Edit story":"Write a new story"}</h2>
    <Input value={article.title} onChange={e=>setArticle(p=>({...p,title:e.target.value}))} maxLength={140} placeholder="Article headline" aria-label="Article headline"/>
    <Input value={article.summary} onChange={e=>setArticle(p=>({...p,summary:e.target.value}))} maxLength={400} placeholder="Optional introduction" aria-label="Article summary"/>
    <Textarea rows={12} value={article.body} onChange={e=>setArticle(p=>({...p,body:e.target.value}))} maxLength={18000} placeholder="Write your story. Paste a campaign URL or IFund embed iframe anywhere to display a donation card." aria-label="Article body"/>
    <div className="border border-stone-200 rounded-lg p-3">
     <p className="text-sm font-medium text-slate-900">Add a campaign card</p>
     <p className="text-xs text-slate-600 mb-2">Paste the IFund embed snippet, use a campaign URL, or select a card below. Only public campaigns render.</p>
     <select aria-label="Add a campaign embed" className="border bg-white text-slate-900 rounded-lg p-2 w-full" defaultValue="" onChange={e=>{if(e.target.value)addEmbed(e.target.value);e.target.value="";}}>
      <option value="">Choose an active campaign to insert</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
     </select>
    </div>
    {!!pasteIds.length&&<div className="space-y-2"><p className="text-sm font-semibold text-slate-800">Campaigns in this article</p><div className="grid sm:grid-cols-2 gap-3">{pasteIds.map(id=>{
     const campaign=campaigns.find(c=>c.id===id);return campaign?<CampaignCard key={id} campaign={campaign}/>:<p key={id} className="text-xs text-slate-600">Campaign {id} will be checked before publication.</p>;
    })}</div></div>}
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={()=>save(false)}>Save draft</Button>
     <Button disabled={busy||!state.can_create} onClick={()=>save(true)}>Publish story</Button>
     <Button variant="ghost" onClick={()=>setArticle(empty)}>New story</Button></div>
    <p className="text-xs text-slate-600">Publishing makes your article publicly readable. Embedded campaigns always open their IFund campaign page.</p>
   </section>
   <section className="bg-white border border-stone-200 rounded-2xl p-5">
    <h2 className="font-semibold text-lg text-slate-950 mb-2">Your stories</h2>
    {!state.entries?.length?<p className="text-sm text-slate-600">No stories yet.</p>:<div className="space-y-2">{state.entries.map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-3">
     <div><p className="text-slate-900 font-medium">{e.title}</p><p className="text-slate-600 text-xs">{e.status}</p></div>
     <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setArticle({...e})}>Edit</Button>
      {e.status==="published"&&<Link to={`/blogs/${e.id}`} className="text-sm text-blue-700 underline self-center">View</Link>}
     </div></div>)}</div>}
   </section>
  </>}
  {notice&&<p role="status" className="text-green-700 text-sm">{notice}</p>}{error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
 </div>;
}
