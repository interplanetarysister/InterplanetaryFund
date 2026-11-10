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
  if(!response.ok||data.ok===false) throw new Error(data.error||"Payment API unavailable");
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
  const cardSession=useRef(null), tokens=useRef(new Map()), keys=useRef(new Map()), latestPaid=useRef(onPaid);
  useEffect(()=>{latestPaid.current=onPaid;});
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
    const data=await api("/api/payments/create-order",{method:"POST",body:JSON.stringify({
      campaign_id:campaign.id,gift_cents:gift,optional_support_cents:tip,
      payment_channel:channel,request_key:requestKey(channel),
    })});
    if(!data.id||!data.checkout_token||data.environment!=="live")throw new Error("Invalid payment intent");
    tokens.current.set(data.id,data.checkout_token);
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
        if(cancelled||config.environment!=="live"||!config.client_id)return;
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
    if(!value){tokens.current.clear();keys.current.clear();setComplete(false);setError("");}
    onOpenChange?.(value);
  }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Donate to this campaign</DialogTitle>
        <DialogDescription>Pay by card or PayPal. No iFund account is required.</DialogDescription>
      </DialogHeader>
      {complete?<p role="status" className="rounded-lg bg-emerald-50 p-4 font-semibold text-emerald-800">Donation verified and recorded. Thank you!</p>:
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[5,10,25,50].map(value=><button key={value} className="min-h-10 rounded-lg border border-slate-300 font-semibold" onClick={()=>setAmount(String(value))}>{"$"+value}</button>)}
        </div>
        <label className="block text-sm font-medium">Donation amount (USD)
          <input type="number" className={field} min="1" max="1000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/>
        </label>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={support} onChange={e=>setSupport(e.target.checked)}/> Add 10% optional iFund support</label>
        {valid&&<p className="text-xs text-slate-600">{"Campaign gift: $"+(gift/100).toFixed(2)+(support?" · Optional support: $"+(tip/100).toFixed(2):"")+". PayPal confirms the final total before payment."}</p>}
        {!valid?<p className="text-xs text-red-700">Enter a gift of at least $1.</p>:
          <>
            {status==="loading"&&<p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin"/> Loading secure checkout…</p>}
            <section className="space-y-2" aria-label="Credit or debit card checkout" style={{display:eligible===false?"none":"block"}}>
              <h3 className="flex gap-2 items-center text-sm font-semibold"><CreditCard className="h-4 w-4"/> Pay with card — no PayPal login</h3>
              <label className="block text-xs">Name on card<div ref={nameHost} className={field}/></label>
              <label className="block text-xs">Card number<div ref={numberHost} className={field}/></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs">Expiration<div ref={expiryHost} className={field}/></label>
                <label className="block text-xs">Security code<div ref={cvvHost} className={field}/></label>
              </div>
              <button className="min-h-12 w-full rounded-lg bg-blue-700 font-semibold text-white disabled:opacity-50"
                disabled={status!=="ready"||!eligible}
                onClick={async()=>{setError("");try{await cardSession.current.submit();}catch(_){setError("Card payment failed. Check the details or use PayPal.");}}}>
                {status==="capturing"?"Verifying donation…":"Donate securely with card"}
              </button>
            </section>
            {eligible===false&&<p className="text-xs text-slate-500">Embedded card payment is unavailable for this account or device. PayPal may still offer guest card checkout.</p>}
            <h3 className="text-sm font-semibold">PayPal checkout</h3>
            <div ref={paypalHost} aria-label="PayPal buttons"/>
            <p className="flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="h-3 w-3"/> Secure hosted payment. iFund never collects card numbers or CVV.</p>
          </>}
        {status==="capturing"&&<p role="status">Verifying PayPal capture and saving your donation…</p>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
