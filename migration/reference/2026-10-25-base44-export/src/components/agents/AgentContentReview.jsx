import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, ClipboardList, RefreshCcw, Pencil } from "lucide-react";

const lockedFields = new Set(["campaign_id", "community_id", "post_id", "blog_id", "entry_id", "donation_destination_connection_id"]);
const longFields = new Set(["content", "body", "story", "summary", "bio"]);
const labels = {
  social_post: "IFund social post",
  campaign_update: "Campaign update",
  campaign_changes: "Campaign changes",
  external_post: "Outside-platform draft",
  blog_entry: "Blog article draft",
  discussion_post: "Community discussion",
  discussion_reply: "Community reply",
  profile_update: "Profile changes",
};
const preview = (draft) => Object.entries(draft.payload || {})
  .filter(([key]) => !lockedFields.has(key))
  .map(([key, value]) => key.replaceAll("_", " ") + ": " +
    (typeof value === "string" ? value : JSON.stringify(value))).join("\n\n");

export default function AgentContentReview() {
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [confirmed, setConfirmed] = useState({});
  const [editing, setEditing] = useState("");
  const [revisions, setRevisions] = useState({});
  const [error, setError] = useState("");

  const load = async () => {
    setBusy("load");setError("");
    try {
      const r = await base44.functions.invoke("manageAgentContentDraft", {mode:"list"});
      if(!r?.data?.ok)throw new Error("Drafts unavailable");
      setDrafts(r.data.drafts||[]);setLoaded(true);
      setConfirmed({});setEditing("");setRevisions({});
    } catch { setError("Could not load AI content drafts. Try again."); }
    finally { setBusy(""); }
  };

  const editDraft = (draft) => {
    setRevisions(current=>({...current,[draft.id]:{...draft.payload}}));
    setEditing(draft.id);setConfirmed(current=>({...current,[draft.id]:false}));
  };
  const updateField = (draft, field, value) => {
    setRevisions(current=>({...current,[draft.id]:{...current[draft.id],[field]:value}}));
    setConfirmed(current=>({...current,[draft.id]:false}));
  };
  const act = async (draft, action) => {
    if(action==="apply"&&!confirmed[draft.id])return;
    setBusy(draft.id);setError("");
    try {
      let fn="manageAgentContentDraft",input={mode:action,draft_id:draft.id};
      if(action==="apply"){
        fn="applyAgentContentDraft";
        input={draft_id:draft.id,confirm_owner_review:true};
      }
      if(action==="revise")input={...input,payload:revisions[draft.id]};
      const r=await base44.functions.invoke(fn,input);
      if(!r?.data?.ok)throw new Error("Action was rejected");
      const next=action==="apply"
        ? {...draft,status:"applied",result_id:r.data.result_id,result_summary:r.data.result_summary||"Applied"}
        : action==="cancel"?{...draft,status:"cancelled"}:r.data.draft;
      setDrafts(items=>items.map(item=>item.id===draft.id?next:item));
      setConfirmed(current=>({...current,[draft.id]:false}));
      setEditing("");
    } catch {
      setError("This action was not confirmed. Refresh the list and check its status before attempting it again.");
      setConfirmed(current=>({...current,[draft.id]:false}));
    } finally {setBusy("");}
  };
  return <section aria-label="Review AI content drafts" className="space-y-3">
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <div className="flex gap-2 items-center font-semibold text-foreground"><ClipboardList className="h-4 w-4"/>Review content your AI team prepared</div>
      <button type="button" onClick={load} disabled={!!busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground">
        <RefreshCcw className="h-4 w-4"/> {loaded?"Refresh":"Show drafts"}
      </button>
    </div>
    <p className="text-sm text-muted-foreground">Your AI team prepares drafts. Review or edit before approving anything. Outside-platform drafts require separate permission to publish.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {loaded && !drafts.length && <p className="text-sm text-muted-foreground">No AI drafts yet.</p>}
    {drafts.map(d=><article key={d.id} className="p-3 sm:p-4 rounded-xl border border-border bg-background space-y-3">
      <div className="flex flex-wrap justify-between gap-2">
        <strong>{labels[d.kind]||d.kind}</strong><span className="text-sm text-muted-foreground">{d.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">Campaign: {d.campaign_id||"Not applicable"} · Destination: {d.connection_id||"IFund"} · Drafted by {d.source_agent||"AI team"}</p>
      {editing===d.id ? <div className="space-y-3">
        {Object.entries(revisions[d.id]||{}).filter(([key])=>!lockedFields.has(key)).map(([key,value])=>
          <label key={key} className="block text-sm text-foreground">
            <span className="block mb-1 font-medium capitalize">{key.replaceAll("_"," ")}</span>
            {typeof value==="boolean"?
              <input type="checkbox" checked={value} onChange={e=>updateField(d,key,e.target.checked)}/>:
             typeof value==="number"?
              <input type="number" min={key==="goal_amount"?0:undefined} value={value} onChange={e=>updateField(d,key,Number(e.target.value))} className="w-full min-h-11 rounded-lg border border-border bg-background px-3"/>:
             typeof value==="string"?
              longFields.has(key)?
              <textarea value={value} onChange={e=>updateField(d,key,e.target.value)} rows={5} className="w-full rounded-lg border border-border bg-background p-3 resize-y"/>:
              <input value={value} onChange={e=>updateField(d,key,e.target.value)} className="w-full min-h-11 rounded-lg border border-border bg-background px-3"/>:
              <p className="text-muted-foreground">This setting is best edited from its original account page.</p>}
          </label>)}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={()=>act(d,"revise")} className="min-h-11 rounded-lg bg-blue-700 text-white px-4">Save edits</button>
          <button type="button" disabled={!!busy} onClick={()=>setEditing("")} className="min-h-11 rounded-lg border border-border text-foreground px-4">Cancel editing</button>
        </div>
      </div>:<pre className="max-h-56 overflow-auto rounded-lg border border-border p-3 text-sm text-foreground font-sans whitespace-pre-wrap break-words">{preview(d)||"No text preview available"}</pre>}
      {d.status==="draft" && editing!==d.id && <>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={!!confirmed[d.id]} onChange={e=>setConfirmed(c=>({...c,[d.id]:e.target.checked}))}/>
          <span>I reviewed this exact content and destination and approve the resulting IFund action.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy||!confirmed[d.id]} onClick={()=>act(d,"apply")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50"><Check className="h-4 w-4"/>Apply approved content</button>
          <button type="button" disabled={!!busy} onClick={()=>editDraft(d)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground"><Pencil className="h-4 w-4"/>Edit draft</button>
          <button type="button" disabled={!!busy} onClick={()=>act(d,"cancel")}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-foreground">Discard</button>
        </div>
      </>}
      {d.result_summary&&<p className="text-sm text-muted-foreground">{d.result_summary}</p>}
      {d.status==="failed"&&<p className="text-sm text-destructive">The previous attempt was not confirmed. Check for a partial result before preparing a replacement.</p>}
    </article>)}
  </section>;
}
