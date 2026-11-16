import {CAMPAIGN_DOCUMENTS_ACTIVE} from "@/lib/campaignDocumentAvailability.mjs";
import {useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {authClient} from "@/api/auth";
import {
  listOwnerDocumentPermissions,revokeAllOwnerDocumentAgentUse,
  updateDocumentAgentAccess,DOCUMENT_CATEGORIES
} from "@/api/campaignDocuments";

const PAGE_SIZE=40;
export default function CampaignDocumentPermissions(){
  if(!CAMPAIGN_DOCUMENTS_ACTIVE)
    return <section className="rounded-xl border border-border p-5" aria-label="Campaign document permissions unavailable">
      <h2 className="font-semibold">Campaign documents</h2>
      <p className="mt-2 text-sm text-muted-foreground">Private document upload and agent permissions are being prepared. They will be available after the secure storage service is enabled.</p>
    </section>;
  return <EnabledCampaignDocumentPermissions/>;
}
function EnabledCampaignDocumentPermissions(){
  const [records,setRecords]=useState([]);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const ownerRef=useRef(null);
  useEffect(()=>{
    let active=true;
    setRecords([]);setError("");setMessage("");setLoading(true);
    const client=authClient();
    const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>{
      if(!active||!ownerRef.current)return;
      if(session?.user?.id!==ownerRef.current){
        setRecords([]);setHasMore(false);setError("Your account changed. Reload your private document permissions.");
        setLoading(false);
      }
    });
    (async()=>{
      const {data,error:identityError}=await client.auth.getUser();
      if(identityError||!data?.user?.id)throw Error("Sign in to manage private document permissions.");
      ownerRef.current=data.user.id;
      const docs=await listOwnerDocumentPermissions(client,{limit:PAGE_SIZE});
      if(!active)return;
      setRecords(docs);setHasMore(docs.length===PAGE_SIZE);setLoading(false);
    })().catch(e=>{if(active){setRecords([]);setHasMore(false);setError(e.message||"Document permissions unavailable.");setLoading(false);}});
    return()=>{active=false;ownerRef.current=null;subscription?.subscription?.unsubscribe();};
  },[refresh]);

  async function setAccess(row,enabled){
    if(busy||row.deletion_requested_at)return;
    setBusy(true);setError("");setMessage("");
    try{
      await updateDocumentAgentAccess(authClient(),row.campaign_id,row,{
        allowAgentUse:enabled,
        summary:row.agent_summary||"",
        ownerExcerpt:row.owner_excerpt||"",
        purpose:row.purpose,
      });
      setRecords(existing=>existing.map(item=>item.id===row.id?{...item,allow_agent_use:enabled}:item));
      setMessage(enabled?"Agent reference enabled for this document only.":"Agent reference revoked for this document.");
    }catch(e){setError(e.message||"Permission not updated.");}
    finally{setBusy(false);}
  }
  async function revokeAll(){
    if(busy||!window.confirm("Turn off iFund agent access to all uploaded campaign documents? Your private files will be kept."))return;
    setBusy(true);setError("");setMessage("");
    try{
      const changed=await revokeAllOwnerDocumentAgentUse(authClient());
      setRecords(rows=>rows.map(row=>({...row,allow_agent_use:false})));
      setMessage("Agent use disabled for "+changed+" documents across your account. The files remain private and stored.");
    }catch(e){setError(e.message||"Unable to revoke account-wide agent document access.");}
    finally{setBusy(false);}
  }
  async function more(){
    if(busy||loading||!hasMore)return;
    setBusy(true);setError("");
    try{
      const page=await listOwnerDocumentPermissions(authClient(),{offset:records.length,limit:PAGE_SIZE});
      setRecords(rows=>[...rows,...page.filter(doc=>!rows.some(existing=>existing.id===doc.id))]);
      setHasMore(page.length===PAGE_SIZE);
    }catch(e){setError(e.message||"Older documents could not be loaded.");}
    finally{setBusy(false);}
  }
  const authorized=records.filter(row=>row.allow_agent_use&&!row.deletion_requested_at).length;
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Campaign document agent permissions">
    <header className="space-y-2">
      <h2 className="text-lg font-semibold">Campaign document permissions</h2>
      <p className="text-sm text-muted-foreground">Review which private fundraising references your iFund agent team may use. Permission is per document and does not authorize outreach, publication, or payment.</p>
      <p className="text-sm">{records.length} documents loaded · {authorized} enabled for agents in this view</p>
      <button type="button" disabled={busy||loading} onClick={revokeAll}
        className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">
        Turn off agent access to all my campaign documents
      </button>
    </header>
    {loading&&<p role="status" className="text-sm">Loading your private document permissions…</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {!loading&&!records.length&&!error&&<p className="text-sm text-muted-foreground">No documents have been added to your campaigns yet.</p>}
    {records.length>0&&<ul className="space-y-3">
      {records.map(row=><li key={row.id} className="rounded-xl border border-border p-3">
        <p className="break-words text-sm font-semibold">{row.file_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{DOCUMENT_CATEGORIES[row.purpose]||"Campaign reference"} · {row.deletion_requested_at?"Pending private-file deletion":row.allow_agent_use?"Agent reference enabled":"Agent reference disabled"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy||Boolean(row.deletion_requested_at)||(!row.allow_agent_use&&(row.agent_summary||"").trim().length<20)}
            onClick={()=>setAccess(row,!row.allow_agent_use)}
            className="min-h-11 rounded-lg border border-border px-3 text-sm">
            {row.allow_agent_use?"Disable agent access":"Enable agent access"}
          </button>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm"
            to={"/campaigns/"+encodeURIComponent(row.campaign_id)+"/edit"}>
            Edit document summary in campaign
          </Link>
        </div>
        {!row.allow_agent_use&&(row.agent_summary||"").trim().length<20&&<p className="mt-2 text-xs text-muted-foreground">Add a 20-character description in the campaign editor before enabling agent use.</p>}
      </li>)}
    </ul>}
    {hasMore&&<button type="button" onClick={more} disabled={busy} className="min-h-11 rounded-lg border border-border px-4 text-sm">Load more documents</button>}
    <button type="button" onClick={()=>setRefresh(value=>value+1)} disabled={busy||loading} className="min-h-11 rounded-lg border border-border px-4 text-sm">Refresh document permissions</button>
  </section>;
}
