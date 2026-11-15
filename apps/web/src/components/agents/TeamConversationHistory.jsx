import { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import { loadTeamHistory, eraseTeamEvent, correctTeamStatement } from "@/api/teamContext";
import { AGENT_IDENTITIES } from "./AgentIdentityIcon";

/** Member-only, read-only by default. No claim all agents have migrated yet. */
export default function TeamConversationHistory(){
  const [state,setState]=useState({status:"loading",items:[],message:""});
  const [removing,setRemoving]=useState("");
  const [editing,setEditing]=useState("");
  const [correction,setCorrection]=useState("");
  const [loadingMore,setLoadingMore]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const requestGeneration=useRef(0);
  const mounted=useRef(true);
  async function refresh(){
    const generation=++requestGeneration.current;
    setState(prev=>({...prev,status:"loading",message:""}));
    try {
      const items=await loadTeamHistory(authClient());
      if(mounted.current && generation===requestGeneration.current){setState({status:"ready",items,message:""});setHasMore(items.length===30);setLoadingMore(false);}
    }catch(e){if(mounted.current && generation===requestGeneration.current){setState({status:"error",items:[],message:e.message||"History unavailable."});setLoadingMore(false);}}
  }
  useEffect(()=>{let alive=true;mounted.current=true;const generation=++requestGeneration.current;(async()=>{
    try{const items=await loadTeamHistory(authClient());if(alive && generation===requestGeneration.current){setState({status:"ready",items,message:""});setHasMore(items.length===30);}}
    catch(e){if(alive && generation===requestGeneration.current)setState({status:"error",items:[],message:e.message||"History unavailable."});}
  })();return()=>{alive=false;mounted.current=false;requestGeneration.current++;};},[]);
  async function loadMore(){
    if(loadingMore||state.status!=="ready"||!state.items.length)return;
    const last=state.items[state.items.length-1];
    const generation=requestGeneration.current;
    setLoadingMore(true);
    try{
      const next=await loadTeamHistory(authClient(),{beforeAt:last.recorded_at,beforeId:last.id});
      if(mounted.current && generation===requestGeneration.current){
        setState(prev=>({...prev,items:[...prev.items,...next.filter(item=>!prev.items.some(saved=>saved.id===item.id))],message:""}));
        setHasMore(next.length===30);
      }
    }catch(e){if(mounted.current && generation===requestGeneration.current)setState(prev=>({...prev,message:e.message||"Older history could not be loaded."}));}
    finally{if(mounted.current && generation===requestGeneration.current)setLoadingMore(false);}
  }
  async function remove(row){
    if(removing||editing)return;
    setRemoving(row.id);
    try{
      await eraseTeamEvent(authClient(),row.event_key);
      setState(prev=>({...prev,items:prev.items.filter(item=>item.id!==row.id),message:"Entry removed from shared team history."}));
    }catch(e){setState(prev=>({...prev,message:e.message}));}
    finally{setRemoving("");}
  }
  async function saveCorrection(row){
    if(removing||editing!==row.id)return;
    setRemoving(row.id);
    try{
      await correctTeamStatement(authClient(),row.event_key,correction);
      setEditing("");setCorrection("");
      await refresh();
    }catch(e){setState(prev=>({...prev,message:e.message||"Correction was not saved."}));}
    finally{setRemoving("");}
  }
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="Your shared team history">
    <h2 className="text-lg font-semibold">Your shared team history</h2>
    <p className="mt-2 text-sm text-muted-foreground">This workspace is being connected to your private shared team context. Saved records will appear here once the service is verified and enabled. A missing entry does not prove a conversation never happened.</p>
    <button type="button" className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={refresh} disabled={state.status==="loading"}>Refresh history</button>
    {state.status==="loading"&&<p className="mt-3 text-sm" role="status">Loading private team records…</p>}
    {state.status==="error"&&<p className="mt-3 text-sm text-destructive" role="alert">{state.message}</p>}
    {state.status==="ready"&&<div className="mt-4 space-y-3">
      {state.message&&<p className="text-sm" role="status">{state.message}</p>}
      {state.items.length===0 ? <p className="text-sm text-muted-foreground">No recorded team exchanges yet.</p> : state.items.map(item=><article key={item.id} className="rounded-xl border border-border p-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <strong>{AGENT_IDENTITIES[item.agent_id]?.name||"iFund agent"} · {item.speaker==="user"?"You":"Agent"}</strong>
          <time dateTime={item.recorded_at}>{new Date(item.recorded_at).toLocaleString()}</time>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.content}</p>
        {item.speaker==="user" && <button type="button" disabled={Boolean(removing)||loadingMore} className="mt-2 mr-2 min-h-11 rounded-lg border border-border px-3 text-xs" onClick={()=>{setEditing(item.id);setCorrection(item.content);}}>Correct statement</button>}
                <button type="button" className="mt-2 min-h-11 rounded-lg border border-border px-3 text-xs" disabled={Boolean(removing)||Boolean(editing)||loadingMore} onClick={()=>remove(item)}>Remove from team history</button>
        {editing===item.id&&<div className="mt-3 space-y-2">
          <label htmlFor={"correct-"+item.id} className="text-xs font-medium">Correct your saved statement</label>
          <textarea id={"correct-"+item.id} value={correction} onChange={e=>setCorrection(e.target.value)} maxLength={4000} rows={3}
            className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={()=>saveCorrection(item)} disabled={Boolean(removing)||!correction.trim()} className="min-h-11 rounded-lg bg-primary px-3 text-sm text-primary-foreground">Save correction</button>
            <button type="button" onClick={()=>{setEditing("");setCorrection("");}} className="min-h-11 rounded-lg border border-border px-3 text-sm">Cancel</button>
          </div>
        </div>}
      </article>)}
      {hasMore&&<button type="button" onClick={loadMore} disabled={loadingMore||Boolean(removing)||Boolean(editing)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">{loadingMore?"Loading…":"Load older conversations"}</button>}
    </div>}
  </section>;
}
