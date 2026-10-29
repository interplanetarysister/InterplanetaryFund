import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadNotifications, acknowledgeNotification,
  acknowledgeAllNotifications, safeNoticeDestination } from "@/lib/notifications";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";

export default function Notifications(){
  const navigate=useNavigate();
  const alive=useRef(true);
  const requestId=useRef(0);
  const [items,setItems]=useState([]);
  const [phase,setPhase]=useState("loading");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const load=useCallback(async()=>{
    const generation=++requestId.current;
    setPhase("loading");setError("");
    try {
      const result=await loadNotifications(authClient());
      if(alive.current&&generation===requestId.current){
        setItems(result);setPhase("ready");
      }
    } catch(cause) {
      if(alive.current&&generation===requestId.current){
        setPhase("error");
        setError(cause?.message||"Could not load your notifications.");
      }
    }
  },[]);
  useEffect(()=>{
    alive.current=true;
    load();
    return()=>{alive.current=false;requestId.current+=1;};
  },[load]);
  const unread=items.filter(item=>item.read!==true).length;
  async function markAll(){
    if(busy)return;
    setBusy("all");setError("");
    try {
      await acknowledgeAllNotifications(authClient());
      await load();
    } catch(cause){setError(cause?.message||"Could not acknowledge notifications.");}
    finally{setBusy("");}
  }
  async function openNotice(item){
    if(busy)return;
    setBusy(item.id);setError("");
    try {
      if(item.read!==true)await acknowledgeNotification(authClient(),item.id);
      setItems(current=>current.map(x=>x.id===item.id?{...x,read:true}:x));
      const destination=safeNoticeDestination(item.link);
      if(destination)navigate(destination);
    } catch(cause){setError(cause?.message||"Could not acknowledge this notice.");}
    finally{setBusy("");}
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-3 font-display text-3xl font-bold">
        <Bell aria-hidden="true" className="h-7 w-7 text-primary"/>Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your private IFund notices, separate from the payment ledger and external provider messages.</p>
      </div>
      {phase==="ready"&&unread>0&&<button type="button" disabled={Boolean(busy)}
        onClick={markAll} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 disabled:opacity-50">
        <CheckCheck aria-hidden="true" className="h-4 w-4"/>Mark all read ({unread})
      </button>}
    </header>
    {error&&<p role="alert" className="rounded-lg border border-destructive/40 p-3 text-destructive">{error}</p>}
    {phase==="loading"&&<p role="status">Loading notifications…</p>}
    {phase==="error"&&<section className="rounded-xl border border-border bg-card p-5">
      <p>The independent notification service is not available or your session could not be verified. No sample notices are displayed.</p>
      <button type="button" onClick={load} className="mt-3 font-semibold underline">Retry</button>
    </section>}
    {phase==="ready"&&items.length===0&&<section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold">You're all caught up</h2>
      <p className="mt-2 text-sm text-muted-foreground">New verified notices will appear here when an authorized IFund service produces them.</p>
      <Link to="/following" className="mt-4 inline-block underline">Your followed campaigns</Link>
    </section>}
    {phase==="ready"&&items.length>0&&<ul className="space-y-3">
      {items.map(item=>{
        const destination=safeNoticeDestination(item.link);
        return <li key={item.id}>
          <article className={"rounded-xl border p-4 "+(item.read?"border-border bg-card":"border-primary/30 bg-primary/5")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                {item.body&&<p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>}
                <p className="mt-3 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              {!item.read&&<span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}
            </div>
            {(destination||!item.read)&&<button type="button" disabled={Boolean(busy)}
              onClick={()=>openNotice(item)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">
              {destination?"Open notice":"Mark read"}{destination&&<ChevronRight aria-hidden="true" className="h-4 w-4"/>}
            </button>}
          </article>
        </li>;
      })}
    </ul>}
    <p className="text-xs text-muted-foreground">Android push, optional diagnostics, and administrative mail remain separate consent-controlled integrations; they are not enabled by opening this page.</p>
  </main>;
}
