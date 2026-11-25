import {useState} from "react";
import {CreditCard,ShieldCheck,Loader2} from "lucide-react";
import {chooseBillingMethod,chooseBillingMode,initialBillingChoice} from "@/lib/premiumBillingChoice.mjs";
import {canStartVerifiedSubscription} from "@/lib/subscriptionEnrollment.mjs";
import CardSubscriptionCheckout from "./CardSubscriptionCheckout";
import PremiumOneTimeCheckout from "./PremiumOneTimeCheckout";

const METHODS=[
  {id:"card",label:"Credit or debit card — no PayPal account needed"},
  {id:"paypal",label:"PayPal"},
  {id:"googlepay",label:"Google Pay"}
];
export default function PremiumBillingChoices({plan,status,statusLoad,busy,native,oneTimeActive=false,onSubscribe}){
  const [choice,setChoice]=useState(()=>initialBillingChoice("card"));
  const [renewalConsent,setRenewalConsent]=useState(false);
  const existing=oneTimeActive||statusLoad!=="ready"||Boolean(status&&
    ["active","pending","past_due","approval_pending"].includes(status.status));
  const canRecurring=!oneTimeActive&&canStartVerifiedSubscription({plan,status,statusLoad,busy,native});
  const recurring=choice.mode==="recurring";
  function selectMethod(method){
    setChoice(current=>chooseBillingMethod(current,method));
    setRenewalConsent(false);
  }
  function selectMode(mode){
    setChoice(current=>chooseBillingMode(current,mode));
    setRenewalConsent(false);
  }
  return <div className="mt-5 space-y-4">
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold">How would you like to pay?</legend>
      <div className="grid gap-2">
        {METHODS.map(m=><button type="button" key={m.id} aria-pressed={choice.method===m.id}
          onClick={()=>selectMethod(m.id)}
          className={"min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors "+
            (choice.method===m.id?"border-cyan-500 bg-cyan-500/10 text-foreground":"border-border bg-background hover:border-cyan-500/50")}>
          {m.id==="card"&&<CreditCard className="mr-2 inline h-4 w-4"/>}{m.label}
        </button>)}
      </div>
    </fieldset>
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold">When should we bill you?</legend>
      <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 "+
        (recurring?"border-cyan-500 bg-cyan-500/10":"border-border")}>
        <input type="radio" name="premium-billing-mode" className="mt-1 accent-cyan-600"
          checked={recurring} onChange={()=>selectMode("recurring")}/>
        <span className="text-sm"><strong>$4.99 every month</strong>
          <span className="block text-xs text-muted-foreground">Automatically renews until you cancel. You'll approve the recurring billing agreement before any charge.</span>
        </span>
      </label>
      <label className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 "+
        (!recurring?"border-cyan-500 bg-cyan-500/10":"border-border")}>
        <input type="radio" name="premium-billing-mode" className="mt-1 accent-cyan-600"
          checked={!recurring} onChange={()=>selectMode("one_time")}/>
        <span className="text-sm"><strong>Pay $4.99 once</strong>
          <span className="block text-xs text-muted-foreground">Premium for one month. No automatic renewal or future payment agreement.</span>
        </span>
      </label>
    </fieldset>
    {recurring?<div className="space-y-3">
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5 accent-cyan-600" checked={renewalConsent}
          onChange={event=>setRenewalConsent(event.target.checked)}/>
        <span>I understand that this plan bills $4.99 USD each month until canceled, and I will approve its recurring billing agreement.</span>
      </label>
      {choice.method==="googlepay"?<div className="space-y-2">
        <button type="button" disabled aria-disabled="true"
          className="min-h-11 w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white opacity-50">
          Subscribe $4.99/month with Google Pay
        </button>
        <p role="status" className="text-xs text-muted-foreground">
          Google Pay recurring billing is not yet authorized for this merchant. Choose PayPal to approve recurring billing, or card with the one-time option. No charge is initiated here.
        </p>
      </div>:choice.method==="card"?<div className="space-y-2">
        <CardSubscriptionCheckout plan={plan} hasExistingSubscription={existing} consented={renewalConsent}/>
        <button type="button" className="ifund-interactive min-h-11 w-full rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-semibold"
          onClick={()=>selectMode("one_time")}>
          Enter my card number instead — pay $4.99 once (no PayPal account)
        </button>
        {!renewalConsent&&<p role="status" className="text-xs text-muted-foreground">
          To continue to the recurring approval page, acknowledge the monthly renewal terms above.
        </p>}
      </div>:<div className="space-y-2">
        <button type="button" disabled={!canRecurring||!renewalConsent}
          onClick={()=>onSubscribe(plan)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy?<Loader2 className="h-4 w-4 animate-spin"/>:null}
          Continue to PayPal — $4.99/month
        </button>
        {!renewalConsent&&<p role="status" className="text-xs text-muted-foreground">Acknowledge the monthly renewal terms to continue.</p>}
      </div>}
    </div>:choice.method==="googlepay"?<div className="mt-4 space-y-2">
      <button type="button" disabled aria-disabled="true"
        className="min-h-11 w-full rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white opacity-50">
        Pay $4.99 once with Google Pay
      </button>
      <p role="status" className="text-xs text-muted-foreground">
        One-time Google Pay for Premium is not provider-verified. Select card or PayPal to continue without automatic renewal.
      </p>
    </div>:<PremiumOneTimeCheckout key={choice.method} method={choice.method} activeSubscription={existing}/>}
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>Selecting a payment method does not authorize automatic charges. Your billing choice is confirmed when you approve checkout.
    </p>
  </div>;
}
