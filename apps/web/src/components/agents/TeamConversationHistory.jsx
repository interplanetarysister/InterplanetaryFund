import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { loadTeamHistory, eraseTeamEvent } from "@/api/teamContext";
import { AGENT_IDENTITIES } from "./AgentIdentityIcon";

/** Member-only, read-only by default. No claim all agents have migrated yet. */
export default function TeamConversationHistory(){
  const [state,setState]=useState({status:"loading",items:[],message:""});
  const [removing,setRemoving]=useState("");
  async function refresh(){
    setState(prev=>({...prev,status:"loading",message:""}));
    try {
      const items=await loadTeamHistory(authClient());
      setState({status:"ready",items,message:""});
    }catch(e){setState({status:"error",items:[],message:e.message||"History unavailable."});}
  }
  useEffect(()=>{let alive=true;(async()=>{
    try{const items=await loadTeamHistory(authClient());if(alive)setState({status:"ready",items,message:""});}
    catch(e){if(alive)setState({status:"error",items:[],message:e.message||"History unavailable."});}
  })();return()=>{alive=false;};},[]);
  async function remove(row){
    if(removing)return;
    setRemoving(row.id);
    try{
      // Erasure uses the idempotency event key, not the internal row id.
      // Until a matching server-authorized event_key is returned, no erasure
      // control should be enabled; record ID is not sufficient.
      throw Error("Conversation erasure is awaiting a verified event reference.");
    }catch(e){setState(prev=>({...prev,message:e.message}));}
    finally{setRemoving("");}
  }
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="Your shared team history">
    <h2 className="text-lg font-semibold">Your shared team history</h2>
    <p className="mt-2 text-sm text-muted-foreground">Your iFund agents can use relevant conversations from your account. This view shows saved records only; a missing record does not mean an interaction never happened.</p>
    <button type="button" className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold" onClick={refresh} disabled={state.status==="loading"}>Refresh history</button>
    {state.status==="loading"&&<p className="mt-3 text-sm" role="status">Loading private team records…</p>}
    {state.status==="error"&&<p className="mt-3 text-sm text-muted-foreground" role="status">{state.message}</p>}
    {state.status==="ready"&&<div className="mt-4 space-y-3">
      {state.items.length===0 ? <p className="text-sm text-muted-foreground">No recorded team exchanges yet.</p> : state.items.map(item=><article key={item.id} className="rounded-xl border border-border p-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <strong>{AGENT_IDENTITIES[item.agent_id]?.name||"iFund agent"} · {item.speaker==="user"?"You":"Agent"}</strong>
          <time dateTime={item.recorded_at}>{new Date(item.recorded_at).toLocaleString()}</time>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.content}</p>
      </article>)}
    </div>}
  </section>;
}
