import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";

// PayPal-hosted card fields; no cardholder PAN/CVV touches iFund.
let sdkPromise, sdkClient;
function loadPayPal(clientId) {
  if (sdkPromise) return sdkClient === clientId ? sdkPromise : Promise.reject(new Error("Reload checkout: account changed"));
  sdkClient = clientId;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(clientId)
      + "&components=buttons,card-fields&currency=USD&intent=capture";
    script.async = true;
    script.onload = () => window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error("PayPal SDK unavailable"));
    script.onerror = () => reject(new Error("PayPal SDK unavailable"));
    document.head.appendChild(script);
  }).catch(e => { sdkPromise = null; sdkClient = null; throw e; });
  return sdkPromise;
}
async function api(path, options={}) {
  const response = await fetch(path,{...options,cache:"no-store",
    headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false) {
    if(data.error==="payments_disabled") throw new Error("Campaign checkout is temporarily unavailable. No payment was started.");
    if(data.error==="capture_failed_check_receipt_before_retry") throw new Error("Payment confirmation is delayed. Check your receipt or donation history before attempting another payment.");
    throw new Error(data.error||"Payment API unavailable");
  }
  return data;
}
export default function CampaignDonationDialog({ campaign, open, onOpenChange, onPaid }) {
  const [amount,setAmount]=useState("25");
  const [support,setSupport]=useState(false);
  const [status,setStatus]=useState("idle");
  const [error,setError]=useState("");
  const [eligible,setEligible]=useState(null);
  const [complete,setComplete]=useState(false);
  const paypalHost=useRef(null), nameHost=useRef(null),numberHost=useRef(null),expiryHost=useRef(null),cvvHost=useRef(null);
  const cardSession=useRef(null), tokens=useRef(new Map()), keys=useRef(new Map()), checkoutTokens=useRef(new Map()), latestPaid=useRef(onPaid);
  useEffect(()=>{latestPaid.current=onPaid;});
  const checkoutLocked=status==="capturing"||complete;
  const gift=Math.round(Number(amount)*100);
  const valid=Number.isSafeInteger(gift)&&gift>=100&&gift<=100000000;
  const tip=valid&&support?Math.round(gift*.10):0;
  const requestKey=channel=>{
    const key=[campaign?.id,gift,tip,channel].join("|");
    if(!keys.current.has(key))keys.current.set(key,crypto.randomUUID().replace(/-/g,""));
    return keys.current.get(key);
  };
  const begin=async channel=>{
    if(!valid||!campaign?.id)throw new Error("Enter a donation of at least $1");
    const key=requestKey(channel);
    let checkoutToken=checkoutTokens.current.get(key);
    if(!checkoutToken){
      checkoutToken=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
      checkoutTokens.current.set(key,checkoutToken);
    }
    const data=await api("/api/payments/create-order",{method:"POST",body:JSON.stringify({
      campaign_id:campaign.id,gift_cents:gift,optional_support_cents:tip,
      payment_channel:channel,request_key:key,checkout_token:checkoutToken,
    })});
    if(!data.id||data.checkout_token!==checkoutToken||data.environment!=="live")
      throw new Error("Payment checkout requires reconciliation");
    tokens.current.set(data.id,checkoutToken);
    return data.id;
  };
  const capture=async data=>{
    const id=data?.orderID,token=tokens.current.get(id);
    if(!id||!token)throw new Error("Unknown payment order");
    setStatus("capturing");
    const result=await api("/api/payments/capture-order",{
      method:"POST",body:JSON.stringify({order_id:id,checkout_token:token}),
    });
    if(result.ok!==true||result.status!=="captured"||!result.donation_id)throw new Error("Capture requires reconciliation");
    tokens.current.delete(id);setComplete(true);setStatus("complete");latestPaid.current?.(result);
  };
  useEffect(()=>{
    if(!open||!valid||!campaign?.id||campaign.status!=="active")return;
    let cancelled=false,buttons=null;
    setError("");setStatus("loading");setEligible(null);
    (async()=>{
      try{
        const config=await api("/api/payments/config");
        if(cancelled)return;
        if(config.environment!=="live"||!config.client_id)throw new Error("Live checkout is unavailable. No payment was started.");
        const paypal=await loadPayPal(config.client_id);
        if(cancelled)return;
        const onApprove=async data=>{
          try{await capture(data);}catch(e){if(!cancelled){setError(e.message);setStatus("error");}}
        };
        buttons=paypal.Buttons({
          createOrder:()=>begin("paypal"),onApprove,
          onError:()=>{if(!cancelled){setStatus("error");setError("PayPal could not complete the donation");}},
          onCancel:()=>{if(!cancelled)setStatus("ready");},
          style:{layout:"vertical",shape:"rect",label:"paypal"},
        });
        if(paypalHost.current)await buttons.render(paypalHost.current);
        if(typeof paypal.CardFields==="function"){
          const card=paypal.CardFields({
            createOrder:()=>begin("card"),onApprove,
            onError:()=>{if(!cancelled){setStatus("error");setError("Card payment could not be completed");}},
            onCancel:()=>{if(!cancelled)setStatus("ready");},
          });
          if(card.isEligible()){
            cardSession.current=card;
            await Promise.all([
              card.NameField().render(nameHost.current),
              card.NumberField().render(numberHost.current),
              card.ExpiryField().render(expiryHost.current),
              card.CVVField().render(cvvHost.current),
            ]);
            if(!cancelled)setEligible(true);
          }else if(!cancelled)setEligible(false);
        }else if(!cancelled)setEligible(false);
        if(!cancelled)setStatus("ready");
      }catch(e){if(!cancelled){setError(e.message||"Secure checkout unavailable");setStatus("error");}}
    })();
    return ()=>{
      cancelled=true;
      try{buttons?.close?.();}catch(_){}
      cardSession.current=null;
      for(const node of [paypalHost.current,nameHost.current,numberHost.current,expiryHost.current,cvvHost.current]) {
        try{node?.replaceChildren();}catch(_){}
      }
    };
  },[open,campaign?.id,campaign?.status,gift,tip,valid]);
  const field="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return <Dialog open={open} onOpenChange={value=>{
    if(!value&&status==="capturing")return;
    if(!value){tokens.current.clear();keys.current.clear();checkoutTokens.current.clear();setComplete(false);setError("");}
    onOpenChange?.(value);
  }}>
    <DialogContent className="gap-0 overflow-x-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-xl">
      <DialogHeader className="space-y-2 border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 pb-5 pt-6 text-left text-white sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[.22em] text-cyan-300">Secure donation</p>
        <DialogTitle className="pr-9 text-xl font-bold leading-snug sm:text-2xl">Support {campaign?.title || "this campaign"}</DialogTitle>
        <DialogDescription className="text-sm text-slate-200">Choose an amount and payment method. No IFund account is needed.</DialogDescription>
      </DialogHeader>
      {complete?<p role="status" className="m-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 font-semibold text-emerald-800">Donation verified with PayPal and recorded. Thank you!</p>:
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Choose your donation</p>
          <div className="grid grid-cols-4 gap-2">
            {[5,10,25,50].map(value=><button key={value} type="button" disabled={checkoutLocked} aria-pressed={Number(amount)===value}
              className={Number(amount)===value
                ? "min-h-11 rounded-xl border-2 border-cyan-500 bg-cyan-50 text-sm font-bold text-blue-950 shadow-sm"
                : "min-h-11 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-cyan-500"}
              onClick={()=>setAmount(String(value))}>{"$"+value}</button>)}
          </div>
        </div>
        <label className="block text-sm font-semibold text-slate-900">Other amount (USD)
          <input type="number" className={field} min="1" max="1000000" step="0.01" disabled={checkoutLocked} value={amount} onChange={e=>setAmount(e.target.value)}/>
        </label>
        <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
          <input type="checkbox" disabled={checkoutLocked} className="mt-1 h-4 w-4 accent-cyan-600" checked={support} onChange={e=>setSupport(e.target.checked)}/>
          <span>Add optional 10% support for the IFund platform <span className="block text-xs text-slate-500">This is separate from your campaign gift and not required.</span></span>
        </label>
        {valid&&<div aria-live="polite" className="rounded-xl border border-slate-200 bg-blue-50/60 p-3 text-sm text-slate-800">
          <div className="flex justify-between gap-3"><span>Campaign donation</span><strong>{"$"+(gift/100).toFixed(2)}</strong></div>
          {support&&<div className="mt-1 flex justify-between gap-3"><span>Optional IFund support</span><strong>{"$"+(tip/100).toFixed(2)}</strong></div>}
          <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 font-bold"><span>Today's total</span><span>{"$"+((gift+tip)/100).toFixed(2)} USD</span></div>
          <p className="mt-1 text-[11px] text-slate-500">Review the final amount before approving with your payment provider.</p>
        </div>}
        {!valid?<p className="text-xs text-red-700">Enter a gift of at least $1.</p>:
          <>
            {status==="loading"&&<p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin"/> Loading secure checkout…</p>}
            <section aria-busy={status==="capturing"} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3" aria-label="Credit or debit card checkout" style={{display:eligible===false?"none":"block"}}>
              <h3 className="flex gap-2 items-center text-sm font-semibold text-slate-900"><CreditCard className="h-4 w-4"/> Credit or debit card</h3>
              <p className="text-xs text-slate-500">PayPal-hosted secure card fields. You may not need a PayPal account.</p>
              <label className="block text-xs">Name on card<div ref={nameHost} className={field}/></label>
              <label className="block text-xs">Card number<div ref={numberHost} className={field}/></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">Expiration<div ref={expiryHost} className={field}/></label>
                <label className="block text-xs">Security code<div ref={cvvHost} className={field}/></label>
              </div>
            </section>
            {eligible===false&&<p className="text-xs text-slate-500">Direct card fields are unavailable for this account or device. PayPal may offer guest card checkout.</p>}
            <section aria-label="Payment actions" className="sticky bottom-0 z-10 -mx-5 -mb-5 space-y-3 border-t border-slate-200 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_25px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:-mx-6 sm:px-6">
              <h3 className="text-center text-sm font-bold text-slate-900">Choose how to pay</h3>
              {eligible===true&&<button type="button" className="min-h-12 w-full rounded-xl bg-[#003087] px-4 font-semibold text-white shadow-sm hover:bg-[#002466] disabled:opacity-50"
                disabled={status!=="ready"||!eligible}
                onClick={async()=>{setError("");try{await cardSession.current.submit();}catch(_){setError("Card payment failed. Check the details or use PayPal.");}}}>
                {status==="capturing"?"Verifying donation…":"Pay by debit or credit card"}
              </button>}
              <div ref={paypalHost} aria-label="Eligible PayPal payment buttons" className="min-h-[44px]"/>
              <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cyan-600"/> Secure PayPal checkout · Other payment methods appear only if PayPal offers them.</p>
            </section>
          </>}
        {status==="capturing"&&<p role="status">Verifying PayPal capture and saving your donation… Please keep checkout open.</p>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
