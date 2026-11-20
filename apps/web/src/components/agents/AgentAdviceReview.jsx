import {useEffect,useMemo,useRef,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {authClient} from "@/api/auth";
import {readAgentAdvice,forgetAgentAdvice,AgentAdviceHandoffError} from "@/lib/agentAdviceHandoff.mjs";

// Never saves or publishes a campaign. Only an explicit member click changes
// the local editor; existing owner save/publish flows remain authoritative.
export default function AgentAdviceReview({ownerId,campaignId=null,currentStory="",disabled=false,onApply,onBusyChange}){
  const [params,setParams]=useSearchParams();
  const id=params.get("agentAdvice");
  const scope=JSON.stringify([ownerId,campaignId,id]);
  const scopeRef=useRef(scope);
  const pending=useRef(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const advice=useMemo(()=>{
    if(!id||!ownerId)return null;
    try{return readAgentAdvice(sessionStorage,{ownerId,id,campaignId});}catch{return null;}
  },[ownerId,id,campaignId]);
  useEffect(()=>{
    scopeRef.current=scope;pending.current=false;setBusy(false);setError("");
    onBusyChange?.(false);
  },[scope,onBusyChange]);
  if(!id)return notice?<p role="status" className="rounded-xl border p-4">{notice}</p>:null;
  if(!advice)return <section role="status" className="rounded-xl border border-border bg-card p-4">
    This agent answer is expired or belongs to a different account or campaign. Nothing was changed.
    <Link className="ml-2 underline" to="/agents">Return to the agent team</Link>
  </section>;
  const overflow=(currentStory?currentStory.trim().length+2:0)+advice.answer.length>12000;
  async function accept(){
    if(pending.current||disabled||overflow||!onApply)return;
    pending.current=true;setBusy(true);onBusyChange?.(true);setError("");
    try{
      const current=await authClient().auth.getUser();
      if(current.error||current.data?.user?.id!==ownerId||
        current.data.user.is_anonymous===true||!current.data.user.email_confirmed_at)
        throw new AgentAdviceHandoffError("Sign in with the same verified account before using this answer.");
      if(scopeRef.current!==scope)throw new AgentAdviceHandoffError("Your editor changed. Reopen the saved answer.");
      const refreshed=readAgentAdvice(sessionStorage,{ownerId,id,campaignId});
      if(!refreshed||refreshed.answer!==advice.answer)
        throw new AgentAdviceHandoffError("This answer changed or expired. Open it again from Agent Team.");
      const combined=currentStory?.trim()?currentStory.trim()+"\n\n"+refreshed.answer:refreshed.answer;
      if(combined.length>12000)throw new AgentAdviceHandoffError("The story would be too long. Edit your existing story first.");
      await onApply(combined);
      if(scopeRef.current!==scope)return;
      forgetAgentAdvice(sessionStorage,{ownerId,id,campaignId});
      const next=new URLSearchParams(params);next.delete("agentAdvice");setParams(next,{replace:true});
      setNotice("Agent advice added to your story editor. Review and save your campaign to keep the change. Nothing was published.");
    }catch(cause){if(scopeRef.current===scope)setError(cause?.message||"The advice could not be added.");}
    finally{pending.current=false;if(scopeRef.current===scope){setBusy(false);onBusyChange?.(false);}}
  }
  function dismiss(){
    if(busy)return;
    forgetAgentAdvice(sessionStorage,{ownerId,id,campaignId});
    const next=new URLSearchParams(params);next.delete("agentAdvice");setParams(next,{replace:true});
    setNotice("Your existing campaign story was kept unchanged.");
  }
  return <section aria-label="Review AI agent advice" className="space-y-4 rounded-2xl border border-cyan-400/40 bg-card p-5 sm:p-7">
    <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Agent Team handoff</p>
      <h2 className="mt-2 text-xl font-semibold">Review advice before adding it</h2>
      <p className="mt-2 text-sm text-muted-foreground">This {advice.agent.toUpperCase()} answer is advisory text, not verified campaign facts. It will be appended to the story editor only if you choose. Review it carefully and save the campaign separately.</p>
    </div>
    <div className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-relaxed">{advice.answer}</div>
    {overflow&&<p role="alert" className="text-sm text-destructive">Your story would exceed 12,000 characters. Shorten the story first; nothing has been changed.</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy||disabled||overflow} onClick={accept} className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy?"Checking account…":"Append advice to story"}</button>
      <button type="button" disabled={busy} onClick={dismiss} className="min-h-12 rounded-xl border border-border px-4 font-semibold disabled:opacity-50">Keep my existing story</button>
    </div>
  </section>;
}
