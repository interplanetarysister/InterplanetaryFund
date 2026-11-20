import {useCallback,useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {loadInAppReminders,scheduleInAppReminder,cancelInAppReminder} from "@/lib/inAppReminders.mjs";
import {CalendarClock,RefreshCw,Trash2} from "lucide-react";

// Owner-authenticated, deliberate in-app reminders. Not a push, email or
// external publishing queue; delivery is handled by the restricted DB cron.
export default function InAppReminders(){
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [localTime,setLocalTime]=useState("");
  const [items,setItems]=useState([]);
  const [phase,setPhase]=useState("loading");
  const [busy,setBusy]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const current=useRef(null);
  const alive=useRef(false);
  const lock=useRef(false);
  const generation=useRef(0);
  const refresh=useCallback(async()=>{
    const seq=++generation.current;
    setPhase("loading");
    try{
      const rows=await loadInAppReminders(authClient());
      if(alive.current&&seq===generation.current){setItems(rows);setPhase("ready");}
      return rows;
    }catch(e){
      if(alive.current&&seq===generation.current){setPhase("error");setError(e?.message||"Your reminders could not load.");}
      throw e;
    }
  },[]);
  useEffect(()=>{
    alive.current=true;
    refresh().catch(()=>{});
    return()=>{alive.current=false;generation.current++;};
  },[refresh]);
  const resetRequest=()=>{current.current=null;setNotice("");setError("");};
  async function schedule(event){
    event.preventDefault();
    if(lock.current)return;
    lock.current=true;setBusy("schedule");setNotice("");setError("");
    const selectedTime=new Date(localTime);
    if(!Number.isFinite(selectedTime.getTime())||selectedTime.getTime()<Date.now()+60_000){
      setError("Choose a time at least one minute from now.");lock.current=false;setBusy("");return;
    }
    const payload={title:title.trim(),body:body.trim(),dueAt:selectedTime.toISOString()};
    if(!current.current||JSON.stringify(current.current.payload)!==JSON.stringify(payload))
      current.current={id:crypto.randomUUID(),payload};
    try{
      const saved=await scheduleInAppReminder(authClient(),{...payload,requestId:current.current.id});
      const rows=await refresh();
      if(!rows.some(r=>r.id===saved.id))
        throw new Error("Scheduled reminder is not visible yet. Check the list before retrying.");
      if(!alive.current)return;
      setTitle("");setBody("");setLocalTime("");current.current=null;
      setNotice("Reminder confirmed. It will appear in your private inbox after the scheduled time (typically within five minutes).");
    }catch(e){if(alive.current)setError(e?.message||"Reminder could not be confirmed.");}
    finally{lock.current=false;if(alive.current)setBusy("");}
  }
  async function cancel(id){
    if(lock.current)return;
    lock.current=true;setBusy(id);setError("");setNotice("");
    try{
      const result=await cancelInAppReminder(authClient(),id);
      const rows=await refresh();
      if(!rows.some(row=>row.id===id&&row.status===result.status))
        throw new Error("The updated cancellation status could not be confirmed.");
      if(!alive.current)return;
      setNotice(result.status==="cancelled"?"Reminder cancelled. Nothing will be sent.":"This reminder is no longer pending. Its existing delivery was not removed.");
    }catch(e){if(alive.current)setError(e?.message||"Reminder could not be cancelled.");}
    finally{lock.current=false;if(alive.current)setBusy("");}
  }
  return <section aria-label="Scheduled inbox reminders" className="space-y-5 rounded-2xl border border-cyan-500/20 bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock aria-hidden="true" className="h-5 w-5 text-cyan-500"/>Your scheduled inbox reminders</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Write a note for your future self. iFund saves it now and places it in your private Notifications inbox after the scheduled time. Delivery runs about every five minutes. No email, push, social post or payment is sent.</p>
      </div>
      <button type="button" onClick={()=>{setError("");refresh().catch(()=>{});}}
        disabled={Boolean(busy)||phase==="loading"}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">
        <RefreshCw aria-hidden="true" className="h-4 w-4"/>Refresh
      </button>
    </div>
    <form className="grid gap-3" onSubmit={schedule}>
      <label htmlFor="ifund-reminder-title" className="text-sm font-semibold">Reminder title</label>
      <input id="ifund-reminder-title" value={title} onChange={e=>{setTitle(e.target.value);resetRequest();}}
        minLength={4} maxLength={100} required disabled={Boolean(busy)}
        placeholder="Check my campaign progress"
        className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"/>
      <label htmlFor="ifund-reminder-body" className="text-sm font-semibold">Your message</label>
      <textarea id="ifund-reminder-body" value={body} onChange={e=>{setBody(e.target.value);resetRequest();}}
        minLength={8} maxLength={1000} required rows={3} disabled={Boolean(busy)}
        placeholder="Review the campaign story, finances and supporter updates."
        className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-foreground"/>
      <label htmlFor="ifund-reminder-time" className="text-sm font-semibold">When to deliver (your local time)</label>
      <input id="ifund-reminder-time" type="datetime-local" required value={localTime}
        disabled={Boolean(busy)} onChange={e=>{setLocalTime(e.target.value);resetRequest();}}
        className="min-h-11 w-full max-w-sm rounded-xl border border-border bg-background px-3 text-foreground"/>
      <p className="text-xs text-muted-foreground">Choose between one minute and 30 days ahead. Up to 10 new reminders in 24 hours and 20 pending at once.</p>
      <div><button type="submit" disabled={Boolean(busy)||title.trim().length<4||body.trim().length<8||!localTime}
        className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy==="schedule"?"Scheduling…":"Schedule private reminder"}
      </button></div>
    </form>
    {error&&<p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-cyan-500/40 p-3 text-sm">{notice}</p>}
    <div className="space-y-2">
      <h3 className="text-sm font-bold">Recent scheduled reminders</h3>
      {phase==="loading"&&<p role="status" className="text-sm text-muted-foreground">Checking your private queue…</p>}
      {phase==="error"&&<p role="status" className="text-sm text-muted-foreground">The queue could not be loaded. Retry using Refresh.</p>}
      {phase==="ready"&&items.length===0&&<p className="text-sm text-muted-foreground">No reminders scheduled yet.</p>}
      {phase==="ready"&&items.length>0&&<ul className="space-y-2">
        {items.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="max-w-lg whitespace-pre-wrap break-words text-xs text-muted-foreground">{item.body}</p>
            <p className="text-xs text-muted-foreground">{new Date(item.due_at).toLocaleString()} · <span className="font-semibold">{item.status}</span></p>
          </div>
          {item.status==="queued"&&<button type="button" disabled={Boolean(busy)}
            onClick={()=>cancel(item.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50">
            <Trash2 aria-hidden="true" className="h-4 w-4"/>Cancel</button>}
        </li>)}
      </ul>}
    </div>
  </section>;
}
