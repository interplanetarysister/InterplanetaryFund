import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const LABELS = {
  story:"STORY", polaris:"POLARIS", echo:"ECHO", orbit:"ORBIT", nexus:"NEXUS",
};
/** Displays rule-based suggestions persisted in the account's private editorial queue.
 * This does not claim that any model has independently deliberated or executed a task.
 */
export default function EditorialAgentQueue() {
  const [open,setOpen] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const [state,setState] = useState({phase:"idle",rows:[],error:""});
  const [acknowledging,setAcknowledging] = useState("");
  const [notice,setNotice] = useState("");
  async function acknowledge(item) {
    if(acknowledging)return;
    setAcknowledging(item.review_id);setNotice("");
    try {
      const {data,error}=await authClient().rpc("ifund_acknowledge_editorial_review",{
        p_review_id:item.review_id,
      });
      if(error||data!==true)throw new Error(error?.message||"Review acknowledgment was not confirmed.");
      setNotice("Your review acknowledgment was recorded. This does not certify an agent action.");
      setRefresh(v=>v+1);
    }catch(e){setNotice(e.message||"Unable to update review.");}
    finally{setAcknowledging("")}
  }
  useEffect(()=>{
    if(!open)return;
    let active=true;
    setState({phase:"loading",rows:[],error:""});
    authClient().rpc("ifund_my_editorial_agent_reviews").then(({data,error})=>{
      if(!active)return;
      if(error||!Array.isArray(data))throw new Error("Private editorial reviews could not be verified.");
      setState({phase:"ready",rows:data,error:""});
    }).catch(e=>{if(active)setState({phase:"error",rows:[],error:e.message||"Unavailable"});});
    return ()=>{active=false};
  },[open,refresh]);
  return <section className="rounded-2xl border border-border bg-card p-5 space-y-3" aria-label="Cross-agent editorial review queue">
    <h2 className="text-xl font-semibold">Prepublication agent review queue</h2>
    <p className="text-sm text-muted-foreground">
      Owner-submitted improvement proposals are organized by specialist role.
      Perspectives here are free deterministic editorial prompts, not an independent AI conversation.
      Your story text is not copied into these queue records.
    </p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>setOpen(v=>!v)} className="min-h-11 rounded-xl border px-4 font-semibold">
        {open?"Hide":"Open"} private editorial reviews
      </button>
      {open && <button type="button" onClick={()=>setRefresh(n=>n+1)} className="min-h-11 rounded-xl border px-4">Refresh</button>}
    </div>
    {open && <div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {state.phase==="loading" && <p role="status">Loading authorized reviews…</p>}
      {state.phase==="error" && <p role="alert" className="text-red-600">{state.error}</p>}
      {state.phase==="ready" && (state.rows.length===0
        ? <p className="text-sm text-muted-foreground">No editorial proposals recorded yet. Save a draft and use its Prepublication quality review.</p>
        : <ul className="space-y-4">{state.rows.map(item=><li key={item.review_id} className="rounded-xl border p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{LABELS[item.lead_agent]||"Agent"} · {item.review_status||"Queued"}</p>
          <h3 className="font-semibold">{item.task_title}</h3>
          <p className="text-sm">{item.suggested_action}</p>
          {Array.isArray(item.discussion) && item.discussion.length>0 &&
            <ol className="space-y-2">{item.discussion.map((note,i)=><li key={i} className="rounded-lg bg-muted/50 p-3 text-sm">
              <strong>{LABELS[note.agent]||"Agent"} — {note.kind==="rule_based_proposal"?"Proposal":"Cross-review"}</strong>
              <p className="mt-1">{note.text}</p>
            </li>)}</ol>}
          <Link className="inline-flex min-h-11 items-center underline" to={`/campaigns/${encodeURIComponent(item.campaign_id)}/edit`}>Review and improve campaign</Link>
          {item.review_status!=="acknowledged" &&
            <button type="button" disabled={Boolean(acknowledging)}
              onClick={()=>acknowledge(item)} className="ml-3 min-h-11 rounded-xl border px-3 text-sm disabled:opacity-50">
              {acknowledging===item.review_id?"Recording…":"I reviewed this suggestion"}
            </button>}
        </li>)}</ul>)}
    </div>}
  </section>;
}
