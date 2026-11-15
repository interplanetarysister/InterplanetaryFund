import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {
  DOCUMENT_CATEGORIES,DOCUMENT_MAX_BYTES,listCampaignDocuments,uploadCampaignDocument,
  updateDocumentAgentAccess,downloadPrivateCampaignDocument,removeCampaignDocument
} from "@/api/campaignDocuments";

// One owner-scoped private library per saved campaign. Files never enter public
// covers or social publishing; per-document agent use is owner-controlled.
export default function CampaignDocuments({campaignId,ownerId}) {
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(Boolean(campaignId&&ownerId));
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [file,setFile]=useState(null);
  const [purpose,setPurpose]=useState("general");
  const [summary,setSummary]=useState("");
  const [teamAccess,setTeamAccess]=useState(false);
  const [editing,setEditing]=useState(null);
  const [draft,setDraft]=useState({summary:"",purpose:"general",allowAgentUse:false});

  useEffect(()=>{
    let active=true;
    setRecords([]);setError("");setNotice("");
    if(!campaignId||!ownerId){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    listCampaignDocuments(authClient(),campaignId)
      .then(rows=>{if(active)setRecords(rows);})
      .catch(e=>{if(active)setError(e.message||"Document library unavailable.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[campaignId,ownerId]);

  async function reload(){
    const rows=await listCampaignDocuments(authClient(),campaignId);
    setRecords(rows);
  }
  async function saveFile(event){
    event.preventDefault();
    if(busy||!file)return;
    setBusy(true);setError("");setNotice("");
    try{
      await uploadCampaignDocument(authClient(),campaignId,file,{
        purpose,summary,allowAgentUse:teamAccess
      });
      await reload();
      setNotice("Private document uploaded. It is not visible to campaign visitors.");
      setFile(null);setSummary("");setPurpose("general");setTeamAccess(false);
      if(event.currentTarget?.elements?.document)event.currentTarget.elements.document.value="";
    }catch(e){setError(e.message||"Upload failed.");}
    finally{setBusy(false);}
  }
  async function saveAccess(row){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      await updateDocumentAgentAccess(authClient(),campaignId,row,{
        allowAgentUse:draft.allowAgentUse,summary:draft.summary,purpose:draft.purpose
      });
      await reload();setEditing(null);setNotice("Agent reference settings updated.");
    }catch(e){setError(e.message||"Document settings were not saved.");}
    finally{setBusy(false);}
  }
  async function download(row){
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const blob=await downloadPrivateCampaignDocument(authClient(),campaignId,row);
      const objectUrl=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=objectUrl;link.download=row.file_name;link.rel="noopener";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(e){setError(e.message||"The file could not be downloaded.");}
    finally{setBusy(false);}
  }
  async function remove(row){
    if(busy)return;
    if(!window.confirm(`Remove "${row.file_name}" from your private campaign documents?`))return;
    setBusy(true);setError("");setNotice("");
    try{
      await removeCampaignDocument(authClient(),campaignId,row);
      await reload();setNotice("Document removed from your campaign library.");
    }catch(e){setError(e.message||"The document could not be removed.");}
    finally{setBusy(false);}
  }

  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Private campaign documents">
    <div>
      <h2 className="text-xl font-semibold">Campaign documents</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Keep budgets, planning notes, reports, supporting evidence and outreach references together.
        Uploaded files stay private to your account. Choose which documents the iFund agent team may reference.
      </p>
    </div>
    {!campaignId||!ownerId ?
      <p className="text-sm text-muted-foreground" role="status">
        Save a private campaign draft with your verified account before adding documents.
      </p> :
      <>
        <p className="text-xs text-muted-foreground">
          PDF, Word (DOCX), TXT, Markdown or CSV · Maximum {Math.floor(DOCUMENT_MAX_BYTES/1048576)} MB each · Up to 15 per campaign.
          For PDF and Word, agents use your written description until private document extraction is verified.
          Plain-text extracts are available only when you enable agent use.
        </p>
        <form onSubmit={saveFile} className="space-y-3 rounded-xl border border-border p-4">
          <label className="block text-sm font-semibold" htmlFor="campaign-reference-file">Upload a fundraising document
            <input id="campaign-reference-file" name="document" type="file"
              accept=".pdf,.docx,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={busy||loading}
              onChange={event=>setFile(event.target.files?.[0]||null)}
              className="mt-2 block w-full text-sm" />
          </label>
          <label className="block text-sm font-semibold">Document category
            <select value={purpose} onChange={e=>setPurpose(e.target.value)}
              disabled={busy} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3">
              {Object.entries(DOCUMENT_CATEGORIES).map(([id,title])=><option key={id} value={id}>{title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">What should your agents know about this document?
            <textarea value={summary} onChange={e=>setSummary(e.target.value)}
              rows={3} maxLength={3000} disabled={busy}
              placeholder="Summarize the facts agents may reference. Include relevant figures, dates, audience or requirements."
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={teamAccess} onChange={e=>setTeamAccess(e.target.checked)} disabled={busy}
              className="mt-1" />
            <span>Allow my iFund agent team to use this document's description and supported text excerpts when preparing campaign materials. This does not publish the file or approve outreach.</span>
          </label>
          <button type="submit" disabled={!file||busy||loading||records.length>=15||(teamAccess&&summary.trim().length<20)}
            className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy?"Saving…":"Upload private document"}
          </button>
        </form>
        {loading&&<p className="text-sm" role="status">Loading private documents…</p>}
        {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
        {notice&&<p className="text-sm" role="status">{notice}</p>}
        {!loading&&records.length===0&&<p className="text-sm text-muted-foreground">No documents uploaded for this campaign.</p>}
        {records.length>0&&<ul className="space-y-3">
          {records.map(row=><li key={row.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">{row.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORIES[row.purpose]||"Reference"} · {(row.file_size/1024).toFixed(0)} KB · {row.allow_agent_use?"Agent reference enabled":"Private, not shared with agents"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={()=>download(row)} className="min-h-11 rounded-lg border border-border px-3 text-sm">Download</button>
                <button type="button" disabled={busy} onClick={()=>{setEditing(row.id);setDraft({summary:row.agent_summary||"",purpose:row.purpose,allowAgentUse:row.allow_agent_use});}}
                  className="min-h-11 rounded-lg border border-border px-3 text-sm">Agent settings</button>
                <button type="button" disabled={busy} onClick={()=>remove(row)} className="min-h-11 rounded-lg border border-border px-3 text-sm">Remove</button>
              </div>
            </div>
            {editing===row.id&&<div className="mt-3 space-y-3">
              <label className="block text-sm font-semibold">Agent reference summary
                <textarea value={draft.summary} onChange={e=>setDraft(v=>({...v,summary:e.target.value}))}
                  maxLength={3000} rows={3} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold">Category
                <select value={draft.purpose} onChange={e=>setDraft(v=>({...v,purpose:e.target.value}))}
                  className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3">
                  {Object.entries(DOCUMENT_CATEGORIES).map(([id,title])=><option key={id} value={id}>{title}</option>)}
                </select>
              </label>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.allowAgentUse}
                onChange={e=>setDraft(v=>({...v,allowAgentUse:e.target.checked}))} />
                Let my agent team reference this description and supported text</label>
              <div className="flex gap-2">
                <button type="button" disabled={busy||(draft.allowAgentUse&&draft.summary.trim().length<20)}
                  onClick={()=>saveAccess(row)} className="min-h-11 rounded-lg bg-primary px-3 text-sm text-primary-foreground">Save settings</button>
                <button type="button" onClick={()=>setEditing(null)} className="min-h-11 rounded-lg border border-border px-3 text-sm">Cancel</button>
              </div>
            </div>}
          </li>)}
        </ul>}
      </>
    }
  </section>;
}
