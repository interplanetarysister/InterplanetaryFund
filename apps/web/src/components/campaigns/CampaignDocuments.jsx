import {CAMPAIGN_DOCUMENTS_ACTIVE} from "@/lib/campaignDocumentAvailability.mjs";
import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {
  DOCUMENT_CATEGORIES,DOCUMENT_MAX_BYTES,listCampaignDocuments,uploadCampaignDocument,
  updateDocumentAgentAccess,downloadPrivateCampaignDocument,removeCampaignDocument,
  findStaleCampaignDocumentUploads,removeStaleCampaignDocumentUpload
} from "@/api/campaignDocuments";

// One owner-scoped private library per saved campaign. Files never enter public
// covers or social publishing; per-document agent use is owner-controlled.
export default function CampaignDocuments(props) {
  return CAMPAIGN_DOCUMENTS_ACTIVE?<EnabledCampaignDocuments {...props}/>:null;
}
function EnabledCampaignDocuments({campaignId,ownerId}) {
  const [records,setRecords]=useState([]);
  const [accountLocked,setAccountLocked]=useState(false);
  const [retryCount,setRetryCount]=useState(0);
  const accountGeneration=useRef(0);
  // Render-time scope guard: effects run after paint, so old owner/campaign rows
  // must never be displayed during the first render after a prop transition.
  const visibleScope=useRef({ownerId:null,campaignId:null});
  const fileInputRef=useRef(null);
  const uploadLock=useRef(false);
  const accountBlocked=useRef(false);
  const [loading,setLoading]=useState(Boolean(campaignId&&ownerId));
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [file,setFile]=useState(null);
  const [purpose,setPurpose]=useState("general");
  const [summary,setSummary]=useState("");
  const [ownerExcerpt,setOwnerExcerpt]=useState("");
  const [teamAccess,setTeamAccess]=useState(false);
  const [editing,setEditing]=useState(null);
  const [staleUploads,setStaleUploads]=useState([]);
  const [staleScanned,setStaleScanned]=useState(false);
  const [draft,setDraft]=useState({summary:"",ownerExcerpt:"",purpose:"general",allowAgentUse:false});

  useEffect(()=>{
    if(!ownerId)return;
    const client=authClient();
    const {data}=client.auth.onAuthStateChange((_event,session)=>{
      if(session?.user?.id===ownerId && session?.user?.is_anonymous!==true)return;
      accountGeneration.current+=1;
      accountBlocked.current=true;
      setAccountLocked(true);
      visibleScope.current={ownerId:null,campaignId:null};
      setRecords([]);setStaleUploads([]);setStaleScanned(false);setFile(null);setSummary("");setOwnerExcerpt("");setTeamAccess(false);
      setEditing(null);setError("Your account changed. Reload before accessing private campaign documents.");
      setNotice("");setLoading(false);
    });
    return()=>data?.subscription?.unsubscribe();
  },[ownerId]);

  useEffect(()=>{
    let active=true;
    accountGeneration.current+=1;
    accountBlocked.current=true;
    setAccountLocked(true);
    const generation=accountGeneration.current;
    visibleScope.current={ownerId:null,campaignId:null};
    setRecords([]);setStaleUploads([]);setStaleScanned(false);setError("");setNotice("");
    if(!campaignId||!ownerId){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    (async()=>{
      const client=authClient();
      const {data:{user},error:identityError}=await client.auth.getUser();
      if(identityError||user?.id!==ownerId||user?.is_anonymous===true)throw new Error("Verify your account before opening private documents.");
      if(!active||generation!==accountGeneration.current)return;
      const rows=await listCampaignDocuments(client,campaignId);
      const {data:{user:confirmed},error:confirmationError}=await client.auth.getUser();
      if(confirmationError||confirmed?.id!==ownerId||confirmed?.is_anonymous===true)throw new Error("Account changed while loading documents.");
      if(active&&generation===accountGeneration.current){accountBlocked.current=false;visibleScope.current={ownerId,campaignId};setAccountLocked(false);setRecords(rows);}
    })()
      .catch(e=>{if(active&&generation===accountGeneration.current)setError(e.message||"Document library unavailable.");})
      .finally(()=>{if(active&&generation===accountGeneration.current)setLoading(false);});
    return()=>{active=false;};
  },[campaignId,ownerId,retryCount]);

  async function reload(){
    const generation=accountGeneration.current;
    if(accountBlocked.current)throw new Error("Account changed. Reload before accessing private documents.");
    const client=authClient();
    const {data:{user},error:identityError}=await client.auth.getUser();
    if(identityError||user?.id!==ownerId||user?.is_anonymous===true)throw new Error("Private document owner verification failed.");
    const rows=await listCampaignDocuments(authClient(),campaignId);
    const {data:{user:confirmed},error:confirmationError}=await client.auth.getUser();
    if(confirmationError||confirmed?.id!==ownerId||confirmed?.is_anonymous===true||generation!==accountGeneration.current||accountBlocked.current)throw new Error("Account changed. Reload before accessing private documents.");
    visibleScope.current={ownerId,campaignId};
    setRecords(rows);
  }
  async function saveFile(event){
    event.preventDefault();
    if(busy||uploadLock.current||!file||accountBlocked.current||accountLocked)return;
    uploadLock.current=true;
    setBusy(true);setError("");setNotice("");
    const generation=accountGeneration.current;
    try{
      const {data:before,error:beforeError}=await authClient().auth.getUser();
      if(beforeError||before?.user?.id!==ownerId||before?.user?.is_anonymous===true||generation!==accountGeneration.current||accountBlocked.current)return;
      await uploadCampaignDocument(authClient(),campaignId,file,{
        purpose,summary,ownerExcerpt,allowAgentUse:teamAccess
      });
      await reload();
      if(generation!==accountGeneration.current||accountBlocked.current)return;
      setNotice("Private document uploaded. It is not visible to campaign visitors.");
      setFile(null);setSummary("");setOwnerExcerpt("");setPurpose("general");setTeamAccess(false);
      if(fileInputRef.current)fileInputRef.current.value="";
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"Upload failed.");}
    finally{uploadLock.current=false;setBusy(false);}
  }
  async function saveAccess(row){
    if(busy||accountBlocked.current||accountLocked)return;
    const generation=accountGeneration.current;
    setBusy(true);setError("");setNotice("");
    try{
      const {data:before,error:beforeError}=await authClient().auth.getUser();
      if(beforeError||before?.user?.id!==ownerId||generation!==accountGeneration.current||accountBlocked.current)return;
      await updateDocumentAgentAccess(authClient(),campaignId,row,{
        allowAgentUse:draft.allowAgentUse,summary:draft.summary,ownerExcerpt:draft.ownerExcerpt,purpose:draft.purpose
      });
      await reload();
      if(generation!==accountGeneration.current||accountBlocked.current)return;
      setEditing(null);setNotice("Agent reference settings updated.");
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"Document settings were not saved.");}
    finally{setBusy(false);}
  }
  async function download(row){
    if(busy||accountBlocked.current||accountLocked)return;
    const generation=accountGeneration.current;
    setBusy(true);setError("");setNotice("");
    try{
      const blob=await downloadPrivateCampaignDocument(authClient(),campaignId,row);
      const {data,error:identityError}=await authClient().auth.getUser();
      if(identityError||data?.user?.id!==ownerId||generation!==accountGeneration.current||accountBlocked.current)return;
      const objectUrl=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=objectUrl;link.download=row.file_name;link.rel="noopener";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"The file could not be downloaded.");}
    finally{setBusy(false);}
  }
  async function scanOrphans(){
    if(busy||accountBlocked.current||accountLocked)return;
    const generation=accountGeneration.current;
    setBusy(true);setError("");setNotice("");
    try{
      const docs=await findStaleCampaignDocumentUploads(authClient(),campaignId);
      if(generation!==accountGeneration.current||accountBlocked.current)return;
      setStaleUploads(docs);setStaleScanned(true);
      setNotice(docs.length
        ?docs.length+" incomplete old uploads found. Registered campaign files will not be removed."
        :"No incomplete uploads older than 24 hours were found.");
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"Unable to inspect incomplete uploads.");}
    finally{setBusy(false);}
  }
  async function removeOrphan(candidate){
    if(busy||accountBlocked.current||accountLocked)return;
    if(!window.confirm("Delete this incomplete upload? This only removes a private file older than 24 hours with no saved campaign document record."))return;
    const generation=accountGeneration.current;
    setBusy(true);setError("");setNotice("");
    try{
      await removeStaleCampaignDocumentUpload(authClient(),campaignId,candidate.path);
      if(generation!==accountGeneration.current||accountBlocked.current)return;
      setStaleUploads(current=>current.filter(row=>row.path!==candidate.path));
      setNotice("Incomplete private upload securely removed.");
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"Incomplete upload could not be removed.");}
    finally{setBusy(false);}
  }
  async function remove(row){
    if(busy||accountBlocked.current||accountLocked)return;
    if(!window.confirm(`Remove "${row.file_name}" from your private campaign documents?`))return;
    const generation=accountGeneration.current;
    setBusy(true);setError("");setNotice("");
    try{
      const {data:before,error:beforeError}=await authClient().auth.getUser();
      if(beforeError||before?.user?.id!==ownerId||generation!==accountGeneration.current||accountBlocked.current)return;
      await removeCampaignDocument(authClient(),campaignId,row);
      await reload();
      if(generation!==accountGeneration.current||accountBlocked.current)return;
      setNotice("Document removed from your campaign library.");
    }catch(e){if(generation===accountGeneration.current&&!accountBlocked.current)setError(e.message||"The document could not be removed.");}
    finally{setBusy(false);}
  }

  const scopeMatches=visibleScope.current.ownerId===ownerId&&visibleScope.current.campaignId===campaignId;
  const visibleRecords=scopeMatches&&!accountLocked?records:[];
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
          PDF, Word (DOCX), Excel (XLSX), TXT, Markdown or CSV · Maximum {Math.floor(DOCUMENT_MAX_BYTES/1048576)} MB each · Up to 15 per campaign. Private storage is limited to 200 MB per account.
          For PDF, Word and Excel, agents use your written description and excerpts you provide; automatic document extraction is not yet verified.
          Plain-text extracts are available only when you enable agent use.
        </p>
        <form onSubmit={saveFile} className="space-y-3 rounded-xl border border-border p-4">
          <label className="block text-sm font-semibold" htmlFor="campaign-reference-file">Upload a fundraising document
            <input ref={fileInputRef} id="campaign-reference-file" name="document" type="file"
              accept=".pdf,.docx,.xlsx,.txt,.md,.csv,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy||loading||accountLocked}
              onChange={event=>setFile(event.target.files?.[0]||null)}
              className="mt-2 block w-full text-sm" />
          </label>
          <label className="block text-sm font-semibold">Document category
            <select value={purpose} onChange={e=>setPurpose(e.target.value)}
              disabled={busy||accountLocked} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3">
              {Object.entries(DOCUMENT_CATEGORIES).map(([id,title])=><option key={id} value={id}>{title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">What should your agents know about this document?
            <textarea value={summary} onChange={e=>setSummary(e.target.value)}
              rows={3} maxLength={3000} disabled={busy||accountLocked}
              placeholder="Summarize the facts agents may reference. Include relevant figures, dates, audience or requirements."
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
          </label>
          <label className="block text-sm font-semibold">Important document excerpts (optional)
            <textarea value={ownerExcerpt} onChange={e=>setOwnerExcerpt(e.target.value)}
              rows={3} maxLength={4000} disabled={busy||accountLocked}
              placeholder="Paste only the sections you want your agents to consider. Avoid passwords, payment details or private third-party contact information."
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={teamAccess} onChange={e=>setTeamAccess(e.target.checked)} disabled={busy||accountLocked}
              className="mt-1" />
            <span>Allow my iFund agent team to use this document's description and supported text excerpts when preparing campaign materials. This does not publish the file or approve outreach.</span>
          </label>
          <button type="submit" disabled={!file||busy||loading||accountLocked||visibleRecords.length>=15||(teamAccess&&summary.trim().length<20)}
            className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
            {busy?"Saving…":"Upload private document"}
          </button>
        </form>
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Recover storage from interrupted uploads</p>
          <p className="text-xs text-muted-foreground">
            Check for files uploaded more than 24 hours ago that never received a campaign document record.
            Registered documents are protected and are never deleted by this cleanup.
          </p>
          <button type="button" onClick={()=>void scanOrphans()} disabled={busy||loading||accountLocked}
            className="min-h-11 rounded-lg border border-border px-3 text-sm">Find incomplete uploads</button>
          {staleScanned&&staleUploads.length===0&&<p role="status" className="text-xs">No stale incomplete uploads to remove.</p>}
          {staleUploads.length>0&&<ul className="space-y-2">
            {staleUploads.map(item=><li key={item.path} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
              <span className="break-all text-xs">{item.name} · Incomplete upload</span>
              <button type="button" disabled={busy||accountLocked} onClick={()=>void removeOrphan(item)}
                className="min-h-11 rounded-lg border border-border px-3 text-sm">Remove incomplete file</button>
            </li>)}
          </ul>}
        </div>
        {loading&&<p className="text-sm" role="status">Loading private documents…</p>}
        {accountLocked&&<div role="status" className="space-y-2 text-sm text-muted-foreground"><p>Private documents are hidden until this account is verified.</p><button type="button" disabled={loading||busy} onClick={()=>setRetryCount(n=>n+1)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Retry account verification</button></div>}
        {error&&<p className="text-sm text-destructive" role="alert">{error}</p>}
        {notice&&<p className="text-sm" role="status">{notice}</p>}
        {!loading&&!accountLocked&&visibleRecords.length===0&&<p className="text-sm text-muted-foreground">No documents uploaded for this campaign.</p>}
        {!accountLocked&&visibleRecords.length>0&&<ul className="space-y-3">
          {visibleRecords.map(row=><li key={row.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">{row.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_CATEGORIES[row.purpose]||"Reference"} · {(row.file_size/1024).toFixed(0)} KB · {row.deletion_requested_at?"Pending secure deletion":row.allow_agent_use?"Agent reference enabled":"Private, not shared with agents"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy||accountLocked||Boolean(row.deletion_requested_at)} onClick={()=>download(row)} className="min-h-11 rounded-lg border border-border px-3 text-sm">Download</button>
                <button type="button" disabled={busy||accountLocked||Boolean(row.deletion_requested_at)} onClick={()=>{setEditing(row.id);setDraft({summary:row.agent_summary||"",ownerExcerpt:row.owner_excerpt||"",purpose:row.purpose,allowAgentUse:row.allow_agent_use});}}
                  className="min-h-11 rounded-lg border border-border px-3 text-sm">Agent settings</button>
                <button type="button" disabled={busy||accountLocked} onClick={()=>remove(row)} className="min-h-11 rounded-lg border border-border px-3 text-sm">{row.deletion_requested_at?"Retry secure removal":"Remove"}</button>
              </div>
            </div>
            {editing===row.id&&<div className="mt-3 space-y-3">
              <label className="block text-sm font-semibold">Agent reference summary
                <textarea value={draft.summary} onChange={e=>setDraft(v=>({...v,summary:e.target.value}))}
                  maxLength={3000} rows={3} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
              </label>
              <label className="block text-sm font-semibold">Important excerpts you want agents to reference
                <textarea value={draft.ownerExcerpt} onChange={e=>setDraft(v=>({...v,ownerExcerpt:e.target.value}))}
                  rows={3} maxLength={4000} className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" />
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
                <button type="button" disabled={busy||accountLocked||(draft.allowAgentUse&&draft.summary.trim().length<20)}
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
