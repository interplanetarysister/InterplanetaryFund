import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Outbound marketing is never authorized by a follow or legacy email_updates preference. */
export default function MarketingPreferences() {
  const [state,setState] = useState({phase:"loading",optIn:false,original:false,updatedAt:null,error:""});
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [retry,setRetry] = useState(0);

  useEffect(()=>{
    let active=true;
    setState({phase:"loading",optIn:false,original:false,updatedAt:null,error:""});
    authClient().rpc("ifund_my_marketing_consent")
      .then(({data,error})=>{
        if(!active)return;
        if(error||!Array.isArray(data)||data.length!==1)
          throw new Error("Your outreach permissions could not be verified.");
        const value=data[0].outreach_opt_in===true;
        setState({phase:"ready",optIn:value,original:value,updatedAt:data[0].updated_at||null,error:""});
      })
      .catch(e=>{if(active)setState({phase:"error",optIn:false,original:false,updatedAt:null,error:e.message||"Unavailable"});});
    return ()=>{active=false};
  },[retry]);
  async function save(event){
    event.preventDefault();
    if(busy||state.phase!=="ready")return;
    setBusy(true);setNotice("");
    try{
      const {data,error}=await authClient().rpc("ifund_set_marketing_consent",{p_opt_in:state.optIn});
      if(error||!Array.isArray(data)||data.length!==1||data[0].outreach_opt_in!==state.optIn)
        throw new Error("Your preference could not be saved or verified.");
      setState(current=>({...current,original:state.optIn,updatedAt:data[0].updated_at||null,error:""}));
      setNotice(state.optIn?"Your optional fundraising outreach opt-in was saved.":"Fundraising marketing outreach is disabled for your account.");
    }catch(e){setState(current=>({...current,error:e.message||"Preference update failed."}));}
    finally{setBusy(false)}
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
    <h1 className="text-3xl font-bold">Communication preferences</h1>
    <p className="text-sm text-muted-foreground">
      Choose whether iFund may send optional fundraising outreach and campaign marketing messages.
      This is separate from account security notices, receipts, case replies, and campaign follows.
      No marketing permission is inferred from existing notification settings.
    </p>
    {state.phase==="loading"&&<p role="status">Verifying communication permissions…</p>}
    {state.phase==="error"&&<section role="alert" className="rounded-xl border border-red-500/40 p-5">
      <p>{state.error}</p><button type="button" onClick={()=>setRetry(x=>x+1)} className="mt-3 min-h-11 rounded-lg border px-4">Retry</button>
    </section>}
    {state.phase==="ready"&&<form onSubmit={save} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={state.optIn}
          onChange={e=>setState(s=>({...s,optIn:e.target.checked,error:""}))} />
        <span><strong className="block">Allow optional fundraising outreach</strong>
          <span className="mt-1 block text-sm text-muted-foreground">
            I agree to receive optional campaign and fundraising marketing from Interplanetary Fund.
            I can turn this off whenever I want.
          </span>
        </span>
      </label>
      {state.error&&<p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {notice&&<p role="status" className="text-sm text-cyan-700">{notice}</p>}
      <p className="text-xs text-muted-foreground">
        Saved choice: {state.original?"Opted in":"Not opted in"}.
        {state.updatedAt?" Last updated "+new Date(state.updatedAt).toLocaleString()+".":""}
      </p>
      <button type="submit" disabled={busy||state.optIn===state.original}
        className="min-h-11 rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white disabled:opacity-40">
        {busy?"Saving…":"Save preferences"}
      </button>
    </form>}
  </main>;
}
