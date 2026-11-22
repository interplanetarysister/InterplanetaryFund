import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, HeartHandshake, Loader2, ShieldCheck, CircleCheck } from "lucide-react";
import GooglePayDonationButton from "./GooglePayDonationButton";
import { authClient } from "@/api/auth";
import { isNativeBundle } from "@/lib/nativeApi";
let sdkPromise, sdkClient;
function loadPayPal(clientId) {
  if(window.paypal?.Buttons)return Promise.resolve(window.paypal);
  if(sdkPromise)return sdkClient===clientId?sdkPromise:Promise.reject(new Error("Reload checkout: account changed"));
  sdkClient=clientId;
  sdkPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://www.paypal.com/sdk/js?client-id="+encodeURIComponent(clientId)+"&components=buttons,card-fields,googlepay&currency=USD&intent=capture";
    script.async=true;script.onload=()=>window.paypal?.Buttons?resolve(window.paypal):reject(new Error("Secure checkout unavailable."));
    script.onerror=()=>reject(new Error("Secure checkout unavailable."));document.head.appendChild(script);
  }).catch(error=>{sdkPromise=null;sdkClient=null;throw error;});
  return sdkPromise;
}
async function api(path,options={}) {
  const response=await fetch(path,{...options,cache:"no-store",headers:{"content-type":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false)throw new Error(data.error||"Platform donation checkout unavailable.");
  return data;
}
export default function PlatformSupportDonationDialog({open,onOpenChange}) {
  const [amount,setAmount]=useState("10"),[message,setMessage]=useState(""),[status,setStatus]=useState("idle");
  const [error,setError]=useState(""),[eligible,setEligible]=useState(null),[complete,setComplete]=useState(false);
  const paypalHost=useRef(null),numberHost=useRef(null),expiryHost=useRef(null),cvvHost=useRef(null),messageRef=useRef("");
  useEffect(()=>{messageRef.current=message;},[message]);
  const cardSession=useRef(null),tokens=useRef(new Map()),keys=useRef(new Map()),checkoutTokens=useRef(new Map());
  const nativeUnavailable=isNativeBundle();
  const giftCents=/^\d+(?:\.\d{1,2})?$/.test(amount.trim())?Math.round(Number(amount)*100):0;
  const valid=giftCents>=100&&giftCents<=100000000,locked=status==="capturing"||complete;
  const requestKey=channel=>{
    const key=[giftCents,channel,messageRef.current.trim()].join("|");
    if(!keys.current.has(key))keys.current.set(key,crypto.randomUUID().replace(/-/g,""));
    return keys.current.get(key);
  };
  const begin=async channel=>{
    if(!valid)throw new Error("Enter an amount from $1 to $1,000,000.");
    const key=requestKey(channel);let token=checkoutTokens.current.get(key);
    if(!token){token=crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");checkoutTokens.current.set(key,token);}
    const {data,error:sessionError}=await authClient().auth.getSession();
    if(sessionError)throw new Error("Account session could not be checked.");
    const session=data?.session,accessToken=session&&!session.user?.is_anonymous?session.access_token:null;
    const result=await api("/api/payments/create-platform-support-order",{method:"POST",
      headers:accessToken?{"authorization":"Bearer "+accessToken}:{},
      body:JSON.stringify({gift_cents:giftCents,payment_channel:channel,request_key:key,checkout_token:token,support_message:messageRef.current.trim()||null})});
    if(!result.id||result.checkout_token!==token||result.environment!=="live"||result.amount_cents!==giftCents)
      throw new Error("Platform donation needs review. No payment was confirmed.");
    tokens.current.set(result.id,token);return result.id;
  };
  const capture=async data=>{
    const id=data?.orderID,token=tokens.current.get(id);if(!id||!token)throw new Error("Payment needs review.");
    setStatus("capturing");
    const result=await api("/api/payments/capture-platform-support-order",{method:"POST",body:JSON.stringify({order_id:id,checkout_token:token})});
    if(result.ok!==true||result.status!=="captured"||!result.donation_id)throw new Error("Platform donation was not verified.");
    tokens.current.delete(id);setComplete(true);setStatus("complete");
  };
  useEffect(()=>{
    if(nativeUnavailable||!open||!valid)return;
    let cancelled=false,buttons=null;setError("");setStatus("loading");setEligible(null);
    (async()=>{
      try{
        const config=await api("/api/payments/config");if(cancelled)return;
        if(config.environment!=="live"||!config.client_id)throw new Error("Live checkout unavailable.");
        const paypal=await loadPayPal(config.client_id);if(cancelled)return;
        const onApprove=async data=>{try{await capture(data);}catch(e){if(!cancelled){setError(e.message);setStatus("error");}}};
        buttons=paypal.Buttons({createOrder:()=>begin("paypal"),onApprove,
          onError:()=>{if(!cancelled){setError("PayPal reported an error. Check your receipt before retrying.");setStatus("error");}},
          onCancel:()=>{if(!cancelled)setStatus("ready");},style:{layout:"vertical",shape:"rect",label:"paypal"}});
        if(paypalHost.current)await buttons.render(paypalHost.current);
        if(typeof paypal.CardFields==="function"){
          const card=paypal.CardFields({createOrder:()=>begin("card"),onApprove,
            onError:()=>{if(!cancelled){setError("Card checkout reported an error. Check your receipt before retrying.");setStatus("error");}},
            onCancel:()=>{if(!cancelled)setStatus("ready");}});
          if(card.isEligible()){
            cardSession.current=card;
            await Promise.all([card.NumberField().render(numberHost.current),card.ExpiryField().render(expiryHost.current),card.CVVField().render(cvvHost.current)]);
            if(!cancelled)setEligible(true);
          }else if(!cancelled)setEligible(false);
        }else if(!cancelled)setEligible(false);
        if(!cancelled)setStatus("ready");
      }catch(e){if(!cancelled){setError(e.message||"Secure checkout unavailable.");setStatus("error");}}
    })();
    return ()=>{cancelled=true;try{buttons?.close?.();}catch(_){}cardSession.current=null;
      for(const node of [paypalHost.current,numberHost.current,expiryHost.current,cvvHost.current])try{node?.replaceChildren();}catch(_){}};
  },[nativeUnavailable,open,valid,giftCents]);
  if(nativeUnavailable)return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Platform donations are not available in the app yet</DialogTitle><DialogDescription>Open InterplanetaryFund.com to donate. No payment was started.</DialogDescription></DialogHeader>
  </DialogContent></Dialog>;
  const field="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  return <Dialog open={open} onOpenChange={value=>{if(!value&&status==="capturing")return;
    if(!value){tokens.current.clear();keys.current.clear();checkoutTokens.current.clear();setComplete(false);setError("");}
    onOpenChange?.(value);}}>
    <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 sm:max-h-[min(90dvh,48rem)] sm:max-w-xl">
      <DialogHeader className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 pb-5 pt-6 text-left sm:px-6">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-900"><HeartHandshake className="h-4 w-4"/> Interplanetary Fund</p>
        <DialogTitle className="pr-8 text-2xl font-bold">Donate to IFund</DialogTitle>
        <DialogDescription className="text-sm text-slate-600">Support the platform and its community, not a specific campaign. No account or donor name is required.</DialogDescription>
      </DialogHeader>
      {complete?<div role="status" className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <p className="font-bold"><CircleCheck className="mr-2 inline h-5 w-5"/>Your platform donation was verified. Thank you.</p>
        <p className="mt-2 text-sm">Your optional message was delivered privately to the IFund admin team.</p>
      </div>:<div className="space-y-4 px-5 py-5 sm:px-6">
        <div className="space-y-2"><p className="text-sm font-semibold">Choose an amount (USD)</p>
          <div className="grid grid-cols-4 gap-2">{[5,10,25,50].map(v=><button key={v} type="button" disabled={locked} aria-pressed={Number(amount)===v}
            onClick={()=>setAmount(String(v))} className={Number(amount)===v?"min-h-11 rounded-xl border-2 border-cyan-500 bg-cyan-50 font-bold":"min-h-11 rounded-xl border border-slate-300 bg-white font-semibold"}>{"$"+v}</button>)}</div>
          <label className="block space-y-1 text-sm font-semibold">Other amount<input className={field} inputMode="decimal" value={amount} disabled={locked} onChange={e=>setAmount(e.target.value)}/></label>
        </div>
        <label className="block space-y-1 text-sm font-semibold">Message to the IFund team (optional)
          <textarea rows={3} maxLength={500} className={field+" resize-y"} disabled={locked} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Leave a note for the IFund team"/>
          <span className="block text-xs font-normal text-slate-500">Visible only to authorized administrators after your payment is verified.</span>
        </label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-2 font-semibold text-slate-800">Available payment methods</p><p>PayPal, credit/debit card, and Google Pay when eligible.</p>
          <p className="mt-1">Cash App and bank transfer are not enabled for platform donations yet; they will not appear as active payment methods until settlement is verified.</p>
        </div>
        {!valid?<p className="text-xs text-red-700">Enter a valid amount from $1 to $1,000,000.</p>:<>
          {status==="loading"&&<p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-4 w-4 animate-spin"/>Loading secure checkout…</p>}
          <section aria-busy={status==="capturing"} aria-label="Credit or debit card checkout" className="space-y-2 rounded-xl border border-slate-200 p-3" style={{display:eligible===false?"none":"block"}}>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4"/>Credit or debit card</h3>
            <p className="text-xs text-slate-500">Cardholder name is not required by IFund. If your issuer requires billing details, PayPal will request them securely.</p>
            <label className="block text-xs">Card number<div ref={numberHost} className={field}/></label>
            <div className="grid grid-cols-2 gap-2"><label className="block text-xs">Expiration<div ref={expiryHost} className={field}/></label><label className="block text-xs">Security code<div ref={cvvHost} className={field}/></label></div>
            {eligible===true&&<button type="button" disabled={status!=="ready"} onClick={async()=>{setError("");try{await cardSession.current.submit();}catch(_){setError("Card checkout failed. Check your receipt before retrying.");}}}
              className="min-h-12 w-full rounded-xl bg-blue-900 px-4 font-semibold text-white disabled:opacity-50">Pay by debit or credit card</button>}
          </section>
          {eligible===false&&<p className="text-xs text-slate-500">Direct card fields are unavailable on this device; PayPal may still offer guest card checkout.</p>}
          <GooglePayDonationButton campaignId="platform-support" amountCents={giftCents} enabled={status==="ready"&&!locked} begin={begin} capture={capture}/>
          <div ref={paypalHost} aria-label="PayPal checkout button" className="min-h-[44px]"/>
          <p className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-blue-900"/>Payments securely processed by PayPal. IFund never stores card numbers or security codes.</p>
        </>}
        {status==="capturing"&&<p role="status" className="text-xs">Verifying payment and securely delivering your message…</p>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}
