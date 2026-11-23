import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {isNativeBundle} from "@/lib/nativeApi";
import {CreditCard,Loader2,ShieldCheck} from "lucide-react";

const STRIPE_HOSTS=new Set(["checkout.stripe.com","billing.stripe.com"]);
const CARD_ENDPOINT="/api/payments/card-subscriptions";

export default function CardSubscriptionCheckout({plan,hasExistingSubscription=false}){
  const [readiness,setReadiness]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const native=isNativeBundle();

  useEffect(()=>{
    let mounted=true;
    fetch(CARD_ENDPOINT+"/readiness",{cache:"no-store"})
      .then(async response=>response.ok?response.json():{ready:false})
      .then(data=>{if(mounted)setReadiness(data)})
      .catch(()=>{if(mounted)setReadiness({ready:false})});
    return()=>{mounted=false};
  },[]);

  const correctPlan=plan?.tier==="basic"&&plan?.interval==="monthly"&&
    Number(plan?.amount_cents)===499&&plan?.currency==="USD";
  const verified=readiness?.ready===true&&readiness?.provider==="stripe"&&
    readiness?.amount_cents===499&&readiness?.currency==="USD"&&
    readiness?.interval==="monthly";
  const available=!native&&correctPlan&&verified&&!hasExistingSubscription;

  async function openCheckout(){
    if(!available||busy)return;
    setBusy(true);setError("");
    try{
      const {data,error:sessionError}=await authClient().auth.getSession();
      const token=data?.session?.access_token;
      if(sessionError||!token)throw new Error("Sign in before starting a subscription.");
      const response=await fetch(CARD_ENDPOINT+"/start",{
        method:"POST",
        headers:{"content-type":"application/json","authorization":"Bearer "+token},
        body:JSON.stringify({tier:"basic",interval:"monthly"}),
        cache:"no-store"
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok||body.ok!==true)throw new Error("Card subscriptions are not verified for enrollment yet.");
      const target=new URL(body.checkout_url);
      if(target.protocol!=="https:"||!STRIPE_HOSTS.has(target.hostname)||target.username||target.password)
        throw new Error("Card checkout provider returned an untrusted address.");
      window.location.assign(target.href);
    }catch(e){setError(e.message);setBusy(false)}
  }

  if(!correctPlan)return null;
  return <div className="mt-3 space-y-2">
    <button type="button" onClick={openCheckout} disabled={!available||busy}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-card px-4 py-2 font-semibold text-foreground transition-colors hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
      {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CreditCard className="h-4 w-4"/>}
      {busy?"Opening secure card checkout…":available?"Subscribe with credit or debit card":"Card subscription checkout pending verification"}
    </button>
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
      Card details are handled by the card processor. Paid access starts only after IFund receives a verified payment receipt.
    </p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
