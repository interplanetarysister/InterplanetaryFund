import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Compass, LockKeyhole, Orbit, Sparkles, HeartHandshake } from "lucide-react";
import { authClient } from "@/api/auth";
import { createMission, exploreMission } from "@/api/missions";
import { useAuthSession } from "@/hooks/useAuthSession";

const PENDING_KEY="ifund-what-if-guest-explicit-handoff-v1";
const EXAMPLES=[
 "I need help making reliable transportation possible for my family.",
 "I'd like to start a community garden with neighbors.",
 "I have an invention idea, but I don't know where to start."
];
function restore(){
 try{
  const raw=sessionStorage.getItem(PENDING_KEY);
  if(!raw)return "";
  const data=JSON.parse(raw);
  if(data?.version!==1||typeof data.prompt!=="string"||data.prompt.length>12000||
    Date.now()-data.at>24*60*60*1000||Date.now()<data.at)return "";
  return data.prompt;
 }catch{return "";}
}
export default function WhatIfStart(){
 const navigate=useNavigate();
 const location=useLocation();
 const session=useAuthSession();
 const [prompt,setPrompt]=useState(()=>{
   const transferred=location.state?.prompt;
   return typeof transferred==="string"&&transferred.length<=12000&&transferred.trim()
     ? transferred : restore();
 });
 const [preview,setPreview]=useState(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState("");
 const [accountNeeded,setAccountNeeded]=useState(false);
 const [handoffWarning,setHandoffWarning]=useState("");
 const signedIn=session.status==="signed-in"&&
   session.user?.is_anonymous!==true&&Boolean(session.user?.email_confirmed_at);
 function update(value){setPrompt(value);setPreview(null);setError("");setAccountNeeded(false);}
 function retainExplicitly(){
  try{
   sessionStorage.setItem(PENDING_KEY,JSON.stringify({version:1,at:Date.now(),prompt}));
   setHandoffWarning("Idea kept temporarily in this browser tab for sign-in. It is not saved to an iFund account yet.");
  }catch{
   setHandoffWarning("Browser storage was unavailable. Copy your idea before signing in; it has not been saved.");
  }
 }
 async function explore(){
  if(!prompt.trim()||busy)return;
  setBusy("explore");setError("");setPreview(null);
  try{
    const p=await exploreMission(prompt);
    setPreview(p);
  }catch(cause){setError(cause.message||"The preview is unavailable. You can still save a private Mission.");}
  finally{setBusy("");}
 }
 async function save(){
  if(!prompt.trim()||busy)return;
  if(!signedIn){
   retainExplicitly();
   setAccountNeeded(true);
   return;
  }
  setBusy("save");setError("");
  try{
    const client=authClient();
    const title=prompt.trim().split(/[.!?\n]/u)[0].trim().slice(0,100);
    const mission=await createMission(client,{prompt,title:title||"My Mission",summary:""});
    try{
      const raw=sessionStorage.getItem(PENDING_KEY);
      if(raw&&JSON.parse(raw)?.prompt===prompt)sessionStorage.removeItem(PENDING_KEY);
    }catch{/* Saved account copy remains authoritative. */}
    navigate("/missions/"+encodeURIComponent(mission.id),{replace:true});
  }catch(cause){setError(cause.message||"Unable to save privately. Your text is still here.");}
  finally{setBusy("");}
 }
 return <main className="relative mx-auto max-w-6xl space-y-9 px-4 py-8 sm:px-8 sm:py-12" aria-label="What If? Mission creation">
   <section className="relative overflow-hidden rounded-[2rem] border border-cyan-500/20 bg-slate-950 px-5 py-10 text-white shadow-2xl sm:px-12 sm:py-16" style={{backgroundImage:"radial-gradient(ellipse at 16% 5%,rgba(23,204,226,.19),transparent 43%),radial-gradient(ellipse at 88% 78%,rgba(178,82,226,.19),transparent 46%),repeating-linear-gradient(110deg,transparent,transparent 74px,rgba(170,210,255,.025) 75px,transparent 76px)"}}>
     <div className="relative mx-auto max-w-3xl space-y-6">
       <div className="flex items-center gap-3 text-xs uppercase tracking-[.24em] text-cyan-200"><Orbit size={22} aria-hidden="true"/> Interplanetary Fund</div>
       <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-7xl">What if<span className="text-cyan-300">?</span></h1>
       <p className="max-w-xl text-lg leading-relaxed text-slate-200 sm:text-xl">Every dream, challenge, and possibility deserves a place to begin. Tell us what you want to make possible.</p>
       <form onSubmit={e=>{e.preventDefault();void explore();}} className="space-y-4 rounded-3xl border border-white/15 bg-white/[.07] p-4 backdrop-blur-sm sm:p-5">
         <label htmlFor="what-if-prompt" className="block text-sm font-medium text-white">Your idea, in your own words</label>
         <textarea id="what-if-prompt" autoFocus value={prompt} onChange={e=>update(e.target.value)} maxLength={12000} rows={5}
           className="w-full resize-y rounded-2xl border border-white/20 bg-slate-950/60 p-4 text-base leading-relaxed text-white placeholder-slate-400 outline-offset-4 focus-visible:ring-2 focus-visible:ring-cyan-400" placeholder="I want to… I need help with… What if we could…" />
         <p className="text-xs text-slate-300">You don't need a fundraising goal or a perfect story. New Missions are private by default.</p>
         <div className="flex flex-wrap items-center gap-3">
           <button type="submit" disabled={!prompt.trim()||!!busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">
             <Compass size={19} aria-hidden="true"/> {busy==="explore"?"Exploring…":"Explore possibilities"}
           </button>
           <button type="button" onClick={save} disabled={!prompt.trim()||!!busy||session.status==="loading"} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/25 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50">
             <LockKeyhole size={18} aria-hidden="true"/> {busy==="save"?"Saving…":"Save private Mission"}
           </button>
         </div>
       </form>
       {accountNeeded&&<div className="space-y-3 rounded-2xl border border-cyan-400/40 bg-slate-900 p-4" role="status">
         <p className="text-sm">A verified iFund account is needed to save your Mission securely. Your idea has not been sent to your account.</p>
         {handoffWarning&&<p className="text-xs text-slate-300">{handoffWarning}</p>}
         <div className="flex flex-wrap gap-3"><Link className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950" to="/register?returnTo=%2Fwhat-if">Create free account</Link>
           <Link className="rounded-xl border border-white/20 px-4 py-3 text-sm" to="/login?returnTo=%2Fwhat-if">Sign in</Link></div>
       </div>}
       {error&&<p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-950/40 p-3 text-sm text-amber-100">{error}</p>}
       {preview&&<section className="space-y-4 rounded-2xl border border-cyan-300/25 bg-slate-900/90 p-5" aria-label="Provisional planning preview">
         <div className="flex items-center gap-2 text-cyan-200"><Sparkles size={19} aria-hidden="true"/><h2 className="font-semibold">A starting point</h2></div>
         <p className="text-sm text-slate-200">{preview.understood}</p>
         <div className="grid gap-3 sm:grid-cols-3">{preview.pathways.map(p=><article key={p.kind} className="rounded-xl border border-white/15 p-3"><h3 className="text-sm font-semibold">{p.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">{p.next_step}</p></article>)}</div>
         <p className="text-xs text-slate-300">This is an unresearched planning preview. No sponsor, aid program, donation, or external action has been verified.</p>
         <button type="button" onClick={save} disabled={!!busy} className="min-h-11 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950">Make this a private Mission <ArrowRight className="ml-1 inline" size={17}/></button>
       </section>}
     </div>
   </section>
   <section aria-label="Example ideas" className="space-y-4">
     <h2 className="text-lg font-semibold">Not sure where to begin?</h2>
     <div className="grid gap-3 md:grid-cols-3">{EXAMPLES.map(example=><button key={example} type="button" onClick={()=>update(example)} className="min-h-24 rounded-2xl border border-border bg-card p-5 text-left text-sm leading-relaxed shadow-sm transition hover:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-500">{example}</button>)}</div>
   </section>
   <div className="flex flex-wrap items-center gap-5 text-sm">
     <Link className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline" to="/missions">My private Missions <ArrowRight size={16}/></Link>
     <Link className="inline-flex items-center gap-2 text-muted-foreground underline-offset-4 hover:underline" to="/create?manual=1"><HeartHandshake size={16}/> Prefer the existing campaign editor?</Link>
   </div>
 </main>;
}