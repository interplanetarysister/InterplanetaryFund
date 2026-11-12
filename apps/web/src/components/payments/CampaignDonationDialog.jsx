import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Loader2, ShieldCheck, LockKeyhole, CircleCheck, HandHeart } from "lucide-react";
import { paymentQuoteCents } from "@/lib/paymentQuote";
import { authClient } from "@/api/auth";
import { Link } from "react-router-dom";

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
  const quote = valid ? paymentQuoteCents(gift, tip) : null;
  const requestKey=channel=>{
    const key=[campaign?.id,gift,tip,channel].join("|");
    if(!keys.current.has(key))keys.current.set(key,crypto.randomUUID().replace(/-/g,""));
    return keys.current.get(key);
  };
  const begin=async channel=>{
    if(!valid||!campaign?.id)throw new Error("Enter a donation of at least $1");
    if(campaign.status!=="active"||campaign.preview_only)throw new Error("This campaign is not accepting donations.");
    const key=requestKey(channel);
    let checkoutToken=checkoutTokens.current.get(key);
    if(!checkoutToken){
      checkoutToken=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
      checkoutTokens.current.set(key,checkoutToken);
    }
    // The financial service verifies this JWT against Supabase Auth. A missing
    // authenticated session remains an anonymous guest donation.
    const {data:sessionData,error:sessionError}=await authClient().auth.getSession();
    if(sessionError) throw new Error("Account session could not be checked. Sign in again before donating.");
    const session=sessionData?.session;
    const accessToken=session && !session.user?.is_anonymous ? session.access_token : null;
    const data=await api("/api/payments/create-order",{method:"POST",
      headers:accessToken?{"authorization":"Bearer "+accessToken}:{},
      body:JSON.stringify({
      campaign_id:campaign.id,gift_cents:gift,optional_support_cents:tip,
      payment_channel:channel,request_key:key,checkout_token:checkoutToken,
    })});
    if(!data.id||data.checkout_token!==checkoutToken||data.environment!=="live")
      throw new Error("Payment checkout requires reconciliation");
    if(!Number.isSafeInteger(data.amount_cents)||
       data.amount_cents!==paymentQuoteCents(gift,tip,channel)?.totalCents)
      throw new Error("The payment charge changed. Do not approve checkout. Please retry.");
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
    if(!open||!valid||!campaign?.id||campaign.status!=="active"||campaign.preview_only)return;
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
          onError:()=>{if(!cancelled){setStatus("error");setError("PayPal reported an error. If you approved a payment, check your receipt or donation history before retrying.");}},
          onCancel:()=>{if(!cancelled)setStatus("ready");},
          style:{layout:"vertical",shape:"rect",label:"paypal"},
        });
        if(paypalHost.current)await buttons.render(paypalHost.current);
        if(typeof paypal.CardFields==="function"){
          const card=paypal.CardFields({
            createOrder:()=>begin("card"),onApprove,
            onError:()=>{if(!cancelled){setStatus("error");setError("Card checkout reported an error. If you approved a payment, check your receipt or donation history before retrying.");}},
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
  },[open,campaign?.id,campaign?.status,campaign?.preview_only,gift,tip,valid]);
  const field="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return <Dialog open={open} onOpenChange={value=>{
    if(!value&&status==="capturing")return;
    if(!value){tokens.current.clear();keys.current.clear();checkoutTokens.current.clear();setComplete(false);setError("");}
    onOpenChange?.(value);
  }}>
    <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-[#dce4f2] bg-white p-0 shadow-[0_24px_80px_rgba(0,48,135,.2)] sm:max-h-[min(90dvh,52rem)] sm:max-w-xl">
      <DialogHeader className="space-y-3 border-b border-[#e5ebf5] bg-gradient-to-b from-[#f2f7ff] to-white px-5 pb-5 pt-6 text-left sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#003087]"><HandHeart className="h-4 w-4" /> Interplanetary Fund</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c5d6ee] bg-white px-3 py-1 text-[11px] font-semibold text-[#003087]"><LockKeyhole className="h-3.5 w-3.5" /> Secure checkout by PayPal</span>
        </div>
        <DialogTitle className="pr-9 text-xl font-bold leading-snug text-[#11264b] sm:text-2xl">Support {campaign?.title || "this campaign"}</DialogTitle>
        <DialogDescription className="text-sm text-slate-600">Review your entire payment before approving it securely with PayPal. No IFund account is needed.</DialogDescription>
      </DialogHeader>
      {complete?<div role="status" className="m-5 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <p className="font-bold"><CircleCheck className="mr-2 inline h-5 w-5" />Donation verified with PayPal and recorded. Thank you!</p>
        <p className="text-sm">Signed-in donors can find their verified campaign receipts in My Giving. Guest donations remain private and are not automatically assigned to an account.</p>
        <Link to="/giving" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100">View My Giving</Link>
      </div>:
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
        <label className="flex items-start gap-3 rounded-xl border border-[#dbe6f5] bg-[#f9fbff] px-4 py-4 text-sm text-[#173764]">
          <input type="checkbox" disabled={checkoutLocked} className="mt-1 h-4 w-4 accent-cyan-600" checked={support} onChange={e=>setSupport(e.target.checked)}/>
          <span className="font-semibold">Add 10% optional support for Interplanetary Fund <span className="mt-1 block text-xs font-normal text-slate-600">Entirely optional, separate from the campaign donation; unchecked by default.</span></span>
        </label>
        {valid&&<section aria-label="Your PayPal payment summary" aria-live="polite" className="overflow-hidden rounded-2xl border border-[#c9d9f1] bg-[#f6f9ff] text-sm text-[#183153] shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dce6f5] bg-white px-4 py-3">
            <h3 className="font-bold text-[#003087]">Your payment summary</h3>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#127549]"><CircleCheck className="h-3.5 w-3.5" /> Reviewed before payment</span>
          </div>
          <dl className="space-y-2 px-4 py-4">
            <div className="flex justify-between gap-4"><dt>Campaign donation</dt><dd className="font-semibold tabular-nums">{"$"+(gift/100).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Optional IFund platform support</dt><dd className="font-semibold tabular-nums">{"$"+(tip/100).toFixed(2)}</dd></div>
            <div className="flex justify-between gap-4"><dt>PayPal processing surcharge</dt><dd className="font-semibold tabular-nums">$0.00</dd></div>
            <div className="flex justify-between gap-4 border-t border-[#c9d9f1] pt-3 text-base font-extrabold text-[#003087]"><dt>Total you approve in PayPal</dt><dd className="tabular-nums">{"$"+((quote?.totalCents ?? gift+tip)/100).toFixed(2)} USD</dd></div>
          </dl>
          <p className="border-t border-[#dce6f5] bg-white px-4 py-3 text-xs leading-relaxed text-slate-600">IFund covers payment processing costs. The existing 7% IFund platform fee is deducted from the organizer's eligible withdrawal, not charged again to you. PayPal will display the same donation and optional support items for your approval.</p>
        </section>}
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
              <div className="space-y-1 text-center"><h3 className="text-sm font-bold text-[#003087]">Pay securely with PayPal</h3><p className="text-xs text-slate-600">You will approve {"$"+((quote?.totalCents ?? gift+tip)/100).toFixed(2)} USD before any capture.</p></div>
              {eligible===true&&<button type="button" className="min-h-12 w-full rounded-xl bg-[#003087] px-4 font-semibold text-white shadow-sm hover:bg-[#002466] disabled:opacity-50"
                disabled={status!=="ready"||!eligible}
                onClick={async()=>{setError("");try{await cardSession.current.submit();}catch(_){setError("Card checkout could not be confirmed. If you approved a payment, check your receipt or donation history before retrying.");}}}>
                {status==="capturing"?"Verifying donation…":"Pay by debit or credit card"}
              </button>}
              <div ref={paypalHost} aria-label="Eligible PayPal payment buttons" className="min-h-[44px]"/>
              <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#003087]"/> Checkout and card fields securely provided by PayPal. Your payment details are never stored by IFund.</p>
            </section>
          </>}
        {status==="capturing"&&<p role="status">Verifying PayPal capture and saving your donation… Please keep checkout open.</p>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
