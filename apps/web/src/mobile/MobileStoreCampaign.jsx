import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Share2, Flag, EyeOff, Bookmark } from "lucide-react";
import { getCampaignDetail } from "@/api/publicData";
import { authClient } from "@/api/auth";
import { shareWithDevice } from "@/lib/nativeApi.js";
import { useAuthSession } from "@/hooks/useAuthSession";
import { blockOrganizer, blockedOrganizerIds, verifiedOrganizersForCampaigns } from "@/mobile/organizerBlock";
import { savedCampaignIds, setCampaignSaved } from "@/mobile/savedCampaigns";

const ORIGIN="https://interplanetaryfund.com";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validImage = raw=>typeof raw==="string" && /^https:\/\/[^\s]+$/i.test(raw)?raw:null;

export default function MobileStoreCampaign() {
  const {id}=useParams();
  const {user,status:sessionStatus}=useAuthSession();
  const [organizerId,setOrganizerId]=useState(null);
  const [safety,setSafety]=useState("loading");
  const [organizerBlocked,setOrganizerBlocked]=useState(false);
  const [safetyRetry,setSafetyRetry]=useState(0);
  const [blockBusy,setBlockBusy]=useState(false);
  const [saved,setSaved]=useState(()=>savedCampaignIds().includes(id));
  const navigate=useNavigate();
  const [campaign,setCampaign]=useState(null),[phase,setPhase]=useState("loading"),[error,setError]=useState("");
  const [notice,setNotice]=useState(""),[reporting,setReporting]=useState(false),[reason,setReason]=useState("");
  const [reportBusy,setReportBusy]=useState(false);
  useEffect(()=>{
    if(!UUID.test(id||"")){setPhase("missing");return;}
    let live=true;setPhase("loading");setError("");
    getCampaignDetail(id).then(data=>{if(live){setCampaign(data);setPhase(data?"ready":"missing");}}).catch(e=>{if(live){setPhase("error");setError(e.message||"Could not load this campaign.");}});
    return ()=>{live=false;};
  },[id]);

  useEffect(()=>{
    let active=true;
    setOrganizerId(null);
    setOrganizerBlocked(false);
    setSafety("loading");
    if(sessionStatus==="loading")return()=>{active=false;};
    if(!user?.id||user?.is_anonymous){
      setSafety("ready");return()=>{active=false;};
    }
    if(!UUID.test(id||"")){setSafety("ready");return()=>{active=false;};
    Promise.all([
      verifiedOrganizersForCampaigns([id]),
      blockedOrganizerIds(),
    ]).then(([owners,blocked])=>{
      if(!active)return;
      const owner=owners.get(id)||null;
      setOrganizerId(owner);
      setOrganizerBlocked(Boolean(owner&&blocked.includes(owner)));
      setSafety("ready");
    }).catch(()=>{
      // Never reveal a known-blocked organizer on a failed safety lookup.
      if(active){setOrganizerId(null);setSafety("error");}
    });
    return()=>{active=false;};
  },[id,user?.id,user?.is_anonymous,sessionStatus,safetyRetry]);

  async function blockAuthor(){
    if(!user?.id||!organizerId||blockBusy)return;
    setNotice("");setBlockBusy(true);
    try{
      await blockOrganizer(organizerId);
      setOrganizerBlocked(true);
      navigate("/discover",{replace:true});
    }catch(cause){
      setNotice(cause?.message||"Organizer blocking could not be verified.");
    }finally{setBlockBusy(false);}
  }

  useEffect(()=>setSaved(savedCampaignIds().includes(id)),[id]);
  function bookmark(){
    try{
      setSaved(setCampaignSaved(id,!saved));
      setNotice(saved?"Removed from saved campaigns.":"Saved a link on this device.");
    }catch{setNotice("This device could not save the campaign link.");}
  }
  const shareUrl=ORIGIN+"/campaign/"+encodeURIComponent(String(id||""));
  async function share(){
    setNotice("");
    try{
      await shareWithDevice({title:campaign.title,text:campaign.summary||"Explore this campaign",url:shareUrl});
    }catch(e){
      if(e?.name==="AbortError"||/cancel/i.test(String(e?.message||"")))return;
      try{await navigator.clipboard.writeText(shareUrl);setNotice("Campaign link copied.");}
      catch{setNotice("Sharing is unavailable on this device.");}
    }
  }
  function block(){
    try{
      const previous=JSON.parse(localStorage.getItem("ifund-mobile-hidden-campaigns")||"[]");
      const clean=Array.isArray(previous)?previous.filter(x=>UUID.test(x)).slice(-99):[];
      localStorage.setItem("ifund-mobile-hidden-campaigns",JSON.stringify([...new Set([...clean,id])]));
    }catch{}
    navigate("/discover");
  }
  async function report(event){
    event.preventDefault();setNotice("");
    if(!UUID.test(id||"")||reason.trim().length<15||reason.trim().length>1500){
      setNotice("Describe the problem in 15–1500 characters.");return;
    }
    setReportBusy(true);
    try{
      const client=authClient();
      const {data:auth,error:authIssue}=await client.auth.getUser();
      if(authIssue||!auth?.user?.id){setNotice("Sign in before submitting a report.");return;}
      const {data,error:issue}=await client.rpc("ifund_create_support_ticket",{
        p_subject:"Campaign content report",
        p_message:"Campaign: "+shareUrl+"\nReason: "+reason.trim(),
      });
      if(issue||!Array.isArray(data)||!data[0]?.ticket_id)throw new Error(issue?.message||"Report could not be recorded.");
      setNotice("Report received for review. Reference: "+data[0].ticket_id);
      setReporting(false);setReason("");
    }catch(e){setNotice(e.message||"Report could not be recorded. Please contact IFund.");}
    finally{setReportBusy(false);}
  }
  if(phase==="ready" && (sessionStatus==="loading" || safety==="loading"))
    return <p role="status" className="py-10">Applying your account safety preferences…</p>;
  if(phase==="ready" && safety==="error")
    return <section role="alert" className="space-y-4 rounded-xl border border-amber-300/40 p-6">
      <h1 className="text-xl font-bold">Campaign safety check unavailable</h1>
      <p>IFund could not verify your organizer block settings. This campaign is hidden until your settings can be checked.</p>
      <button type="button" onClick={()=>setSafetyRetry(n=>n+1)} className="min-h-11 rounded-lg border border-white/30 px-4">Retry safety check</button>
      <Link to="/discover" className="block text-emerald-200 underline">Return to Explore</Link>
    </section>;
  if(phase==="ready" && organizerBlocked)
    return <section role="status" className="space-y-4 rounded-xl border border-white/20 p-6">
      <h1 className="text-xl font-bold">This organizer is blocked</h1>
      <p className="text-sm text-slate-300">You chose not to see content from this organizer. Manage blocked organizers in your account on any signed-in device.</p>
      <Link to="/account" className="inline-flex min-h-11 items-center rounded-lg border border-emerald-300/30 px-4 text-sm">Manage blocked organizers</Link>
    </section>;
  if(phase==="loading")return <p role="status" className="py-10">Loading published campaign…</p>;
  if(phase==="missing")return <div className="space-y-4 py-8"><h1 className="text-2xl font-bold">Campaign unavailable</h1><p>This campaign isn't published or could not be found.</p><Link to="/discover" className="underline">Explore campaigns</Link></div>;
  if(phase==="error")return <div className="space-y-4 py-8" role="alert"><h1 className="text-2xl font-bold">Campaign couldn't be loaded</h1><p>{error}</p><Link to="/discover" className="underline">Explore campaigns</Link></div>;
  return <article className="space-y-6">
    <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 text-sm text-emerald-200 underline"><ArrowLeft aria-hidden="true" className="h-4 w-4"/> Back to campaigns</Link>
    {validImage(campaign.cover_image_url)&&<img src={validImage(campaign.cover_image_url)} alt="" className="max-h-96 w-full rounded-2xl object-cover" referrerPolicy="no-referrer"/>}
    <header className="space-y-3">
      <p className="text-xs uppercase tracking-[.2em] text-emerald-200">{campaign.category||"Fundraising"}</p>
      <h1 className="text-3xl font-bold">{campaign.title}</h1>
      <p className="text-base leading-7 text-slate-200">{campaign.summary}</p>
      {campaign.location&&<p className="text-sm text-slate-300">Campaign location: {campaign.location}</p>}
      {campaign.raised_amount!==null&&Number.isFinite(Number(campaign.raised_amount))&&<p className="rounded-lg border border-emerald-300/30 p-3 text-sm">Provider-verified funding: {Number(campaign.raised_amount).toLocaleString("en-US",{style:"currency",currency:"USD"})}</p>}
    </header>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={share} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-200 px-5 text-sm font-bold text-slate-950"><Share2 aria-hidden="true" className="h-5 w-5"/> Share campaign</button>
      <button type="button" onClick={bookmark} aria-pressed={saved} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-300/40 px-4 text-sm"><Bookmark aria-hidden="true" className="h-4 w-4"/>{saved?"Saved":"Save campaign"}</button>
      <button type="button" onClick={()=>setReporting(x=>!x)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm"><Flag aria-hidden="true" className="h-4 w-4"/> Report content</button>
      <button type="button" onClick={block} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm"><EyeOff aria-hidden="true" className="h-4 w-4"/> Hide campaign</button>
      {user?.id&&organizerId&&organizerId!==user.id&&<button type="button" onClick={blockAuthor} disabled={blockBusy} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-rose-300/40 px-4 text-sm"><EyeOff aria-hidden="true" className="h-4 w-4"/> {blockBusy?"Blocking…":"Block organizer"}</button>}
    </div>
    {notice&&<p role="status" aria-live="polite" className="rounded-xl border border-emerald-300/30 p-4 text-sm">{notice}</p>}
    {reporting&&<form onSubmit={report} className="space-y-3 rounded-2xl border border-amber-300/30 p-5">
      <h2 className="text-lg font-bold">Report this campaign</h2>
      <p className="text-sm text-slate-300">IFund reviews reports concerning misleading, abusive, unsafe or infringing content. You must be signed in to file a tracked report.</p>
      <label className="block text-sm font-semibold" htmlFor="report-details">What is the concern?</label>
      <textarea id="report-details" value={reason} onChange={e=>setReason(e.target.value)} required minLength={15} maxLength={1500} className="min-h-28 w-full rounded-lg border border-white/30 bg-white/10 p-3 text-white"/>
      <button type="submit" disabled={reportBusy} className="min-h-11 rounded-lg bg-amber-200 px-4 text-sm font-bold text-slate-950 disabled:opacity-60">{reportBusy?"Submitting…":"Submit report"}</button>
      <Link to={"/login?returnTo="+encodeURIComponent("/campaign/"+id)} className="ml-3 text-sm underline">Sign in</Link>
    </form>}
    {campaign.story&&<section aria-label="Campaign story" className="space-y-3"><h2 className="text-xl font-bold">The story</h2><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{campaign.story}</p></section>}
    <section className="rounded-xl border border-cyan-300/20 bg-white/5 p-4 text-xs leading-6 text-slate-300">
      This app provides campaign information and native sharing; it does not collect donations, process financial gifts, or sell digital subscriptions. Campaign descriptions are organizer-supplied and not independently verified.
    </section>
  </article>;
}
