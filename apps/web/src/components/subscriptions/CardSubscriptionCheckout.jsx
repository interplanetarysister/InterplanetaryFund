import { useEffect, useState } from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";

// Subscriptions use the same PayPal merchant and signed ledger as the existing
// campaign-donation card option, but a DIFFERENT recurring billing agreement.
// Orders v2 CardFields are one-time payments; they must never be reused as if
// they authorize future subscription renewals.
const API="/api/payments/subscriptions";
const PAYPAL_HOSTS=new Set(["www.paypal.com","paypal.com"]);
async function readJson(path,options={}){
  const response=await fetch(path,{...options,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false)throw Error(data.error||"Subscription checkout unavailable.");
  return data;
}
export default function CardSubscriptionCheckout({plan,hasExistingSubscription=false,consented=false}){
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const native=isNativeBundle();
  const correctPlan=plan?.tier==="basic"&&plan?.interval==="monthly"&&
    Number(plan.amount_cents)===499&&plan.currency==="USD"&&
    plan.available===true&&plan.verified===true;

  useEffect(()=>{
    let active=true;
    if(native){setLoading(false);return undefined;}
    readJson(API+"/provider-readiness")
      .then(data=>{if(active)setReady(data.live===true&&data.purchase_ready===true&&
          data.plan_ready===true&&data.webhook_ready===true&&data.atomic_ready===true);})
      .catch(()=>{if(active)setReady(false)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;};
  },[native]);

  async function startCardSubscription(){
    if(!correctPlan||!ready||hasExistingSubscription||native||busy||!consented)return;
    setBusy(true);setError("");
    try{
      const {data,error:authError}=await authClient().auth.getSession();
      if(authError||!data?.session?.access_token)throw Error("Sign in to start a subscription.");
      // The server creates and binds an authenticated member-specific intent
      // BEFORE PayPal presents any billing agreement.
      const result=await readJson(API+"/start",{
        method:"POST",headers:{"content-type":"application/json",
          authorization:"Bearer "+data.session.access_token},
        body:JSON.stringify({tier:"basic",interval:"monthly",payment_preference:"card"})
      });
      const target=new URL(result.approval_url);
      if(target.protocol!=="https:"||target.port||target.username||target.password||
         !PAYPAL_HOSTS.has(target.hostname)||!/^I-[A-Z0-9]{10,30}$/.test(result.subscription_id||""))
        throw Error("The provider returned an untrusted subscription approval link.");
      // PayPal decides whether a card-funded recurring agreement is offered. This
      // option is not an independently provider-confirmed card funding method.
      // Returning from PayPal does NOT grant access: the existing /confirm
      // route and signed financial receipt reconciliation are authoritative.
      window.location.assign(target.href);
    }catch(_){
      setBusy(false);
      setError("Card-funded subscriptions could not be started. No paid access was granted. If PayPal opened, verify your subscription status before retrying.");
    }
  }

  if(!correctPlan)return null;
  const enabled=ready&&!loading&&!hasExistingSubscription&&!native&&consented;
  return <div className="mt-3 space-y-2">
    <button type="button" disabled={!enabled||busy} onClick={startCardSubscription}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-card px-4 py-2 font-semibold text-foreground transition-colors hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
      {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CreditCard className="h-4 w-4"/>}
      {busy?"Opening PayPal billing…":loading?"Checking secure subscription billing…":
        !consented?"Agree to renewal terms to continue":!enabled?"Recurring card checkout unavailable":"Continue to PayPal recurring checkout"}
    </button>
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
      $4.99 USD each month until canceled. This route opens PayPal approval, not a direct card-number form. PayPal may offer guest card funding depending on eligibility; if it does not, this recurring card option is unavailable. IFund never receives your card details, and Premium activates only after a verified payment receipt.
    </p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
