import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

/** Owner-only ECHO template library; saving is not consent to delivery. */
export default function EchoSavedTemplates({message,onApply}) {
  const {user}=useAuthSession();
  const [state,setState]=useState({phase:"loading",rows:[],error:""});
  const [label,setLabel]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    setState({phase:"loading",rows:[],error:""});
    if(!user?.id){setState({phase:"error",rows:[],error:"Sign in to use saved templates."});return;}
    authClient().rpc("ifund_my_message_templates").then(({data,error})=>{
      if(!active)return;
      if(error||!Array.isArray(data))throw new Error("Your saved templates could not be loaded.");
      setState({phase:"ready",rows:data,error:""});
    }).catch(e=>{if(active)setState({phase:"error",rows:[],error:e.message||"Unavailable"});});
    return ()=>{active=false};
  },[user?.id,refresh]);
  async function save(){
    if(busy||!user?.id)return;
    if(label.trim().length<4||label.trim().length>80||String(message||"").trim().length<15||String(message||"").trim().length>3000){
      setNotice("Use a label of 4–80 characters and a message of 15–3000 characters.");return;
    }
    setBusy(true);setNotice("");
    try{
      const client=authClient();
      const {data,error}=await client.rpc("ifund_save_message_template",{p_label:label.trim(),p_body:message.trim()});
      if(error||typeof data!=="string")throw new Error(error?.message||"Template save was not confirmed.");
      const current=await client.auth.getUser();
      if(current.error||current.data?.user?.id!==user.id)throw new Error("Your session changed. Reload your templates.");
      setLabel("");setNotice("Template saved privately. No message was sent.");setRefresh(n=>n+1);
    }catch(e){setNotice(e.message||"Unable to save template.");}
    finally{setBusy(false)}
  }
  async function remove(id){
    if(busy)return;
    setBusy(true);setNotice("");
    try{
      const {data,error}=await authClient().rpc("ifund_delete_message_template",{p_template_id:id});
      if(error||data!==true)throw new Error(error?.message||"Removal could not be confirmed.");
      setRefresh(n=>n+1);setNotice("Private template deleted.");
    }catch(e){setNotice(e.message||"Unable to remove template.");}
    finally{setBusy(false)}
  }
  return <section className="rounded-xl border border-border p-4 space-y-3" aria-label="ECHO personal message templates">
    <h2 className="font-semibold">ECHO · Reusable message templates</h2>
    <p className="text-xs text-muted-foreground">Save your approved text for future drafts. Templates are private to your account; saving or loading never sends a message.</p>
    {state.phase==="loading"&&<p role="status">Loading templates…</p>}
    {state.phase==="error"&&<p role="alert" className="text-red-600">{state.error}</p>}
    {state.phase==="ready" && <div className="space-y-2">
      <label className="block text-sm font-medium">Save current message as
        <input className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2" value={label} maxLength={80}
          placeholder="Template name" onChange={e=>setLabel(e.target.value)}/>
      </label>
      <button type="button" onClick={save} disabled={busy||state.rows.length>=20}
        className="min-h-11 rounded-xl border px-4 font-semibold disabled:opacity-50">Save reusable template</button>
      {state.rows.length>=20&&<p className="text-xs text-amber-700">Limit of 20 saved templates reached.</p>}
      <ul className="space-y-2">{state.rows.map(row=><li key={row.template_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
        <span className="min-w-0 flex-1 break-words text-sm font-medium">{row.label}</span>
        <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" disabled={busy}
          onClick={()=>{onApply?.(row.body);setNotice("Template loaded into the editable message. Review before sharing.");}}>Load</button>
        <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" disabled={busy}
          onClick={()=>remove(row.template_id)}>Delete</button>
      </li>)}</ul>
    </div>}
    {notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>;
}
