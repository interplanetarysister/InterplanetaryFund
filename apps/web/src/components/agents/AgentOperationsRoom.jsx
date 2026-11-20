import React,{useCallback,useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {AGENT_IDENTITIES,AgentIdentityIcon} from "./AgentIdentityIcon";

const THREAD="00000000-0000-4000-8000-000000000a61";
const TYPES=["discussion","assignment","analysis","result","blocker"];
export default function AgentOperationsRoom({user}){
  const ownerId=user?.id || null;
  const ownerGuard=React.useRef(ownerId);
  ownerGuard.current=ownerId;
  const [permitted,setPermitted]=useState(false);
  const [checking,setChecking]=useState(true);
  const [items,setItems]=useState([]);
  const [body,setBody]=useState("");
  const [kind,setKind]=useState("discussion");
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);
  const [analyzing,setAnalyzing]=useState(false);
  const [analyzingAssignment,setAnalyzingAssignment]=useState(null);
  const refresh=useCallback(async()=>{
    if(!ownerId)return;
    const client=authClient();
    const [identity,admin]=await Promise.all([client.auth.getUser(),client.rpc("ifund_current_user_is_verified_admin")]);
    if(ownerGuard.current!==ownerId)return;
    if(identity.error||identity.data?.user?.id!==ownerId||admin.error||admin.data!==true){
      setPermitted(false);setItems([]);setChecking(false);return;
    }
    setPermitted(true);
    const {data,error:readError}=await client.from("ifund_agent_operations_messages")
      .select("id,speaker_type,agent_id,body,event_type,source_kind,source_receipt,created_at,author_user_id")
      .eq("thread_id",THREAD).order("created_at",{ascending:false}).limit(80);
    if(ownerGuard.current!==ownerId)return;
    if(readError) setError("The private room could not be refreshed.");
    else {setItems((data||[]).reverse());setError("");}
    setChecking(false);
  },[ownerId]);
  useEffect(()=>{
    let alive=true;
    (async()=>{if(alive)try{await refresh();}catch{if(alive){setChecking(false);setPermitted(false);setItems([]);}}})();
    const timer=setInterval(()=>{if(alive&&document.visibilityState==="visible")refresh().catch(()=>{});},30000);
    return()=>{alive=false;clearInterval(timer);};
  },[refresh]);
  useEffect(()=>{setPermitted(false);setChecking(true);setItems([]);setBody("");},[ownerId]);
  async function send(e){
    e.preventDefault();
    const message=body.trim();
    if(!permitted||sending||message.length<1||message.length>4000||!ownerId)return;
    setSending(true);setError("");
    try{
      const client=authClient();
      const [identity,admin]=await Promise.all([client.auth.getUser(),client.rpc("ifund_current_user_is_verified_admin")]);
      if(identity.error||identity.data?.user?.id!==ownerId||admin.error||admin.data!==true)throw Error("Administrator access could not be verified.");
      const {error:writeError}=await client.from("ifund_agent_operations_messages").insert({
        thread_id:THREAD,speaker_type:"admin",author_user_id:ownerId,body:message,event_type:kind,source_kind:"admin_post"
      });
      if(writeError)throw Error("The message was not saved.");
      setBody("");await refresh();
    }catch(cause){setError(cause?.message||"Message failed.");}
    finally{setSending(false);}
  }
  async function askNexus(messageId=null){
    const prompt=body.trim();
    if(!permitted||analyzing||sending||!ownerId)return;
    if(messageId===null && (prompt.length<8||prompt.length>1100))return;
    if(messageId!==null && !items.some(item=>item.id===messageId && item.speaker_type==="admin" && item.event_type==="assignment"))return;
    setAnalyzing(true);setAnalyzingAssignment(messageId);setError("");
    try{
      const client=authClient();
      const [identity,session,admin]=await Promise.all([
        client.auth.getUser(),client.auth.getSession(),client.rpc("ifund_current_user_is_verified_admin")
      ]);
      if(identity.error||identity.data?.user?.id!==ownerId||admin.error||admin.data!==true ||
        session.error||session.data?.session?.user?.id!==ownerId || !session.data?.session?.access_token)
        throw Error("Administrator session could not be verified.");
      const response=await fetch("/api/agents/ops/analyze",{
        method:"POST",headers:{"Content-Type":"application/json",
          Authorization:"Bearer "+session.data.session.access_token},
        body:JSON.stringify(messageId===null?{question:prompt}:{message_id:messageId})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok || !Number.isInteger(result?.saved) || result.saved<1)
        throw Error(typeof result?.error==="string"?result.error:"NEXUS could not complete this analysis.");
      if(messageId===null)setBody("");await refresh();
    }catch(cause){setError(cause?.message||"Agent analysis was not completed.");}
    finally{setAnalyzing(false);setAnalyzingAssignment(null);}
  }
  if(checking)return null;
  if(!permitted)return null;
  return <section aria-label="Private Agent Operations Room" className="rounded-2xl border border-slate-600/50 bg-slate-950/60 p-4 space-y-4">
    <div className="flex items-center gap-3">
      <AgentIdentityIcon identity="nexus" size={45}/>
      <div><h2 className="text-lg font-bold">Agent Operations Room</h2>
        <p className="text-xs text-slate-400">Private administrator room · Agent messages require verified runtime receipts</p>
      </div>
    </div>
    <p className="text-xs text-slate-400">Discuss tasks and priorities here. Only verified administrators can read or post. An agent will appear as the speaker only after its backend message is authenticated and recorded.</p>
    <div role="log" aria-label="Private agent operations messages" aria-live="polite" className="max-h-[500px] min-h-28 space-y-3 overflow-y-auto rounded-xl bg-black/20 p-3">
      {items.length===0&&<p className="text-sm text-slate-400">No saved discussions yet.</p>}
      {items.map(item=><article key={item.id} className="flex items-start gap-2 rounded-xl border border-slate-700/60 p-3">
        {item.speaker_type==="agent"?<AgentIdentityIcon identity={item.agent_id} size={35}/>:<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-500 bg-slate-900 text-xs font-bold">A</span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{item.speaker_type==="agent"?(AGENT_IDENTITIES[item.agent_id]?.name||"Agent"):"Administrator"}
            <span className="ml-2 font-normal text-slate-400">{item.event_type} · {new Date(item.created_at).toLocaleString()}</span></p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p>
          {item.speaker_type==="agent"&&<p className="mt-1 text-[11px] text-slate-400">Verified agent runtime · receipt {item.source_receipt?.slice(0,12)}</p>}
          {item.speaker_type==="admin"&&item.event_type==="assignment"&&
            <button type="button" disabled={analyzing||sending||
                items.some(entry=>entry.speaker_type==="agent" &&
                  entry.source_receipt?.startsWith("assignment-"+item.id+":"))}
              className="mt-2 rounded-lg border border-cyan-500/50 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"
              onClick={()=>askNexus(item.id)}>
              {analyzingAssignment===item.id?"Specialists reviewing…":
                items.some(entry=>entry.speaker_type==="agent" &&
                  entry.source_receipt?.startsWith("assignment-"+item.id+":"))?"Review recorded":
                  "Assign to NEXUS for specialist review"}
            </button>}
        </div>
      </article>)}
    </div>
    {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
    <form onSubmit={send} className="space-y-2">
      <label htmlFor="ifund-ops-kind" className="block text-xs font-medium">Message type</label>
      <select id="ifund-ops-kind" value={kind} onChange={e=>setKind(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm">
        {TYPES.map(type=><option value={type} key={type}>{type}</option>)}
      </select>
      <label htmlFor="ifund-ops-post" className="block text-xs font-medium">Administrator message</label>
      <textarea id="ifund-ops-post" value={body} onChange={e=>setBody(e.target.value)}
        maxLength={4000} rows={3} className="w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-sm"
        placeholder="Describe an assignment, question, decision or blocker…"/>
      <div className="flex flex-wrap gap-2">
        <button disabled={!body.trim()||sending||analyzing} className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{sending?"Saving…":"Post to private room"}</button>
        <button type="button" onClick={()=>askNexus()} disabled={analyzing||sending||body.trim().length<8||body.trim().length>1100}
          className="rounded-xl border border-cyan-500/70 px-4 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-40">
          {analyzing?"Consulting specialists…":"Ask NEXUS to analyze"}
        </button>
        <button type="button" onClick={()=>refresh().catch(()=>setError("Room refresh failed."))} className="rounded-xl border border-slate-600 px-4 py-2 text-sm">Refresh</button>
      </div>
    </form>
  </section>;
}
