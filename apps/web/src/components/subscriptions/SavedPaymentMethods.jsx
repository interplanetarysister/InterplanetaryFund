import {useCallback,useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {CreditCard,Loader2,ShieldCheck,Star,Trash2} from "lucide-react";
import {isNativeBundle} from "@/lib/nativeApi";
import {formatSavedCard,savedCardExpiry,savedMethodsFromResponse} from "@/lib/savedPaymentMethods.mjs";

// Saved cards are PayPal Vault v3 payment tokens. Card details are typed
// ONLY into PayPal-hosted card fields below; this page, the iFund API, and
// iFund's database never receive or store a card number or CVV — only the
// PayPal token reference (kept server-side) and display descriptors.
const API="/api/payments/saved-methods";
const VAULT_SDK_NAMESPACE="ifundVaultPayPal";
let scriptPromise,scriptClient;
function loadPayPal(clientId){
  if(scriptPromise)return scriptClient===clientId?scriptPromise:Promise.reject(Error("PayPal merchant changed. Reload this page."));
  scriptClient=clientId;
  scriptPromise=new Promise((resolve,reject)=>{
    if(window[VAULT_SDK_NAMESPACE]?.CardFields){resolve(window[VAULT_SDK_NAMESPACE]);return;}
    const script=document.createElement("script");
    script.setAttribute("data-namespace",VAULT_SDK_NAMESPACE);
    script.src="https://www.paypal.com/sdk/js?client-id="+encodeURIComponent(clientId)+
      "&components=card-fields&currency=USD";
    script.async=true;
    script.onload=()=>window[VAULT_SDK_NAMESPACE]?.CardFields
      ?resolve(window[VAULT_SDK_NAMESPACE]):reject(Error("PayPal Card Fields SDK unavailable"));
    script.onerror=()=>reject(Error("PayPal Card Fields SDK unavailable"));
    document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;scriptClient=null;throw error});
  return scriptPromise;
}
async function memberToken(){
  const {data,error}=await authClient().auth.getSession();
  if(error||!data?.session?.access_token)throw Error("Sign in to manage saved payment methods.");
  return data.session.access_token;
}
async function call(path,options={}){
  const headers={"content-type":"application/json",...(options.headers||{})};
  headers.authorization="Bearer "+await memberToken();
  const response=await fetch(path,{...options,headers,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false)throw Error(data.error||"Saved payment methods are unavailable.");
  return data;
}

export default function SavedPaymentMethods(){
  const [methods,setMethods]=useState([]);
  const [loadState,setLoadState]=useState("loading");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [adding,setAdding]=useState(false);
  const [cardReady,setCardReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const nameHost=useRef(null),numberHost=useRef(null),expiryHost=useRef(null),cvvHost=useRef(null);
  const cardSession=useRef(null);
  const submitting=useRef(false);
  const native=isNativeBundle();

  const refresh=useCallback(async()=>{
    setLoadState("loading");
    try{
      const data=await call(API);
      setMethods(savedMethodsFromResponse(data));
      setLoadState("ready");
    }catch(_){
      // A missing session is a signed-out state, not a service failure.
      const {data}=await authClient().auth.getSession().catch(()=>({data:null}));
      setLoadState(data?.session?"unavailable":"signed-out");
    }
  },[]);
  useEffect(()=>{refresh().catch(()=>{});},[refresh]);

  useEffect(()=>{
    if(!adding||native)return;
    let disposed=false,card=null;
    setCardReady(false);setError("");
    (async()=>{
      try{
        const cfg=await fetch("/api/payments/config",{cache:"no-store"}).then(r=>r.json()).catch(()=>({}));
        if(cfg.environment!=="live"||!cfg.client_id)throw Error("Live card saving unavailable");
        const paypal=await loadPayPal(cfg.client_id);
        if(disposed)return;
        card=paypal.CardFields({
          createVaultSetupToken:async()=>{
            const created=await call(API+"/setup-token",{method:"POST",body:"{}"});
            if(!created.setup_token_id)throw Error("Vault setup unavailable");
            return created.setup_token_id;
          },
          onApprove:async data=>{
            if(disposed)return;
            try{
              if(!data?.vaultSetupToken)throw Error("Vault approval was not verified");
              await call(API+"/exchange",{method:"POST",
                body:JSON.stringify({setup_token_id:data.vaultSetupToken})});
              if(!disposed){
                setNotice("Card saved to your account. Only a PayPal token reference and the card's brand, last four digits, and expiry are stored — never the card number.");
                setAdding(false);
                await refresh();
              }
            }catch(_){
              if(!disposed)setError("Your card could not be saved. No payment was taken. Try again or use a different card.");
            }finally{if(!disposed)setSaving(false)}
          },
          onError:()=>{if(!disposed){setSaving(false);setError("PayPal could not validate the card details. Check them and try again; the card was not saved.");}}
        });
        if(!card.isEligible())throw Error("Card saving is not eligible in this browser.");
        cardSession.current=card;
        const hosted=[card.NameField(),card.NumberField(),card.ExpiryField(),card.CVVField()];
        const hosts=[nameHost.current,numberHost.current,expiryHost.current,cvvHost.current];
        const results=await Promise.allSettled(hosted.map((field,index)=>{
          try{return field.render(hosts[index]);}catch(e){return Promise.reject(e);}
        }));
        if(disposed)return;
        if(results.every(result=>result.status==="rejected"))throw Error("Card fields could not load.");
        setCardReady(true);
      }catch(_){
        if(!disposed)setError("Secure card saving did not initialize. No card details were entered or stored. Refresh the page and try again.");
      }
    })();
    return()=>{
      disposed=true;
      cardSession.current=null;
      for(const node of [nameHost.current,numberHost.current,expiryHost.current,cvvHost.current]){
        try{node?.replaceChildren()}catch(_){}
      }
    };
  },[adding,native,refresh]);

  async function remove(method){
    if(!window.confirm("Remove "+formatSavedCard(method)+" from your account? Future checkouts will no longer offer it."))return;
    setBusy(method.id);setError("");setNotice("");
    try{
      await call(API+"/delete",{method:"POST",body:JSON.stringify({saved_method_id:method.id})});
      setNotice("Saved payment method removed.");
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy("");}
  }
  async function makeDefault(method){
    setBusy(method.id);setError("");setNotice("");
    try{
      await call(API+"/default",{method:"POST",body:JSON.stringify({saved_method_id:method.id})});
      setNotice(formatSavedCard(method)+" is now your default payment method.");
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy("");}
  }

  const field="min-h-11 w-full rounded-lg border border-border bg-background px-2 py-2";
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="Saved payment methods">
    <h2 className="text-lg font-semibold">Saved payment methods</h2>
    <p className="mt-1 text-sm text-muted-foreground">
      Save a card to your account for faster checkout. Card details are entered only in PayPal's secure fields;
      IFund stores a PayPal token reference plus the brand, last four digits, and expiry — never the card number or security code.
    </p>
    {notice&&<p role="status" className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{notice}</p>}
    {error&&<p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</p>}
    {native?<p role="status" className="mt-3 text-sm text-muted-foreground">Saved payment methods are managed on the website while mobile billing rules are reviewed.</p>:
    loadState==="loading"?<p role="status" className="mt-3 text-sm text-muted-foreground">Loading saved payment methods…</p>:
    loadState==="signed-out"?<p className="mt-3 text-sm text-muted-foreground">Sign in to view and manage your saved payment methods.</p>:
    loadState==="unavailable"?<div role="alert" className="mt-3 space-y-3 text-sm text-amber-600">
      <p>Your saved payment methods could not be loaded. Nothing was changed.</p>
      <button type="button" onClick={()=>refresh().catch(()=>{})} className="min-h-11 rounded-xl border border-current px-4 py-2 font-semibold">Retry</button>
    </div>:
    <>
      {methods.length===0?
        <p className="mt-3 text-sm text-muted-foreground">No saved payment methods yet.</p>:
        <ul className="mt-4 space-y-3">
          {methods.map(method=><li key={method.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
            <CreditCard className="h-5 w-5 shrink-0" aria-hidden="true"/>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {formatSavedCard(method)}
                {method.is_default&&<span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-700">Default</span>}
              </p>
              <p className="text-sm text-muted-foreground">{savedCardExpiry(method)}{method.cardholder_name?" · "+method.cardholder_name:""}</p>
            </div>
            {!method.is_default&&<button type="button" disabled={busy!==""} onClick={()=>makeDefault(method)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">
              <Star className="h-4 w-4" aria-hidden="true"/>{busy===method.id?"Saving…":"Set default"}
            </button>}
            <button type="button" disabled={busy!==""} onClick={()=>remove(method)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
              <Trash2 className="h-4 w-4" aria-hidden="true"/>{busy===method.id?"Removing…":"Remove"}
            </button>
          </li>)}
        </ul>}
      {adding?
        <div className="mt-4 space-y-2">
          <label className="block text-xs">Name on card<div className={field} ref={nameHost}/></label>
          <label className="block text-xs">Card number<div className={field} ref={numberHost}/></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Expiry<div className={field} ref={expiryHost}/></label>
            <label className="text-xs">Security code<div className={field} ref={cvvHost}/></label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={!cardReady||saving} onClick={async()=>{
              if(submitting.current||!cardSession.current)return;
              setError("");
              try{
                const state=await cardSession.current.getState();
                if(!state?.isFormValid){setError("Check the card details and try again — every field must be complete.");return;}
                submitting.current=true;setSaving(true);
                await cardSession.current.submit();
              }catch(_){
                setError("Your card could not be saved. No payment was taken. Try again or use a different card.");
              }finally{submitting.current=false;setSaving(false);}
            }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CreditCard className="h-4 w-4"/>}
              {saving?"Saving securely…":"Save card"}
            </button>
            <button type="button" disabled={saving} onClick={()=>setAdding(false)}
              className="min-h-11 rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-50">Cancel</button>
          </div>
          {!cardReady&&<p role="status" className="text-xs text-muted-foreground">Secure card form is loading. The save button activates only after PayPal's fields are available.</p>}
        </div>:
        <button type="button" onClick={()=>{setError("");setNotice("");setAdding(true);}}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500/35 px-4 py-2 font-semibold disabled:opacity-50">
          <CreditCard className="h-4 w-4" aria-hidden="true"/>Add a card
        </button>}
    </>}
    <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
      Secured by PayPal Vault. Removing a card deletes its saved token so it can no longer be used for future checkouts.
    </p>
  </section>;
}
