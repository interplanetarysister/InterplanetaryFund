import React,{useCallback,useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {AGENT_IDENTITIES,AgentIdentityIcon} from "./AgentIdentityIcon";

const THREAD="00000000-0000-4000-8000-000000000a61";
const TYPES=["discussion","assignment","analysis","result","blocker"];
const TYPE_LABELS={discussion:"Question",assignment:"Task",analysis:"Analysis",result:"Result",blocker:"Risk"};
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
  const [automationStatus,setAutomationStatus]=useState(null);
  const refresh=useCallback(async()=>{
    if(!ownerId)return;
    const client=authClient();
    const [identity,admin]=await Promise.all([client.auth.getUser(),client.rpc("ifund_current_user_is_verified_admin")]);
    if(ownerGuard.current!==ownerId)return;
    if(identity.error||identity.data?.user?.id!==ownerId||admin.error||admin.data!==true){
      setPermitted(false);setItems([]);setAutomationStatus(null);setChecking(false);return;
    }
    setPermitted(true);
    // A separate admin-scoped RPC reports real stored Worker run receipts,
    // never a browser-supplied state or a claim that a Cron was delivered.
    const [history,botStatus]=await Promise.all([
      client.from("ifund_agent_operations_messages")
        .select("id,speaker_type,agent_id,body,event_type,source_kind,source_receipt,created_at,author_user_id")
        .eq("thread_id",THREAD).order("created_at",{ascending:false}).limit(80),
      client.rpc("ifund_ops_bot_admin_status")
    ]);
    const {data,error:readError}=history;
    if(ownerGuard.current!==ownerId)return;
    if(!botStatus.error && botStatus.data && typeof botStatus.data.configured==="boolean" &&
      Number.isInteger(botStatus.data.utc_day_used) && botStatus.data.utc_day_used>=0 &&
      botStatus.data.utc_day_used<=8 && botStatus.data.utc_day_limit===8 &&
      (!botStatus.data.latest || ["claimed","completed","failed","superseded"].includes(botStatus.data.latest.state)))
      setAutomationStatus(botStatus.data);
    else setAutomationStatus(null);
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
  useEffect(()=>{setPermitted(false);setChecking(true);setItems([]);setAutomationStatus(null);setBody("");},[ownerId]);
  async function runNexus(payload){
    const client=authClient();
    const [identity,session,admin]=await Promise.all([
      client.auth.getUser(),client.auth.getSession(),client.rpc("ifund_current_user_is_verified_admin")
    ]);
    if(ownerGuard.current!==ownerId||identity.error||identity.data?.user?.id!==ownerId||
      admin.error||admin.data!==true ||session.error ||
      session.data?.session?.user?.id!==ownerId || !session.data?.session?.access_token)
      throw Error("Administrator session could not be verified.");
    const response=await fetch("/api/agents/ops/analyze",{
      method:"POST",headers:{"Content-Type":"application/json",
        Authorization:"Bearer "+session.data.session.access_token},
      body:JSON.stringify(payload)
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok || !Number.isInteger(result?.saved) || result.saved<1)
      throw Error(typeof result?.error==="string"?result.error:"NEXUS could not complete this analysis.");
    return result;
  }
  async function send(e){
    e.preventDefault();
    const message=body.trim();
    if(!permitted||sending||analyzing||message.length<1||message.length>4000||!ownerId)return;
    setSending(true);setError("");
    try{
      const client=authClient();
      const [identity,admin]=await Promise.all([client.auth.getUser(),client.rpc("ifund_current_user_is_verified_admin")]);
      if(ownerGuard.current!==ownerId||identity.error||identity.data?.user?.id!==ownerId||
        admin.error||admin.data!==true)throw Error("Administrator access could not be verified.");
      const {data,error:writeError}=await client.from("ifund_agent_operations_messages").insert({
        thread_id:THREAD,speaker_type:"admin",author_user_id:ownerId,body:message,event_type:kind,source_kind:"admin_post"
      }).select("id").single();
      if(writeError||!data?.id)throw Error("The message was not saved.");
      setBody("");
      await refresh();
      if(["assignment","discussion"].includes(kind) && message.length>=8 && message.length<=1100){
        setAnalyzing(true);setAnalyzingAssignment(data.id);
        try{
          await runNexus({message_id:data.id});
          await refresh();
        }catch(cause){
          if(ownerGuard.current===ownerId)setError("Message saved, but specialist analysis needs retry: "+
            (cause?.message||"Agent unavailable"));
        }finally{setAnalyzing(false);setAnalyzingAssignment(null);}
      }
    }catch(cause){setError(cause?.message||"Message failed.");}
    finally{setSending(false);}
  }
  async function askNexus(messageId=null){
    const prompt=body.trim();
    if(!permitted||analyzing||sending||!ownerId)return;
    if(messageId===null && (prompt.length<8||prompt.length>1100))return;
    if(messageId!==null && !items.some(item=>item.id===messageId &&
      item.speaker_type==="admin" && ["assignment","discussion"].includes(item.event_type)))return;
    setAnalyzing(true);setAnalyzingAssignment(messageId);setError("");
    try{
      await runNexus(messageId===null?{question:prompt}:{message_id:messageId});
      if(messageId===null)setBody("");
      await refresh();
    }catch(cause){setError(cause?.message||"Agent analysis was not completed.");}
    finally{setAnalyzing(false);setAnalyzingAssignment(null);}
  }
  if(checking)return null;
  if(!permitted)return null;
  return <section aria-label="Private Agent Operations Room" className="rounded-2xl border border-slate-600/50 bg-slate-950/60 p-4 space-y-4">
    <div className="flex items-center gap-3">
      <AgentIdentityIcon identity="nexus" size={45}/>
      <div><h2 className="text-lg font-bold">Agent Operations Room</h2>
        <p className="text-sm text-slate-300">Admins only · Replies appear after verification</p>
      </div>
    </div>
    <p className="text-sm text-slate-300">Only verified administrators can read or post. A question or task automatically requests a short advisory NEXUS review. Replies appear only after the backend confirms them.</p>
    {automationStatus&&<p role="status" className="rounded-lg border border-slate-700/70 p-3 text-sm text-slate-300">
      Background review authorization: {automationStatus.configured?"enabled":"paused"} · {automationStatus.utc_day_used}/{automationStatus.utc_day_limit} daily runs used (UTC).
      {automationStatus.latest?<> Latest recorded run: {automationStatus.latest.state}
        {automationStatus.latest.finished_at?" · "+new Date(automationStatus.latest.finished_at).toLocaleString():""}</>:" No scheduled run recorded yet."}
      {" "}These are read-only agent discussions, not authorization for payment, publication or external account actions.
    </p>}
    <div role="log" aria-label="Private agent operations messages" aria-live="polite" className="max-h-[500px] min-h-28 space-y-3 overflow-y-auto rounded-xl bg-black/20 p-3">
      {items.length===0&&<p className="text-sm text-slate-400">No saved discussions yet.</p>}
      {items.map(item=><article key={item.id} className="flex items-start gap-2 rounded-xl border border-slate-700/60 p-3">
        {item.speaker_type==="agent"?<AgentIdentityIcon identity={item.agent_id} size={35}/>:<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-500 bg-slate-900 text-xs font-bold">A</span>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{item.speaker_type==="agent"?(AGENT_IDENTITIES[item.agent_id]?.name||"Agent"):"Administrator"}
            <span className="ml-2 font-normal text-slate-300">{TYPE_LABELS[item.event_type]||item.event_type} · {new Date(item.created_at).toLocaleString()}</span></p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p>
          {item.speaker_type==="agent"&&<p className="mt-1 text-sm text-slate-300">Verified reply · receipt {item.source_receipt?.slice(0,12)}</p>}
          {item.speaker_type==="admin"&&["assignment","discussion"].includes(item.event_type)&&
            <button type="button" disabled={analyzing||sending||
                items.some(entry=>entry.speaker_type==="agent" &&
                  entry.source_receipt?.startsWith(item.event_type+"-"+item.id+":"))}
              className="ifund-agent-panel-tool mt-2 rounded-lg border border-cyan-500/50 px-4 text-sm text-cyan-200 disabled:opacity-40"
              onClick={()=>askNexus(item.id)}>
              {analyzingAssignment===item.id?"Reviewing…":
                items.some(entry=>entry.speaker_type==="agent" &&
                  entry.source_receipt?.startsWith(item.event_type+"-"+item.id+":"))?"Review recorded":
                  "Get NEXUS review"}
            </button>}
        </div>
      </article>)}
    </div>
    {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
    <form onSubmit={send} className="space-y-2">
      <label htmlFor="ifund-ops-kind" className="block text-sm font-medium">Message type</label>
      <select id="ifund-ops-kind" value={kind} onChange={e=>setKind(e.target.value)} className="ifund-agent-panel-tool rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm">
        {TYPES.map(type=><option value={type} key={type}>{TYPE_LABELS[type]}</option>)}
      </select>
      <label htmlFor="ifund-ops-post" className="block text-sm font-medium">Administrator message</label>
      <textarea id="ifund-ops-post" value={body} onChange={e=>setBody(e.target.value)}
        maxLength={4000} rows={3} className="w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-sm"
        placeholder="Describe an assignment, question, decision or blocker…"/>
      <div className="flex flex-wrap gap-2">
        <button disabled={!body.trim()||sending||analyzing} className="ifund-agent-panel-tool rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{sending?"Saving…":"Post to private room"}</button>
        <button type="button" onClick={()=>askNexus()} disabled={analyzing||sending||body.trim().length<8||body.trim().length>1100}
          className="ifund-agent-panel-tool rounded-xl border border-cyan-500/70 px-4 text-sm font-semibold text-cyan-200 disabled:opacity-40">
          {analyzing?"Getting a review…":"Get NEXUS review"}
        </button>
        <button type="button" onClick={()=>refresh().catch(()=>setError("Room refresh failed."))} className="ifund-agent-panel-tool rounded-xl border border-slate-600 px-4 text-sm">Refresh</button>
      </div>
    </form>
  </section>;
}
