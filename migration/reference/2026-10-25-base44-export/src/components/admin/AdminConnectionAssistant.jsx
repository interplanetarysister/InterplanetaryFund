import React,{useState} from 'react';
import {base44} from '@/api/base44Client';

export default function AdminConnectionAssistant(){
 const [input,setInput]=useState(''),[analysis,setAnalysis]=useState(null),[provider,setProvider]=useState(''),[endpoint,setEndpoint]=useState(''),[authType,setAuthType]=useState(''),[notes,setNotes]=useState(''),[record,setRecord]=useState(null),[test,setTest]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const call=async(action,data={})=>{
  const response=await base44.functions.invoke('adminApiConnectionIntake',{action,...data});
  if(response?.data?.error)throw Error(response.data.error);
  if(!response?.data)throw Error('The connection service did not return a response');
  return response.data;
 };
 const run=async(action)=>{
  setBusy(true);setError('');
  try{
   if(action==='analyze'){
    const r=await call('analyze',{text:input});setAnalysis(r.analysis);setProvider(r.analysis.provider||'');setEndpoint(r.analysis.endpoint_url||'');setTest(null);setRecord(null);
   }
   if(action==='save'){
    const r=await call('save',{provider,kind:analysis.kind,endpoint_url:endpoint,auth_type:authType,notes});setRecord(r);setTest(null);
   }
   if(action==='test'){setTest(await call('test',{id:record.id}));}
  }catch{setError('Connection assistance is temporarily unavailable. Please check the details and try again.')}
  finally{setBusy(false)}
 };
 return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="AI assisted connection intake">
  <h2 className="font-semibold text-lg">Connection setup assistant</h2>
  <p className="text-sm text-muted-foreground">Paste a non-secret endpoint, webhook description, documentation excerpt, or explain what you want to connect. The assistant identifies the connection type, asks for missing information, saves a draft in IFund, and checks supported endpoints.</p>
  <label className="block text-sm font-semibold" htmlFor="api-assistant-input">Connection details</label>
  <textarea id="api-assistant-input" rows={4} maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} placeholder="Example: Provider: Make. Incoming webhook URL for campaign updates, event types: campaign.created..." className="w-full rounded border bg-background text-foreground p-3"/>
  <p className="text-xs text-muted-foreground">Never paste passwords, API keys, bearer tokens, client secrets, or signing secrets here. Enter those only through IFund's encrypted Connections credential manager.</p>
  <button type="button" className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50" disabled={busy||input.trim().length<5} onClick={()=>run('analyze')}>{busy?'Checking…':'Identify connection and required details'}</button>
  {analysis&&<div className="rounded-lg border p-3 space-y-3">
   <p><strong>Detected type:</strong> {analysis.kind.replaceAll('_',' ')}</p>
   <h3 className="font-semibold">Information this connection needs</h3>
   <ul className="list-disc pl-6 text-sm space-y-1">{analysis.required.map(item=><li key={item}>{item}</li>)}</ul>
   <p className="text-xs text-muted-foreground">Items above are a checklist, not proof that the provider supports the requested action. Confirm permissions and webhook direction before activating a connection.</p>
   <label className="block text-sm" htmlFor="api-assistant-provider">Provider or app name</label>
   <input id="api-assistant-provider" value={provider} maxLength={80} onChange={e=>setProvider(e.target.value)} className="w-full rounded border bg-background text-foreground p-3"/>
   <label className="block text-sm" htmlFor="api-assistant-endpoint">HTTPS endpoint or webhook URL (no credentials or query secrets)</label>
   <input id="api-assistant-endpoint" value={endpoint} onChange={e=>setEndpoint(e.target.value)} className="w-full rounded border bg-background text-foreground p-3"/>
   <label className="block text-sm" htmlFor="api-assistant-auth">Authentication method (name only)</label>
   <input id="api-assistant-auth" placeholder="OAuth 2.0, HMAC, API key header..." value={authType} onChange={e=>setAuthType(e.target.value)} className="w-full rounded border bg-background text-foreground p-3"/>
   <label className="block text-sm" htmlFor="api-assistant-notes">Events, methods and expected data (no secrets)</label>
   <textarea id="api-assistant-notes" value={notes} maxLength={800} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full rounded border bg-background text-foreground p-3"/>
   <button type="button" disabled={busy||provider.trim().length<2} onClick={()=>run('save')} className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50">Save connection draft to IFund</button>
   {record&&<div className="space-y-2"><p role="status" className="text-sm">Draft saved in IFund. No credentials stored, subscriptions activated, or provider changes made.</p><button type="button" disabled={busy} onClick={()=>run('test')} className="rounded border px-3 py-2">Test connection reachability</button></div>}
   {test&&<p role="status" className="text-sm"><strong>Test: {test.status}</strong> — {test.message}</p>}
  </div>}
  {error&&<p role="alert" className="text-destructive">{error}</p>}
 </section>;
}