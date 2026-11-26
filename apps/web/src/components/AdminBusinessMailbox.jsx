import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/api/auth";

export default function AdminBusinessMailbox({ ownerId }) {
  const [state,setState]=useState({status:"loading",messages:[]});
  const [busy,setBusy]=useState(null);
  const load=useCallback(async (signal)=>{
    setState({status:"loading",messages:[]});
    try {
      const client=authClient();
      const {data:before}=await client.auth.getUser();
      if(before?.user?.id!==ownerId)throw Error("Session changed");
      const {data,error}=await client.functions.invoke("ifund-admin-mailbox",{method:"GET"});
      if(signal?.aborted)return;
      const {data:after}=await client.auth.getUser();
      if(signal?.aborted)return;
      if(after?.user?.id!==ownerId)throw Error("Session changed");
      if(error){setState({status:error.context?.status===403?"restricted":"error",messages:[]});return;}
      if(!Array.isArray(data?.messages))throw Error("Invalid mailbox response");
      setState({status:"ready",messages:data.messages.filter(m=>typeof m.id==="string"&&typeof m.recipient_address==="string")});
    }catch{if(!signal?.aborted)setState({status:"error",messages:[]});}
  },[ownerId]);
  useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[load]);
  async function markRead(id){
    if(busy)return;
    setBusy(id);
    try{
      const client=authClient();
      const {data:before}=await client.auth.getUser();
      if(before?.user?.id!==ownerId)throw Error("Session changed");
      const {error,data}=await client.functions.invoke("ifund-admin-mailbox",{method:"PATCH",body:{id,is_read:true}});
      if(error||data?.ok!==true)throw Error("Update failed");
      await load();
    }catch{setState({status:"error",messages:[]});}
    finally{setBusy(null);}
  }
  return <section aria-label="iFund business mailbox" className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">iFund business mailbox</h2><button type="button" className="min-h-11 rounded-xl border px-3 text-sm" onClick={()=>void load()} disabled={state.status==="loading"||!!busy}>Refresh</button></div>
    <p className="text-sm text-muted-foreground">Official @interplanetaryfund.com email. Access is restricted to authorized administrators and does not require a paid add-on.</p>
    {state.status==="loading"&&<p role="status">Loading business email…</p>}
    {state.status==="restricted"&&<p>Business mailbox access has not been granted to this account.</p>}
    {state.status==="error"&&<p role="alert">Business mail could not be verified. Refresh to try again.</p>}
    {state.status==="ready"&&state.messages.length===0&&<p>No business email received yet.</p>}
    {state.status==="ready"&&state.messages.map(m=><article key={m.id} className="space-y-2 rounded-xl border p-3">
      <h3 className="break-words font-medium">{m.subject||"(No subject)"}</h3>
      <p className="break-words text-xs text-muted-foreground">From: {m.sender_address} · To: {m.recipient_address}</p>
      <p className="text-xs text-muted-foreground">{m.received_at?new Date(m.received_at).toLocaleString():""}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{m.body_text}</p>
      {!m.is_read&&<button type="button" className="min-h-11 rounded-xl border px-3 text-sm" onClick={()=>void markRead(m.id)} disabled={!!busy}>Mark read</button>}
    </article>)}
  </section>;
}
