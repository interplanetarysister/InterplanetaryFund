import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {extractCampaignIds,embedSnippet} from "@/lib/campaignEmbed";
import CampaignCard from "@/components/campaigns/CampaignCard";
import {Eye, Copy} from "lucide-react";

export default function PublicProfileEditor({user}) {
 const [data,setData]=useState(null),[candidates,setCandidates]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [paste,setPaste]=useState("");
 useEffect(()=>{if(!user?.id)return;let active=true;
  Promise.all([
   base44.functions.invoke("managePublicProfile",{mode:"read",user_id:user.id}),
   base44.entities.Campaign.filter({created_by_id:user.id}).catch(()=>[]),
   base44.entities.FollowedCampaign.filter({user_id:user.id}).catch(()=>[]),
  ]).then(async([res,owned,followed])=>{
   if(!active)return;
   const allowed=[...(owned||[]).filter(c=>c.status==="active")];
   const followedActive=await Promise.all((followed||[]).filter(f=>!f.archived).slice(0,100).map(f=>base44.entities.Campaign.get(f.campaign_id).catch(()=>null)));
   const combined=[...new Map([...allowed,...followedActive.filter(c=>c?.status==="active")].map(c=>[c.id,c])).values()];
   setCandidates(combined);
   setData({display_name:res.data?.profile?.display_name||user.username||user.full_name||"",
    bio:res.data?.profile?.bio||"",
    focus_campaign_ids:res.data?.profile?.focus_campaign_ids||[],
    priority_campaign_id:res.data?.profile?.priority_campaign_id||"",
    show_posts:res.data?.profile?.show_posts!==false,
    show_communities:res.data?.profile?.show_communities!==false,
   });
  }).catch(()=>{if(active)setError("Profile editor could not load.");});
  return()=>{active=false;};
 },[user?.id]);
 if(!data)return <div className="text-sm text-slate-600 p-4">{error||"Loading your public profile…"}</div>;
 const toggle=id=>setData(p=>({...p,focus_campaign_ids:p.focus_campaign_ids.includes(id)?p.focus_campaign_ids.filter(x=>x!==id):[...p.focus_campaign_ids,id].slice(0,6),
  priority_campaign_id:p.priority_campaign_id===id&&p.focus_campaign_ids.includes(id)?"":p.priority_campaign_id}));
 const submit=async()=>{setBusy(true);setError("");setNotice("");
  try{const r=await base44.functions.invoke("managePublicProfile",{mode:"save",...data});
   if(!r.data?.ok)throw new Error(r.data?.error||"Could not save.");
   setData(p=>({...p,...r.data.profile}));setNotice("Public profile saved.");
  }catch(e){console.error("Public profile save failed:",e?.name||"ProfileSaveError");setError("Could not save profile.");}finally{setBusy(false);}
 };
 const pasteCampaign=()=>{const ids=extractCampaignIds(paste).filter(id=>candidates.some(c=>c.id===id));if(!ids.length){setError("Paste a valid IFund embed for a campaign you own or follow.");return;}setData(p=>({...p,focus_campaign_ids:[...new Set([...p.focus_campaign_ids,...ids])].slice(0,6)}));setPaste("");setError("");};
 return <section className="rounded-2xl bg-white border border-stone-200 p-5 mt-6 space-y-4">
  <div className="flex justify-between gap-2 items-start">
   <div><h2 className="text-lg font-semibold text-slate-950">Your public profile</h2>
    <p className="text-xs text-slate-600">Other people can view your chosen highlights, posts and communities.</p></div>
   <Link to={`/u/${user.id}`} className="text-blue-700 text-sm inline-flex items-center gap-1 shrink-0"><Eye className="w-4 h-4"/>View</Link>
  </div>
  <label className="block text-sm text-slate-800">Display name
   <Input className="mt-1" maxLength={70} value={data.display_name} onChange={e=>setData(p=>({...p,display_name:e.target.value}))}/>
  </label>
  <label className="block text-sm text-slate-800">Your story and interests
   <Textarea className="mt-1" maxLength={900} value={data.bio} onChange={e=>setData(p=>({...p,bio:e.target.value}))} placeholder="What are you passionate about?"/>
  </label>
  <div><p className="text-sm font-semibold text-slate-900">Campaigns to feature (up to six)</p>
   <p className="text-xs text-slate-600 mb-2">Choose campaigns you created or hearted/followed. Only active campaigns appear publicly.</p>
   <div className="max-h-52 overflow-y-auto space-y-1">{candidates.map(c=><label key={c.id} className="flex items-center gap-2 text-sm p-2 border rounded-lg text-slate-800">
    <input type="checkbox" checked={data.focus_campaign_ids.includes(c.id)} onChange={()=>toggle(c.id)}/><span className="min-w-0 truncate">{c.title}</span>
    <button type="button" className="text-xs text-blue-700 ml-auto" onClick={e=>{e.preventDefault();navigator.clipboard?.writeText(embedSnippet(c.id));setNotice("Embed snippet copied.");}} aria-label={`Copy embed for ${c.title}`}><Copy className="w-3.5 h-3.5"/></button>
   </label>)}</div>
  </div>
  <div className="flex gap-2"><Input value={paste} onChange={e=>setPaste(e.target.value)} placeholder="Paste an IFund campaign embed or link" aria-label="Paste campaign embed"/><Button type="button" onClick={pasteCampaign} variant="outline">Add</Button></div>
  <label className="block text-sm text-slate-800">Priority campaign
   <select value={data.priority_campaign_id||""} onChange={e=>setData(p=>({...p,priority_campaign_id:e.target.value}))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white text-slate-900 p-2">
    <option value="">No priority</option>{candidates.filter(c=>data.focus_campaign_ids.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
   </select>
  </label>
  {data.priority_campaign_id&&candidates.find(c=>c.id===data.priority_campaign_id)&&<div className="max-w-xs"><CampaignCard campaign={candidates.find(c=>c.id===data.priority_campaign_id)}/></div>}
  <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={data.show_posts} onChange={e=>setData(p=>({...p,show_posts:e.target.checked}))}/>Show my public IFund posts</label>
  <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={data.show_communities} onChange={e=>setData(p=>({...p,show_communities:e.target.checked}))}/>Show my community memberships</label>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
  <Button disabled={busy} onClick={submit}>Save public profile</Button>
 </section>;
}
