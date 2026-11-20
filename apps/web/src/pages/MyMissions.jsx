import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Orbit, PlusCircle, LockKeyhole } from "lucide-react";
import { authClient } from "@/api/auth";
import { listMissions } from "@/api/missions";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function MyMissions(){
 const session=useAuthSession();
 const [phase,setPhase]=useState("loading"),[items,setItems]=useState([]),[error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 const owner=session.user?.id||null;
 useEffect(()=>{
  if(session.status==="loading")return;
  if(!owner||session.user?.is_anonymous){setPhase("error");setError("Sign in with a confirmed account to open your private Missions.");return;}
  let live=true;
  setPhase("loading");setError("");
  listMissions(authClient(),{limit:100}).then(result=>{if(live){setItems(result);setPhase("ready");}})
   .catch(cause=>{if(live){setError(cause.message||"Missions could not be loaded.");setPhase("error");}});
  return()=>{live=false;};
 },[owner,session.status,revision]);
 return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <div className="space-y-2"><p className="flex items-center gap-2 text-xs uppercase tracking-[.18em] text-primary"><Orbit size={19}/> My private workspace</p>
    <h1 className="font-display text-3xl font-semibold sm:text-4xl">My Missions</h1>
    <p className="max-w-2xl text-sm text-muted-foreground">Your goals and planning history are private. A Mission never publishes a fundraiser on its own.</p>
   </div>
   <Link to="/what-if" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"><PlusCircle size={19}/> New Mission</Link>
  </header>
  {phase==="loading"&&<p role="status">Loading your private Missions…</p>}
  {phase==="error"&&<div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 p-5">
   <p>{error}</p><button type="button" onClick={()=>setRevision(v=>v+1)} className="min-h-11 rounded-xl border px-4">Retry</button>
  </div>}
  {phase==="ready"&&items.length===0&&<section className="space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
   <Orbit className="mx-auto" size={36}/><h2 className="text-xl font-semibold">It starts with a possibility</h2>
   <p className="text-sm text-muted-foreground">Describe something you want to make happen, then build your private plan.</p>
   <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" to="/what-if">Create your first Mission <ArrowRight size={17}/></Link>
  </section>}
  {phase==="ready"&&items.length>0&&<section aria-label="Saved private Missions" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
   {items.map(m=><Link key={m.id} to={"/missions/"+encodeURIComponent(m.id)} className="group flex min-h-48 flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-400">
    <div><div className="mb-4 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><LockKeyhole size={14}/> Private</span><span className="capitalize">{m.status?.replaceAll("_"," ")}</span></div>
     <h2 className="line-clamp-2 text-lg font-semibold group-hover:text-primary">{m.title||"Untitled Mission"}</h2>
     <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{m.summary||m.original_prompt}</p>
    </div>
    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">Open Mission <ArrowRight size={16}/></span>
   </Link>)}
  </section>}
 </main>;
}