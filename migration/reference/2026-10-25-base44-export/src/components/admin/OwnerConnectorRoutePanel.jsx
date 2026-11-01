import React,{useState} from 'react';
import {base44} from '@/api/base44Client';

// An owner-only configuration request UI. Server rechecks owner identity,
// route status, pending request, and conditional write on every invocation.
export default function OwnerConnectorRoutePanel() {
  const [platform,setPlatform]=useState('');
  const [operation,setOperation]=useState('connect');
  const [transport,setTransport]=useState('oauth');
  const [preview,setPreview]=useState(null);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const [approval,setApproval]=useState(false);
  const clear=()=>{setPreview(null);setApproval(false);setStatus('');};
  const invoke=async(mode,payload)=>{
    const reply=await base44.functions.invoke('manageOwnerConnectionConfiguration',{mode,...payload});
    const data=reply?.data;
    if(!data?.ok)throw new Error('Request could not be completed');
    return data;
  };
  const prepare=async()=>{
    setBusy(true);clear();
    try {
      const result=await invoke('prepare',{platform:platform.trim().toLowerCase(),operation,transport});
      setPreview(result);
      setStatus('Review the requested change before approving it.');
    } catch {
      setStatus('This provider route could not be prepared. Check that it is an existing approved option.');
    } finally {setBusy(false);}
  };
  const execute=async()=>{
    if(!preview?.request_id||!approval)return;
    setBusy(true);setStatus('');
    try {
      const result=await invoke('execute',{request_id:preview.request_id,confirm:true});
      setStatus(result.status==='applied'
        ? 'IFund route preference updated. This does not connect or authorize the external provider.'
        : 'Review the saved request status.');
      setPreview(null);
    } catch {
      setStatus('The change was not confirmed. Check its status before attempting another request.');
    } finally {setBusy(false);}
  };
  const check=async()=>{
    if(!preview?.request_id)return;
    setBusy(true);
    try {
      const result=await invoke('status',{request_id:preview.request_id});
      setStatus('Request status: '+result.status+(result.result_summary?' — '+result.result_summary:''));
      if(result.status!=='pending')setApproval(false);
    } catch {setStatus('Could not retrieve the request status.');}
    finally{setBusy(false);}
  };
  return <section className="mt-5 rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Owner connection route settings">
    <h2 className="text-lg font-semibold">Owner connection settings</h2>
    <p className="text-sm text-muted-foreground">Change IFund's internal connection preference for an existing provider recipe. This cannot grant access to a third-party account, create a provider registration, or change payment settings.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm">Provider ID
        <input value={platform} maxLength={80} onChange={e=>{setPlatform(e.target.value);clear();}} placeholder="instagram" className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground"/>
      </label>
      <label className="block text-sm">Purpose
        <select className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground" value={operation} onChange={e=>{setOperation(e.target.value);clear();}}>
          <option value="connect">Connect</option><option value="read_metrics">Read metrics</option><option value="publish">Publish</option><option value="account_create">Account setup</option>
        </select>
      </label>
      <label className="block text-sm">Connection method
        <select className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground" value={transport} onChange={e=>{setTransport(e.target.value);clear();}}>
          {['oauth','api','webhook','token','authenticated_browser','public_browser','manual'].map(t=><option value={t} key={t}>{t.replaceAll('_',' ')}</option>)}
        </select>
      </label>
    </div>
    <button type="button" disabled={busy||!platform.trim()} className="rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50" onClick={prepare}>Review change</button>
    {preview&&<div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-sm">Current method: <strong>{preview.preview?.previous_transport || 'Unknown'}</strong></p>
      <p className="text-sm">Proposed method: <strong>{preview.preview?.proposed_transport}</strong></p>
      <p className="text-xs text-muted-foreground">This changes the internal preference only. It does not verify provider permissions.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)}/>I approve this specific IFund configuration change.</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!approval||busy} onClick={execute} className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">Apply approved change</button>
        <button type="button" disabled={busy} onClick={check} className="rounded border px-3 py-2">Check request status</button>
      </div>
    </div>}
    {status&&<p role="status" className="text-sm text-foreground">{status}</p>}
  </section>;
}
