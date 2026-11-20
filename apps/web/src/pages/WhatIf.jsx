import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle, Compass, Lightbulb, Loader2, Plus, Sparkles } from "lucide-react";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { createMission, listMissions, loadMission, updateMission, listMissionTasks, addMissionTask, setMissionTaskState, listMissionPlans } from "@/api/missions";

const GUEST_KEY="ifund-whatif-provisional-v1";
const suggestions=["I need help with an unexpected expense.","I have an invention I want to bring to life.","I want to improve something in my community."];
const tasksFromPrompt=(prompt)=>[
  {title:"Define what a successful outcome would look like",description:"Write down your desired outcome and any non-negotiable constraints."},
  {title:"Identify existing support and possible resources",description:"Consider people, tools, assistance programs and services you may already have access to."},
  {title:"Estimate the remaining practical or financial gap",description:"Only after the needs are clearer, decide whether fundraising would help."}
];
function useGuestPrompt(){
 const [prompt,setPrompt]=useState(()=>{try{return sessionStorage.getItem(GUEST_KEY)||"";}catch{return "";}});
 useEffect(()=>{try{if(prompt)sessionStorage.setItem(GUEST_KEY,prompt);else sessionStorage.removeItem(GUEST_KEY);}catch{/* Browser privacy/storage restrictions must not block exploring. */}},[prompt]);
 return [prompt,setPrompt];
}
const label=(status)=>({draft:"Draft",planned:"Planned",in_progress:"In progress",completed:"Completed",archived:"Archived"})[status]||"Private";
const card="rounded-2xl border border-cyan-300/15 bg-slate-950/55 p-5 shadow-lg shadow-slate-950/10";
export default function WhatIf() {
 const { missionId }=useParams();
 const navigate=useNavigate();
 const session=useAuthSession();
 const confirmed=Boolean(session.user?.email_confirmed_at && !session.user?.is_anonymous);
 const [prompt,setPrompt]=useGuestPrompt();
 const [missions,setMissions]=useState([]);
 const [mission,setMission]=useState(null);
 const [missionTasks,setMissionTasks]=useState([]);
 const [plans,setPlans]=useState([]);
 const [newTask,setNewTask]=useState("");
 const [preview,setPreview]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loaded,setLoaded]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{
   let active=true;setError("");setLoaded(false);setMission(null);setMissionTasks([]);setPlans([]);
   if(!confirmed){setLoaded(true);return()=>{active=false;};}
   const client=authClient();
   const job=missionId
     ?Promise.all([loadMission(client,missionId),listMissionTasks(client,missionId),listMissionPlans(client,missionId)])
     :listMissions(client);
   job.then(result=>{
     if(!active)return;
     if(missionId){setMission(result[0]);setMissionTasks(result[1]);setPlans(result[2]);}
     else setMissions(result);
   }).catch(e=>{if(active)setError(e.message||"Unable to load your private Missions.");})
     .finally(()=>{if(active)setLoaded(true);});
   return()=>{active=false;};
 },[confirmed,missionId]);
 async function save(){
   if(inFlight.current||!prompt.trim())return;
   if(!confirmed){setPreview(true);setNotice("This is a private, provisional plan on this device. Sign in to save it to your account.");return;}
   inFlight.current=true;setBusy(true);setError("");setNotice("");
   try{
     const saved=await createMission(authClient(),{prompt,title:prompt.trim().replace(/\s+/g," ").slice(0,120)});
     setPrompt("");
     navigate("/missions/"+encodeURIComponent(saved.id));
   }catch(e){setError(e.message||"Could not save your Mission.");}
   finally{inFlight.current=false;setBusy(false);}
 }
 async function setStatus(nextStatus){
   if(!mission||inFlight.current)return;
   inFlight.current=true;setBusy(true);setError("");setNotice("");
   try{const updated=await updateMission(authClient(),mission.id,mission.revision,{status:nextStatus});setMission(updated);setNotice("Mission updated.");}
   catch(e){setError(e.message||"Unable to update Mission. Reload before retrying.");}
   finally{inFlight.current=false;setBusy(false);}
 }
 async function createTask(event){
   event.preventDefault();
   if(!mission||!newTask.trim()||inFlight.current)return;
   inFlight.current=true;setBusy(true);setError("");setNotice("");
   try{
     const task=await addMissionTask(authClient(),mission.id,{title:newTask});
     setMissionTasks(current=>[...current,task]);setNewTask("");setNotice("Task added.");
   }catch(e){setError(e.message||"Unable to add task.");}
   finally{inFlight.current=false;setBusy(false);}
 }
 async function toggleTask(task){
   if(inFlight.current)return;
   inFlight.current=true;setBusy(true);setError("");setNotice("");
   try{
     const updated=await setMissionTaskState(authClient(),mission.id,task.id,task.revision,task.state==="done"?"todo":"done");
     setMissionTasks(current=>current.map(t=>t.id===updated.id?updated:t));
   }catch(e){setError(e.message||"Unable to update task.");}
   finally{inFlight.current=false;setBusy(false);}
 }
 const previewTasks=tasksFromPrompt(prompt);
 return <main className="relative mx-auto min-h-[75vh] max-w-5xl space-y-6 px-4 py-7 text-slate-100 sm:px-6 sm:py-12">
   <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 rounded-full bg-cyan-500/10 blur-3xl"/>
   <header className="space-y-3 text-center">
     <p className="text-xs font-semibold uppercase tracking-[.28em] text-cyan-300">Interplanetary Fund · What If? Engine</p>
     <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">What if<span className="text-cyan-300">?</span></h1>
     <p className="mx-auto max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">A dream, a challenge, an idea or a cause. Start privately, explore what could help, and choose whether fundraising belongs in your plan.</p>
     <nav aria-label="Mission navigation" className="flex flex-wrap justify-center gap-3 text-sm">
       <Link to="/what-if" className="rounded-full border border-cyan-300/30 px-4 py-2 hover:bg-cyan-500/10">New possibility</Link>
       <Link to="/missions" className="rounded-full border border-cyan-300/30 px-4 py-2 hover:bg-cyan-500/10">My Missions</Link>
       <Link to="/create?manual=1" className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10">Manual fundraiser editor</Link>
     </nav>
   </header>
   {error&&<p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm">{error}</p>}
   {notice&&<p role="status" className="rounded-xl border border-cyan-400/35 bg-cyan-950/25 px-4 py-3 text-sm">{notice}</p>}
   {!loaded&&<div role="status" className="flex justify-center gap-2 py-12"><Loader2 className="animate-spin"/>Loading private workspace…</div>}
   {loaded&&missionId&&mission&&<section className="space-y-5">
     <div className={card}>
       <p className="mb-2 text-xs font-medium uppercase tracking-widest text-cyan-300">Private Mission · {label(mission.status)}</p>
       <h2 className="break-words text-2xl font-bold">{mission.title||"New possibility"}</h2>
       <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{mission.original_prompt}</p>
       {mission.summary&&<p className="mt-3 text-sm">{mission.summary}</p>}
       <div className="mt-4 flex flex-wrap gap-2">
         {mission.status==="draft"&&<button disabled={busy} onClick={()=>setStatus("planned")} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Start planning</button>}
         {mission.status==="planned"&&<button disabled={busy} onClick={()=>setStatus("in_progress")} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Begin Mission</button>}
         {mission.status==="in_progress"&&<button disabled={busy} onClick={()=>setStatus("completed")} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Mark complete</button>}
         {mission.status!=="archived"&&<button disabled={busy} onClick={()=>setStatus("archived")} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50">Archive</button>}
         {mission.status==="archived"&&<button disabled={busy} onClick={()=>setStatus("draft")} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50">Reopen</button>}
       </div>
     </div>
     <div className={card}>
       <div className="flex items-center gap-2"><Compass className="h-5 w-5 text-cyan-300"/><h2 className="text-xl font-semibold">Action plan</h2></div>
       {plans.length? <p className="mt-3 text-sm text-slate-300">Saved plan version {plans[0].version}. Review suggested actions before taking any external steps.</p>:
        <p className="mt-3 text-sm text-slate-300">Your private Mission is saved. Add tasks here to shape your plan. AI-generated plans will require your approval and a verified inference service; no external outreach happens automatically.</p>}
       <div className="mt-4 space-y-2">{missionTasks.map(t=><button type="button" key={t.id} disabled={busy} onClick={()=>toggleTask(t)} className="flex w-full items-start gap-3 rounded-xl border border-white/10 p-3 text-left text-sm hover:bg-white/5 disabled:opacity-60">
         {t.state==="done"?<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/>:<Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"/>}
         <span className={t.state==="done"?"text-slate-400 line-through":"text-slate-100"}>{t.title}</span>
       </button>)}</div>
       <form onSubmit={createTask} className="mt-4 flex flex-wrap gap-2">
         <input aria-label="New task" maxLength={240} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add your next step…" className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-400"/>
         <button disabled={busy||!newTask.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"><Plus size={17}/>Add</button>
       </form>
     </div>
     <div className={card}>
       <h2 className="font-semibold">Fundraising is optional</h2>
       <p className="mt-2 text-sm text-slate-300">Your Mission can progress without fundraising. If a campaign would help, use the existing editor to write and review a separate fundraiser. This action does not publish anything.</p>
       <Link to="/create?manual=1" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-300/35 px-4 py-3 text-sm text-cyan-100 hover:bg-cyan-500/10">Prepare a fundraiser <ArrowRight size={16}/></Link>
     </div>
   </section>}
   {loaded&&!missionId&&<section className="space-y-6">
     <div className={card}>
       <label htmlFor="what-if-prompt" className="mb-3 flex items-center gap-2 text-base font-semibold"><Lightbulb className="h-5 w-5 text-cyan-300"/> What would you like to make possible?</label>
       <textarea id="what-if-prompt" rows={4} maxLength={12000} value={prompt} onChange={e=>{setPrompt(e.target.value);setPreview(false);}} placeholder="Tell iFund about a dream, a need, or a project…" className="w-full resize-y rounded-xl border border-white/20 bg-slate-900/90 p-4 text-base text-slate-100 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none"/>
       <div className="mt-3 flex flex-wrap gap-2">{suggestions.map(s=><button type="button" key={s} onClick={()=>{setPrompt(s);setPreview(false);}} className="rounded-full border border-white/20 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-300/60">{s}</button>)}</div>
       <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
         <p className="text-xs text-slate-400">Private by default · Nothing publishes automatically</p>
         <div className="flex flex-wrap gap-2">
           <button type="button" disabled={!prompt.trim()||busy} onClick={()=>setPreview(true)} className="rounded-xl border border-cyan-300/40 px-4 py-3 font-semibold text-cyan-100 disabled:opacity-50">Explore privately</button>
           <button type="button" disabled={!prompt.trim()||busy} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}Save Mission</button>
         </div>
       </div>
     </div>
     {preview&&prompt.trim()&&<div className={card}>
       <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Provisional starting plan · Not researched or verified</p>
       <p className="mt-3 whitespace-pre-wrap break-words text-sm">{prompt}</p>
       <h2 className="mt-5 text-lg font-bold">Three ways to begin</h2>
       <ol className="mt-3 space-y-3">{previewTasks.map((t,i)=><li key={t.title} className="rounded-xl border border-white/10 p-3 text-sm"><strong>{i+1}. {t.title}</strong><p className="mt-1 text-slate-300">{t.description}</p></li>)}</ol>
       {!confirmed&&<Link className="mt-5 inline-flex rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950" to="/register?returnTo=%2Fwhat-if">Create an account to save privately</Link>}
       <p className="mt-3 text-xs text-slate-400">These are generic starting points, not verified grants, funding promises, or an AI-generated plan.</p>
     </div>}
     {confirmed&&<div className={card}>
       <h2 className="text-lg font-bold">Your saved Missions</h2>
       {!missions.length?<p className="mt-2 text-sm text-slate-300">No saved Missions yet. Describe your first possibility above.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2">{missions.map(m=><Link key={m.id} className="rounded-xl border border-white/15 p-4 hover:border-cyan-300/40" to={"/missions/"+m.id}><span className="text-xs text-cyan-300">{label(m.status)} · Private</span><h3 className="mt-1 break-words font-semibold">{m.title||m.original_prompt.slice(0,120)}</h3><ArrowRight className="mt-3 h-4 w-4"/></Link>)}</div>}
     </div>}
   </section>}
 </main>;
}