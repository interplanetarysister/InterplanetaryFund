import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, BrainCircuit, CheckCircle2, Circle, LockKeyhole, Orbit, Plus, RefreshCcw, Save, Sparkles } from "lucide-react";
import { authClient } from "@/api/auth";
import MissionBudget from "@/components/missions/MissionBudget";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
 loadMission,listMissionPlans,listMissionTasks,listMissionCampaignLinks,
 addMissionTask,setMissionTaskState,saveReviewedMissionPlan,suggestMissionPlan,
 updateMission,getMissionIntegrationStatus,listVerifiedMissionResources,bookmarkMissionResource
} from "@/api/missions";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500";
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";
const starterPlan=m=>({
 summary:m.desired_outcome||m.summary||"An initial private plan for: "+(m.title||m.original_prompt.slice(0,120)),
 steps:[
  {title:"Define what success looks like",detail:"Write down the result you want and the most important constraints.",agent:"polaris"},
  {title:"Identify existing resources",detail:"List the people, supplies, knowledge, or support already available. Nothing here is a confirmed external offer.",agent:"discover"},
  {title:"Research realistic options",detail:"Investigate potential assistance or collaborators before deciding whether financial support is needed.",agent:"pulse"},
  {title:"Choose your first next action",detail:"Pick one achievable task and make progress at your own pace.",agent:"nexus"}
 ],
 funding:{suggested:false,required:false,estimated_goal_minor:null,currency:"USD",verified_amount_minor:null},
 evidence:{status:"suggested_unverified",external_sources_checked:0,provider_offers_confirmed:0},
 source:"owner_template",external_actions_performed:false
});
export default function MissionWorkspace(){
 const {id}=useParams(),session=useAuthSession(),owner=session.user?.id||null;
 const [phase,setPhase]=useState("loading"),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [mission,setMission]=useState(null),[plans,setPlans]=useState([]),[tasks,setTasks]=useState([]),
       [links,setLinks]=useState([]),[integration,setIntegration]=useState(null);
 const [resources,setResources]=useState([]),[resourceError,setResourceError]=useState("");
 const [proposal,setProposal]=useState(null),[busy,setBusy]=useState("");
 const [newTask,setNewTask]=useState(""),[titleDraft,setTitleDraft]=useState("");
 const [refresh,setRefresh]=useState(0);
 const proposalRequest=useRef(null),active=useRef(true);
 const load=useCallback(async()=>{
  if(!UUID.test(id||""))throw Error("Invalid Mission reference.");
  const client=authClient();
  const [m,p,t,l,integrations,catalog]=await Promise.all([
    loadMission(client,id),listMissionPlans(client,id),listMissionTasks(client,id),
    listMissionCampaignLinks(client,id),getMissionIntegrationStatus(client,id),
    listVerifiedMissionResources(client).then(items=>({items})).catch(()=>({error:true}))
  ]);
  if(!active.current)return;
  if(m.owner_id!==owner)throw Error("That Mission belongs to a different account.");
  setMission(m);setPlans(p);setTasks(t);setLinks(l);setIntegration(integrations);
  setResources(catalog.items||[]);
  setResourceError(catalog.error?"Potential resource links are temporarily unavailable. Your Mission is unaffected.":"");
  setTitleDraft(m.title||"");setPhase("ready");
 },[id,owner]);
 useEffect(()=>{
  active.current=true;
  setMission(null);setPlans([]);setTasks([]);setLinks([]);setProposal(null);setIntegration(null);
  setResources([]);setResourceError("");
  setError("");setNotice("");setPhase("loading");
  if(session.status==="loading")return()=>{active.current=false;};
  if(!owner||session.user?.is_anonymous===true){setPhase("error");setError("Sign in to open your private Mission.");return()=>{active.current=false;};}
  load().catch(cause=>{if(active.current){setError(cause.message||"Mission could not be loaded.");setPhase("error");}});
  return()=>{active.current=false;};
 },[id,owner,session.status,refresh,load]);
 const ready=phase==="ready"&&mission?.owner_id===owner;
 const refreshData=async()=>{await load();};
 const editProposal=(updater)=>{
  setProposal(current=>updater(current));
  proposalRequest.current=crypto.randomUUID();
  setNotice("");
 };
 function createStarter(){
  if(!ready)return;
  proposalRequest.current=crypto.randomUUID();
  setProposal(starterPlan(mission));setNotice("This is an editable starter worksheet, not an AI-generated or researched plan.");
  setError("");
 }
 async function generate(){
  if(!ready||busy)return;
  setBusy("ai");setError("");setNotice("");
  try{
    const result=await suggestMissionPlan(authClient(),mission.id,mission.revision);
    proposalRequest.current=crypto.randomUUID();setProposal(result);
    setNotice("Review and edit the AI suggestion before saving. Sources, grants and resources have not been verified.");
  }catch(cause){setError(cause.message||"AI planning unavailable; you can use a starter plan instead.");}
  finally{setBusy("");}
 }
 async function savePlan(){
  if(!ready||!proposal||busy)return;
  setBusy("plan");setError("");setNotice("");
  try{
    if(!proposalRequest.current)proposalRequest.current=crypto.randomUUID();
    await saveReviewedMissionPlan(authClient(),mission.id,mission.revision,proposal,{requestId:proposalRequest.current});
    setProposal(null);proposalRequest.current=null;
    await refreshData();
    setNotice("Your reviewed plan was saved privately, and its initial steps are now available as tasks.");
  }catch(cause){setError(cause.message||"The plan was not confirmed. It remains in this editor.");}
  finally{setBusy("");}
 }
 async function bookmarkResource(item){
  if(!ready||busy)return;
  setBusy("resource");setError("");setNotice("");
  try{
   await bookmarkMissionResource(authClient(),mission.id,item.id);
   await refreshData();
   setNotice("Saved as a possible resource. Eligibility, funding and provider permissions are not confirmed.");
  }catch(cause){setError(cause.message||"Resource could not be saved.");}
  finally{setBusy("");}
 }
 async function updateTitle(){
  if(!ready||busy||!titleDraft.trim()||titleDraft===mission.title)return;
  setBusy("title");setError("");
  try{
   await updateMission(authClient(),mission.id,mission.revision,{title:titleDraft});
   await refreshData();setNotice("Mission title saved.");
  }catch(cause){setError(cause.message||"Title update failed.");}
  finally{setBusy("");}
 }
 async function setStatus(value){
  if(!ready||busy)return;
  setBusy("status");setError("");
  try{await updateMission(authClient(),mission.id,mission.revision,{status:value});await refreshData();setNotice("Mission status saved.");}
  catch(cause){setError(cause.message||"Status update failed.");}
  finally{setBusy("");}
 }
 async function addTask(e){
  e.preventDefault();
  if(!ready||busy||!newTask.trim())return;
  setBusy("task");setError("");
  try{await addMissionTask(authClient(),mission.id,{title:newTask});setNewTask("");await refreshData();setNotice("Task saved.");}
  catch(cause){setError(cause.message||"Task save failed.");}
  finally{setBusy("");}
 }
 async function toggleTask(task){
  if(!ready||busy)return;
  setBusy(task.id);setError("");
  try{
   await setMissionTaskState(authClient(),mission.id,task.id,task.revision,task.state==="done"?"todo":"done");
   await refreshData();setNotice("Task progress saved.");
  }catch(cause){setError(cause.message||"Task update failed.");}
  finally{setBusy("");}
 }
 if(phase==="loading"||session.status==="loading")return <main className="mx-auto max-w-5xl px-5 py-10" role="status">Opening your private Mission…</main>;
 if(!ready)return <main className="mx-auto max-w-4xl space-y-4 px-5 py-10" role="alert">
  <h1 className="text-2xl font-semibold">Mission unavailable</h1><p>{error||"You don't have access to this Mission."}</p>
  <button type="button" className={button} onClick={()=>setRefresh(r=>r+1)}><RefreshCcw size={16}/> Try again</button>
  <Link className="ml-3 underline" to="/missions">My Missions</Link>
 </main>;
 const current=plans[0]?.structured_plan||null,done=tasks.filter(t=>t.state==="done").length;
 return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-8">
  <nav aria-label="Mission breadcrumbs" className="flex items-center gap-3 text-sm text-muted-foreground">
   <Link to="/missions" className="underline-offset-4 hover:underline">My Missions</Link><ArrowRight size={15} aria-hidden="true"/><span className="truncate">Private workspace</span>
  </nav>
  <header className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white sm:p-9">
    <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-cyan-200"><Orbit size={18}/> Private Mission workspace · <LockKeyhole size={14}/> Private</p>
    <label htmlFor="mission-title" className="block text-sm font-medium text-slate-200">Mission title</label>
    <div className="mt-2 flex flex-wrap items-center gap-2">
     <input id="mission-title" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950/70 px-4 text-lg font-semibold text-white focus-visible:ring-2 focus-visible:ring-cyan-400"
      value={titleDraft} onChange={e=>setTitleDraft(e.target.value)} maxLength={160}/>
     <button className="min-h-12 rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-50" type="button" disabled={!!busy||!titleDraft.trim()||titleDraft===mission.title} onClick={updateTitle}><Save size={17} className="mr-2 inline"/> Save</button>
    </div>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{mission.original_prompt}</p>
    <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-300"><span className="rounded-full border border-white/20 px-3 py-1 capitalize">{mission.status.replaceAll("_"," ")}</span><span>{done} of {tasks.length} tasks completed</span><span>Saved plan</span></div>
  </header>
  {error&&<div role="alert" className="rounded-xl border border-rose-400/40 bg-rose-950/10 p-4 text-sm text-rose-600 dark:text-rose-200">{error}</div>}
  {notice&&<p role="status" className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-4 text-sm">{notice}</p>}
  <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
   <div className="space-y-5">
    <article className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7">
     <h2 className="flex items-center gap-2 text-xl font-semibold"><BrainCircuit size={22} aria-hidden="true"/> Your action plan</h2>
     {current?<><p className="text-sm leading-relaxed text-muted-foreground">{current.summary}</p>
       <p className="text-xs text-muted-foreground">Saved plan · Owner-reviewed. Opportunities remain unverified until supported by external evidence.</p>
       <div className="space-y-3">{(Array.isArray(current.steps)?current.steps:[]).map((step,i)=><div key={step.id||i} className="rounded-xl border border-border p-4">
        <div className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i+1}</span>
          <div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm text-muted-foreground">{step.detail||""}</p></div></div>
       </div>)}</div>
      </>:<p className="text-sm text-muted-foreground">No plan saved yet. Start with a simple worksheet or request an AI suggestion if enabled on this environment.</p>}
     <div className="flex flex-wrap gap-3">
      <button type="button" onClick={createStarter} disabled={!!busy} className={button}><Plus size={17}/> {current?"Create revised worksheet":"Create starter plan"}</button>
      <button type="button" onClick={generate} disabled={!!busy} className={button}><Sparkles size={17}/> {busy==="ai"?"Planning…":"Ask NEXUS to suggest a plan"}</button>
     </div>
    </article>
    {proposal&&<article className="space-y-4 rounded-2xl border border-cyan-400/40 bg-card p-5 sm:p-7" aria-label="Review proposed plan">
      <h2 className="text-xl font-semibold">Review before saving</h2>
      <p className="text-xs text-muted-foreground">This worksheet hasn't been saved yet. Editing it does not trigger external actions or make proposed assistance verified.</p>
      <label className="block space-y-2 text-sm font-medium">Plan summary
       <textarea value={proposal.summary} maxLength={4000} rows={3} className={field} onChange={e=>editProposal(d=>({...d,summary:e.target.value}))}/>
      </label>
      {proposal.steps.map((step,i)=><div key={step.id||i} className="space-y-2 rounded-xl border border-border p-4">
       <label className="block space-y-1 text-sm font-medium">Step {i+1} title<input className={field} maxLength={240} value={step.title}
        onChange={e=>editProposal(d=>({...d,steps:d.steps.map((s,n)=>n===i?{...s,title:e.target.value}:s)}))}/></label>
       <label className="block space-y-1 text-sm font-medium">What to do<textarea className={field} rows={2} maxLength={1400} value={step.detail||""}
        onChange={e=>editProposal(d=>({...d,steps:d.steps.map((s,n)=>n===i?{...s,detail:e.target.value}:s)}))}/></label>
      </div>)}
      <div className="flex flex-wrap gap-2">
       <button type="button" onClick={savePlan} disabled={!!busy||!proposal.summary.trim()||proposal.steps.some(s=>!s.title.trim())} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"><Save size={18}/> {busy==="plan"?"Saving…":"Save reviewed plan and tasks"}</button>
       <button type="button" onClick={()=>{setProposal(null);proposalRequest.current=null;}} disabled={!!busy} className={button}>Discard suggestion</button>
      </div>
     </article>}
    <article className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-7" aria-label="Mission tasks">
     <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl font-semibold">Your checklist</h2><span className="text-sm text-muted-foreground">{done} / {tasks.length}</span></div>
     {tasks.length===0&&<p className="text-sm text-muted-foreground">Save a plan to create your first steps, or add a task yourself.</p>}
     <div className="space-y-2">{tasks.map(t=><button type="button" key={t.id} onClick={()=>toggleTask(t)} disabled={!!busy} aria-pressed={t.state==="done"}
        className="flex min-h-12 w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-cyan-400/60 disabled:opacity-50">
       {t.state==="done"?<CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-500"/>:<Circle size={21} className="mt-0.5 shrink-0 text-muted-foreground"/>}
       <span className={t.state==="done"?"line-through text-muted-foreground":""}><span className="font-medium">{t.title}</span>{t.description&&<span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>}</span>
      </button>)}</div>
      <form onSubmit={addTask} className="flex flex-wrap gap-2"><label htmlFor="new-mission-task" className="sr-only">New task</label>
       <input id="new-mission-task" className={field+" min-w-0 flex-1"} maxLength={240} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add your next task"/>
       <button type="submit" disabled={!newTask.trim()||!!busy} className={button}><Plus size={17}/> Add task</button>
      </form>
    </article>
   </div>
   <aside className="space-y-5">
    <MissionBudget key={mission.id+":"+owner} missionId={mission.id} ownerId={owner}/>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
     <h2 className="text-lg font-semibold">Fundraising is your choice</h2>
     <p className="text-sm text-muted-foreground">You don't need to raise money to complete a Mission. If a fundraising gap emerges, you can create a separate campaign without making your private planning notes public.</p>
     <Link to={"/create?manual=1&mission="+encodeURIComponent(mission.id)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-center font-semibold text-primary-foreground">Create optional fundraiser <ArrowRight size={18}/></Link>
     {links.length>0&&<div className="space-y-2 border-t border-border pt-4"><h3 className="text-sm font-semibold">Linked campaigns</h3>{links.map(l=><Link key={l.id} className="block rounded-xl border border-border px-3 py-2 text-sm text-primary underline-offset-2 hover:underline" to={"/campaigns/"+encodeURIComponent(l.campaign_id)+"/edit"}>Manage linked campaign</Link>)}</div>}
    </section>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
     <h2 className="text-lg font-semibold">Opportunities and connections</h2>
     <p className="text-sm text-muted-foreground">Potential programs and partners need real source checks. A website link alone never proves a verified connection or approved support.</p>
     <p className="text-xs text-muted-foreground">{integration?.opportunities?.length||0} opportunity matches · {integration?.connections?.length||0} connection requests · {integration?.agents?.length||0} agents</p>
     <div className="space-y-3 border-t border-border pt-4" aria-label="Potential outside resources">
       <h3 className="font-semibold">Programs and resources to investigate</h3>
       <p className="text-xs text-muted-foreground">These are independently checked official website links, not offers or grants to your Mission. Eligibility, deadlines, availability and benefits have not been confirmed for you. Visiting an external site is your choice.</p>
       {resourceError&&<p role="status" className="text-xs text-muted-foreground">{resourceError}</p>}
       {!resourceError&&resources.length===0&&<p className="text-sm text-muted-foreground">No reviewed source links are currently listed. Your Mission can continue without them.</p>}
       {resources.slice(0,5).map(item=><article key={item.id} className="rounded-xl border border-border p-3">
         <p className="text-xs text-muted-foreground">{item.tags.includes(mission.goal_type)?"Related topic · ":"General resource · "}Source link checked · Eligibility not checked</p>
         <p className="text-xs text-muted-foreground">{item.deadline_at?`Deadline: ${new Date(item.deadline_at).toISOString().replace("T"," ").slice(0,16)} UTC`:item.deadline_date?`Deadline date: ${item.deadline_date} (provider timezone unconfirmed)`:"Deadline unknown; verify with the official provider."}</p>
         <h4 className="mt-1 text-sm font-semibold">{item.title}</h4>
         <p className="mt-1 text-xs text-muted-foreground">{item.official_provider} · {item.geography}</p>
         <div className="mt-2 flex flex-wrap items-center gap-3">
           <a href={item.official_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary underline">Review official website <ArrowRight size={14} aria-hidden="true"/></a>
           {integration?.opportunities?.some(x=>x.opportunity_id===item.id)
             ? <span className="text-xs font-medium text-cyan-600">Saved as a possible resource</span>
             : <button type="button" disabled={!!busy} onClick={()=>bookmarkResource(item)} className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold disabled:opacity-50">Save to this Mission</button>}
         </div>
       </article>)}
     </div>
     <Link to="/connections" className="text-sm font-medium text-primary underline">Manage connected platforms</Link>
    </section>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
     <h2 className="text-lg font-semibold">Mission progress</h2>
     <p className="text-sm text-muted-foreground">Your checklist sets progress. Donation amounts are never estimated.</p>
     <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={tasks.length?Math.round(done/tasks.length*100):0} aria-valuemin={0} aria-valuemax={100} aria-label="Task completion">
       <div className="h-full rounded-full bg-cyan-500 transition-all" style={{width:(tasks.length?done/tasks.length*100:0)+"%"}}/>
     </div>
     <div className="flex flex-wrap gap-2">
      {mission.status!=="completed"&&mission.status!=="archived"&&<button type="button" className={button} disabled={!!busy} onClick={()=>setStatus("completed")}>Mark completed</button>}
      {mission.status==="completed"&&<button type="button" className={button} disabled={!!busy} onClick={()=>setStatus("in_progress")}>Reopen</button>}
      {mission.status!=="archived"&&<button type="button" className={button} disabled={!!busy} onClick={()=>setStatus("archived")}>Archive</button>}
      {mission.status==="archived"&&<button type="button" className={button} disabled={!!busy} onClick={()=>setStatus("draft")}>Restore</button>}
     </div>
    </section>
   </aside>
  </section>
 </main>;
}